begin;

select plan(28);

select has_table('public', 'content_items', 'content items table exists');
select has_table('public', 'resource_revisions', 'resource revisions table exists');
select ok(
  to_regprocedure('public.publish_content(uuid,uuid,text)') is not null,
  'transactional content publisher exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.publish_content(uuid,uuid,text)',
    'EXECUTE'
  ),
  'anonymous caller cannot publish content'
);

insert into auth.users (id, email, email_confirmed_at)
values
  (
    '22000000-0000-0000-0000-000000000010',
    'content-admin@example.invalid',
    now()
  ),
  (
    '22000000-0000-0000-0000-000000000011',
    'content-student@example.invalid',
    now()
  );

insert into public.profiles (id, display_name, normalized_email)
values
  (
    '12000000-0000-0000-0000-000000000010',
    'Innholdsadministrator',
    'content-admin@example.invalid'
  ),
  (
    '12000000-0000-0000-0000-000000000011',
    'Innholdsstudent',
    'content-student@example.invalid'
  );

insert into public.user_accounts (user_id, profile_id, normalized_email)
values
  (
    '22000000-0000-0000-0000-000000000010',
    '12000000-0000-0000-0000-000000000010',
    'content-admin@example.invalid'
  ),
  (
    '22000000-0000-0000-0000-000000000011',
    '12000000-0000-0000-0000-000000000011',
    'content-student@example.invalid'
  );

insert into public.role_assignments (profile_id, role, granted_by)
values (
  '12000000-0000-0000-0000-000000000010',
  'administrator',
  '12000000-0000-0000-0000-000000000010'
);

insert into public.course_templates (id, code, title, level)
values (
  '32000000-0000-0000-0000-000000000010',
  'CONTENT_T1',
  'Innholdstest Trener 1',
  1
);

insert into public.course_runs (
  id,
  template_id,
  title,
  start_year,
  location_name,
  starts_on,
  ends_on,
  status
)
values (
  '42000000-0000-0000-0000-000000000010',
  '32000000-0000-0000-0000-000000000010',
  'Innholdstest 2027',
  2027,
  'Oslo GK',
  '2027-02-03',
  '2027-10-31',
  'active'
);

insert into public.enrollments (course_run_id, profile_id, status)
values (
  '42000000-0000-0000-0000-000000000010',
  '12000000-0000-0000-0000-000000000011',
  'active'
);

insert into public.content_items (
  id,
  kind,
  slug,
  title,
  created_by
)
values (
  '52000000-0000-0000-0000-000000000010',
  'lesson',
  'ballfluktslover',
  'Ballfluktslover',
  '12000000-0000-0000-0000-000000000010'
);

insert into public.content_revisions (
  id,
  content_item_id,
  revision_number,
  status,
  document,
  change_note,
  created_by
)
values (
  '62000000-0000-0000-0000-000000000010',
  '52000000-0000-0000-0000-000000000010',
  1,
  'draft',
  '{"locale":"nb-NO","format":"short_page","blocks":[{"type":"paragraph","text":"Versjon 1"}]}'::jsonb,
  'Første kladd',
  '12000000-0000-0000-0000-000000000010'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22000000-0000-0000-0000-000000000010',
  true
);

select lives_ok(
  $$
    select public.publish_content(
      '52000000-0000-0000-0000-000000000010',
      '12000000-0000-0000-0000-000000000010',
      'Første publisering'
    )
  $$,
  'administrator publishes the first content revision'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.content_revisions
    where content_item_id = '52000000-0000-0000-0000-000000000010'
      and status = 'published'
  ),
  1,
  'first publication leaves one published revision'
);
select is(
  (
    select count(*)::integer
    from public.content_revisions
    where content_item_id = '52000000-0000-0000-0000-000000000010'
      and status = 'draft'
  ),
  1,
  'publication creates one fresh draft'
);

select lives_ok(
  $$
    insert into public.course_content_bindings (
      course_run_id,
      content_item_id,
      content_revision_id,
      bound_by
    )
    values (
      '42000000-0000-0000-0000-000000000010',
      '52000000-0000-0000-0000-000000000010',
      '62000000-0000-0000-0000-000000000010',
      '12000000-0000-0000-0000-000000000010'
    )
  $$,
  'course binds an explicitly published revision'
);

select throws_ok(
  $$
    update public.content_revisions
    set document = '{"tampered":true}'::jsonb
    where id = '62000000-0000-0000-0000-000000000010'
  $$,
  'P0001',
  'published_revision_is_immutable',
  'published content cannot be edited directly'
);

