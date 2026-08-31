begin;

insert into public.profiles (
  id,
  display_name,
  normalized_email,
  club_name,
  birth_year
)
values
  ('c0000000-0000-0000-0000-000000000016', 'Kari Ferdig', 'kari.ferdig@nivaa.invalid', 'Oslo GK', 1996),
  ('c0000000-0000-0000-0000-000000000017', 'Trond «50%»', 'trond.50@nivaa.invalid', 'Losby GK', 1997),
  ('c0000000-0000-0000-0000-000000000018', 'Jonas «henger etter»', 'jonas.henger.etter@nivaa.invalid', 'Fana GK', 1998),
  ('c0000000-0000-0000-0000-000000000019', 'Amalie Solberg', 'amalie.solberg@nivaa.invalid', 'Byneset GK', 1999),
  ('c0000000-0000-0000-0000-000000000020', 'Bendik Nilsen', 'bendik.nilsen@nivaa.invalid', 'Stavanger GK', 2000),
  ('c0000000-0000-0000-0000-000000000021', 'Camilla Røed', 'camilla.roed@nivaa.invalid', 'Romerike GK', 2001),
  ('c0000000-0000-0000-0000-000000000022', 'Daniel Moen', 'daniel.moen@nivaa.invalid', 'Onsøy GK', 2002),
  ('c0000000-0000-0000-0000-000000000023', 'Eva Lunde', 'eva.lunde@nivaa.invalid', 'Oslo GK', 2003),
  ('c0000000-0000-0000-0000-000000000024', 'Fredrik Berg', 'fredrik.berg@nivaa.invalid', 'Grenland og Omegn GK', 2004),
  ('c0000000-0000-0000-0000-000000000025', 'Guro Hagen', 'guro.hagen@nivaa.invalid', 'Kristiansund og Omegn GK', 2005),
  ('c0000000-0000-0000-0000-000000000026', 'Håkon Lie', 'hakon.lie@nivaa.invalid', 'Sandane GK', 2006),
  ('c0000000-0000-0000-0000-000000000027', 'Ida Strand', 'ida.strand@nivaa.invalid', 'Losby GK', 2007),
  ('c0000000-0000-0000-0000-000000000028', 'Kristian Vik', 'kristian.vik@nivaa.invalid', 'Fana GK', 2008),
  ('c0000000-0000-0000-0000-000000000029', 'Line Aasen', 'line.aasen@nivaa.invalid', 'Elverum GK', 1991),
  ('c0000000-0000-0000-0000-000000000030', 'Martin Dale', 'martin.dale@nivaa.invalid', 'Byneset GK', 1992),
  ('c0000000-0000-0000-0000-000000000031', 'Nina Holm', 'nina.holm@nivaa.invalid', 'Stavanger GK', 1993),
  ('c0000000-0000-0000-0000-000000000032', 'Ole Pettersen', 'ole.pettersen@nivaa.invalid', 'Romerike GK', 1994)
on conflict (id) do update set
  display_name = excluded.display_name,
  normalized_email = excluded.normalized_email,
  club_name = excluded.club_name,
  birth_year = excluded.birth_year;

insert into public.enrollments (course_run_id, profile_id, status)
select
  'b1030000-0000-0000-0000-000000000001',
  profile.id,
  'active'
from public.profiles as profile
where profile.id between
  'c0000000-0000-0000-0000-000000000016'
  and 'c0000000-0000-0000-0000-000000000032'
on conflict (course_run_id, profile_id) do nothing;

insert into public.role_assignments (
  profile_id,
  role,
  course_run_id,
  granted_by
)
select
  profile.id,
  'student',
  'b1030000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001'
from public.profiles as profile
where profile.id between
  'c0000000-0000-0000-0000-000000000016'
  and 'c0000000-0000-0000-0000-000000000032'
on conflict do nothing;

insert into public.activity_completions (
  enrollment_id,
  course_run_id,
  learning_path_id,
  activity_id,
  source,
  completed_by,
  completed_at
)
select
  enrollment.id,
  enrollment.course_run_id,
  'a3000000-0000-0000-0000-000000000001',
  completed_activity.activity_id,
  'system',
  enrollment.profile_id,
  demo.completed_at
