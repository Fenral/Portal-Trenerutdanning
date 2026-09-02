-- Idempotente varsler: planlagte påminnelser, leveringssporing og worker-RPC-er
-- rundt den eksisterende public.outbox_events-tabellen.

create table public.scheduled_reminders (
  id uuid primary key default gen_random_uuid(),
  course_run_id uuid not null references public.course_runs(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade,
  remind_at timestamptz not null,
  idempotency_key text not null
    constraint scheduled_reminders_idempotency_key_not_blank
    check (char_length(btrim(idempotency_key)) > 0),
  enqueued_at timestamptz,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint scheduled_reminders_idempotency_key_unique unique (idempotency_key)
);

create index scheduled_reminders_due_idx
  on public.scheduled_reminders (remind_at)
  where enqueued_at is null;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  outbox_event_id uuid not null references public.outbox_events(id) on delete cascade,
  provider_message_id text,
  attempts smallint not null default 0
    constraint notification_deliveries_attempts_nonnegative
    check (attempts >= 0),
  next_retry_at timestamptz,
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_outbox_event_unique unique (outbox_event_id)
);

create table public.notification_incidents (
  id uuid primary key default gen_random_uuid(),
  outbox_event_id uuid not null references public.outbox_events(id) on delete cascade,
  last_error_code text,
  created_at timestamptz not null default now(),
  constraint notification_incidents_outbox_event_unique unique (outbox_event_id)
);

alter table public.scheduled_reminders enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_incidents enable row level security;

revoke all on table public.scheduled_reminders from anon, authenticated;
revoke all on table public.notification_deliveries from anon, authenticated;
revoke all on table public.notification_incidents from anon, authenticated;

-- Worker-RPC-er (kun service_role).

create function public.claim_notification_events(
  target_event_types text[],
  batch_size integer default 20,
  claim_now timestamptz default now()
)
returns setof public.outbox_events
language sql
security definer
set search_path = ''
as $$
  with claimable as (
    select event.id
    from public.outbox_events as event
    where event.status = 'pending'
      and event.event_type = any(target_event_types)
      and event.available_at <= claim_now
    order by event.available_at, event.created_at
    limit greatest(batch_size, 0)
    for update skip locked
  )
  update public.outbox_events as event
  set
    status = 'processing',
    attempts = event.attempts + 1
  from claimable
  where event.id = claimable.id
  returning event.*;
$$;

create function public.complete_notification_event(
  target_event_id uuid,
  target_provider_message_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_attempts smallint;
begin
  update public.outbox_events
  set
    status = 'delivered',
    delivered_at = now(),
    last_error_code = null
  where id = target_event_id
    and status = 'processing'
  returning attempts into event_attempts;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'NOTIFICATION_EVENT_NOT_PROCESSING';
  end if;

  insert into public.notification_deliveries (
    outbox_event_id,
    provider_message_id,
    attempts,
    next_retry_at,
    delivered_at,
    last_error_code
  )
  values (
    target_event_id,
    target_provider_message_id,
    event_attempts,
    null,
    now(),
    null
  )
  on conflict (outbox_event_id) do update
  set
    provider_message_id = excluded.provider_message_id,
    attempts = excluded.attempts,
    next_retry_at = null,
    delivered_at = excluded.delivered_at,
    last_error_code = null,
    updated_at = now();
end;
$$;

create function public.fail_notification_event(
  target_event_id uuid,
  target_error_code text,
  retry_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_attempts smallint;
  give_up boolean;
begin
  select attempts into event_attempts
  from public.outbox_events
  where id = target_event_id
    and status = 'processing'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'NOTIFICATION_EVENT_NOT_PROCESSING';
  end if;

  give_up := retry_at is null or event_attempts >= 5;

  update public.outbox_events
  set
    status = case when give_up then 'failed' else 'pending' end,
    available_at = case when give_up then available_at else retry_at end,
    last_error_code = target_error_code
  where id = target_event_id;

  insert into public.notification_deliveries (
    outbox_event_id,
    attempts,
    next_retry_at,
    last_error_code
  )
  values (
    target_event_id,
    event_attempts,
    case when give_up then null else retry_at end,
    target_error_code
  )
  on conflict (outbox_event_id) do update
  set
    attempts = excluded.attempts,
    next_retry_at = excluded.next_retry_at,
    last_error_code = excluded.last_error_code,
    updated_at = now();

  if give_up then
    insert into public.notification_incidents (outbox_event_id, last_error_code)
    values (target_event_id, target_error_code)
    on conflict (outbox_event_id) do nothing;
    return 'incident_created';
  end if;

  return 'retry_scheduled';
end;
$$;

create function public.rotate_invitation_token(
  target_invitation_id uuid,
  new_token_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new_token_hash is null or new_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'INVITATION_TOKEN_HASH_INVALID';
  end if;

  update public.invitations
  set token_hash = new_token_hash
  where id = target_invitation_id
    and claimed_at is null;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'INVITATION_ROTATE_INVALID';
  end if;
end;
$$;

-- Manuell påminnelse fra kurslærer/kursleder, idempotent per Oslo-dag.

create function public.enqueue_due_reminder(
  target_enrollment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  enrollment_record public.enrollments%rowtype;
  reminder_key text;
  event_id uuid;
begin
  actor_profile_id := private.current_profile_id();

  select enrollment.*
  into enrollment_record
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id;

  if actor_profile_id is null
    or enrollment_record.id is null
    or not (
      private.is_administrator()
      or private.has_course_role(
        enrollment_record.course_run_id,
        array['course_teacher', 'course_lead']::public.portal_role[]
      )
    )
  then
    raise exception using
      errcode = '42501',
      message = 'REMINDER_FORBIDDEN';
  end if;

  if enrollment_record.status <> 'active' then
    raise exception using
      errcode = '22023',
      message = 'REMINDER_ENROLLMENT_INACTIVE';
  end if;

  reminder_key := 'due_reminder:' || target_enrollment_id::text || ':'
    || to_char(now() at time zone 'Europe/Oslo', 'YYYY-MM-DD');

  insert into public.outbox_events (event_type, idempotency_key, payload)
  values (
    'notification.email',
    reminder_key,
    jsonb_build_object(
      'template', 'due_reminder',
      'enrollmentId', target_enrollment_id
    )
  )
  on conflict (idempotency_key) do nothing;

  if found then
    insert into public.audit_events (
      actor_profile_id,
      action,
      entity_type,
      entity_id
    )
    values (
      actor_profile_id,
      'notification.reminder_requested',
      'enrollment',
      target_enrollment_id::text
    );
  end if;

  select id into event_id
  from public.outbox_events
  where idempotency_key = reminder_key;

  return event_id;
end;
$$;

revoke all on function public.claim_notification_events(text[], integer, timestamptz)
from public, anon, authenticated;
revoke all on function public.complete_notification_event(uuid, text)
from public, anon, authenticated;
revoke all on function public.fail_notification_event(uuid, text, timestamptz)
from public, anon, authenticated;
revoke all on function public.rotate_invitation_token(uuid, text)
from public, anon, authenticated;
revoke all on function public.enqueue_due_reminder(uuid)
from public, anon, authenticated;

grant execute on function public.claim_notification_events(text[], integer, timestamptz)
to service_role;
grant execute on function public.complete_notification_event(uuid, text)
to service_role;
grant execute on function public.fail_notification_event(uuid, text, timestamptz)
to service_role;
grant execute on function public.rotate_invitation_token(uuid, text)
to service_role;
grant execute on function public.enqueue_due_reminder(uuid)
to authenticated;
