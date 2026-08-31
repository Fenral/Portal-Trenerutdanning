create temporary table demo_seed_users (
  position smallint primary key,
  display_name text not null,
  email text not null,
  club_name text not null
) on commit drop;

insert into demo_seed_users (position, display_name, email, club_name)
values
  (1, 'Ada Admin', 'admin.demo@nivaa.invalid', 'Norges Golfforbund'),
  (2, 'Terje Trener 1', 'teacher.demo@nivaa.invalid', 'Oslo GK'),
  (3, 'Lise Trener 2', 'lead.t2@nivaa.invalid', 'Elverum GK'),
  (4, 'Liv Trener 3', 'lead.t3@nivaa.invalid', 'Losby GK'),
  (5, 'Nora Nordmann', 'student.demo@nivaa.invalid', 'Fana GK'),
  (6, 'Emil Berg', 'emil.berg@nivaa.invalid', 'Stavanger GK'),
  (7, 'Selma Dahl', 'selma.dahl@nivaa.invalid', 'Onsøy GK'),
  (8, 'Henrik Aas', 'henrik.aas@nivaa.invalid', 'Losby GK'),
  (9, 'Thea Bakke', 'thea.bakke@nivaa.invalid', 'Stavanger GK'),
  (10, 'Mina Eide', 'mina.eide@nivaa.invalid', 'Byneset GK'),
  (11, 'Jakob Fjell', 'jakob.fjell@nivaa.invalid', 'Sandane GK'),
  (12, 'Ingrid Gran', 'ingrid.gran@nivaa.invalid', 'Romerike GK'),
  (13, 'Oskar Haug', 'oskar.haug@nivaa.invalid', 'Kristiansund og Omegn GK'),
  (14, 'Sofie Iversen', 'sofie.iversen@nivaa.invalid', 'Grenland og Omegn GK'),
  (15, 'Marius Kvale', 'marius.kvale@nivaa.invalid', 'Oslo GK'),
  (16, 'Kari Ferdig', 'kari.ferdig@nivaa.invalid', 'Oslo GK'),
  (17, 'Trond «50%»', 'trond.50@nivaa.invalid', 'Losby GK'),
  (18, 'Jonas «henger etter»', 'jonas.henger.etter@nivaa.invalid', 'Fana GK'),
  (19, 'Amalie Solberg', 'amalie.solberg@nivaa.invalid', 'Byneset GK'),
  (20, 'Bendik Nilsen', 'bendik.nilsen@nivaa.invalid', 'Stavanger GK'),
  (21, 'Camilla Røed', 'camilla.roed@nivaa.invalid', 'Romerike GK'),
  (22, 'Daniel Moen', 'daniel.moen@nivaa.invalid', 'Onsøy GK'),
  (23, 'Eva Lunde', 'eva.lunde@nivaa.invalid', 'Oslo GK'),
  (24, 'Fredrik Berg', 'fredrik.berg@nivaa.invalid', 'Grenland og Omegn GK'),
  (25, 'Guro Hagen', 'guro.hagen@nivaa.invalid', 'Kristiansund og Omegn GK'),
  (26, 'Håkon Lie', 'hakon.lie@nivaa.invalid', 'Sandane GK'),
  (27, 'Ida Strand', 'ida.strand@nivaa.invalid', 'Losby GK'),
  (28, 'Kristian Vik', 'kristian.vik@nivaa.invalid', 'Fana GK'),
  (29, 'Line Aasen', 'line.aasen@nivaa.invalid', 'Elverum GK'),
  (30, 'Martin Dale', 'martin.dale@nivaa.invalid', 'Byneset GK'),
  (31, 'Nina Holm', 'nina.holm@nivaa.invalid', 'Stavanger GK'),
  (32, 'Ole Pettersen', 'ole.pettersen@nivaa.invalid', 'Romerike GK');

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  ('d0000000-0000-0000-0000-' || lpad(position::text, 12, '0'))::uuid,
  'authenticated',
  'authenticated',
  email,
  extensions.crypt('Nivaa-demo-2026!', extensions.gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', display_name, 'email_verified', true),
  now(),
  now()
from demo_seed_users;

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at
)
select
  ('e0000000-0000-0000-0000-' || lpad(position::text, 12, '0'))::uuid,
  ('d0000000-0000-0000-0000-' || lpad(position::text, 12, '0'))::uuid,
  jsonb_build_object(
    'sub',
    ('d0000000-0000-0000-0000-' || lpad(position::text, 12, '0'))::uuid,
    'email',
    email,
    'email_verified',
    true,
    'phone_verified',
    false
  ),
  'email',
  ('d0000000-0000-0000-0000-' || lpad(position::text, 12, '0')),
  now(),
  now()
from demo_seed_users;

insert into public.profiles (
  id,
  display_name,
  normalized_email,
  club_name,
  birth_year
)
select
  ('c0000000-0000-0000-0000-' || lpad(position::text, 12, '0'))::uuid,
  display_name,
  email,
  club_name,
  case
    when position in (7, 9) then 2009
    when position >= 16 then 1980 + (position % 18)
    else 1988 + position
  end
from demo_seed_users;

insert into public.user_accounts (user_id, profile_id, normalized_email)
select
  ('d0000000-0000-0000-0000-' || lpad(position::text, 12, '0'))::uuid,
  ('c0000000-0000-0000-0000-' || lpad(position::text, 12, '0'))::uuid,
  email
from demo_seed_users;

