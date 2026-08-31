begin;

select plan(9);

select ok(
  to_regprocedure('public.save_content_draft(uuid,uuid,jsonb,text)') is not null,
  'transactional draft saver exists'
);
select ok(
  to_regprocedure(
    'public.publish_content_and_rebind(uuid,uuid,text,uuid[])'
  ) is not null,
  'transactional publisher and course rebinder exists'
);

insert into auth.users (id, email, email_confirmed_at)
values
  (
    '22000000-0000-0000-0000-000000000020',
    'editor-admin@example.invalid',
    now()
  ),
  (
    '22000000-0000-0000-0000-000000000021',
    'editor-student@example.invalid',
    now()
  );

insert into public.profiles (id, display_name, normalized_email)
values
  (
    '12000000-0000-0000-0000-000000000020',
    'Redigeringsadministrator',
    'editor-admin@example.invalid'
  ),
  (
    '12000000-0000-0000-0000-000000000021',
    'Redigeringsstudent',
    'editor-student@example.invalid'
  );

insert into public.user_accounts (user_id, profile_id, normalized_email)
values
  (
    '22000000-0000-0000-0000-000000000020',
    '12000000-0000-0000-0000-000000000020',
    'editor-admin@example.invalid'
  ),
  (
    '22000000-0000-0000-0000-000000000021',
    '12000000-0000-0000-0000-000000000021',
    'editor-student@example.invalid'
  );

insert into public.role_assignments (profile_id, role, granted_by)
values (
  '12000000-0000-0000-0000-000000000020',
  'administrator',
  '12000000-0000-0000-0000-000000000020'
);

insert into public.course_templates (id, code, title, level)
values (
  '32000000-0000-0000-0000-000000000020',
  'EDITOR_T1',
  'Redigeringstest Trener 1',
  1
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
  '42000000-0000-0000-0000-000000000020',
  '32000000-0000-0000-0000-000000000020',
  'Redigeringstest 2027',
  2027,
  '2027-02-03',
  '2027-10-31',
  'active'
);

insert into public.content_items (id, kind, slug, title, created_by)
values (
  '52000000-0000-0000-0000-000000000020',
  'lesson',
  'redigeringstest',
  'Redigeringstest',
  '12000000-0000-0000-0000-000000000020'
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
  '62000000-0000-0000-0000-000000000020',
  '52000000-0000-0000-0000-000000000020',
  1,
  'draft',
  '{"locale":"nb-NO","format":"short_page","blocks":[{"type":"heading","level":2,"text":"Før"},{"type":"paragraph","text":"Før lagring"}]}'::jsonb,
  'Første kladd',
  '12000000-0000-0000-0000-000000000020'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22000000-0000-0000-0000-000000000020',
  true
);

select lives_ok(
  $$
    select public.save_content_draft(
      '52000000-0000-0000-0000-000000000020',
      '12000000-0000-0000-0000-000000000020',
      '{"locale":"nb-NO","format":"short_page","blocks":[{"type":"heading","level":2,"text":"Etter"},{"type":"paragraph","text":"Etter lagring"}]}'::jsonb,
      'Oppdatert fra redaktørflaten'
    )
  $$,
  'administrator saves only the draft'
);

reset role;

select is(
  (
    select document #>> '{blocks,0,text}'
    from public.content_revisions
    where id = '62000000-0000-0000-0000-000000000020'
  ),
  'Etter',
  'draft document is updated'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22000000-0000-0000-0000-000000000020',
  true
);

select lives_ok(
  $$
    select public.publish_content_and_rebind(
      '52000000-0000-0000-0000-000000000020',
      '12000000-0000-0000-0000-000000000020',
      'Publisert fra redaktørflaten',
      array['42000000-0000-0000-0000-000000000020'::uuid]
    )
  $$,
  'publication and selected course rebind succeed together'
);

reset role;

select is(
  (
    select content_revision_id
    from public.course_content_bindings
    where course_run_id = '42000000-0000-0000-0000-000000000020'
      and content_item_id = '52000000-0000-0000-0000-000000000020'
  ),
  '62000000-0000-0000-0000-000000000020'::uuid,
  'selected course points to the newly published revision'
);
select is(
  (
    select document #>> '{blocks,0,text}'
    from public.content_revisions
    where content_item_id = '52000000-0000-0000-0000-000000000020'
      and status = 'published'
  ),
  'Etter',
  'published revision contains the saved draft'
);
select is(
  (
    select count(*)::integer
    from public.content_revisions
    where content_item_id = '52000000-0000-0000-0000-000000000020'
      and status = 'draft'
  ),
  1,
  'publication leaves one fresh draft'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22000000-0000-0000-0000-000000000021',
  true
);

select throws_ok(
  $$
    select public.save_content_draft(
      '52000000-0000-0000-0000-000000000020',
      '12000000-0000-0000-0000-000000000021',
      '{"locale":"nb-NO","format":"short_page","blocks":[{"type":"heading","level":2,"text":"Ulovlig"},{"type":"paragraph","text":"Ulovlig lagring"}]}'::jsonb,
      'Student forsøker lagring'
    )
  $$,
  '42501',
  'CONTENT_SAVE_FORBIDDEN',
  'student cannot save a content draft'
);

reset role;

select * from finish();
rollback;