from public.enrollments as enrollment
join (
  values
    ('c0000000-0000-0000-0000-000000000016'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid, 'a3200000-0000-0000-0000-000000000002'::uuid, 'a3200000-0000-0000-0000-000000000003'::uuid, 'a3200000-0000-0000-0000-000000000005'::uuid, 'a3200000-0000-0000-0000-000000000006'::uuid, 'a3200000-0000-0000-0000-000000000007'::uuid], '2026-08-25T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000017'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid, 'a3200000-0000-0000-0000-000000000002'::uuid, 'a3200000-0000-0000-0000-000000000003'::uuid], '2026-07-18T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000018'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid], '2026-03-01T10:00:00+01:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000019'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid, 'a3200000-0000-0000-0000-000000000002'::uuid, 'a3200000-0000-0000-0000-000000000003'::uuid, 'a3200000-0000-0000-0000-000000000005'::uuid, 'a3200000-0000-0000-0000-000000000006'::uuid], '2026-08-20T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000020'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid, 'a3200000-0000-0000-0000-000000000002'::uuid, 'a3200000-0000-0000-0000-000000000003'::uuid, 'a3200000-0000-0000-0000-000000000006'::uuid], '2026-08-18T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000021'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid, 'a3200000-0000-0000-0000-000000000002'::uuid, 'a3200000-0000-0000-0000-000000000006'::uuid], '2026-08-14T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000022'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid, 'a3200000-0000-0000-0000-000000000002'::uuid, 'a3200000-0000-0000-0000-000000000003'::uuid], '2026-08-12T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000023'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid, 'a3200000-0000-0000-0000-000000000002'::uuid, 'a3200000-0000-0000-0000-000000000007'::uuid], '2026-08-10T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000024'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid, 'a3200000-0000-0000-0000-000000000003'::uuid], '2026-07-29T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000025'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid], '2026-07-20T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000026'::uuid, array['a3200000-0000-0000-0000-000000000003'::uuid], '2026-07-11T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000027'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid, 'a3200000-0000-0000-0000-000000000002'::uuid, 'a3200000-0000-0000-0000-000000000003'::uuid, 'a3200000-0000-0000-0000-000000000006'::uuid, 'a3200000-0000-0000-0000-000000000007'::uuid], '2026-08-22T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000028'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid, 'a3200000-0000-0000-0000-000000000002'::uuid, 'a3200000-0000-0000-0000-000000000003'::uuid, 'a3200000-0000-0000-0000-000000000006'::uuid], '2026-08-16T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000029'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid, 'a3200000-0000-0000-0000-000000000002'::uuid, 'a3200000-0000-0000-0000-000000000006'::uuid], '2026-08-08T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000030'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid, 'a3200000-0000-0000-0000-000000000002'::uuid], '2026-07-30T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000031'::uuid, array['a3200000-0000-0000-0000-000000000001'::uuid, 'a3200000-0000-0000-0000-000000000003'::uuid], '2026-07-23T10:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000032'::uuid, array['a3200000-0000-0000-0000-000000000003'::uuid], '2026-07-12T10:00:00+02:00'::timestamptz)
) as demo(profile_id, activity_ids, completed_at)
  on demo.profile_id = enrollment.profile_id
cross join lateral unnest(demo.activity_ids) as completed_activity(activity_id)
on conflict (enrollment_id, activity_id) do nothing;

insert into public.attendance_records (
  enrollment_id,
  course_run_id,
  session_id,
  planned_minutes,
  present_minutes,
  reason,
  recorded_by,
  recorded_at,
  updated_at
)
select
  enrollment.id,
  enrollment.course_run_id,
  session.id,
  420,
  case
    when enrollment.profile_id = 'c0000000-0000-0000-0000-000000000018' and session.sort_order = 1 then 210
    when enrollment.profile_id = 'c0000000-0000-0000-0000-000000000018' and session.sort_order = 2 then 0
    else 420
  end,
  'Fiktivt oppmøte for demonstrasjon',
  'c0000000-0000-0000-0000-000000000004',
  '2026-08-25T12:00:00+02:00',
  '2026-08-25T12:00:00+02:00'
from public.enrollments as enrollment
join public.course_sessions as session
  on session.course_run_id = enrollment.course_run_id
  and session.session_type = 'regular'
  and session.is_required
