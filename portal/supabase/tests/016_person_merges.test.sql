begin;

select plan(38);

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

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values (
  '27000000-0000-0000-0000-000000000008',
  'kari.kilde@example.invalid',
  now(),
  '{"full_name": "Kari Kilde"}'::jsonb
);

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values (
  'a7000000-0000-0000-0000-000000000008',
  '27000000-0000-0000-0000-000000000008',
  '27000000-0000-0000-0000-000000000008',
  '{"sub": "27000000-0000-0000-0000-000000000008", "email": "kari.kilde@example.invalid"}'::jsonb,
  'email', now(), now(), now()
);

insert into public.profiles (id, display_name, normalized_email)
values
  ('17000000-0000-0000-0000-000000000001', 'Merge Admin', 'merge-admin@example.invalid'),
  ('17000000-0000-0000-0000-000000000002', 'Merge Kursleder', 'merge-lead@example.invalid'),
  ('17000000-0000-0000-0000-000000000003', 'Merge Lærer', 'merge-teacher@example.invalid'),
  ('17000000-0000-0000-0000-000000000004', 'Merge Student', 'merge-student@example.invalid'),
  ('17000000-0000-0000-0000-000000000005', 'Nora Vik', 'merge-nora@example.invalid'),
  ('17000000-0000-0000-0000-000000000006', 'Nora K Vik', 'merge-nora-k@example.invalid'),
  ('17000000-0000-0000-0000-000000000007', 'Godkjenner Admin', 'merge-approver@example.invalid'),
  ('17000000-0000-0000-0000-000000000008', 'Kari Kilde', 'kari.kilde@example.invalid'),
  ('17000000-0000-0000-0000-000000000009', 'Kari K Kilde', 'kari.k.kilde@example.invalid'),
  ('17000000-0000-0000-0000-000000000010', 'Per Konflikt', 'per.konflikt@example.invalid'),
  ('17000000-0000-0000-0000-000000000011', 'Per K Konflikt', 'per.k.konflikt@example.invalid'),
  ('17000000-0000-0000-0000-000000000012', 'Anna Aktiv', 'anna.aktiv@example.invalid'),
  ('17000000-0000-0000-0000-000000000013', 'Anna A Aktiv', 'anna.a.aktiv@example.invalid'),
  ('17000000-0000-0000-0000-000000000014', 'Ola Ferdig', 'ola.ferdig@example.invalid'),
  ('17000000-0000-0000-0000-000000000015', 'Ola F Ferdig', 'ola.f.ferdig@example.invalid'),
  ('17000000-0000-0000-0000-000000000016', 'Liv Levende', 'liv.levende@example.invalid');

insert into public.user_accounts (user_id, profile_id, normalized_email)
values
  ('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', 'merge-admin@example.invalid'),
  ('27000000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000002', 'merge-lead@example.invalid'),
  ('27000000-0000-0000-0000-000000000003', '17000000-0000-0000-0000-000000000003', 'merge-teacher@example.invalid'),
  ('27000000-0000-0000-0000-000000000004', '17000000-0000-0000-0000-000000000004', 'merge-student@example.invalid'),
  ('27000000-0000-0000-0000-000000000008', '17000000-0000-0000-0000-000000000008', 'kari.kilde@example.invalid');

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
  ('17000000-0000-0000-0000-000000000004', 'student', null, '47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001'),
  ('17000000-0000-0000-0000-000000000007', 'administrator', null, null, '17000000-0000-0000-0000-000000000001'),
  ('17000000-0000-0000-0000-000000000012', 'student', null, '47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001');

-- Læringsstruktur (utkast er nok for direkte innsatte fullføringer).
insert into public.learning_paths (id, course_run_id, title, created_by)
values (
  '87000000-0000-0000-0000-000000000001',
  '47000000-0000-0000-0000-000000000001',
  'Sammenslåingsløp',
  '17000000-0000-0000-0000-000000000001'
);

insert into public.modules (id, learning_path_id, title, sort_order)
values (
  '88000000-0000-0000-0000-000000000001',
  '87000000-0000-0000-0000-000000000001',
  'Modul', 1
);

insert into public.activities (
  id, learning_path_id, module_id, title, activity_type, completion_mode,
  content_item_id, required, weight, sort_order
)
values
  ('89000000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-000000000001', 'Prøve 1', 'knowledge_test', 'quiz_pass', null, true, 1, 1),
  ('89000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-000000000001', 'Prøve 2', 'knowledge_test', 'quiz_pass', null, true, 1, 2);

