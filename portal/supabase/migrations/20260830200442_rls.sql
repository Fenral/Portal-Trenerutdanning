create function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select account.profile_id
  from public.user_accounts as account
  where account.user_id = (select auth.uid())
    and account.is_active
  limit 1
$$;

create function private.has_global_role(target_role public.portal_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.role_assignments as assignment
      where assignment.profile_id = private.current_profile_id()
        and assignment.role = target_role
        and assignment.course_template_id is null
        and assignment.course_run_id is null
        and assignment.revoked_at is null
    )
$$;

create function private.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and private.has_global_role('administrator'::public.portal_role)
$$;

create function private.has_course_role(
  target_course_run_id uuid,
  allowed_roles public.portal_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and target_course_run_id is not null
    and coalesce(cardinality(allowed_roles), 0) > 0
    and exists (
      select 1
      from public.role_assignments as assignment
      join public.course_runs as course_run
        on course_run.id = target_course_run_id
      where assignment.profile_id = private.current_profile_id()
        and assignment.role = any(allowed_roles)
        and assignment.revoked_at is null
        and (
          assignment.course_run_id = target_course_run_id
          or assignment.course_template_id = course_run.template_id
        )
    )
$$;

create function private.is_enrolled(target_course_run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and target_course_run_id is not null
    and exists (
      select 1
      from public.enrollments as enrollment
      where enrollment.profile_id = private.current_profile_id()
        and enrollment.course_run_id = target_course_run_id
        and enrollment.status in ('active', 'completed')
    )
$$;

revoke all on function private.current_profile_id() from public, anon, authenticated;
revoke all on function private.has_global_role(public.portal_role) from public, anon, authenticated;
revoke all on function private.is_administrator() from public, anon, authenticated;
revoke all on function private.has_course_role(uuid, public.portal_role[]) from public, anon, authenticated;
revoke all on function private.is_enrolled(uuid) from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.current_profile_id() to authenticated;
grant execute on function private.has_global_role(public.portal_role) to authenticated;
grant execute on function private.is_administrator() to authenticated;
grant execute on function private.has_course_role(uuid, public.portal_role[]) to authenticated;
grant execute on function private.is_enrolled(uuid) to authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.course_templates to authenticated;
grant select on table public.course_runs to authenticated;
grant select on table public.course_sessions to authenticated;
grant select on table public.role_assignments to authenticated;
grant select on table public.enrollments to authenticated;

create policy profiles_self_or_course_staff_select
on public.profiles
for select
to authenticated
using (
  id = (select private.current_profile_id())
  or (select private.is_administrator())
  or exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.profile_id = profiles.id
      and private.has_course_role(
        enrollment.course_run_id,
        array['course_teacher', 'course_lead']::public.portal_role[]
      )
  )
);

create policy course_templates_scoped_select
on public.course_templates
for select
to authenticated
using (
  (select private.is_administrator())
  or (select private.has_global_role('editor'::public.portal_role))
  or exists (
    select 1
    from public.course_runs as course_run
    where course_run.template_id = course_templates.id
  )
);

create policy course_runs_scoped_select
on public.course_runs
for select
to authenticated
using (
  (select private.is_administrator())
  or (select private.has_global_role('editor'::public.portal_role))
  or private.is_enrolled(id)
  or private.has_course_role(
    id,
    array['course_teacher', 'course_lead']::public.portal_role[]
  )
);

create policy course_sessions_scoped_select
on public.course_sessions
for select
to authenticated
using (
  (select private.is_administrator())
  or (select private.has_global_role('editor'::public.portal_role))
  or private.is_enrolled(course_run_id)
  or private.has_course_role(
    course_run_id,
    array['course_teacher', 'course_lead']::public.portal_role[]
  )
);

create policy role_assignments_self_or_admin_select
on public.role_assignments
for select
to authenticated
using (
  profile_id = (select private.current_profile_id())
  or (select private.is_administrator())
);

create policy enrollments_self_or_course_staff_select
on public.enrollments
for select
to authenticated
using (
  profile_id = (select private.current_profile_id())
  or (select private.is_administrator())
  or private.has_course_role(
    course_run_id,
    array['course_teacher', 'course_lead']::public.portal_role[]
  )
);
