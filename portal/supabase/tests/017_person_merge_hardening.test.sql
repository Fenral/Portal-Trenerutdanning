-- Gjenskaper de fire beviste angrepene mot person-merge/anonymisering
-- (uavhengig review, lukket i 20261105090000_person_merge_hardening.sql):
--   1. Aktivitetsdeteksjonen så bare 4 av 10 aktivitetsbærende tabeller.
--   2. Reverseringsfingeravtrykket hadde samme blindsone.
--   3. Anonymisering fulgte merge-grafen kun ett hopp og lot uinnløste
--      invitasjoner stå i klartekst.
--   4. anonymize_person manglet privilegert-mål-vern, selvanonymiseringsvern
--      og robust godkjennerkontroll, og revokerte ikke målets roller.

begin;

select plan(27);

insert into auth.users (id, email, email_confirmed_at)
values ('28000000-0000-0000-0000-000000000001', 'hard-admin@example.invalid', now());

insert into public.profiles (id, display_name, normalized_email)
values
  ('18000000-0000-0000-0000-000000000001', 'Hard Admin', 'hard-admin@example.invalid'),
  ('18000000-0000-0000-0000-000000000002', 'Hard Godkjenner', 'hard-approver@example.invalid'),
  ('18000000-0000-0000-0000-000000000003', 'Hard Måladmin', 'hard-target-admin@example.invalid'),
  ('18000000-0000-0000-0000-000000000004', 'Anonymisert deltaker', 'anonymisert-18000000-0000-0000-0000-000000000004@anonymisert.invalid'),
  ('18000000-0000-0000-0000-000000000010', 'Atle Oppmøte', 'atle.oppmote@hard.invalid'),
  ('18000000-0000-0000-0000-000000000011', 'Atle O Oppmøte', 'atle.o.oppmote@hard.invalid'),
  ('18000000-0000-0000-0000-000000000020', 'Unit Oppmøte', 'unit.oppmote@hard.invalid'),
  ('18000000-0000-0000-0000-000000000021', 'Unit Quiz', 'unit.quiz@hard.invalid'),
  ('18000000-0000-0000-0000-000000000022', 'Unit Universitet', 'unit.universitet@hard.invalid'),
  ('18000000-0000-0000-0000-000000000023', 'Unit Progresjon', 'unit.progresjon@hard.invalid'),
  ('18000000-0000-0000-0000-000000000024', 'Unit Unntak', 'unit.unntak@hard.invalid'),
  ('18000000-0000-0000-0000-000000000025', 'Unit Praksis', 'unit.praksis@hard.invalid'),
  ('18000000-0000-0000-0000-000000000026', 'Unit Stillas', 'unit.stillas@hard.invalid'),
  ('18000000-0000-0000-0000-000000000030', 'Rakel Flytt', 'rakel.flytt@hard.invalid'),
  ('18000000-0000-0000-0000-000000000031', 'Rakel F Flytt', 'rakel.f.flytt@hard.invalid'),
  ('18000000-0000-0000-0000-000000000050', 'Rita Rot', 'rita.rot@hard.invalid'),
  ('18000000-0000-0000-0000-000000000051', 'Rita R Rot', 'rita.r.rot@hard.invalid'),
  ('18000000-0000-0000-0000-000000000052', 'Rita RR Rot', 'rita.rr.rot@hard.invalid'),
  ('18000000-0000-0000-0000-000000000060', 'Stig Student', 'stig.student@hard.invalid');

insert into public.user_accounts (user_id, profile_id, normalized_email)
values ('28000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000001', 'hard-admin@example.invalid');

insert into public.course_templates (id, code, title, level)
values ('38000000-0000-0000-0000-000000000001', 'HARD_T2', 'Herdingstest Trener 2', 2);

insert into public.course_runs (id, template_id, title, start_year, starts_on, ends_on, status)
values
  ('48000000-0000-0000-0000-000000000001', '38000000-0000-0000-0000-000000000001', 'Herdingstest A', 2027, '2027-02-01', '2027-10-31', 'active'),
  ('48000000-0000-0000-0000-000000000002', '38000000-0000-0000-0000-000000000001', 'Herdingstest B', 2027, '2027-02-01', '2027-10-31', 'active');

insert into public.course_sessions (id, course_run_id, title, starts_at, ends_at, sort_order)
values
  ('58000000-0000-0000-0000-000000000001', '48000000-0000-0000-0000-000000000001', 'Samling 1', '2027-03-01 17:00+01', '2027-03-01 21:00+01', 1),
  ('58000000-0000-0000-0000-000000000002', '48000000-0000-0000-0000-000000000002', 'Samling 1', '2027-03-08 17:00+01', '2027-03-08 21:00+01', 1);