insert into public.enrollments (id, course_run_id, profile_id, status)
values
  ('66000000-0000-0000-0000-000000000001', '47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000012', 'active'),
  ('66000000-0000-0000-0000-000000000002', '47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000010', 'active'),
  ('66000000-0000-0000-0000-000000000003', '47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000011', 'active'),
  ('66000000-0000-0000-0000-000000000004', '47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000014', 'completed'),
  ('66000000-0000-0000-0000-000000000005', '47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000015', 'active');

insert into public.activity_completions (
  enrollment_id, course_run_id, learning_path_id, activity_id, source, completed_by
)
values
  ('66000000-0000-0000-0000-000000000002', '47000000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-000000000001', '89000000-0000-0000-0000-000000000001', 'teacher', '17000000-0000-0000-0000-000000000010'),
  ('66000000-0000-0000-0000-000000000003', '47000000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-000000000001', '89000000-0000-0000-0000-000000000001', 'teacher', '17000000-0000-0000-0000-000000000011'),
  ('66000000-0000-0000-0000-000000000005', '47000000-0000-0000-0000-000000000001', '87000000-0000-0000-0000-000000000001', '89000000-0000-0000-0000-000000000001', 'teacher', '17000000-0000-0000-0000-000000000015');

insert into public.certificates (
  enrollment_id, course_run_id, certificate_number, template_version,
  display_name, course_title, completed_on
)
values (
  '66000000-0000-0000-0000-000000000005',
  '47000000-0000-0000-0000-000000000001',
  'MERGE-CERT-1', 'v1', 'Ola F Ferdig', 'Sammenslåingstest Trener 2',
  '2027-10-01'
);

insert into public.invitations (
  id, normalized_email, token_hash, course_run_id, role, expires_at,
  claimed_by, claimed_at, created_by
)
values (
  '76000000-0000-0000-0000-000000000001',
  'ola.f.ferdig@example.invalid',
  repeat('ab12', 16),
  '47000000-0000-0000-0000-000000000001',
  'student',
  now() + interval '30 days',
  '17000000-0000-0000-0000-000000000015',
  now(),
  '17000000-0000-0000-0000-000000000001'
);

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

-- Funn 4: sammenslåing er en rolletildeling — privilegerte profiler avvises.
select throws_ok(
  $$select public.merge_people('17000000-0000-0000-0000-000000000004', '17000000-0000-0000-0000-000000000001', 'Student inn i administrator')$$,
  '42501', 'MERGE_PRIVILEGED_PROFILE',
  'merging into an administrator profile is refused'
);
select throws_ok(
  $$select public.merge_people('17000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000004', 'Administrator inn i student')$$,
  '42501', 'MERGE_PRIVILEGED_PROFILE',
  'merging an administrator profile away is refused'
);

-- Funn 5: begge har aktivitet i samme kurs — stopp uten endringer.
select throws_ok(
  $$select public.merge_people('17000000-0000-0000-0000-000000000010', '17000000-0000-0000-0000-000000000011', 'Duplikat med aktivitet')$$,
  '22023', 'MERGE_COURSE_CONFLICT',
  'same-course conflict where both enrollments have activity is refused'
);

-- Funn 5: enrollment med registrert aktivitet vinner over statusrang.
select lives_ok(
  $$select public.merge_people('17000000-0000-0000-0000-000000000014', '17000000-0000-0000-0000-000000000015', 'Duplikat')$$,
  'merge with one-sided activity succeeds'
);
select is(
  (select profile_id from public.enrollments where id = '66000000-0000-0000-0000-000000000005'),
  '17000000-0000-0000-0000-000000000015'::uuid,
  'enrollment with activity stays on the kept profile'
);
select is(
  (select status::text from public.enrollments where id = '66000000-0000-0000-0000-000000000005'),
  'active',
  'enrollment with activity keeps its status'
);
select is(
  (select status::text from public.enrollments where id = '66000000-0000-0000-0000-000000000004'),
  'withdrawn',
  'enrollment without activity is the one withdrawn'
);

-- Funn 1 + 4: flytting av enrollment og rolle, deretter ny aktivitet.
select lives_ok(
  $$select public.merge_people('17000000-0000-0000-0000-000000000012', '17000000-0000-0000-0000-000000000013', 'Duplikat')$$,
  'merge moving an enrollment and a role succeeds'
);

reset role;

select ok(
  exists (
    select 1 from public.audit_events
    where action = 'role.granted'
      and entity_type = 'role_assignment'
      and after_data ->> 'profileId' = '17000000-0000-0000-0000-000000000013'
  ),
  'moved role assignment is logged as role.granted'
);

-- Ny aktivitet på den flyttede enrollmenten etter sammenslåingen.
insert into public.activity_completions (
  enrollment_id, course_run_id, learning_path_id, activity_id, source, completed_by
)
values (
  '66000000-0000-0000-0000-000000000001',
  '47000000-0000-0000-0000-000000000001',
  '87000000-0000-0000-0000-000000000001',
  '89000000-0000-0000-0000-000000000001',
  'teacher',
  '17000000-0000-0000-0000-000000000013'
);

