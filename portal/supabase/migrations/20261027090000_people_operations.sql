-- Reversible enrollment lifecycle: withdraw and reopen with audit trail.
-- Only the enrollment status columns change; deadlines are never touched.

create function private.change_enrollment_status(
  target_enrollment_id uuid,
  target_reason text,
  required_status public.enrollment_status,
  next_status public.enrollment_status,
  audit_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  enrollment_record public.enrollments%rowtype;
  previous_changed_at timestamptz;
begin
  actor_profile_id := private.current_profile_id();

  if coalesce(char_length(btrim(target_reason)), 0) = 0 then
    raise exception using
      errcode = '22023',
      message = 'ENROLLMENT_REASON_REQUIRED';
  end if;

  select * into enrollment_record
  from public.enrollments
  where id = target_enrollment_id
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'ENROLLMENT_NOT_FOUND';
  end if;

  if actor_profile_id is null
    or not (
      private.is_administrator()
      or private.has_course_role(
        enrollment_record.course_run_id,
        array['course_lead'::public.portal_role]
      )
    )
  then
    raise exception using
      errcode = '42501',
      message = 'ENROLLMENT_STATUS_FORBIDDEN';
  end if;

  if enrollment_record.status <> required_status then
    raise exception using
      errcode = '22023',
      message = 'ENROLLMENT_INVALID_TRANSITION';
  end if;

  previous_changed_at := enrollment_record.status_changed_at;

  update public.enrollments
  set
    status = next_status,
    status_changed_at = now(),
    status_reason = btrim(target_reason)
  where id = target_enrollment_id;

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    reason,
    before_data,
    after_data
  )
  values (
    actor_profile_id,
    audit_action,
    'enrollment',
    target_enrollment_id::text,
    btrim(target_reason),
    jsonb_build_object(
      'status', enrollment_record.status,
      'statusChangedAt', previous_changed_at,
      'statusReason', enrollment_record.status_reason
    ),
    jsonb_build_object(
      'status', next_status,
      'statusChangedAt', now(),
      'statusReason', btrim(target_reason)
    )
  );
end;
$$;

create function public.withdraw_enrollment(
  target_enrollment_id uuid,
  target_reason text
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.change_enrollment_status(
    target_enrollment_id,
    target_reason,
    'active'::public.enrollment_status,
    'withdrawn'::public.enrollment_status,
    'enrollment.withdrawn'
  );
$$;

create function public.reopen_enrollment(
  target_enrollment_id uuid,
  target_reason text
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.change_enrollment_status(
    target_enrollment_id,
    target_reason,
    'withdrawn'::public.enrollment_status,
    'active'::public.enrollment_status,
    'enrollment.reopened'
  );
$$;

revoke all on function private.change_enrollment_status(
  uuid, text, public.enrollment_status, public.enrollment_status, text
) from public, anon, authenticated;

revoke all on function public.withdraw_enrollment(uuid, text)
  from public, anon, authenticated;
revoke all on function public.reopen_enrollment(uuid, text)
  from public, anon, authenticated;

grant execute on function public.withdraw_enrollment(uuid, text) to authenticated;
grant execute on function public.reopen_enrollment(uuid, text) to authenticated;