insert into public.role_assignments (profile_id, role, course_template_id, course_run_id, granted_by)
values
  ('18000000-0000-0000-0000-000000000001', 'administrator', null, null, '18000000-0000-0000-0000-000000000001'),
  ('18000000-0000-0000-0000-000000000002', 'administrator', null, null, '18000000-0000-0000-0000-000000000001'),
  ('18000000-0000-0000-0000-000000000003', 'administrator', null, null, '18000000-0000-0000-0000-000000000001'),
  ('18000000-0000-0000-0000-000000000004', 'administrator', null, null, '18000000-0000-0000-0000-000000000001'),
  ('18000000-0000-0000-0000-000000000060', 'student', null, '48000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000001');

-- Læringsstruktur i kjøring A (utkast er nok for FK-ene).
insert into public.learning_paths (id, course_run_id, title, created_by)
values ('8a000000-0000-0000-0000-000000000001', '48000000-0000-0000-0000-000000000001', 'Herdingsløp', '18000000-0000-0000-0000-000000000001');

insert into public.modules (id, learning_path_id, title, sort_order)
values ('8b000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000001', 'Modul', 1);

insert into public.activities (
  id, learning_path_id, module_id, title, activity_type, completion_mode,
  content_item_id, required, weight, sort_order
)
values
  ('8c000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-000000000001', 'Prøve', 'knowledge_test', 'quiz_pass', null, true, 1, 1),
  ('8c000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000001', '8b000000-0000-0000-0000-000000000001', 'Praksis', 'knowledge_test', 'quiz_pass', null, true, 1, 2);

insert into public.quiz_definitions (id, activity_id, revision_number, title, pass_percent, created_by)
values ('9a000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-000000000001', 1, 'Herdingsprøve', 70, '18000000-0000-0000-0000-000000000001');

insert into public.enrollments (id, course_run_id, profile_id, status)
values
  ('68000000-0000-0000-0000-000000000010', '48000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000010', 'active'),
  ('68000000-0000-0000-0000-000000000011', '48000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000011', 'active'),
  ('68000000-0000-0000-0000-000000000020', '48000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000020', 'active'),
  ('68000000-0000-0000-0000-000000000021', '48000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000021', 'active'),
  ('68000000-0000-0000-0000-000000000022', '48000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000022', 'active'),
  ('68000000-0000-0000-0000-000000000023', '48000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000023', 'active'),
  ('68000000-0000-0000-0000-000000000024', '48000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000024', 'active'),
  ('68000000-0000-0000-0000-000000000025', '48000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000025', 'active'),
  ('68000000-0000-0000-0000-000000000026', '48000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000026', 'active'),
  ('68000000-0000-0000-0000-000000000030', '48000000-0000-0000-0000-000000000002', '18000000-0000-0000-0000-000000000030', 'active');

-- Én rad per aktivitetsbærende tabell som gammel deteksjon ikke så.
insert into public.attendance_records (
  enrollment_id, course_run_id, session_id, planned_minutes, present_minutes, reason, recorded_by
)
values
  ('68000000-0000-0000-0000-000000000010', '48000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000001', 780, 660, 'Registrert oppmøte', '18000000-0000-0000-0000-000000000001'),
  ('68000000-0000-0000-0000-000000000011', '48000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000001', 780, 780, 'Registrert oppmøte', '18000000-0000-0000-0000-000000000001'),
  ('68000000-0000-0000-0000-000000000020', '48000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000001', 780, 120, 'Registrert oppmøte', '18000000-0000-0000-0000-000000000001');

insert into public.university_requirements (enrollment_id, course_run_id, completed, note, verified_by, verified_at)
values
  ('68000000-0000-0000-0000-000000000010', '48000000-0000-0000-0000-000000000001', true, 'Verifisert mot vitnemål', '18000000-0000-0000-0000-000000000001', now()),
  ('68000000-0000-0000-0000-000000000022', '48000000-0000-0000-0000-000000000001', false, 'Avventer dokumentasjon', null, null);

insert into public.quiz_attempts (
  enrollment_id, course_run_id, learning_path_id, activity_id, quiz_definition_id,
  idempotency_key, question_version_ids, earned_points, possible_points, percent, passed
)
values (
  '68000000-0000-0000-0000-000000000021', '48000000-0000-0000-0000-000000000001',
  '8a000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-000000000001',
  '9a000000-0000-0000-0000-000000000001', gen_random_uuid(),
  array['9b000000-0000-0000-0000-000000000001']::uuid[], 4, 10, 40, false
);

insert into public.enrollment_progress (
  enrollment_id, course_run_id, learning_path_id,
  completed_weight, total_weight, completed_required_count, total_required_count, percentage
)
values
  ('68000000-0000-0000-0000-000000000023', '48000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000001', 5, 10, 1, 2, 50),
  ('68000000-0000-0000-0000-000000000026', '48000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000001', 0, 10, 0, 2, 0)
