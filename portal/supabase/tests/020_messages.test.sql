begin;

select plan(26);

select has_table('public', 'messages', 'messages table exists');

-- Append-only: ingen direkte skrive- eller endringstilgang.
select ok(
  not has_table_privilege('authenticated', 'public.messages', 'INSERT'),
  'authenticated cannot insert messages directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.messages', 'UPDATE'),
  'authenticated cannot update messages'
);
select ok(
  not has_table_privilege('authenticated', 'public.messages', 'DELETE'),
  'authenticated cannot delete messages'
);
select ok(
  not has_table_privilege('anon', 'public.messages', 'SELECT'),
  'anonymous callers cannot read messages'
);

-- Testdata: lærer A (kurs A), lærer B (kurs B), studentene S1/S2 (kurs A),
-- S3 med inaktiv enrollment, og en global editor.

insert into auth.users (id, email, email_confirmed_at)
values
  ('26000000-0000-0000-0000-000000000001', 'msg-lead-a@example.invalid', now()),
  ('26000000-0000-0000-0000-000000000002', 'msg-lead-b@example.invalid', now()),
  ('26000000-0000-0000-0000-000000000003', 'msg-student1@example.invalid', now()),
  ('26000000-0000-0000-0000-000000000004', 'msg-student2@example.invalid', now()),
  ('26000000-0000-0000-0000-000000000005', 'msg-editor@example.invalid', now()),
  ('26000000-0000-0000-0000-000000000006', 'msg-student3@example.invalid', now());

insert into public.profiles (id, display_name, normalized_email)
values
  ('16000000-0000-0000-0000-000000000001', 'Melding Leder A', 'msg-lead-a@example.invalid'),
  ('16000000-0000-0000-0000-000000000002', 'Melding Leder B', 'msg-lead-b@example.invalid'),
  ('16000000-0000-0000-0000-000000000003', 'Melding Student 1', 'msg-student1@example.invalid'),
  ('16000000-0000-0000-0000-000000000004', 'Melding Student 2', 'msg-student2@example.invalid'),
  ('16000000-0000-0000-0000-000000000005', 'Melding Editor', 'msg-editor@example.invalid'),
  ('16000000-0000-0000-0000-000000000006', 'Melding Student 3', 'msg-student3@example.invalid');

insert into public.user_accounts (user_id, profile_id, normalized_email)
values
  ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001', 'msg-lead-a@example.invalid'),
  ('26000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000002', 'msg-lead-b@example.invalid'),
  ('26000000-0000-0000-0000-000000000003', '16000000-0000-0000-0000-000000000003', 'msg-student1@example.invalid'),
  ('26000000-0000-0000-0000-000000000004', '16000000-0000-0000-0000-000000000004', 'msg-student2@example.invalid'),
  ('26000000-0000-0000-0000-000000000005', '16000000-0000-0000-0000-000000000005', 'msg-editor@example.invalid'),
  ('26000000-0000-0000-0000-000000000006', '16000000-0000-0000-0000-000000000006', 'msg-student3@example.invalid');

insert into public.course_templates (id, code, title, level)
values ('36000000-0000-0000-0000-000000000001', 'MSG_T1', 'Meldingstest Trener 1', 1);

insert into public.course_runs (id, template_id, title, start_year, starts_on, ends_on, status)
values
  ('46000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', 'Meldingstest A', 2027, '2027-02-01', '2027-10-31', 'active'),
  ('46000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', 'Meldingstest B', 2027, '2027-02-01', '2027-10-31', 'active');

insert into public.role_assignments (profile_id, role, course_run_id, granted_by)
values
  ('16000000-0000-0000-0000-000000000001', 'course_lead', '46000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001'),
  ('16000000-0000-0000-0000-000000000002', 'course_teacher', '46000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000001');

insert into public.role_assignments (profile_id, role, granted_by)
values ('16000000-0000-0000-0000-000000000005', 'editor', '16000000-0000-0000-0000-000000000001');

insert into public.enrollments (id, course_run_id, profile_id, status)
values
  ('66000000-0000-0000-0000-000000000001', '46000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000003', 'active'),
  ('66000000-0000-0000-0000-000000000002', '46000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000004', 'active'),
  ('66000000-0000-0000-0000-000000000003', '46000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000006', 'invited');

-- Lærer A sender til egen deltaker S1.

set local role authenticated;
select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000001', true);

select isnt(
  public.send_message(
    '66000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000003',
    'Hei! Husk innleveringen til fredag.'
  ),
  null,
  'course lead sends a message to own active participant'
);

