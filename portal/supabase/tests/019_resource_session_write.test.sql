begin;

select plan(9);

select ok(
  to_regprocedure('public.set_resource_session(uuid,uuid,uuid)') is not null,
  'set_resource_session exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.set_resource_session(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'anonymous caller cannot set resource session'
);

insert into auth.users (id, email, email_confirmed_at)
values
  (
    '29000000-0000-0000-0000-000000000010',
    'session-write-editor@example.invalid',
    now()
  ),
  (
    '29000000-0000-0000-0000-000000000011',
    'session-write-student@example.invalid',
    now()
  );

insert into public.profiles (id, display_name, normalized_email)
values
  (
    '19000000-0000-0000-0000-000000000010',
    'Samlingsskriveredaktør',
    'session-write-editor@example.invalid'
  ),
  (
    '19000000-0000-0000-0000-000000000011',
    'Samlingsskrivestudent',
    'session-write-student@example.invalid'
  );

insert into public.user_accounts (user_id, profile_id, normalized_email)
values
  (
    '29000000-0000-0000-0000-000000000010',
    '19000000-0000-0000-0000-000000000010',
    'session-write-editor@example.invalid'
  ),
  (
    '29000000-0000-0000-0000-000000000011',
    '19000000-0000-0000-0000-000000000011',
    'session-write-student@example.invalid'
  );

insert into public.role_assignments (profile_id, role, granted_by)
values (
  '19000000-0000-0000-0000-000000000010',
  'editor',
  '19000000-0000-0000-0000-000000000010'
);

insert into public.course_templates (id, code, title, level)
values (
  '39000000-0000-0000-0000-000000000010',
  'SESSION_W3',
  'Samlingsskrivetest Trener 3',
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
values
  (
    '49000000-0000-0000-0000-000000000010',
    '39000000-0000-0000-0000-000000000010',
    'Samlingsskrivetest 2027',
    2027,
    '2027-02-01',
    '2027-11-30',
    'active'
  ),
  (
    '49000000-0000-0000-0000-000000000011',
    '39000000-0000-0000-0000-000000000010',
    'Samlingsskrivetest 2028',
    2028,
    '2028-02-01',
    '2028-11-30',
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
values
  (
    '59000000-0000-0000-0000-000000000010',
    '49000000-0000-0000-0000-000000000010',
    'Samling 1',
    '2027-02-05T09:00:00+01:00',
    '2027-02-07T16:00:00+01:00',
    1,
    'regular',
    true
  ),
  (
    '59000000-0000-0000-0000-000000000011',
    '49000000-0000-0000-0000-000000000011',
    'Samling i annet kull',
    '2028-02-05T09:00:00+01:00',
    '2028-02-07T16:00:00+01:00',
    1,
    'regular',
    true
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
  '69000000-0000-0000-0000-000000000010',
  'demo/samlingsskrivetest.pdf',
  'samlingsskrivetest.pdf',
  'application/pdf',
  2048,
  repeat('f', 64),
  'clean',
  now(),
  '19000000-0000-0000-0000-000000000010'
);

insert into public.content_items (id, kind, slug, title, created_by)
values (
  'a9000000-0000-0000-0000-000000000010',
  'lesson',
  'samlingsskrivetest',
  'Samlingsskrivetest',
  '19000000-0000-0000-0000-000000000010'
);

-- Kjørescopet ressurs i kull A og pensumscopet ressurs bundet til kull A.
insert into public.resource_items (
  id,
  title,
  audience,
  content_item_id,
  course_run_id,
  created_by
)
values
  (
    '79000000-0000-0000-0000-000000000010',
    'Kjørescopet ressurs',
    'course_members',
    null,
    '49000000-0000-0000-0000-000000000010',
    '19000000-0000-0000-0000-000000000010'
  ),
  (
    '79000000-0000-0000-0000-000000000011',
    'Pensumscopet ressurs',
    'course_members',
    'a9000000-0000-0000-0000-000000000010',
    null,
    '19000000-0000-0000-0000-000000000010'
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
values (
  '89000000-0000-0000-0000-000000000011',
  '79000000-0000-0000-0000-000000000011',
  1,
  'published',
  '69000000-0000-0000-0000-000000000010',
  'Første publisering',
  '19000000-0000-0000-0000-000000000010',
  '19000000-0000-0000-0000-000000000010',
  now()
);

insert into public.course_resource_bindings (
  course_run_id,
  resource_item_id,
  resource_revision_id,
  bound_by
)
values (
  '49000000-0000-0000-0000-000000000010',
  '79000000-0000-0000-0000-000000000011',
  '89000000-0000-0000-0000-000000000011',
  '19000000-0000-0000-0000-000000000010'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '29000000-0000-0000-0000-000000000010',
  true
);

select lives_ok(
  $$
    select public.set_resource_session(
      '79000000-0000-0000-0000-000000000010',
      '19000000-0000-0000-0000-000000000010',
      '59000000-0000-0000-0000-000000000010'
    )
  $$,
  'editor attaches a run-scoped resource to a session in its own run'
);
select throws_ok(
  $$
    select public.set_resource_session(
      '79000000-0000-0000-0000-000000000010',
      '19000000-0000-0000-0000-000000000010',
      '59000000-0000-0000-0000-000000000011'
    )
  $$,
  '22023',
  'RESOURCE_SESSION_COURSE_MISMATCH',
  'a session from another course run is rejected'
);
select lives_ok(
  $$
    select public.set_resource_session(
      '79000000-0000-0000-0000-000000000011',
      '19000000-0000-0000-0000-000000000010',
      '59000000-0000-0000-0000-000000000010'
    )
  $$,
  'editor attaches a content-scoped resource via its course binding'
);

reset role;

select is(
  (
    select course_session_id
    from public.resource_items
    where id = '79000000-0000-0000-0000-000000000010'
  ),
  '59000000-0000-0000-0000-000000000010'::uuid,
  'the session coupling is stored'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '29000000-0000-0000-0000-000000000010',
  true
);

select lives_ok(
  $$
    select public.set_resource_session(
      '79000000-0000-0000-0000-000000000010',
      '19000000-0000-0000-0000-000000000010',
      null
    )
  $$,
  'editor clears the coupling back to felles for kurset'
);

select set_config(
  'request.jwt.claim.sub',
  '29000000-0000-0000-0000-000000000011',
  true
);

select throws_ok(
  $$
    select public.set_resource_session(
      '79000000-0000-0000-0000-000000000010',
      '19000000-0000-0000-0000-000000000011',
      '59000000-0000-0000-0000-000000000010'
    )
  $$,
  '42501',
  'RESOURCE_SESSION_FORBIDDEN',
  'a caller without editor role cannot set the session'
);

reset role;

select is(
  (
    select course_session_id
    from public.resource_items
    where id = '79000000-0000-0000-0000-000000000010'
  ),
  null,
  'clearing leaves the resource as felles for kurset'
);

select * from finish();

rollback;