on conflict (enrollment_id, learning_path_id) do update
set
  completed_weight = excluded.completed_weight,
  total_weight = excluded.total_weight,
  completed_required_count = excluded.completed_required_count,
  total_required_count = excluded.total_required_count,
  percentage = excluded.percentage;

insert into public.completion_overrides (enrollment_id, course_run_id, gate_code, reason, approved_by)
values ('68000000-0000-0000-0000-000000000024', '48000000-0000-0000-0000-000000000001', 'attendance', 'Dokumentert fravær', '18000000-0000-0000-0000-000000000001');

insert into public.practice_entries (
  enrollment_id, course_run_id, learning_path_id, activity_id,
  occurred_on, minutes, category, description, idempotency_key, created_by
)
values (
  '68000000-0000-0000-0000-000000000025', '48000000-0000-0000-0000-000000000001',
  '8a000000-0000-0000-0000-000000000001', '8c000000-0000-0000-0000-000000000002',
  '2027-03-05', 45, 'delivery', 'Gjennomført økt', gen_random_uuid(),
  '18000000-0000-0000-0000-000000000025'
);

-- Uinnløste invitasjoner til e-postene i merge-kjeden R -> Q -> P.
insert into public.invitations (id, normalized_email, token_hash, course_run_id, role, expires_at, created_by)
values
  ('78000000-0000-0000-0000-000000000001', 'rita.rot@hard.invalid', repeat('cd34', 16), '48000000-0000-0000-0000-000000000001', 'student', now() + interval '30 days', '18000000-0000-0000-0000-000000000001'),
  ('78000000-0000-0000-0000-000000000002', 'rita.r.rot@hard.invalid', repeat('ef56', 16), '48000000-0000-0000-0000-000000000001', 'student', now() + interval '30 days', '18000000-0000-0000-0000-000000000001');

-- Funn 1/2 (enhetsnivå): alle aktivitetsbærende tabeller er synlige.
select ok(
  private.enrollment_has_activity('68000000-0000-0000-0000-000000000020'),
  'attendance record counts as enrollment activity'
);
select ok(
  private.enrollment_has_activity('68000000-0000-0000-0000-000000000021'),
  'quiz attempt counts as enrollment activity'
);
select ok(
  private.enrollment_has_activity('68000000-0000-0000-0000-000000000022'),
  'university requirement record counts as enrollment activity'
);
select ok(
  private.enrollment_has_activity('68000000-0000-0000-0000-000000000023'),
  'recorded progress weight counts as enrollment activity'
);
select ok(
  private.enrollment_has_activity('68000000-0000-0000-0000-000000000024'),
  'completion override counts as enrollment activity'
);
select ok(
  private.enrollment_has_activity('68000000-0000-0000-0000-000000000025'),
  'practice entry counts as enrollment activity'
);
select ok(
  not private.enrollment_has_activity('68000000-0000-0000-0000-000000000026'),
  'auto-initialized zero progress is not activity'
);
select ok(
  private.enrollment_activity_fingerprint('68000000-0000-0000-0000-000000000020')
    ?& array[
      'attendanceRecords', 'quizAttempts', 'universityRequirements',
      'completionOverrides', 'practiceEntries', 'enrollmentProgressRows'
    ],
  'activity fingerprint covers the previously invisible tables'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '28000000-0000-0000-0000-000000000001', true);

-- Funn 1 (angrep): begge profiler har oppmøte i samme kurs -> stopp.
select throws_ok(
  $$select public.merge_people('18000000-0000-0000-0000-000000000010', '18000000-0000-0000-0000-000000000011', 'Duplikat med oppmøte')$$,
  '22023', 'MERGE_COURSE_CONFLICT',
  'attendance on both sides of a same-course merge is a conflict'
);

reset role;

select is(
  (select status::text from public.enrollments where id = '68000000-0000-0000-0000-000000000010'),
  'active',
  'refused attendance-conflict merge leaves the source enrollment untouched'
);

-- Funn 2 (angrep): nytt oppmøte etter sammenslåing -> manuell reversering.
set local role authenticated;

select lives_ok(
  $$select public.merge_people('18000000-0000-0000-0000-000000000030', '18000000-0000-0000-0000-000000000031', 'Duplikat')$$,
  'conflict-free merge succeeds'
);

reset role;

insert into public.attendance_records (
  enrollment_id, course_run_id, session_id, planned_minutes, present_minutes, reason, recorded_by
)
values (
  '68000000-0000-0000-0000-000000000030', '48000000-0000-0000-0000-000000000002',
  '58000000-0000-0000-0000-000000000002', 780, 780, 'Nytt oppmøte etter sammenslåing',
  '18000000-0000-0000-0000-000000000001'
);

