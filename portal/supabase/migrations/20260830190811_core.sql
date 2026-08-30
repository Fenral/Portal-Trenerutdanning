create extension if not exists pgcrypto with schema extensions;

create type public.portal_role as enum (
  'student',
  'course_teacher',
  'course_lead',
  'editor',
  'administrator'
);

create type public.enrollment_status as enum (
  'invited',
  'active',
  'withdrawn',
  'completed'
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null
    constraint profiles_display_name_length
    check (char_length(btrim(display_name)) between 2 and 120),
  normalized_email text not null
    constraint profiles_normalized_email_format
    check (
      normalized_email = lower(btrim(normalized_email))
      and char_length(normalized_email) between 3 and 254
      and normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    ),
  phone text,
  club_name text,
  birth_year smallint
    constraint profiles_birth_year_range
    check (birth_year between 1900 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_unique
  on public.profiles (normalized_email);

create table public.user_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  normalized_email text not null
    constraint user_accounts_normalized_email_format
    check (
      normalized_email = lower(btrim(normalized_email))
      and char_length(normalized_email) between 3 and 254
      and normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    ),
  is_active boolean not null default true,
  linked_at timestamptz not null default now(),
  constraint user_accounts_profile_email_unique unique (profile_id, normalized_email)
);

create index user_accounts_profile_id_idx
  on public.user_accounts (profile_id);

create table public.course_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null
    constraint course_templates_code_format
    check (code ~ '^[A-Z][A-Z0-9_-]{0,31}$'),
  title text not null
    constraint course_templates_title_length
    check (char_length(btrim(title)) between 2 and 120),
  level smallint not null
    constraint course_templates_level_range
    check (level between 1 and 3),
  created_at timestamptz not null default now(),
  constraint course_templates_code_unique unique (code)
);

create table public.course_runs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.course_templates(id) on delete restrict,
  title text not null
    constraint course_runs_title_length
    check (char_length(btrim(title)) between 2 and 120),
  start_year smallint not null
    constraint course_runs_start_year_range
    check (start_year between 2020 and 2100),
  location_name text,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'draft'
    constraint course_runs_status_allowed
    check (status in ('draft', 'active', 'closed')),
  created_at timestamptz not null default now(),
  constraint course_runs_date_order check (ends_on >= starts_on)
);

create index course_runs_template_id_idx
  on public.course_runs (template_id);

create table public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  course_run_id uuid not null references public.course_runs(id) on delete cascade,
  title text not null
    constraint course_sessions_title_length
    check (char_length(btrim(title)) between 2 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_text text,
  sort_order smallint not null
    constraint course_sessions_sort_order_positive
    check (sort_order > 0),
  constraint course_sessions_date_order check (ends_at > starts_at),
  constraint course_sessions_run_sort_unique unique (course_run_id, sort_order)
);

create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  role public.portal_role not null,
  course_template_id uuid references public.course_templates(id) on delete cascade,
  course_run_id uuid references public.course_runs(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint role_assignments_scope_allowed check (
    (
      role in ('administrator', 'editor')
      and num_nonnulls(course_template_id, course_run_id) = 0
    )
    or (
      role in ('student', 'course_teacher', 'course_lead')
      and num_nonnulls(course_template_id, course_run_id) = 1
    )
  ),
  constraint role_assignments_revocation_order
    check (revoked_at is null or revoked_at >= granted_at)
);

create unique index role_assignments_active_unique
  on public.role_assignments (
    profile_id,
    role,
    coalesce(course_template_id, '00000000-0000-0000-0000-000000000000'),
    coalesce(course_run_id, '00000000-0000-0000-0000-000000000000')
  )
  where revoked_at is null;

create index role_assignments_profile_id_idx
  on public.role_assignments (profile_id);

create index role_assignments_course_template_id_idx
  on public.role_assignments (course_template_id)
  where course_template_id is not null;

create index role_assignments_course_run_id_idx
  on public.role_assignments (course_run_id)
  where course_run_id is not null;

