create table public.pace_plans (
  id uuid primary key default gen_random_uuid(),
  course_run_id uuid not null references public.course_runs(id) on delete restrict,
  green_lag integer not null default 5
    constraint pace_plans_green_lag_nonnegative check (green_lag >= 0),
  red_lag integer not null default 15,
  version integer not null default 1
    constraint pace_plans_version_positive check (version > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint pace_plans_red_gte_green check (red_lag >= green_lag),
  constraint pace_plans_version_unique unique (course_run_id, version)
);

create table public.pace_milestones (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.pace_plans(id) on delete cascade,
  at timestamptz not null,
  percent integer not null
    constraint pace_milestones_percent_valid check (percent between 0 and 100),
  constraint pace_milestones_at_unique unique (plan_id, at)
);

create function private.validate_pace_milestone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.pace_milestones as milestone
    where milestone.plan_id = new.plan_id
      and milestone.id <> new.id
      and (
        (milestone.at <= new.at and milestone.percent >= new.percent)
        or (milestone.at >= new.at and milestone.percent <= new.percent)
      )
  ) then
    raise exception using
      errcode = '22023',
      message = 'PACE_MILESTONES_NOT_STRICTLY_INCREASING';
  end if;

  return new;
end;
$$;

create trigger pace_milestones_validate
before insert or update on public.pace_milestones
for each row execute function private.validate_pace_milestone();

revoke all on function private.validate_pace_milestone() from public, anon, authenticated;

alter table public.pace_plans enable row level security;
alter table public.pace_milestones enable row level security;

revoke all on table public.pace_plans from anon, authenticated;
revoke all on table public.pace_milestones from anon, authenticated;

-- Plan versions are immutable: new thresholds mean a new version, so only
-- select and insert are granted.
grant select, insert on table public.pace_plans to authenticated;
grant select, insert on table public.pace_milestones to authenticated;

create policy pace_plans_staff_select
on public.pace_plans
for select
to authenticated
using (
  (select private.is_administrator())
  or private.has_course_role(
    course_run_id,
    array['course_teacher', 'course_lead']::public.portal_role[]
  )
);

create policy pace_plans_lead_insert
on public.pace_plans
for insert
to authenticated
with check (
  (
    (select private.is_administrator())
    or private.has_course_role(
      course_run_id,
      array['course_lead']::public.portal_role[]
    )
  )
  and created_by = (select private.current_profile_id())
);

create policy pace_milestones_staff_select
on public.pace_milestones
for select
to authenticated
using (
  exists (
    select 1
    from public.pace_plans as plan
    where plan.id = pace_milestones.plan_id
      and (
        (select private.is_administrator())
        or private.has_course_role(
          plan.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy pace_milestones_lead_insert
on public.pace_milestones
for insert
to authenticated
with check (
  exists (
    select 1
    from public.pace_plans as plan
    where plan.id = pace_milestones.plan_id
      and (
        (select private.is_administrator())
        or private.has_course_role(
          plan.course_run_id,
          array['course_lead']::public.portal_role[]
        )
      )
  )
);