create temporary table hardening_reversal_target on commit drop as
select id from public.person_merges
where source_profile_id = '18000000-0000-0000-0000-000000000030';
grant select on hardening_reversal_target to authenticated;

set local role authenticated;

select is(
  (select public.reverse_merge((select id from hardening_reversal_target))) ->> 'status',
  'manual_reversal_required',
  'new attendance on a moved enrollment forces manual reversal'
);

reset role;

select is(
  (select profile_id from public.enrollments where id = '68000000-0000-0000-0000-000000000030'),
  '18000000-0000-0000-0000-000000000031'::uuid,
  'refused reversal leaves the moved enrollment on the kept profile'
);

-- Funn 3 (angrep): kjeden R -> Q -> P, anonymiser P.
set local role authenticated;

select lives_ok(
  $$select public.merge_people('18000000-0000-0000-0000-000000000050', '18000000-0000-0000-0000-000000000051', 'Duplikat R inn i Q')$$,
  'merge R into Q succeeds'
);
select lives_ok(
  $$select public.merge_people('18000000-0000-0000-0000-000000000051', '18000000-0000-0000-0000-000000000052', 'Duplikat Q inn i P')$$,
  'merge Q into P succeeds'
);
select lives_ok(
  $$select public.anonymize_person('18000000-0000-0000-0000-000000000052', 'SAK-HARD-3', '18000000-0000-0000-0000-000000000002')$$,
  'anonymizing the end of a merge chain succeeds'
);

reset role;

select is(
  (select display_name from public.profiles where id = '18000000-0000-0000-0000-000000000050'),
  'Anonymisert deltaker',
  'profile two merge hops away is scrubbed'
);
select is(
  (select normalized_email from public.profiles where id = '18000000-0000-0000-0000-000000000050'),
  'anonymisert-18000000-0000-0000-0000-000000000050@anonymisert.invalid',
  'email two merge hops away is scrubbed'
);
select is(
  (select source_snapshot ->> 'display_name' from public.person_merges where source_profile_id = '18000000-0000-0000-0000-000000000050'),
  'Anonymisert deltaker',
  'merge snapshot two hops away is scrubbed'
);
select is(
  (select normalized_email from public.invitations where id = '78000000-0000-0000-0000-000000000001'),
  'anonymisert-78000000-0000-0000-0000-000000000001@anonymisert.invalid',
  'unclaimed invitation to the deepest chain email is scrubbed'
);
select is(
  (select normalized_email from public.invitations where id = '78000000-0000-0000-0000-000000000002'),
  'anonymisert-78000000-0000-0000-0000-000000000002@anonymisert.invalid',
  'unclaimed invitation to the middle chain email is scrubbed'
);

-- Funn 4 (angrep): godkjenner- og målvern i anonymize_person.
set local role authenticated;

select throws_ok(
  $$select public.anonymize_person('18000000-0000-0000-0000-000000000003', 'SAK-HARD-4A', '18000000-0000-0000-0000-000000000003')$$,
  '22023', 'ANONYMIZE_APPROVER_MUST_DIFFER',
  'the target cannot approve their own anonymization'
);
select throws_ok(
  $$select public.anonymize_person('18000000-0000-0000-0000-000000000003', 'SAK-HARD-4B', '18000000-0000-0000-0000-000000000002')$$,
  '42501', 'ANONYMIZE_TARGET_PRIVILEGED',
  'a target with an active administrator role is refused'
);
select throws_ok(
  $$select public.anonymize_person('18000000-0000-0000-0000-000000000001', 'SAK-HARD-4C', '18000000-0000-0000-0000-000000000002')$$,
  '42501', 'ANONYMIZE_SELF_FORBIDDEN',
  'an administrator cannot anonymize themselves'
);
select throws_ok(
  $$select public.anonymize_person('18000000-0000-0000-0000-000000000060', 'SAK-HARD-4D', '18000000-0000-0000-0000-000000000004')$$,
  '22023', 'ANONYMIZE_APPROVER_ANONYMIZED',
  'an anonymized shell cannot act as approver'
);
select lives_ok(
  $$select public.anonymize_person('18000000-0000-0000-0000-000000000060', 'SAK-HARD-4E', '18000000-0000-0000-0000-000000000002')$$,
  'anonymizing an unprivileged participant succeeds'
);

reset role;

select is(
  (
    select count(*) from public.role_assignments
    where profile_id = '18000000-0000-0000-0000-000000000060'
      and revoked_at is null
  ),
  0::bigint,
  'anonymization revokes every active role assignment of the target'
);

select * from finish();

rollback;