where enrollment.profile_id in (
  'c0000000-0000-0000-0000-000000000016',
  'c0000000-0000-0000-0000-000000000017',
  'c0000000-0000-0000-0000-000000000018'
)
and (
  enrollment.profile_id = 'c0000000-0000-0000-0000-000000000016'
  or (enrollment.profile_id = 'c0000000-0000-0000-0000-000000000017' and session.sort_order <= 3)
  or (enrollment.profile_id = 'c0000000-0000-0000-0000-000000000018' and session.sort_order <= 2)
)
on conflict (enrollment_id, session_id) do update set
  planned_minutes = excluded.planned_minutes,
  present_minutes = excluded.present_minutes,
  reason = excluded.reason,
  recorded_by = excluded.recorded_by,
  updated_at = excluded.updated_at;

insert into public.university_requirements (
  enrollment_id,
  course_run_id,
  completed,
  note,
  verified_by,
  verified_at,
  updated_at
)
select
  enrollment.id,
  enrollment.course_run_id,
  true,
  'Fiktivt universitetskrav kontrollert for demonstrasjon',
  'c0000000-0000-0000-0000-000000000001',
  '2026-08-25T12:10:00+02:00',
  '2026-08-25T12:10:00+02:00'
from public.enrollments as enrollment
where enrollment.profile_id = 'c0000000-0000-0000-0000-000000000016'
  and enrollment.course_run_id = 'b1030000-0000-0000-0000-000000000001'
on conflict (enrollment_id) do update set
  completed = excluded.completed,
  note = excluded.note,
  verified_by = excluded.verified_by,
  verified_at = excluded.verified_at,
  updated_at = excluded.updated_at;

insert into public.assignment_submissions (
  id,
  enrollment_id,
  course_run_id,
  learning_path_id,
  activity_id,
  status,
  current_version_number,
  created_at,
  updated_at
)
select
  demo.submission_id,
  enrollment.id,
  enrollment.course_run_id,
  'a3000000-0000-0000-0000-000000000001',
  'a3200000-0000-0000-0000-000000000007',
  demo.status::public.assignment_submission_status,
  1,
  demo.created_at,
  demo.updated_at
from public.enrollments as enrollment
join (
  values
    ('c0000000-0000-0000-0000-000000000016'::uuid, 'a6000000-0000-0000-0000-000000000001'::uuid, 'approved'::text, '2026-08-10T12:00:00+02:00'::timestamptz, '2026-08-12T14:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000017'::uuid, 'a6000000-0000-0000-0000-000000000002'::uuid, 'submitted'::text, '2026-08-28T09:00:00+02:00'::timestamptz, '2026-08-28T09:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000018'::uuid, 'a6000000-0000-0000-0000-000000000003'::uuid, 'revision_required'::text, '2026-06-02T09:00:00+02:00'::timestamptz, '2026-06-05T11:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000019'::uuid, 'a6000000-0000-0000-0000-000000000004'::uuid, 'submitted'::text, '2026-08-27T13:30:00+02:00'::timestamptz, '2026-08-27T13:30:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000020'::uuid, 'a6000000-0000-0000-0000-000000000005'::uuid, 'revision_required'::text, '2026-08-15T10:00:00+02:00'::timestamptz, '2026-08-18T15:00:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000021'::uuid, 'a6000000-0000-0000-0000-000000000006'::uuid, 'submitted'::text, '2026-08-26T08:15:00+02:00'::timestamptz, '2026-08-26T08:15:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000022'::uuid, 'a6000000-0000-0000-0000-000000000007'::uuid, 'submitted'::text, '2026-08-24T18:45:00+02:00'::timestamptz, '2026-08-24T18:45:00+02:00'::timestamptz),
    ('c0000000-0000-0000-0000-000000000023'::uuid, 'a6000000-0000-0000-0000-000000000008'::uuid, 'approved'::text, '2026-08-06T11:30:00+02:00'::timestamptz, '2026-08-09T09:20:00+02:00'::timestamptz)
) as demo(profile_id, submission_id, status, created_at, updated_at)
  on demo.profile_id = enrollment.profile_id
on conflict do nothing;

insert into public.assignment_submission_versions (
  id,
  submission_id,
  version_number,
  note,
  submitted_by,
  submitted_at
)
select
  demo.version_id,
  demo.submission_id,
  1,
  demo.note,
  enrollment.profile_id,
  demo.submitted_at