select throws_ok(
  $$
    insert into public.content_revisions (
      content_item_id,
      revision_number,
      status,
      document,
      change_note,
      created_by
    )
    values (
      '52000000-0000-0000-0000-000000000010',
      99,
      'draft',
      '{"locale":"nb-NO","format":"short_page","blocks":[{"type":"paragraph","text":"Duplikat"}]}'::jsonb,
      'Duplikat kladd',
      '12000000-0000-0000-0000-000000000010'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "one_draft_per_content_item"',
  'a content item cannot have two drafts'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22000000-0000-0000-0000-000000000010',
  true
);

select lives_ok(
  $$
    select public.publish_content(
      '52000000-0000-0000-0000-000000000010',
      '12000000-0000-0000-0000-000000000010',
      'Andre publisering'
    )
  $$,
  'administrator publishes the next content revision'
);

reset role;

select is(
  (
    select status::text
    from public.content_revisions
    where id = '62000000-0000-0000-0000-000000000010'
  ),
  'superseded',
  'the previous publication becomes superseded'
);
select is(
  (
    select revision_number
    from public.content_revisions
    where content_item_id = '52000000-0000-0000-0000-000000000010'
      and status = 'published'
  ),
  2,
  'the former draft becomes published revision two'
);
select is(
  (
    select content_revision_id
    from public.course_content_bindings
    where course_run_id = '42000000-0000-0000-0000-000000000010'
      and content_item_id = '52000000-0000-0000-0000-000000000010'
  ),
  '62000000-0000-0000-0000-000000000010'::uuid,
  'publishing a new master revision does not move the course binding'
);
select throws_ok(
  $$
    update public.course_content_bindings
    set content_revision_id = (
      select id
      from public.content_revisions
      where content_item_id = '52000000-0000-0000-0000-000000000010'
        and status = 'draft'
    )
    where course_run_id = '42000000-0000-0000-0000-000000000010'
      and content_item_id = '52000000-0000-0000-0000-000000000010'
  $$,
  'P0001',
  'content_binding_requires_published_revision',
  'a course cannot bind a draft revision'
);

insert into public.media_assets (
  id,
  storage_path,
  original_filename,
  mime_type,
  byte_size,
  sha256,
  scan_status,
  uploaded_by
)
values (
  '72000000-0000-0000-0000-000000000010',
  'quarantine/ballfluktslover.pdf',
  'ballfluktslover.pdf',
  'application/pdf',
  2048,
  repeat('a', 64),
  'quarantined',
  '12000000-0000-0000-0000-000000000010'
);

insert into public.resource_items (
  id,
  title,
  audience,
  course_run_id,
  created_by
)
values (
  '82000000-0000-0000-0000-000000000010',
  'Lærerens presentasjon',
  'teachers',
  '42000000-0000-0000-0000-000000000010',
  '12000000-0000-0000-0000-000000000010'
);

select throws_ok(
  $$
    insert into public.resource_revisions (
      resource_item_id,
      revision_number,
      status,
      media_asset_id,
      change_note,
      created_by
    )
    values (
      '82000000-0000-0000-0000-000000000010',
      1,
      'draft',
      '72000000-0000-0000-0000-000000000010',
      'Første fil',
      '12000000-0000-0000-0000-000000000010'
    )
  $$,
  'P0001',
  'resource_asset_not_clean',
  'quarantined media cannot become a resource revision'
);

update public.media_assets
set scan_status = 'clean', scanned_at = now()
where id = '72000000-0000-0000-0000-000000000010';

select lives_ok(
  $$
    insert into public.resource_revisions (
      id,
      resource_item_id,
      revision_number,
      status,
      media_asset_id,
      change_note,
      created_by
    )
    values (
      '92000000-0000-0000-0000-000000000010',
      '82000000-0000-0000-0000-000000000010',
      1,
      'draft',
      '72000000-0000-0000-0000-000000000010',
      'Første fil',
      '12000000-0000-0000-0000-000000000010'
    )
  $$,
  'clean media can back a draft resource revision'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22000000-0000-0000-0000-000000000010',
  true
);

select lives_ok(
  $$
    select public.publish_resource(
      '82000000-0000-0000-0000-000000000010',
      '12000000-0000-0000-0000-000000000010',
      'Første filpublisering'
    )
  $$,
  'administrator publishes the resource'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.resource_revisions
    where resource_item_id = '82000000-0000-0000-0000-000000000010'
      and status = 'published'
  ),
  1,
  'resource publication leaves one published revision'
);
select is(
  (
    select count(*)::integer
    from public.resource_revisions
    where resource_item_id = '82000000-0000-0000-0000-000000000010'
      and status = 'draft'
  ),
  1,
  'resource publication creates one fresh draft'
);
select throws_ok(
  $$
    update public.resource_revisions
    set change_note = 'Forsøk på overskriving'
    where id = '92000000-0000-0000-0000-000000000010'
  $$,
  'P0001',
  'published_resource_revision_is_immutable',
  'published resource metadata cannot be edited directly'
);
select lives_ok(
  $$
    insert into public.course_resource_bindings (
      course_run_id,
      resource_item_id,
      resource_revision_id,
      bound_by
    )
    values (
      '42000000-0000-0000-0000-000000000010',
      '82000000-0000-0000-0000-000000000010',
      '92000000-0000-0000-0000-000000000010',
      '12000000-0000-0000-0000-000000000010'
    )
  $$,
  'course binds the explicitly published resource revision'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22000000-0000-0000-0000-000000000010',
  true
);

select lives_ok(
  $$
    select public.publish_resource(
      '82000000-0000-0000-0000-000000000010',
      '12000000-0000-0000-0000-000000000010',
      'Andre filpublisering'
    )
  $$,
  'administrator publishes the next resource revision'
);

reset role;

select is(
  (
    select status::text
    from public.resource_revisions
    where id = '92000000-0000-0000-0000-000000000010'
  ),
  'superseded',
  'the previous resource publication becomes superseded'
);
select is(
  (
    select resource_revision_id
    from public.course_resource_bindings
    where course_run_id = '42000000-0000-0000-0000-000000000010'
      and resource_item_id = '82000000-0000-0000-0000-000000000010'
  ),
  '92000000-0000-0000-0000-000000000010'::uuid,
  'publishing a new file does not move the course resource binding'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22000000-0000-0000-0000-000000000011',
  true
);

select is(
  (
    select count(*)::integer
    from public.content_revisions
  ),
  1,
  'student sees the one revision explicitly bound to the course'
);
select is(
  (
    select count(*)::integer
    from public.content_revisions
    where status = 'draft'
  ),
  0,
  'student cannot see content drafts'
);
select is(
  (
    select count(*)::integer
    from public.resource_revisions
  ),
  0,
  'student cannot see a teacher-only resource'
);

reset role;

select * from finish();
rollback;