select isnt(
  public.send_message(
    '66000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000003',
    'Oppfølging: si fra om du trenger mer tid.'
  ),
  null,
  'second message the same day is stored as well'
);

select throws_ok(
  $$select public.send_message(
    '66000000-0000-0000-0000-000000000003',
    '16000000-0000-0000-0000-000000000006',
    'Hei S3'
  )$$,
  '22023',
  'MESSAGE_ENROLLMENT_INACTIVE',
  'teacher cannot message a participant without active enrollment'
);

select throws_ok(
  $$select public.send_message(
    '66000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000003',
    repeat('x', 4001)
  )$$,
  '22023',
  'MESSAGE_BODY_INVALID',
  'body over 4000 characters is rejected'
);

reset role;

select is(
  (
    select count(*)::integer from public.outbox_events
    where idempotency_key like
      'message_received:66000000-0000-0000-0000-000000000001:16000000-0000-0000-0000-000000000003:%'
  ),
  1,
  'two sends the same day enqueue exactly one notification'
);

select is(
  (
    select count(*)::integer from public.messages
    where enrollment_id = '66000000-0000-0000-0000-000000000001'
  ),
  2,
  'both messages are stored'
);

-- Student S1 svarer sin lærer, men kan ikke sende til andre.

set local role authenticated;
select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000003', true);

select isnt(
  public.send_message(
    '66000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001',
    'Takk, jeg leverer i kveld.'
  ),
  null,
  'student replies to the course lead in own course'
);

select throws_ok(
  $$select public.send_message(
    '66000000-0000-0000-0000-000000000002',
    '16000000-0000-0000-0000-000000000004',
    'Hei fremmed'
  )$$,
  '42501',
  'MESSAGE_FORBIDDEN',
  'student cannot use another student''s enrollment'
);

select throws_ok(
  $$select public.send_message(
    '66000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000004',
    'Hei medstudent'
  )$$,
  '42501',
  'MESSAGE_FORBIDDEN',
  'student cannot message a fellow student'
);

select throws_ok(
  $$select public.send_message(
    '66000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000002',
    'Hei feil lærer'
  )$$,
  '42501',
  'MESSAGE_FORBIDDEN',
  'student cannot message staff of another course'
);

select is(
  (select count(*)::integer from public.messages),
  3,
  'student sees own thread with the course lead'
);

select is(
  (
    select array_agg(distinct counterpart.display_name)
    from public.message_thread_counterparts() as counterpart
  ),
  array['Melding Leder A'],
  'thread counterparts expose only the course lead name'
);

-- Lærer B (annet kurs) kan verken sende eller lese.

select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$select public.send_message(
    '66000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000003',
    'Hei fra feil kurs'
  )$$,
  '42501',
  'MESSAGE_FORBIDDEN',
  'staff of another course cannot message the participant'
);

select is(
  (select count(*)::integer from public.messages),
  0,
  'staff of another course reads no messages'
);

-- Editor kan verken sende eller lese.

select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000005', true);

select throws_ok(
  $$select public.send_message(
    '66000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000003',
    'Hei fra editor'
  )$$,
  '42501',
  'MESSAGE_FORBIDDEN',
  'global editor cannot send messages'
);

select is(
  (select count(*)::integer from public.messages),
  0,
  'global editor reads no messages'
);

-- Medstudent S2 leser ingenting og kan ikke markere andres tråd som lest.

select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000004', true);

select is(
  (select count(*)::integer from public.messages),
  0,
  'fellow student reads no messages from the thread'
);

select is(
  public.mark_messages_read(
    '66000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001'
  ),
  0,
  'non-recipient marks nothing as read'
);

-- read_at settes kun av mottaker.

reset role;

select is(
  (
    select count(*)::integer from public.messages
    where recipient_profile_id = '16000000-0000-0000-0000-000000000003'
      and read_at is null
  ),
  2,
  'messages to the student are still unread'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '26000000-0000-0000-0000-000000000003', true);

select is(
  public.mark_messages_read(
    '66000000-0000-0000-0000-000000000001',
    '16000000-0000-0000-0000-000000000001'
  ),
  2,
  'recipient marks own thread as read'
);

reset role;

select is(
  (
    select count(*)::integer from public.messages
    where recipient_profile_id = '16000000-0000-0000-0000-000000000003'
      and read_at is null
  ),
  0,
  'read_at is set for the recipient after marking'
);

select * from finish();

rollback;
