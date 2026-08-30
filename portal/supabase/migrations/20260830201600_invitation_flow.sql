alter table public.invitations
add constraint invitations_course_role_allowed
check (role in ('student', 'course_teacher', 'course_lead'));

alter table public.invitations
add constraint invitations_token_hash_format
check (token_hash ~ '^[a-f0-9]{64}$');

create function public.create_course_invitation(
  target_course_run_id uuid,
  target_email text,
  target_role public.portal_role,
  target_token_hash text,
  target_expires_at timestamptz,
  target_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  new_invitation_id uuid := gen_random_uuid();
  safe_email text := lower(btrim(target_email));
begin
  actor_profile_id := private.current_profile_id();

  if actor_profile_id is null
    or not (
      private.is_administrator()
      or private.has_course_role(
        target_course_run_id,
        array['course_lead']::public.portal_role[]
      )
    )
  then
    raise exception using
      errcode = '42501',
      message = 'INVITATION_CREATE_FORBIDDEN';
  end if;

  if target_role not in ('student', 'course_teacher', 'course_lead') then
    raise exception using
      errcode = '22023',
      message = 'INVITATION_ROLE_INVALID';
  end if;

  if target_token_hash is null
    or target_token_hash !~ '^[a-f0-9]{64}$'
  then
    raise exception using
      errcode = '22023',
      message = 'INVITATION_TOKEN_HASH_INVALID';
  end if;

  if target_expires_at is null or target_expires_at <= now() then
    raise exception using
      errcode = '22023',
      message = 'INVITATION_EXPIRY_INVALID';
  end if;

  insert into public.invitations (
    id,
    normalized_email,
    token_hash,
    course_run_id,
    role,
    expires_at,
    created_by
  )
  values (
    new_invitation_id,
    safe_email,
    target_token_hash,
    target_course_run_id,
    target_role,
    target_expires_at,
    actor_profile_id
  );

  insert into public.outbox_events (
    event_type,
    idempotency_key,
    payload
  )
  values (
    'invitation.email',
    'invitation.email:' || new_invitation_id::text,
    jsonb_build_object('invitationId', new_invitation_id)
  );

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    correlation_id,
    after_data
  )
  values (
    actor_profile_id,
    'invitation.created',
    'invitation',
    new_invitation_id::text,
    target_correlation_id,
    jsonb_build_object(
      'courseRunId', target_course_run_id,
      'role', target_role::text
    )
  );

  return new_invitation_id;
end;
$$;