create temporary table reversal_target on commit drop as
select id from public.person_merges
where source_profile_id = '17000000-0000-0000-0000-000000000012';
grant select on reversal_target to authenticated;

set local role authenticated;

select is(
  (select public.reverse_merge((select id from reversal_target))) ->> 'status',
  'manual_reversal_required',
  'new activity on a moved enrollment forces manual reversal'
);

reset role;

select is(
  (select profile_id from public.enrollments where id = '66000000-0000-0000-0000-000000000001'),
  '17000000-0000-0000-0000-000000000013'::uuid,
  'refused reversal leaves the enrollment untouched'
);

-- Funn 3: anonymisering deaktiverer kontoer som en merge har flyttet bort.
-- Herding (funn 5 i 20261105090000): et aktivt merge-skall kan ikke
-- anonymiseres direkte — sletteforespørselen rettes mot den overlevende
-- profilen, hvis kjede dekker skallet.
set local role authenticated;

select lives_ok(
  $$select public.merge_people('17000000-0000-0000-0000-000000000008', '17000000-0000-0000-0000-000000000009', 'Duplikat')$$,
  'merge moving an account succeeds'
);
select throws_ok(
  $$select public.anonymize_person('17000000-0000-0000-0000-000000000008', 'SAK-2026-08', '17000000-0000-0000-0000-000000000007')$$,
  '22023', 'ANONYMIZE_MERGED_SOURCE',
  'anonymizing an active merge source is refused'
);
select lives_ok(
  $$select public.anonymize_person('17000000-0000-0000-0000-000000000009', 'SAK-2026-08', '17000000-0000-0000-0000-000000000007')$$,
  'anonymizing the surviving profile succeeds'
);

reset role;

select is(
  (select is_active from public.user_accounts where user_id = '27000000-0000-0000-0000-000000000008'),
  false,
  'login moved by an earlier merge is deactivated on anonymization'
);
select is(
  (select email::text from auth.users where id = '27000000-0000-0000-0000-000000000008'),
  'anonymisert-27000000-0000-0000-0000-000000000008@anonymisert.invalid',
  'auth email is scrubbed'
);
select is(
  (select raw_user_meta_data from auth.users where id = '27000000-0000-0000-0000-000000000008'),
  '{}'::jsonb,
  'auth user metadata is scrubbed'
);
select is(
  (select identity_data ->> 'email' from auth.identities where user_id = '27000000-0000-0000-0000-000000000008'),
  'anonymisert-27000000-0000-0000-0000-000000000008@anonymisert.invalid',
  'auth identity data is scrubbed'
);

-- Funn 2: anonymisering av et merge-mål skrubber alle klartekst-spor.
set local role authenticated;

select lives_ok(
  $$select public.anonymize_person('17000000-0000-0000-0000-000000000015', 'SAK-2026-15', '17000000-0000-0000-0000-000000000007')$$,
  'anonymizing a merge target succeeds'
);

reset role;

select is(
  (select display_name from public.profiles where id = '17000000-0000-0000-0000-000000000014'),
  'Anonymisert deltaker',
  'merged-away duplicate profile row is scrubbed too'
);
select is(
  (select source_snapshot ->> 'display_name' from public.person_merges where source_profile_id = '17000000-0000-0000-0000-000000000014'),
  'Anonymisert deltaker',
  'merge snapshot no longer holds the old identity'
);
select is(
  (select normalized_email from public.invitations where id = '76000000-0000-0000-0000-000000000001'),
  'anonymisert-76000000-0000-0000-0000-000000000001@anonymisert.invalid',
  'claimed invitation email is scrubbed'
);
select is(
  (select display_name from public.certificates where enrollment_id = '66000000-0000-0000-0000-000000000005'),
  'Anonymisert deltaker',
  'certificate display name is scrubbed'
);

-- Funn 6: anonymiserte profiler kan ikke inngå i sammenslåing.
set local role authenticated;

select throws_ok(
  $$select public.merge_people('17000000-0000-0000-0000-000000000016', '17000000-0000-0000-0000-000000000015', 'Inn i anonymisert skall')$$,
  '22023', 'MERGE_ANONYMIZED_PROFILE',
  'merging into an anonymized profile is refused'
);
select throws_ok(
  $$select public.merge_people('17000000-0000-0000-0000-000000000015', '17000000-0000-0000-0000-000000000016', 'Anonymisert inn i levende')$$,
  '22023', 'MERGE_ANONYMIZED_PROFILE',
  'merging an anonymized profile into a living one is refused'
);

select * from finish();

rollback;