from public.assignment_submissions as submission
join public.enrollments as enrollment on enrollment.id = submission.enrollment_id
join (
  values
    ('a6000000-0000-0000-0000-000000000001'::uuid, 'a6100000-0000-0000-0000-000000000001'::uuid, 'Ferdig treningsplan med mål, øvelser og evaluering.'::text, '2026-08-10T12:00:00+02:00'::timestamptz),
    ('a6000000-0000-0000-0000-000000000002'::uuid, 'a6100000-0000-0000-0000-000000000002'::uuid, 'Halvveis i løpet og klar for tilbakemelding.'::text, '2026-08-28T09:00:00+02:00'::timestamptz),
    ('a6000000-0000-0000-0000-000000000003'::uuid, 'a6100000-0000-0000-0000-000000000003'::uuid, 'Første utkast. Trenger hjelp til evalueringen.'::text, '2026-06-02T09:00:00+02:00'::timestamptz),
    ('a6000000-0000-0000-0000-000000000004'::uuid, 'a6100000-0000-0000-0000-000000000004'::uuid, 'Plan for inkluderende økt med juniorgruppen.'::text, '2026-08-27T13:30:00+02:00'::timestamptz),
    ('a6000000-0000-0000-0000-000000000005'::uuid, 'a6100000-0000-0000-0000-000000000005'::uuid, 'Oppdatert etter samling tre.'::text, '2026-08-15T10:00:00+02:00'::timestamptz),
    ('a6000000-0000-0000-0000-000000000006'::uuid, 'a6100000-0000-0000-0000-000000000006'::uuid, 'Øktplan for voksne nybegynnere.'::text, '2026-08-26T08:15:00+02:00'::timestamptz),
    ('a6000000-0000-0000-0000-000000000007'::uuid, 'a6100000-0000-0000-0000-000000000007'::uuid, 'Øktplan for regional juniorsamling.'::text, '2026-08-24T18:45:00+02:00'::timestamptz),
    ('a6000000-0000-0000-0000-000000000008'::uuid, 'a6100000-0000-0000-0000-000000000008'::uuid, 'Godkjent plan med tydelig differensiering.'::text, '2026-08-06T11:30:00+02:00'::timestamptz)
) as demo(submission_id, version_id, note, submitted_at)
  on demo.submission_id = submission.id
on conflict (id) do nothing;

insert into public.assignment_reviews (
  id,
  submission_id,
  submission_version_id,
  action,
  scale,
  result_value,
  comment,
  reviewed_by,
  reviewed_at
)
values
  ('a6200000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'a6100000-0000-0000-0000-000000000001', 'approve', 'pass_fail', 'approved', 'Godkjent. Planen viser tydelige mål og gode tilpasninger.', 'c0000000-0000-0000-0000-000000000004', '2026-08-12T14:00:00+02:00'),
  ('a6200000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000003', 'a6100000-0000-0000-0000-000000000003', 'request_revision', null, null, 'Beskriv hvordan økten skal evalueres og legg inn ny realistisk frist.', 'c0000000-0000-0000-0000-000000000004', '2026-06-05T11:00:00+02:00'),
  ('a6200000-0000-0000-0000-000000000003', 'a6000000-0000-0000-0000-000000000005', 'a6100000-0000-0000-0000-000000000005', 'request_revision', null, null, 'Tydeliggjør tilpasningen til spillere med ulikt ferdighetsnivå.', 'c0000000-0000-0000-0000-000000000004', '2026-08-18T15:00:00+02:00'),
  ('a6200000-0000-0000-0000-000000000004', 'a6000000-0000-0000-0000-000000000008', 'a6100000-0000-0000-0000-000000000008', 'approve', 'pass_fail', 'approved', 'Godkjent med presise læringsmål og god differensiering.', 'c0000000-0000-0000-0000-000000000004', '2026-08-09T09:20:00+02:00')
on conflict (id) do nothing;

select private.try_complete_enrollment(enrollment.id)
from public.enrollments as enrollment
where enrollment.profile_id = 'c0000000-0000-0000-0000-000000000016'
  and enrollment.course_run_id = 'b1030000-0000-0000-0000-000000000001';

commit;
