begin;

select plan(13);

select has_function(
  'public', 'merge_people', array['uuid', 'uuid', 'text'],
  'merge_people function exists'
);
select has_function(
  'public', 'reverse_merge', array['uuid'],
  'reverse_merge function exists'
);
select has_function(
  'public', 'anonymize_person', array['uuid', 'text', 'uuid'],
  'anonymize_person function exists'
);

insert into auth.users (id, email, email_confirmed_at)
values
  ('27000000-0000-0000-0000-000000000001', 'merge-admin@example.invalid', now()),
  ('27000000-0000-0000-0000-000000000002', 'merge-lead@example.invalid', now()),
  ('27000000-0000-0000-0000-000000000003', 'merge-teacher@example.invalid', now()),
  ('27000000-0000-0000-0000-000000000004', 'merge-student@example.invalid', now());

insert into public.profiles (id, display_name, normalized_email)
values
  ('17000000-0000-0000-0000-000000000001', 'Merge Admin', 'merge-admin@example.invalid'),
  ('17000000-0000-0000-0000-000000000002', 'Merge Kursleder', 'merge-lead@example.invalid'),
  ('17000000-0000-0000-0000-000000000003', 'Merge Lærer', 'merge-teacher@example.invalid'),
  ('17000000-0000-0000-0000-000000000004', 'Merge Student', 'merge-student@example.invalid'),
  ('17000000-0000-0000-0000-000000000005', 'Nora Vik', 'merge-nora@example.invalid'),
  ('17000000-0000-0000-0000-000000000006', 'Nora K Vik', 'merge-nora-k@example.invalid');

insert into public.user_accounts (user_id, profile_id, normalized_email)
values
  ('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', 'merge-admin@example.invalid'),
  ('27000000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000002', 'merge-lead@example.invalid'),
  ('27000000-0000-0000-0000-000000000003', '17000000-0000-0000-0000-000000000003', 'merge-teacher@example.invalid'),
  ('27000000-0000-0000-0000-000000000004', '17000000-0000-0000-0000-000000000004', 'merge-student@example.invalid');

insert into public.course_templates (id, code, title, level)
values ('37000000-0000-0000-0000-000000000001', 'MERGE_T2', 'Sammenslåingstest Trener 2', 2);

insert into public.course_runs (id, template_id, title, start_year, starts_on, ends_on, status)
values (
  '47000000-0000-0000-0000-000000000001',
  '37000000-0000-0000-0000-000000000001',
  'Sammenslåingstest', 2027, '2027-02-01', '2027-10-31', 'active'
);

insert into public.role_assignments (profile_id, role, course_template_id, course_run_id, granted_by)
values
  ('17000000-0000-0000-0000-000000000001', 'administrator', null, null, '17000000-0000-0000-0000-000000000001'),
  ('17000000-0000-0000-0000-000000000002', 'course_lead', null, '47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001'),
  ('17000000-0000-0000-0000-000000000003', 'course_teacher', null, '47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001'),
  ('17000000-0000-0000-0000-000000000004', 'student', null, '47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001');

set local role authenticated;

-- Student kan ikke kalle noen av RPC-ene.
select set_config('request.jwt.claim.sub', '27000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$select public.merge_people('17000000-0000-0000-0000-000000000005', '17000000-0000-0000-0000-000000000006', 'Forsøk')$$,
  '42501', 'MERGE_FORBIDDEN',
  'student cannot merge people'
);
select throws_ok(
  $$select public.reverse_merge('00000000-0000-0000-0000-000000000001')$$,
  '42501', 'MERGE_FORBIDDEN',
  'student cannot reverse a merge'
);
select throws_ok(
  $$select public.anonymize_person('17000000-0000-0000-0000-000000000005', 'SAK-1', '17000000-0000-0000-0000-000000000001')$$,
  '42501', 'ANONYMIZE_FORBIDDEN',
  'student cannot anonymize a person'
);

-- Kurslærer kan ikke kalle noen av RPC-ene.
select set_config('request.jwt.claim.sub', '27000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select public.merge_people('17000000-0000-0000-0000-000000000005', '17000000-0000-0000-0000-000000000006', 'Forsøk')$$,
  '42501', 'MERGE_FORBIDDEN',
  'course teacher cannot merge people'
);
select throws_ok(
  $$select public.reverse_merge('00000000-0000-0000-0000-000000000001')$$,
  '42501', 'MERGE_FORBIDDEN',
  'course teacher cannot reverse a merge'
);
select throws_ok(
  $$select public.anonymize_person('17000000-0000-0000-0000-000000000005', 'SAK-1', '17000000-0000-0000-0000-000000000001')$$,
  '42501', 'ANONYMIZE_FORBIDDEN',
  'course teacher cannot anonymize a person'
);

-- Kursleder kan ikke kalle noen av RPC-ene (kun sentral administrator).
select set_config('request.jwt.claim.sub', '27000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.merge_people('17000000-0000-0000-0000-000000000005', '17000000-0000-0000-0000-000000000006', 'Forsøk')$$,
  '42501', 'MERGE_FORBIDDEN',
  'course lead cannot merge people'
);
select throws_ok(
  $$select public.reverse_merge('00000000-0000-0000-0000-000000000001')$$,
  '42501', 'MERGE_FORBIDDEN',
  'course lead cannot reverse a merge'
);
select throws_ok(
  $$select public.anonymize_person('17000000-0000-0000-0000-000000000005', 'SAK-1', '17000000-0000-0000-0000-000000000001')$$,
  '42501', 'ANONYMIZE_FORBIDDEN',
  'course lead cannot anonymize a person'
);

-- Administrator kan slå sammen (positiv kontroll på grants).
select set_config('request.jwt.claim.sub', '27000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.merge_people('17000000-0000-0000-0000-000000000005', '17000000-0000-0000-0000-000000000006', 'Bekreftet duplikat')$$,
  'administrator can merge people'
);

select * from finish();

rollback;
