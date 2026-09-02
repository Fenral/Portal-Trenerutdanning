-- 1:1-meldinger lærer/kursleder <-> egen deltaker (Inbox).
-- Append-only: authenticated har KUN select; all skriving går via
-- public.send_message (security definer med eksplisitt autorisasjon),
-- og read_at settes kun av mottaker via public.mark_messages_read.
-- Kursrom/gruppechat er eksplisitt utenfor scope (produkteier-beslutning).

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  course_run_id uuid not null references public.course_runs(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete restrict,
  recipient_profile_id uuid not null references public.profiles(id) on delete restrict,
  body text not null
    constraint messages_body_length
    check (char_length(btrim(body)) >= 1 and char_length(body) <= 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_distinct_parties
    check (sender_profile_id <> recipient_profile_id)
);

-- course_run_id utledes alltid fra enrollment i send_message (eneste
-- skrivevei), så kolonnene kan ikke drifte fra hverandre.

create index messages_enrollment_created_idx
  on public.messages (enrollment_id, created_at);

create index messages_recipient_unread_idx
  on public.messages (recipient_profile_id)
  where read_at is null;

alter table public.messages enable row level security;

revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to authenticated;

-- Avsender og mottaker leser egne tråder; ingen andre (heller ikke admin).
create policy messages_participants_select
on public.messages
for select
to authenticated
using (
  sender_profile_id = (select private.current_profile_id())
  or recipient_profile_id = (select private.current_profile_id())
);

-- Som private.has_course_role, men for en vilkårlig profil (mottakersjekk
-- fra studentens sesjon, der role_assignments-RLS ellers skjuler raden).
create function private.profile_has_course_role(
  target_profile_id uuid,
  target_course_run_id uuid,
  allowed_roles public.portal_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_profile_id is not null
    and target_course_run_id is not null
    and exists (
      select 1
      from public.role_assignments as assignment
      join public.course_runs as course_run
        on course_run.id = target_course_run_id
      where assignment.profile_id = target_profile_id
        and assignment.role = any(allowed_roles)
        and assignment.revoked_at is null
        and (
          assignment.course_run_id = target_course_run_id
          or assignment.course_template_id = course_run.template_id
        )
    )
$$;

-- Sender en 1:1-melding og køer message_received-varsel i outbox.
-- Regler:
--   * Lærer/kursleder kan sende KUN til deltaker med AKTIV enrollment i
--     kurs de har rolle i; mottaker må være deltakeren selv.
--   * Student kan svare KUN via egen enrollment (active/completed) og KUN
--     til lærer/kursleder i det kurset.
--   * Ingen andre (editor, admin, fremmede) kan sende.
-- Varsel-e-posten får aldri meldingsteksten; payload bærer kun id-er.
-- Idempotens: maks ett varsel per tråd/mottaker per Oslo-dag.
create function public.send_message(
  target_enrollment_id uuid,
  target_recipient_profile_id uuid,
  target_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  enrollment_record public.enrollments%rowtype;
  staff_roles constant public.portal_role[] :=
    array['course_teacher', 'course_lead']::public.portal_role[];
  actor_is_staff boolean;
  message_id uuid;
  notification_key text;
begin
  actor_profile_id := private.current_profile_id();

  select enrollment.*
  into enrollment_record
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id;

  if actor_profile_id is null
    or target_recipient_profile_id is null
    or enrollment_record.id is null
    or target_recipient_profile_id = actor_profile_id
  then
    raise exception using
      errcode = '42501',
      message = 'MESSAGE_FORBIDDEN';
  end if;

  if target_body is null
    or char_length(btrim(target_body)) < 1
    or char_length(target_body) > 4000
  then
    raise exception using
      errcode = '22023',
      message = 'MESSAGE_BODY_INVALID';
  end if;

  actor_is_staff := private.has_course_role(
    enrollment_record.course_run_id,
    staff_roles
  );

  if actor_is_staff then
    -- Lærer-/lederleg: mottaker må være deltakeren på enrollmenten.
    if target_recipient_profile_id <> enrollment_record.profile_id then
      raise exception using
        errcode = '42501',
        message = 'MESSAGE_FORBIDDEN';
    end if;
    if enrollment_record.status <> 'active' then
      raise exception using
        errcode = '22023',
        message = 'MESSAGE_ENROLLMENT_INACTIVE';
    end if;
  elsif actor_profile_id = enrollment_record.profile_id then
    -- Studentleg: egen enrollment, svar kun til kursets lærer/leder.
    if enrollment_record.status not in ('active', 'completed')
      or not private.profile_has_course_role(
        target_recipient_profile_id,
        enrollment_record.course_run_id,
        staff_roles
      )
    then
      raise exception using
        errcode = '42501',
        message = 'MESSAGE_FORBIDDEN';
    end if;
  else
    raise exception using
      errcode = '42501',
      message = 'MESSAGE_FORBIDDEN';
  end if;

  insert into public.messages (
    course_run_id,
    enrollment_id,
    sender_profile_id,
    recipient_profile_id,
    body
  )
  values (
    enrollment_record.course_run_id,
    target_enrollment_id,
    actor_profile_id,
    target_recipient_profile_id,
    target_body
  )
  returning id into message_id;

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id
  )
  values (
    actor_profile_id,
    'message.sent',
    'message',
    message_id::text
  );

  notification_key := 'message_received:' || target_enrollment_id::text
    || ':' || target_recipient_profile_id::text
    || ':' || to_char(now() at time zone 'Europe/Oslo', 'YYYY-MM-DD');

  insert into public.outbox_events (event_type, idempotency_key, payload)
  values (
    'notification.email',
    notification_key,
    jsonb_build_object(
      'template', 'message_received',
      'enrollmentId', target_enrollment_id,
      'recipientProfileId', target_recipient_profile_id
    )
  )
  on conflict (idempotency_key) do nothing;

  return message_id;
end;
$$;

-- Mottaker markerer tråden som lest; kan per konstruksjon kun berøre
-- meldinger adressert til innlogget profil. Returnerer antall oppdatert.
create function public.mark_messages_read(
  target_enrollment_id uuid,
  target_counterpart_profile_id uuid
)
returns integer
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.messages
    set read_at = now()
    where enrollment_id = target_enrollment_id
      and recipient_profile_id = private.current_profile_id()
      and sender_profile_id = target_counterpart_profile_id
      and read_at is null
    returning 1
  )
  select count(*)::integer from updated;
$$;

-- Motparter i egne tråder (kun id + visningsnavn), for studentens trådliste
-- der profiles-RLS ellers skjuler lærerprofiler. Lekker ingenting utover
-- navn på personer man allerede utveksler meldinger med.
create function public.message_thread_counterparts()
returns table (profile_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct profiles.id, profiles.display_name
  from public.messages as message
  join public.profiles as profiles
    on profiles.id = case
      when message.sender_profile_id = private.current_profile_id()
        then message.recipient_profile_id
      else message.sender_profile_id
    end
  where private.current_profile_id()
    in (message.sender_profile_id, message.recipient_profile_id)
$$;

revoke all on function private.profile_has_course_role(uuid, uuid, public.portal_role[])
from public, anon, authenticated;
revoke all on function public.send_message(uuid, uuid, text)
from public, anon, authenticated;
revoke all on function public.mark_messages_read(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.message_thread_counterparts()
from public, anon, authenticated;

grant execute on function private.profile_has_course_role(uuid, uuid, public.portal_role[])
to authenticated;
grant execute on function public.send_message(uuid, uuid, text)
to authenticated;
grant execute on function public.mark_messages_read(uuid, uuid)
to authenticated;
grant execute on function public.message_thread_counterparts()
to authenticated;
