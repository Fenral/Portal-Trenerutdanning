begin;

select plan(6);

select has_column(
  'public',
  'resource_items',
  'course_session_id',
  'resource items can point at a course session'
);
select col_is_null(
  'public',
  'resource_items',
  'course_session_id',
  'session coupling is optional (felles for kurset)'
);
select fk_ok(
  'public',
  'resource_items',
  'course_session_id',
  'public',
  'course_sessions',
  'id',
  'course_session_id references course_sessions'
);

insert into auth.users (id, email, email_confirmed_at)
values (
  '28000000-0000-0000-0000-000000000011',
  'session-student@example.invalid',
  now()
);

insert into public.profiles (id, display_name, normalized_email)
values
  (
    '18000000-0000-0000-0000-000000000010',
    'Samlingsredaktør',
    'session-editor@example.invalid'
  ),
  (
    '18000000-0000-0000-0000-000000000011',
    'Samlingsstudent',
    'session-student@example.invalid'
  );

insert into public.user_accounts (user_id, profile_id, normalized_email)
values (
  '28000000-0000-0000-0000-000000000011',
  '18000000-0000-0000-0000-000000000011',
  'session-student@example.invalid'
);

insert into public.course_templates (id, code, title, level)
values (
  '38000000-0000-0000-0000-000000000010',
  'SESSION_T3',
  'Samlingstest Trener 3',
  3
);

insert into public.course_runs (
  id,
  template_id,
  title,
  start_year,
  starts_on,
  ends_on,
  status
)
values (
  '48000000-0000-0000-0000-000000000010',
  '38000000-0000-0000-0000-000000000010',
  'Samlingstest 2027',
  2027,
  '2027-02-01',
  '2027-11-30',
  'active'
);

insert into public.course_sessions (
  id,
  course_run_id,
  title,
  starts_at,
  ends_at,
  sort_order,
  session_type,
  is_required
)
values (
  '58000000-0000-0000-0000-000000000010',
  '48000000-0000-0000-0000-000000000010',
  'Samling 1',
  '2027-02-05T09:00:00+01:00',
  '2027-02-07T16:00:00+01:00',
  1,
  'regular',
  true
);

insert into public.enrollments (course_run_id, profile_id, status)
values (
  '48000000-0000-0000-0000-000000000010',
  '18000000-0000-0000-0000-000000000011',
  'active'
);

insert into public.media_assets (
  id,
  storage_path,
  original_filename,
  mime_type,
  byte_size,
  sha256,
  scan_status,
  scanned_at,
  uploaded_by
)
values (
  '68000000-0000-0000-0000-000000000010',
  'demo/samlingstest-presentasjon.pptx',
  'samlingstest-presentasjon.pptx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  4096,
  repeat('d', 64),
  'clean',
  now(),
  '18000000-0000-0000-0000-000000000010'
);

insert into public.resource_items (
  id,
  title,
  description,
  audience,
  course_run_id,
  course_session_id,
  created_by
)
values
  (
    '78000000-0000-0000-0000-000000000010',
    'Presentasjon for studenter',
    null,
    'course_members',
    '48000000-0000-0000-0000-000000000010',
    '58000000-0000-0000-0000-000000000010',
    '18000000-0000-0000-0000-000000000010'
  ),
  (
    '78000000-0000-0000-0000-000000000011',
    'Lærernotater for samlingen',
    null,
    'teachers',
    '48000000-0000-0000-0000-000000000010',
    '58000000-0000-0000-0000-000000000010',
    '18000000-0000-0000-0000-000000000010'
  );

insert into public.resource_revisions (
  id,
  resource_item_id,
  revision_number,
  status,
  media_asset_id,
  change_note,
  created_by,
  published_by,
  published_at
)
values
  (
    '88000000-0000-0000-0000-000000000010',
    '78000000-0000-0000-0000-000000000010',
    1,
    'published',
    '68000000-0000-0000-0000-000000000010',
    'Første publisering',
    '18000000-0000-0000-0000-000000000010',
    '18000000-0000-0000-0000-000000000010',
    now()
  ),
  (
    '88000000-0000-0000-0000-000000000011',
    '78000000-0000-0000-0000-000000000011',
    1,
    'published',
    '68000000-0000-0000-0000-000000000010',
    'Første publisering',
    '18000000-0000-0000-0000-000000000010',
    '18000000-0000-0000-0000-000000000010',
    now()
  );

insert into public.course_resource_bindings (
  course_run_id,
  resource_item_id,
  resource_revision_id,
  bound_by
)
values
  (
    '48000000-0000-0000-0000-000000000010',
    '78000000-0000-0000-0000-000000000010',
    '88000000-0000-0000-0000-000000000010',
    '18000000-0000-0000-0000-000000000010'
  ),
  (
    '48000000-0000-0000-0000-000000000010',
    '78000000-0000-0000-0000-000000000011',
    '88000000-0000-0000-0000-000000000011',
    '18000000-0000-0000-0000-000000000010'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '28000000-0000-0000-0000-000000000011',
  true
);

select results_eq(
  $$
    select count(*)::integer
    from public.resource_items
    where course_session_id = '58000000-0000-0000-0000-000000000010'
  $$,
  array[1],
  'enrolled student sees only the course_members session resource'
);
select results_eq(
  $$
    select count(*)::integer
    from public.resource_items
    where id = '78000000-0000-0000-0000-000000000011'
  $$,
  array[0],
  'enrolled student cannot see the teachers-only session resource'
);

reset role;

delete from public.course_sessions
where id = '58000000-0000-0000-0000-000000000010';

select results_eq(
  $$
    select count(*)::integer
    from public.resource_items
    where id = '78000000-0000-0000-0000-000000000010'
      and course_session_id is null
  $$,
  array[1],
  'deleting a session detaches the resource instead of deleting it'
);

select * from finish();

rollback;