create function public.inspect_course_invitation(
  target_token_hash text,
  inspected_at timestamptz default now()
)
returns table (
  invitation_id uuid,
  normalized_email text,
  expires_at timestamptz,
  claim_state text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    invitation.id,
    invitation.normalized_email,
    invitation.expires_at,
    case
      when invitation.claimed_at is not null then 'already_claimed'
      when invitation.expires_at <= inspected_at then 'expired'
      else 'valid'
    end
  from public.invitations as invitation
  where invitation.token_hash = target_token_hash
    and target_token_hash ~ '^[a-f0-9]{64}$'
  limit 1
$$;

create function public.claim_course_invitation(
  target_token_hash text,
  target_correlation_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  authenticated_email text;
  authenticated_email_confirmed_at timestamptz;
  display_name text;
  invited public.invitations%rowtype;
  target_profile_id uuid;
  destination text;
begin
  select
    lower(btrim(app_user.email)),
    app_user.email_confirmed_at,
    nullif(btrim(app_user.raw_user_meta_data ->> 'full_name'), '')
  into authenticated_email, authenticated_email_confirmed_at, display_name
  from auth.users as app_user
  where app_user.id = current_user_id;

  if current_user_id is null or authenticated_email is null then
    raise exception using
      errcode = '28000',
      message = 'INVITATION_IDENTITY_INVALID';
  end if;

  if authenticated_email_confirmed_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVITATION_EMAIL_UNVERIFIED';
  end if;

  select invitation.*
  into invited
  from public.invitations as invitation
  where invitation.token_hash = target_token_hash
    and target_token_hash ~ '^[a-f0-9]{64}$'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'INVITATION_INVALID';
  end if;

  if invited.claimed_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'INVITATION_ALREADY_CLAIMED';
  end if;

  if invited.expires_at <= now() then
    raise exception using
      errcode = 'P0001',
      message = 'INVITATION_EXPIRED';
  end if;

  if invited.normalized_email <> authenticated_email then
    raise exception using
      errcode = 'P0001',
      message = 'INVITATION_EMAIL_MISMATCH';
  end if;

  select profile.id
  into target_profile_id
  from public.profiles as profile
  where profile.normalized_email = invited.normalized_email
  for update;

  if target_profile_id is null then
    if display_name is null or char_length(display_name) < 2 then
      display_name := split_part(invited.normalized_email, '@', 1);
    end if;

    if char_length(display_name) < 2 then
      display_name := 'Student';
    end if;

    insert into public.profiles (display_name, normalized_email)
    values (display_name, invited.normalized_email)
    returning id into target_profile_id;
  end if;

  if exists (
    select 1
    from public.user_accounts as account
    where account.profile_id = target_profile_id
      and account.user_id <> current_user_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVITATION_PROFILE_ALREADY_LINKED';
  end if;

  insert into public.user_accounts (
    user_id,
    profile_id,
    normalized_email,
    is_active
  )
  values (
    current_user_id,
    target_profile_id,
    invited.normalized_email,
    true
  )
  on conflict (user_id) do update
  set
    is_active = true,
    normalized_email = excluded.normalized_email
  where public.user_accounts.profile_id = excluded.profile_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'INVITATION_ACCOUNT_CONFLICT';
  end if;

  insert into public.enrollments (
    course_run_id,
    profile_id,
    status,
    status_changed_at,
    status_reason
  )
  values (
    invited.course_run_id,
    target_profile_id,
    'active',
    now(),
    'invitation_claimed'
  )
  on conflict (course_run_id, profile_id) do update
  set
    status = 'active',
    status_changed_at = excluded.status_changed_at,
    status_reason = excluded.status_reason;

  if not exists (
    select 1
    from public.role_assignments as assignment
    where assignment.profile_id = target_profile_id
      and assignment.role = invited.role
      and assignment.course_run_id = invited.course_run_id
      and assignment.revoked_at is null
  ) then
    insert into public.role_assignments (
      profile_id,
      role,
      course_run_id,
      granted_by
    )
    values (
      target_profile_id,
      invited.role,
      invited.course_run_id,
      invited.created_by
    );
  end if;

  update public.invitations
  set
    claimed_by = target_profile_id,
    claimed_at = now()
  where id = invited.id;

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    correlation_id,
    after_data
  )
  values (
    target_profile_id,
    'invitation.claimed',
    'invitation',
    invited.id::text,
    target_correlation_id,
    jsonb_build_object(
      'courseRunId', invited.course_run_id,
      'role', invited.role::text
    )
  );

  destination := case
    when invited.role = 'student' then '/student'
    else '/teacher'
  end;

  return destination;
end;
$$;

create function public.mark_invitation_delivery(
  delivery_invitation_id uuid,
  delivery_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_was_updated boolean;
begin
  update public.outbox_events
  set
    status = 'delivered',
    delivered_at = coalesce(delivered_at, now()),
    last_error_code = null
  where idempotency_key = 'invitation.email:' || delivery_invitation_id::text
    and event_type = 'invitation.email'
    and status <> 'delivered';

  delivery_was_updated := found;

  if not delivery_was_updated and not exists (
    select 1
    from public.outbox_events as event
    where event.idempotency_key = 'invitation.email:' || delivery_invitation_id::text
      and event.event_type = 'invitation.email'
      and event.status = 'delivered'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVITATION_DELIVERY_NOT_FOUND';
  end if;

  if not delivery_was_updated then
    return;
  end if;

  insert into public.audit_events (
    action,
    entity_type,
    entity_id,
    correlation_id
  )
  values (
    'invitation.email_delivered',
    'invitation',
    delivery_invitation_id::text,
    delivery_correlation_id
  );
end;
$$;

revoke all on function public.create_course_invitation(
  uuid,
  text,
  public.portal_role,
  text,
  timestamptz,
  uuid
) from public, anon, authenticated;
revoke all on function public.inspect_course_invitation(text, timestamptz)
from public, anon, authenticated;
revoke all on function public.claim_course_invitation(text, uuid)
from public, anon, authenticated;
revoke all on function public.mark_invitation_delivery(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.create_course_invitation(
  uuid,
  text,
  public.portal_role,
  text,
  timestamptz,
  uuid
) to authenticated;
grant execute on function public.claim_course_invitation(text, uuid)
to authenticated;
grant execute on function public.inspect_course_invitation(text, timestamptz)
to service_role;
grant execute on function public.mark_invitation_delivery(uuid, uuid)
to service_role;