insert into public.course_templates (id, code, title, level)
values
  ('a1000000-0000-0000-0000-000000000001', 'T1', 'Trener 1', 1),
  ('a1000000-0000-0000-0000-000000000002', 'T2', 'Trener 2', 2),
  ('a1000000-0000-0000-0000-000000000003', 'T3', 'Trener 3', 3);

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
values
  ('b1010000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Trener 1 · Kristiansund og Omegn GK', 2026, 'Kristiansund og Omegn GK', '2026-05-22', '2026-09-27', 'active'),
  ('b1010000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Trener 1 · Oslo GK', 2026, 'Oslo GK', '2026-05-29', '2026-09-20', 'active'),
  ('b1010000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Trener 1 · Onsøy GK', 2026, 'Onsøy GK', '2026-04-10', '2026-09-06', 'active'),
  ('b1010000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'Trener 1 · Stavanger GK', 2026, 'Stavanger GK', '2026-04-17', '2026-09-06', 'active'),
  ('b1010000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'Trener 1 · Fana GK', 2026, 'Fana GK', '2026-04-24', '2026-09-13', 'active'),
  ('b1010000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'Trener 1 · Grenland og Omegn GK', 2026, 'Grenland og Omegn GK', '2026-04-10', '2026-09-13', 'active'),
  ('b1010000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 'Trener 1 · Romerike GK', 2026, 'Romerike GK', '2026-04-24', '2026-09-20', 'active'),
  ('b1010000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', 'Trener 1 · Byneset GK', 2026, 'Byneset GK', '2026-05-22', '2026-09-27', 'active'),
  ('b1010000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', 'Trener 1 · Sandane GK', 2026, 'Sandane GK', '2026-04-10', '2026-09-20', 'active'),
  ('b1020000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'Trener 2 · 2026', 2026, 'Elverum', '2026-03-20', '2026-09-18', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 'Trener 3 · 2026–2027', 2026, null, '2026-02-15', '2027-03-21', 'active');

insert into public.course_sessions (
  id,
  course_run_id,
  title,
  starts_at,
  ends_at,
  location_text,
  sort_order,
  session_type,
  is_required
)
values
  ('f1010000-0000-0000-0001-000000000001', 'b1010000-0000-0000-0000-000000000001', 'Samling 1', '2026-05-22T09:00:00+02:00', '2026-05-24T16:00:00+02:00', 'Kristiansund og Omegn GK', 1, 'regular', true),
  ('f1010000-0000-0000-0001-000000000002', 'b1010000-0000-0000-0000-000000000001', 'Ungdomsdriven', '2026-07-01T09:00:00+02:00', '2026-07-03T16:00:00+02:00', 'Hafjell GK', 2, 'youth_drive', false),
  ('f1010000-0000-0000-0001-000000000003', 'b1010000-0000-0000-0000-000000000001', 'Samling 2', '2026-09-26T09:00:00+02:00', '2026-09-27T16:00:00+02:00', 'Kristiansund og Omegn GK', 3, 'regular', true),
  ('f1010000-0000-0000-0002-000000000001', 'b1010000-0000-0000-0000-000000000002', 'Samling 1', '2026-05-29T09:00:00+02:00', '2026-05-31T16:00:00+02:00', 'Oslo GK', 1, 'regular', true),
  ('f1010000-0000-0000-0002-000000000002', 'b1010000-0000-0000-0000-000000000002', 'Ungdomsdriven', '2026-07-01T09:00:00+02:00', '2026-07-03T16:00:00+02:00', 'Hafjell GK', 2, 'youth_drive', false),
  ('f1010000-0000-0000-0002-000000000003', 'b1010000-0000-0000-0000-000000000002', 'Samling 2', '2026-09-19T09:00:00+02:00', '2026-09-20T16:00:00+02:00', 'Oslo GK', 3, 'regular', true),
  ('f1010000-0000-0000-0003-000000000001', 'b1010000-0000-0000-0000-000000000003', 'Samling 1', '2026-04-10T09:00:00+02:00', '2026-04-12T16:00:00+02:00', 'Onsøy GK', 1, 'regular', true),
  ('f1010000-0000-0000-0003-000000000002', 'b1010000-0000-0000-0000-000000000003', 'Ungdomsdriven', '2026-07-01T09:00:00+02:00', '2026-07-03T16:00:00+02:00', 'Hafjell GK', 2, 'youth_drive', false),
  ('f1010000-0000-0000-0003-000000000003', 'b1010000-0000-0000-0000-000000000003', 'Samling 2', '2026-09-05T09:00:00+02:00', '2026-09-06T16:00:00+02:00', 'Onsøy GK', 3, 'regular', true),
  ('f1010000-0000-0000-0004-000000000001', 'b1010000-0000-0000-0000-000000000004', 'Samling 1', '2026-04-17T09:00:00+02:00', '2026-04-19T16:00:00+02:00', 'Stavanger GK', 1, 'regular', true),
  ('f1010000-0000-0000-0004-000000000002', 'b1010000-0000-0000-0000-000000000004', 'Ungdomsdriven', '2026-07-01T09:00:00+02:00', '2026-07-03T16:00:00+02:00', 'Hafjell GK', 2, 'youth_drive', false),
  ('f1010000-0000-0000-0004-000000000003', 'b1010000-0000-0000-0000-000000000004', 'Samling 2', '2026-09-05T09:00:00+02:00', '2026-09-06T16:00:00+02:00', 'Stavanger GK', 3, 'regular', true),
  ('f1010000-0000-0000-0005-000000000001', 'b1010000-0000-0000-0000-000000000005', 'Samling 1', '2026-04-24T09:00:00+02:00', '2026-04-26T16:00:00+02:00', 'Fana GK', 1, 'regular', true),
  ('f1010000-0000-0000-0005-000000000002', 'b1010000-0000-0000-0000-000000000005', 'Ungdomsdriven', '2026-07-01T09:00:00+02:00', '2026-07-03T16:00:00+02:00', 'Hafjell GK', 2, 'youth_drive', false),
  ('f1010000-0000-0000-0005-000000000003', 'b1010000-0000-0000-0000-000000000005', 'Samling 2', '2026-09-12T09:00:00+02:00', '2026-09-13T16:00:00+02:00', 'Fana GK', 3, 'regular', true),
  ('f1010000-0000-0000-0006-000000000001', 'b1010000-0000-0000-0000-000000000006', 'Samling 1', '2026-04-10T09:00:00+02:00', '2026-04-12T16:00:00+02:00', 'Grenland og Omegn GK', 1, 'regular', true),
  ('f1010000-0000-0000-0006-000000000002', 'b1010000-0000-0000-0000-000000000006', 'Ungdomsdriven', '2026-07-01T09:00:00+02:00', '2026-07-03T16:00:00+02:00', 'Hafjell GK', 2, 'youth_drive', false),
  ('f1010000-0000-0000-0006-000000000003', 'b1010000-0000-0000-0000-000000000006', 'Samling 2', '2026-09-12T09:00:00+02:00', '2026-09-13T16:00:00+02:00', 'Grenland og Omegn GK', 3, 'regular', true),
  ('f1010000-0000-0000-0007-000000000001', 'b1010000-0000-0000-0000-000000000007', 'Samling 1', '2026-04-24T09:00:00+02:00', '2026-04-26T16:00:00+02:00', 'Romerike GK', 1, 'regular', true),
  ('f1010000-0000-0000-0007-000000000002', 'b1010000-0000-0000-0000-000000000007', 'Ungdomsdriven', '2026-07-01T09:00:00+02:00', '2026-07-03T16:00:00+02:00', 'Hafjell GK', 2, 'youth_drive', false),
  ('f1010000-0000-0000-0007-000000000003', 'b1010000-0000-0000-0000-000000000007', 'Samling 2', '2026-09-19T09:00:00+02:00', '2026-09-20T16:00:00+02:00', 'Romerike GK', 3, 'regular', true),
  ('f1010000-0000-0000-0008-000000000001', 'b1010000-0000-0000-0000-000000000008', 'Samling 1', '2026-05-22T09:00:00+02:00', '2026-05-24T16:00:00+02:00', 'Byneset GK', 1, 'regular', true),
  ('f1010000-0000-0000-0008-000000000002', 'b1010000-0000-0000-0000-000000000008', 'Ungdomsdriven', '2026-07-01T09:00:00+02:00', '2026-07-03T16:00:00+02:00', 'Hafjell GK', 2, 'youth_drive', false),
  ('f1010000-0000-0000-0008-000000000003', 'b1010000-0000-0000-0000-000000000008', 'Samling 2', '2026-09-26T09:00:00+02:00', '2026-09-27T16:00:00+02:00', 'Byneset GK', 3, 'regular', true),
  ('f1010000-0000-0000-0009-000000000001', 'b1010000-0000-0000-0000-000000000009', 'Samling 1', '2026-04-10T09:00:00+02:00', '2026-04-12T16:00:00+02:00', 'Sandane GK', 1, 'regular', true),
  ('f1010000-0000-0000-0009-000000000002', 'b1010000-0000-0000-0000-000000000009', 'Ungdomsdriven', '2026-07-01T09:00:00+02:00', '2026-07-03T16:00:00+02:00', 'Hafjell GK', 2, 'youth_drive', false),
  ('f1010000-0000-0000-0009-000000000003', 'b1010000-0000-0000-0000-000000000009', 'Samling 2', '2026-09-19T09:00:00+02:00', '2026-09-20T16:00:00+02:00', 'Sandane GK', 3, 'regular', true),
  ('f1020000-0000-0000-0000-000000000001', 'b1020000-0000-0000-0000-000000000001', 'Samling 1', '2026-03-20T13:00:00+01:00', '2026-03-20T18:00:00+01:00', 'Elverum / Terningen Arena', 1, 'regular', true),
  ('f1020000-0000-0000-0000-000000000002', 'b1020000-0000-0000-0000-000000000001', 'Samling 2', '2026-05-01T09:00:00+02:00', '2026-05-03T16:00:00+02:00', 'Elverum Golfklubb', 2, 'regular', true),
  ('f1020000-0000-0000-0000-000000000003', 'b1020000-0000-0000-0000-000000000001', 'Samling 3', '2026-09-18T09:00:00+02:00', '2026-09-18T16:00:00+02:00', 'Elverum Golfklubb', 3, 'regular', true),
  ('f1030000-0000-0000-0000-000000000001', 'b1030000-0000-0000-0000-000000000001', 'Samling 1', '2026-02-15T09:00:00+01:00', '2026-02-15T16:00:00+01:00', 'I forlengelse av fellessamling 1', 1, 'regular', true),
  ('f1030000-0000-0000-0000-000000000002', 'b1030000-0000-0000-0000-000000000001', 'Samling 2', '2026-03-13T09:00:00+01:00', '2026-03-15T16:00:00+01:00', null, 2, 'regular', true),
  ('f1030000-0000-0000-0000-000000000003', 'b1030000-0000-0000-0000-000000000001', 'Samling 3', '2026-05-08T09:00:00+02:00', '2026-05-10T16:00:00+02:00', null, 3, 'regular', true),
  ('f1030000-0000-0000-0000-000000000004', 'b1030000-0000-0000-0000-000000000001', 'Samling 4', '2026-09-20T09:00:00+02:00', '2026-09-20T16:00:00+02:00', 'I forlengelse av fellessamling 2', 4, 'regular', true),
  ('f1030000-0000-0000-0000-000000000005', 'b1030000-0000-0000-0000-000000000001', 'Samling 5', '2027-02-07T09:00:00+01:00', '2027-02-07T16:00:00+01:00', 'I forbindelse med fellessamling 3', 5, 'regular', true),
  ('f1030000-0000-0000-0000-000000000006', 'b1030000-0000-0000-0000-000000000001', 'Samling 6', '2027-03-19T09:00:00+01:00', '2027-03-21T16:00:00+01:00', null, 6, 'regular', true);

insert into public.role_assignments (
  profile_id,
  role,
  course_template_id,
  course_run_id,
  granted_by
)
values
  ('c0000000-0000-0000-0000-000000000001', 'administrator', null, null, 'c0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002', 'course_teacher', 'a1000000-0000-0000-0000-000000000001', null, 'c0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000003', 'course_lead', null, 'b1020000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000004', 'course_lead', null, 'b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001');

insert into public.enrollments (course_run_id, profile_id, status)
values
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000006', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'active'),
  ('b1020000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000008', 'active'),
  ('b1020000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000009', 'active'),
  ('b1020000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000010', 'active'),
  ('b1010000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000011', 'active'),
  ('b1010000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000012', 'active'),
  ('b1010000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000013', 'active'),
  ('b1010000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000014', 'active'),
  ('b1010000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000015', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000016', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000017', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000018', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000019', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000020', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000021', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000022', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000023', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000024', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000025', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000026', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000027', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000028', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000029', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000030', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000031', 'active'),
  ('b1030000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000032', 'active');

insert into public.role_assignments (
  profile_id,
  role,
  course_run_id,
  granted_by
)
select
  enrollment.profile_id,
  'student',
  enrollment.course_run_id,
  'c0000000-0000-0000-0000-000000000001'
from public.enrollments as enrollment;

insert into public.content_items (
  id,
  kind,
  slug,
  title,
  created_by,
  created_at
)
values (
  'a2000000-0000-0000-0000-000000000001',
  'lesson',
  'ballfluktslover-og-balltreff',
  'Ballfluktslover og balltreff',
  'c0000000-0000-0000-0000-000000000001',
  '2026-08-20T09:00:00+02:00'
);

insert into public.content_revisions (
  id,
  content_item_id,
  revision_number,
  status,
  document,
  change_note,
  created_by,
  created_at,
  published_by,
  published_at,
  updated_at
)
values
  (
    'a2100000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    1,
    'published',
    '{"locale":"nb-NO","format":"short_page","blocks":[{"type":"heading","level":2,"text":"Ballfluktslover og balltreff"},{"type":"paragraph","text":"Lær hvordan kølleblad og svingbane påvirker ballens startretning og kurve."},{"type":"callout","tone":"practice","title":"Ta med til samling","text":"Observer startretningen før du vurderer ballens kurve."},{"type":"video","provider":"trackman","url":"https://ondemand.trackmangolf.com/example","required":true}]}'::jsonb,
    'Første publiserte versjon',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T09:00:00+02:00',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T10:00:00+02:00',
    '2026-08-20T10:00:00+02:00'
  ),
  (
    'a2100000-0000-0000-0000-000000000002',
    'a2000000-0000-0000-0000-000000000001',
    2,
    'draft',
    '{"locale":"nb-NO","format":"short_page","blocks":[{"type":"heading","level":2,"text":"Ballfluktslover og balltreff"},{"type":"paragraph","text":"Lær hvordan kølleblad og svingbane påvirker ballens startretning og kurve."},{"type":"callout","tone":"practice","title":"Ta med til samling","text":"Observer startretningen før du vurderer ballens kurve."},{"type":"video","provider":"trackman","url":"https://ondemand.trackmangolf.com/example","required":true}]}'::jsonb,
    'Kladd fra publisert versjon',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T10:00:00+02:00',
    null,
    null,
    '2026-08-20T10:00:00+02:00'
  );

insert into public.course_content_bindings (
  course_run_id,
  content_item_id,
  content_revision_id,
  bound_by,
  bound_at
)
values (
  'b1030000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'a2100000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  '2026-08-20T10:00:00+02:00'
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
  uploaded_by,
  created_at
)
values
  (
    'a2300000-0000-0000-0000-000000000001',
    'demo/ballfluktslover-pensum.pdf',
    'ballfluktslover-pensum.pdf',
    'application/pdf',
    24576,
    repeat('a', 64),
    'clean',
    '2026-08-20T09:15:00+02:00',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T09:10:00+02:00'
  ),
  (
    'a2300000-0000-0000-0000-000000000002',
    'demo/ballfluktslover-undervisning.pptx',
    'ballfluktslover-undervisning.pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    53248,
    repeat('b', 64),
    'clean',
    '2026-08-20T09:25:00+02:00',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T09:20:00+02:00'
  ),
  (
    'a2300000-0000-0000-0000-000000000003',
    'demo/observasjonsskjema.xlsx',
    'observasjonsskjema.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    18432,
    repeat('c', 64),
    'clean',
    '2026-08-20T09:35:00+02:00',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T09:30:00+02:00'
  );

insert into public.resource_items (
  id,
  title,
  description,
  audience,
  content_item_id,
  created_by,
  created_at
)
values
  (
    'a2200000-0000-0000-0000-000000000001',
    'Pensum som PDF',
    'Nedlastbar versjon av pensumet.',
    'course_members',
    'a2000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T09:15:00+02:00'
  ),
  (
    'a2200000-0000-0000-0000-000000000002',
    'Undervisningspresentasjon',
    'PowerPoint for kurslærere.',
    'teachers',
    'a2000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T09:25:00+02:00'
  ),
  (
    'a2200000-0000-0000-0000-000000000003',
    'Observasjonsskjema',
    'Excel-ark som kan brukes under praksis.',
    'course_members',
    'a2000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T09:35:00+02:00'
  );

insert into public.resource_revisions (
  id,
  resource_item_id,
  revision_number,
  status,
  media_asset_id,
  change_note,
  created_by,
  created_at,
  published_by,
  published_at,
  updated_at
)
values
  ('a2400000-0000-0000-0000-000000000001', 'a2200000-0000-0000-0000-000000000001', 1, 'published', 'a2300000-0000-0000-0000-000000000001', 'Første publisering', 'c0000000-0000-0000-0000-000000000001', '2026-08-20T09:15:00+02:00', 'c0000000-0000-0000-0000-000000000001', '2026-08-20T09:16:00+02:00', '2026-08-20T09:16:00+02:00'),
  ('a2400000-0000-0000-0000-000000000002', 'a2200000-0000-0000-0000-000000000001', 2, 'draft', 'a2300000-0000-0000-0000-000000000001', 'Kladd fra publisert versjon', 'c0000000-0000-0000-0000-000000000001', '2026-08-20T09:16:00+02:00', null, null, '2026-08-20T09:16:00+02:00'),
  ('a2400000-0000-0000-0000-000000000003', 'a2200000-0000-0000-0000-000000000002', 1, 'published', 'a2300000-0000-0000-0000-000000000002', 'Første publisering', 'c0000000-0000-0000-0000-000000000001', '2026-08-20T09:25:00+02:00', 'c0000000-0000-0000-0000-000000000001', '2026-08-20T09:26:00+02:00', '2026-08-20T09:26:00+02:00'),
  ('a2400000-0000-0000-0000-000000000004', 'a2200000-0000-0000-0000-000000000002', 2, 'draft', 'a2300000-0000-0000-0000-000000000002', 'Kladd fra publisert versjon', 'c0000000-0000-0000-0000-000000000001', '2026-08-20T09:26:00+02:00', null, null, '2026-08-20T09:26:00+02:00'),
  ('a2400000-0000-0000-0000-000000000005', 'a2200000-0000-0000-0000-000000000003', 1, 'published', 'a2300000-0000-0000-0000-000000000003', 'Første publisering', 'c0000000-0000-0000-0000-000000000001', '2026-08-20T09:35:00+02:00', 'c0000000-0000-0000-0000-000000000001', '2026-08-20T09:36:00+02:00', '2026-08-20T09:36:00+02:00'),
  ('a2400000-0000-0000-0000-000000000006', 'a2200000-0000-0000-0000-000000000003', 2, 'draft', 'a2300000-0000-0000-0000-000000000003', 'Kladd fra publisert versjon', 'c0000000-0000-0000-0000-000000000001', '2026-08-20T09:36:00+02:00', null, null, '2026-08-20T09:36:00+02:00');

insert into public.course_resource_bindings (
  course_run_id,
  resource_item_id,
  resource_revision_id,
  bound_by,
  bound_at
)
values
  ('b1030000-0000-0000-0000-000000000001', 'a2200000-0000-0000-0000-000000000001', 'a2400000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '2026-08-20T10:00:00+02:00'),
  ('b1030000-0000-0000-0000-000000000001', 'a2200000-0000-0000-0000-000000000002', 'a2400000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', '2026-08-20T10:00:00+02:00'),
  ('b1030000-0000-0000-0000-000000000001', 'a2200000-0000-0000-0000-000000000003', 'a2400000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', '2026-08-20T10:00:00+02:00');

insert into public.content_items (
  id,
  kind,
  slug,
  title,
  created_by,
  created_at
)
values
  (
    'a2000000-0000-0000-0000-000000000002',
    'lesson',
    'velkommen-til-trener-3',
    'Velkommen til Trener 3',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T08:00:00+02:00'
  ),
  (
    'a2000000-0000-0000-0000-000000000003',
    'lesson',
    'planlegging-av-treningsokt',
    'Planlegging av treningsøkt',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T08:10:00+02:00'
  );

insert into public.content_revisions (
  id,
  content_item_id,
  revision_number,
  status,
  document,
  change_note,
  created_by,
  created_at,
  published_by,
  published_at,
  updated_at
)
values
  (
    'a2100000-0000-0000-0000-000000000003',
    'a2000000-0000-0000-0000-000000000002',
    1,
    'published',
    '{"locale":"nb-NO","format":"short_page","blocks":[{"type":"heading","level":2,"text":"Velkommen til Trener 3"},{"type":"paragraph","text":"Her får du oversikt over læringsløpet, samlingene og hva som anbefales før neste samling."}]}'::jsonb,
    'Første publiserte versjon',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T08:00:00+02:00',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T08:05:00+02:00',
    '2026-08-20T08:05:00+02:00'
  ),
  (
    'a2100000-0000-0000-0000-000000000004',
    'a2000000-0000-0000-0000-000000000002',
    2,
    'draft',
    '{"locale":"nb-NO","format":"short_page","blocks":[{"type":"heading","level":2,"text":"Velkommen til Trener 3"},{"type":"paragraph","text":"Her får du oversikt over læringsløpet, samlingene og hva som anbefales før neste samling."}]}'::jsonb,
    'Kladd fra publisert versjon',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T08:05:00+02:00',
    null,
    null,
    '2026-08-20T08:05:00+02:00'
  ),
  (
    'a2100000-0000-0000-0000-000000000005',
    'a2000000-0000-0000-0000-000000000003',
    1,
    'published',
    '{"locale":"nb-NO","format":"short_page","blocks":[{"type":"heading","level":2,"text":"Planlegging av treningsøkt"},{"type":"paragraph","text":"Lag en tydelig plan med mål, aktivitet og en kort vurdering etter økten."},{"type":"callout","tone":"practice","title":"Før samling","text":"Ta med ett eksempel fra egen klubb."}]}'::jsonb,
    'Første publiserte versjon',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T08:10:00+02:00',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T08:15:00+02:00',
    '2026-08-20T08:15:00+02:00'
  ),
  (
    'a2100000-0000-0000-0000-000000000006',
    'a2000000-0000-0000-0000-000000000003',
    2,
    'draft',
    '{"locale":"nb-NO","format":"short_page","blocks":[{"type":"heading","level":2,"text":"Planlegging av treningsøkt"},{"type":"paragraph","text":"Lag en tydelig plan med mål, aktivitet og en kort vurdering etter økten."},{"type":"callout","tone":"practice","title":"Før samling","text":"Ta med ett eksempel fra egen klubb."}]}'::jsonb,
    'Kladd fra publisert versjon',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T08:15:00+02:00',
    null,
    null,
    '2026-08-20T08:15:00+02:00'
  );

insert into public.course_content_bindings (
  course_run_id,
  content_item_id,
  content_revision_id,
  bound_by,
  bound_at
)
values
  (
    'b1030000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000002',
    'a2100000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T10:00:00+02:00'
  ),
  (
    'b1030000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000003',
    'a2100000-0000-0000-0000-000000000005',
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T10:00:00+02:00'
  );

insert into public.learning_paths (
  id,
  course_run_id,
  title,
  created_by,
  created_at
)
values (
  'a3000000-0000-0000-0000-000000000001',
  'b1030000-0000-0000-0000-000000000001',
  'Trener 3 · 2026–2027',
  'c0000000-0000-0000-0000-000000000001',
  '2026-08-20T10:10:00+02:00'
);

insert into public.modules (
  id,
  learning_path_id,
  title,
  description,
  sort_order
)
values
  (
    'a3100000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001',
    'Kom i gang',
    'Introduksjon og planlegging før første samling.',
    1
  ),
  (
    'a3100000-0000-0000-0000-000000000002',
    'a3000000-0000-0000-0000-000000000001',
    'Golfteknikk',
    'Fagstoff om ballflukt, treff og trenerens observasjoner.',
    2
  ),
  (
    'a3100000-0000-0000-0000-000000000003',
    'a3000000-0000-0000-0000-000000000001',
    'Praksis',
    'Registrering og godkjenning av praksistimer.',
    3
  ),
  (
    'a3100000-0000-0000-0000-000000000004',
    'a3000000-0000-0000-0000-000000000001',
    'Avslutning',
    'Oppsummerende kunnskapsprøve.',
    4
  ),
  (
    'a3100000-0000-0000-0000-000000000005',
    'a3000000-0000-0000-0000-000000000001',
    'Innlevering',
    'Skriftlig oppgave med vurdering og mulighet for utbedring.',
    5
  );

insert into public.activities (
  id,
  learning_path_id,
  module_id,
  title,
  activity_type,
  completion_mode,
  content_item_id,
  required,
  weight,
  sort_order
)
values
  (
    'a3200000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001',
    'a3100000-0000-0000-0000-000000000001',
    'Velkommen til Trener 3',
    'lesson',
    'manual',
    'a2000000-0000-0000-0000-000000000002',
    true,
    2,
    1
  ),
  (
    'a3200000-0000-0000-0000-000000000002',
    'a3000000-0000-0000-0000-000000000001',
    'a3100000-0000-0000-0000-000000000001',
    'Planlegging av treningsøkt',
    'lesson',
    'reach_end',
    'a2000000-0000-0000-0000-000000000003',
    true,
    2,
    2
  ),
  (
    'a3200000-0000-0000-0000-000000000003',
    'a3000000-0000-0000-0000-000000000001',
    'a3100000-0000-0000-0000-000000000002',
    'Ballfluktslover og balltreff',
    'lesson',
    'reach_end',
    'a2000000-0000-0000-0000-000000000001',
    true,
    1,
    1
  ),
  (
    'a3200000-0000-0000-0000-000000000004',
    'a3000000-0000-0000-0000-000000000001',
    'a3100000-0000-0000-0000-000000000002',
    'Ekstra fordypning i ballflukt',
    'lesson',
    'manual',
    'a2000000-0000-0000-0000-000000000001',
    false,
    1,
    2
  ),
  (
    'a3200000-0000-0000-0000-000000000005',
    'a3000000-0000-0000-0000-000000000001',
    'a3100000-0000-0000-0000-000000000003',
    'Praksisregistrering',
    'practice',
    'practice_approved',
    null,
    true,
    1,
    1
  ),
  (
    'a3200000-0000-0000-0000-000000000006',
    'a3000000-0000-0000-0000-000000000001',
    'a3100000-0000-0000-0000-000000000004',
    'Kunnskapsprøve',
    'knowledge_test',
    'quiz_pass',
    null,
    true,
    2,
    1
  ),
  (
    'a3200000-0000-0000-0000-000000000007',
    'a3000000-0000-0000-0000-000000000001',
    'a3100000-0000-0000-0000-000000000005',
    'Innlevering: Planlegg en inkluderende golføkt',
    'assignment',
    'submission_approved',
    null,
    true,
    2,
    1
  );

insert into public.activity_prerequisites (
  learning_path_id,
  activity_id,
  prerequisite_activity_id
)
values
  (
    'a3000000-0000-0000-0000-000000000001',
    'a3200000-0000-0000-0000-000000000002',
    'a3200000-0000-0000-0000-000000000001'
  ),
  (
    'a3000000-0000-0000-0000-000000000001',
    'a3200000-0000-0000-0000-000000000003',
    'a3200000-0000-0000-0000-000000000002'
  ),
  (
    'a3000000-0000-0000-0000-000000000001',
    'a3200000-0000-0000-0000-000000000006',
    'a3200000-0000-0000-0000-000000000001'
  ),
  (
    'a3000000-0000-0000-0000-000000000001',
    'a3200000-0000-0000-0000-000000000006',
    'a3200000-0000-0000-0000-000000000002'
  ),
  (
    'a3000000-0000-0000-0000-000000000001',
    'a3200000-0000-0000-0000-000000000006',
    'a3200000-0000-0000-0000-000000000003'
  );

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-0000-0000-000000000001',
  false
);
select public.publish_learning_path(
  'a3000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001'
);
reset role;

insert into public.activity_completions (
  enrollment_id,
  course_run_id,
  learning_path_id,
  activity_id,
  content_item_id,
  content_revision_id,
  source,
  completed_by,
  completed_at
)
select
  enrollment.id,
  enrollment.course_run_id,
  'a3000000-0000-0000-0000-000000000001',
  completion.activity_id,
  completion.content_item_id,
  completion.content_revision_id,
  'system',
  enrollment.profile_id,
  completion.completed_at
from public.enrollments as enrollment
join (
  values
    (
      'c0000000-0000-0000-0000-000000000005'::uuid,
      'a3200000-0000-0000-0000-000000000001'::uuid,
      'a2000000-0000-0000-0000-000000000002'::uuid,
      'a2100000-0000-0000-0000-000000000003'::uuid,
      '2026-03-01T12:00:00+01:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000005'::uuid,
      'a3200000-0000-0000-0000-000000000002'::uuid,
      'a2000000-0000-0000-0000-000000000003'::uuid,
      'a2100000-0000-0000-0000-000000000005'::uuid,
      '2026-03-08T12:00:00+01:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000006'::uuid,
      'a3200000-0000-0000-0000-000000000001'::uuid,
      'a2000000-0000-0000-0000-000000000002'::uuid,
      'a2100000-0000-0000-0000-000000000003'::uuid,
      '2026-03-04T12:00:00+01:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000007'::uuid,
      'a3200000-0000-0000-0000-000000000001'::uuid,
      'a2000000-0000-0000-0000-000000000002'::uuid,
      'a2100000-0000-0000-0000-000000000003'::uuid,
      '2026-02-22T12:00:00+01:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000007'::uuid,
      'a3200000-0000-0000-0000-000000000002'::uuid,
      'a2000000-0000-0000-0000-000000000003'::uuid,
      'a2100000-0000-0000-0000-000000000005'::uuid,
      '2026-03-02T12:00:00+01:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000007'::uuid,
      'a3200000-0000-0000-0000-000000000003'::uuid,
      'a2000000-0000-0000-0000-000000000001'::uuid,
      'a2100000-0000-0000-0000-000000000001'::uuid,
      '2026-04-02T12:00:00+02:00'::timestamptz
    )
) as completion(
  profile_id,
  activity_id,
  content_item_id,
  content_revision_id,
  completed_at
)
  on completion.profile_id = enrollment.profile_id
where enrollment.course_run_id = 'b1030000-0000-0000-0000-000000000001';

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
    (
      'c0000000-0000-0000-0000-000000000016'::uuid,
      array[
        'a3200000-0000-0000-0000-000000000001'::uuid,
        'a3200000-0000-0000-0000-000000000002'::uuid,
        'a3200000-0000-0000-0000-000000000003'::uuid,
        'a3200000-0000-0000-0000-000000000005'::uuid,
        'a3200000-0000-0000-0000-000000000006'::uuid,
        'a3200000-0000-0000-0000-000000000007'::uuid
      ],
      '2026-08-25T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000017'::uuid,
      array[
        'a3200000-0000-0000-0000-000000000001'::uuid,
        'a3200000-0000-0000-0000-000000000002'::uuid,
        'a3200000-0000-0000-0000-000000000003'::uuid
      ],
      '2026-07-18T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000018'::uuid,
      array['a3200000-0000-0000-0000-000000000001'::uuid],
      '2026-03-01T10:00:00+01:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000019'::uuid,
      array[
        'a3200000-0000-0000-0000-000000000001'::uuid,
        'a3200000-0000-0000-0000-000000000002'::uuid,
        'a3200000-0000-0000-0000-000000000003'::uuid,
        'a3200000-0000-0000-0000-000000000005'::uuid,
        'a3200000-0000-0000-0000-000000000006'::uuid
      ],
      '2026-08-20T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000020'::uuid,
      array[
        'a3200000-0000-0000-0000-000000000001'::uuid,
        'a3200000-0000-0000-0000-000000000002'::uuid,
        'a3200000-0000-0000-0000-000000000003'::uuid,
        'a3200000-0000-0000-0000-000000000006'::uuid
      ],
      '2026-08-18T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000021'::uuid,
      array[
        'a3200000-0000-0000-0000-000000000001'::uuid,
        'a3200000-0000-0000-0000-000000000002'::uuid,
        'a3200000-0000-0000-0000-000000000006'::uuid
      ],
      '2026-08-14T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000022'::uuid,
      array[
        'a3200000-0000-0000-0000-000000000001'::uuid,
        'a3200000-0000-0000-0000-000000000002'::uuid,
        'a3200000-0000-0000-0000-000000000003'::uuid
      ],
      '2026-08-12T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000023'::uuid,
      array[
        'a3200000-0000-0000-0000-000000000001'::uuid,
        'a3200000-0000-0000-0000-000000000002'::uuid,
        'a3200000-0000-0000-0000-000000000007'::uuid
      ],
      '2026-08-10T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000024'::uuid,
      array[
        'a3200000-0000-0000-0000-000000000001'::uuid,
        'a3200000-0000-0000-0000-000000000003'::uuid
      ],
      '2026-07-29T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000025'::uuid,
      array['a3200000-0000-0000-0000-000000000001'::uuid],
      '2026-07-20T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000026'::uuid,
      array['a3200000-0000-0000-0000-000000000003'::uuid],
      '2026-07-11T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000027'::uuid,
      array[
        'a3200000-0000-0000-0000-000000000001'::uuid,
        'a3200000-0000-0000-0000-000000000002'::uuid,
        'a3200000-0000-0000-0000-000000000003'::uuid,
        'a3200000-0000-0000-0000-000000000006'::uuid,
        'a3200000-0000-0000-0000-000000000007'::uuid
      ],
      '2026-08-22T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000028'::uuid,
      array[
        'a3200000-0000-0000-0000-000000000001'::uuid,
        'a3200000-0000-0000-0000-000000000002'::uuid,
        'a3200000-0000-0000-0000-000000000003'::uuid,
        'a3200000-0000-0000-0000-000000000006'::uuid
      ],
      '2026-08-16T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000029'::uuid,
      array[
        'a3200000-0000-0000-0000-000000000001'::uuid,
        'a3200000-0000-0000-0000-000000000002'::uuid,
        'a3200000-0000-0000-0000-000000000006'::uuid
      ],
      '2026-08-08T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000030'::uuid,
      array[
        'a3200000-0000-0000-0000-000000000001'::uuid,
        'a3200000-0000-0000-0000-000000000002'::uuid
      ],
      '2026-07-30T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000031'::uuid,
      array[
        'a3200000-0000-0000-0000-000000000001'::uuid,
        'a3200000-0000-0000-0000-000000000003'::uuid
      ],
      '2026-07-23T10:00:00+02:00'::timestamptz
    ),
    (
      'c0000000-0000-0000-0000-000000000032'::uuid,
      array['a3200000-0000-0000-0000-000000000003'::uuid],
      '2026-07-12T10:00:00+02:00'::timestamptz
    )
) as demo(profile_id, activity_ids, completed_at)
  on demo.profile_id = enrollment.profile_id
cross join lateral unnest(demo.activity_ids) as completed_activity(activity_id)
where enrollment.course_run_id = 'b1030000-0000-0000-0000-000000000001';

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
    when enrollment.profile_id = 'c0000000-0000-0000-0000-000000000018'
      and session.sort_order = 1 then 210
    when enrollment.profile_id = 'c0000000-0000-0000-0000-000000000018'
      and session.sort_order = 2 then 0
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
  or (
    enrollment.profile_id = 'c0000000-0000-0000-0000-000000000017'
    and session.sort_order <= 3
  )
  or (
    enrollment.profile_id = 'c0000000-0000-0000-0000-000000000018'
    and session.sort_order <= 2
  )
);

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
  and enrollment.course_run_id = 'b1030000-0000-0000-0000-000000000001';

select private.try_complete_enrollment(enrollment.id)
from public.enrollments as enrollment
where enrollment.profile_id = 'c0000000-0000-0000-0000-000000000016'
  and enrollment.course_run_id = 'b1030000-0000-0000-0000-000000000001';

insert into public.question_versions (
  id,
  question_key,
  version_number,
  prompt,
  options,
  correct_option_id,
  points,
  created_by,
  created_at,
  published_at
)
values
  (
    'a4100000-0000-0000-0000-000000000001',
    'ballstart',
    1,
    'Hva påvirker ballens startretning mest ved et sentrert treff?',
    '[{"id":"a","label":"Køllehodets hastighet"},{"id":"b","label":"Køllebladets retning i treffet"},{"id":"c","label":"Spillerens oppstilling alene"}]'::jsonb,
    'b',
    1,
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T10:20:00+02:00',
    '2026-08-20T10:25:00+02:00'
  ),
  (
    'a4100000-0000-0000-0000-000000000002',
    'draw-path',
    1,
    'Hvilken kombinasjon kan gi en draw for en høyrehendt spiller?',
    '[{"id":"a","label":"Svingbanen går mer mot høyre enn køllebladet peker"},{"id":"b","label":"Svingbanen går mer mot venstre enn køllebladet peker"},{"id":"c","label":"Kølleblad og svingbane peker alltid helt likt"}]'::jsonb,
    'a',
    1,
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T10:20:00+02:00',
    '2026-08-20T10:25:00+02:00'
  ),
  (
    'a4100000-0000-0000-0000-000000000003',
    'practice-planning-share',
    1,
    'Hvor stor del av praksiskravet kan registreres som planlegging?',
    '[{"id":"a","label":"10 prosent"},{"id":"b","label":"15 prosent"},{"id":"c","label":"20 prosent"}]'::jsonb,
    'c',
    1,
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T10:20:00+02:00',
    '2026-08-20T10:25:00+02:00'
  ),
  (
    'a4100000-0000-0000-0000-000000000004',
    'attendance-requirement',
    1,
    'Hva er minimumskravet til oppmøte i Trenerløypa?',
    '[{"id":"a","label":"70 prosent"},{"id":"b","label":"80 prosent"},{"id":"c","label":"90 prosent"}]'::jsonb,
    'b',
    1,
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T10:20:00+02:00',
    '2026-08-20T10:25:00+02:00'
  ),
  (
    'a4100000-0000-0000-0000-000000000005',
    'practice-hours',
    1,
    'Hvor mange praksistimer må være registrert før praksisen kan sendes inn?',
    '[{"id":"a","label":"45 timer"},{"id":"b","label":"35 timer"},{"id":"c","label":"25 timer"}]'::jsonb,
    'a',
    1,
    'c0000000-0000-0000-0000-000000000001',
    '2026-08-20T10:20:00+02:00',
    '2026-08-20T10:25:00+02:00'
  );

insert into public.quiz_definitions (
  id,
  activity_id,
  revision_number,
  title,
  pass_percent,
  max_attempts,
  retry_delay_hours,
  is_published,
  created_by,
  created_at,
  published_at
)
values (
  'a4000000-0000-0000-0000-000000000001',
  'a3200000-0000-0000-0000-000000000006',
  1,
  'Kunnskapsprøve',
  80,
  null,
  24,
  true,
  'c0000000-0000-0000-0000-000000000001',
  '2026-08-20T10:20:00+02:00',
  '2026-08-20T10:25:00+02:00'
);

insert into public.quiz_question_links (
  quiz_definition_id,
  question_version_id,
  sort_order
)
values
  (
    'a4000000-0000-0000-0000-000000000001',
    'a4100000-0000-0000-0000-000000000001',
    1
  ),
  (
    'a4000000-0000-0000-0000-000000000001',
    'a4100000-0000-0000-0000-000000000002',
    2
  ),
  (
    'a4000000-0000-0000-0000-000000000001',
    'a4100000-0000-0000-0000-000000000003',
    3
  ),
  (
    'a4000000-0000-0000-0000-000000000001',
    'a4100000-0000-0000-0000-000000000004',
    4
  ),
  (
    'a4000000-0000-0000-0000-000000000001',
    'a4100000-0000-0000-0000-000000000005',
    5
  );

insert into public.assignment_definitions (
  activity_id,
  assessment_scale,
  default_deadline,
  instructions,
  created_by,
  created_at
)
values (
  'a3200000-0000-0000-0000-000000000007',
  'pass_fail',
  '2026-12-20T23:59:00+01:00',
  'Last opp planen for en inkluderende golføkt. Beskriv mål, organisering, tilpasning til utøverne og hvordan du vil evaluere økten.',
  'c0000000-0000-0000-0000-000000000001',
  '2026-08-20T10:30:00+02:00'
);

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
where enrollment.course_run_id = 'b1030000-0000-0000-0000-000000000001';

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
  on demo.submission_id = submission.id;

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
  ('a6200000-0000-0000-0000-000000000004', 'a6000000-0000-0000-0000-000000000008', 'a6100000-0000-0000-0000-000000000008', 'approve', 'pass_fail', 'approved', 'Godkjent med presise læringsmål og god differensiering.', 'c0000000-0000-0000-0000-000000000004', '2026-08-09T09:20:00+02:00');

insert into public.practice_definitions (
  activity_id,
  required_minutes,
  max_planning_minutes,
  approval_mode,
  auto_delay_hours,
  created_by,
  created_at,
  updated_at
)
values (
  'a3200000-0000-0000-0000-000000000005',
  2700,
  540,
  'manual_review',
  null,
  'c0000000-0000-0000-0000-000000000001',
  '2026-08-20T10:30:00+02:00',
  '2026-08-20T10:30:00+02:00'
);

insert into public.practice_entries (
  id,
  enrollment_id,
  course_run_id,
  learning_path_id,
  activity_id,
  occurred_on,
  minutes,
  category,
  description,
  idempotency_key,
  created_by,
  created_at
)
select
  demo.id,
  enrollment.id,
  enrollment.course_run_id,
  'a3000000-0000-0000-0000-000000000001',
  'a3200000-0000-0000-0000-000000000005',
  demo.occurred_on,
  demo.minutes,
  demo.category::public.practice_category,
  demo.description,
  demo.idempotency_key,
  enrollment.profile_id,
  demo.created_at
from public.enrollments as enrollment
cross join (
  values
    (
      'a5000000-0000-0000-0000-000000000001'::uuid,
      '2026-05-12'::date,
      900,
      'delivery'::text,
      'Planla og gjennomførte treninger for juniorgruppen.',
      'a5100000-0000-0000-0000-000000000001'::uuid,
      '2026-05-12T20:00:00+02:00'::timestamptz
    ),
    (
      'a5000000-0000-0000-0000-000000000002'::uuid,
      '2026-05-19'::date,
      180,
      'planning'::text,
      'Planla mål, øvelser og tilpasninger for juniorgruppen.',
      'a5100000-0000-0000-0000-000000000002'::uuid,
      '2026-05-19T20:00:00+02:00'::timestamptz
    )
) as demo(
  id,
  occurred_on,
  minutes,
  category,
  description,
  idempotency_key,
  created_at
)
where enrollment.course_run_id = 'b1030000-0000-0000-0000-000000000001'
  and enrollment.profile_id = 'c0000000-0000-0000-0000-000000000005';