create index role_assignments_granted_by_idx
  on public.role_assignments (granted_by);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_run_id uuid not null references public.course_runs(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  status public.enrollment_status not null default 'invited',
  status_changed_at timestamptz not null default now(),
  status_reason text,
  constraint enrollments_run_profile_unique unique (course_run_id, profile_id)
);

create index enrollments_profile_id_idx
  on public.enrollments (profile_id);

create index enrollments_course_run_status_idx
  on public.enrollments (course_run_id, status);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null
    constraint invitations_normalized_email_format
    check (
      normalized_email = lower(btrim(normalized_email))
      and char_length(normalized_email) between 3 and 254
      and normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    ),
  token_hash text not null,
  course_run_id uuid not null references public.course_runs(id) on delete cascade,
  role public.portal_role not null,
  expires_at timestamptz not null,
  claimed_by uuid references public.profiles(id) on delete restrict,
  claimed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint invitations_token_hash_unique unique (token_hash),
  constraint invitations_expiry_after_creation check (expires_at > created_at),
  constraint invitations_claim_consistent check (
    (claimed_by is null and claimed_at is null)
    or (claimed_by is not null and claimed_at is not null)
  )
);

create index invitations_course_run_id_idx
  on public.invitations (course_run_id);

create index invitations_claimed_by_idx
  on public.invitations (claimed_by)
  where claimed_by is not null;

create index invitations_created_by_idx
  on public.invitations (created_by);

create table public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_profile_id uuid references public.profiles(id) on delete restrict,
  action text not null
    constraint audit_events_action_not_blank
    check (char_length(btrim(action)) > 0),
  entity_type text not null
    constraint audit_events_entity_type_not_blank
    check (char_length(btrim(entity_type)) > 0),
  entity_id text not null
    constraint audit_events_entity_id_not_blank
    check (char_length(btrim(entity_id)) > 0),
  correlation_id uuid not null default gen_random_uuid(),
  reason text,
  before_data jsonb,
  after_data jsonb
);

create index audit_events_actor_profile_id_idx
  on public.audit_events (actor_profile_id)
  where actor_profile_id is not null;

create index audit_events_entity_idx
  on public.audit_events (entity_type, entity_id, occurred_at desc);

create index audit_events_correlation_id_idx
  on public.audit_events (correlation_id);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    constraint outbox_events_event_type_not_blank
    check (char_length(btrim(event_type)) > 0),
  idempotency_key text not null,
  payload jsonb not null,
  status text not null default 'pending'
    constraint outbox_events_status_allowed
    check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempts smallint not null default 0
    constraint outbox_events_attempts_nonnegative
    check (attempts >= 0),
  available_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  constraint outbox_events_idempotency_key_unique unique (idempotency_key),
  constraint outbox_events_delivery_consistent check (
    (status = 'delivered' and delivered_at is not null)
    or (status <> 'delivered' and delivered_at is null)
  )
);

create index outbox_events_ready_idx
  on public.outbox_events (available_at, created_at)
  where status in ('pending', 'failed');

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create function private.reject_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events is append-only';
end;
$$;

revoke all on function private.reject_audit_mutation() from public, anon, authenticated;

create trigger audit_events_reject_mutation
before update or delete on public.audit_events
for each row execute function private.reject_audit_mutation();

alter table public.profiles enable row level security;
alter table public.user_accounts enable row level security;
alter table public.course_templates enable row level security;
alter table public.course_runs enable row level security;
alter table public.course_sessions enable row level security;
alter table public.role_assignments enable row level security;
alter table public.enrollments enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_events enable row level security;
alter table public.outbox_events enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_accounts from anon, authenticated;
revoke all on table public.course_templates from anon, authenticated;
revoke all on table public.course_runs from anon, authenticated;
revoke all on table public.course_sessions from anon, authenticated;
revoke all on table public.role_assignments from anon, authenticated;
revoke all on table public.enrollments from anon, authenticated;
revoke all on table public.invitations from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;
revoke all on table public.outbox_events from anon, authenticated;
revoke all on sequence public.audit_events_id_seq from anon, authenticated;
