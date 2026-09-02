begin;

select plan(26);

select has_table('public', 'scheduled_reminders', 'scheduled reminders table exists');
select has_table('public', 'notification_deliveries', 'notification deliveries table exists');
select has_table('public', 'notification_incidents', 'notification incidents table exists');

select ok(
  not has_table_privilege('authenticated', 'public.scheduled_reminders', 'SELECT'),
  'authenticated cannot read scheduled reminders directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.scheduled_reminders', 'INSERT'),
  'authenticated cannot write scheduled reminders directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.notification_deliveries', 'SELECT'),
  'authenticated cannot read notification deliveries directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.notification_incidents', 'SELECT'),
  'authenticated cannot read notification incidents directly'
);
select ok(
  not has_table_privilege('anon', 'public.notification_deliveries', 'SELECT'),
  'anonymous callers cannot read notification deliveries'
);

select ok(
  has_function_privilege('authenticated', 'public.enqueue_due_reminder(uuid)', 'EXECUTE'),
  'authenticated can enqueue manual reminders'
);
select ok(
  not has_function_privilege('authenticated', 'public.claim_notification_events(text[], integer, timestamptz)', 'EXECUTE'),
  'authenticated cannot claim outbox events'
);
select ok(
  not has_function_privilege('authenticated', 'public.fail_notification_event(uuid, text, timestamptz)', 'EXECUTE'),
  'authenticated cannot fail outbox events'
);
select ok(
  not has_function_privilege('authenticated', 'public.complete_notification_event(uuid, text)', 'EXECUTE'),
  'authenticated cannot complete outbox events'
);
select ok(
  not has_function_privilege('authenticated', 'public.rotate_invitation_token(uuid, text)', 'EXECUTE'),
  'authenticated cannot rotate invitation tokens'
);

-- Gjør claim-testen deterministisk uavhengig av tidligere kjøringer;
-- transaksjonen rulles tilbake, så ingenting slettes permanent.
delete from public.outbox_events
where status = 'pending'
  and event_type in ('notification.email', 'invitation.email');

-- Testdata: kursleder for kurs A, kursleder for kurs B og en student i kurs A.

insert into auth.users (id, email, email_confirmed_at)
values
  ('25000000-0000-0000-0000-000000000001', 'notif-lead-a@example.invalid', now()),
  ('25000000-0000-0000-0000-000000000002', 'notif-lead-b@example.invalid', now()),
  ('25000000-0000-0000-0000-000000000003', 'notif-student@example.invalid', now());

insert into public.profiles (id, display_name, normalized_email)
values
  ('15000000-0000-0000-0000-000000000001', 'Notif Leder A', 'notif-lead-a@example.invalid'),
  ('15000000-0000-0000-0000-000000000002', 'Notif Leder B', 'notif-lead-b@example.invalid'),
  ('15000000-0000-0000-0000-000000000003', 'Notif Student', 'notif-student@example.invalid');

insert into public.user_accounts (user_id, profile_id, normalized_email)
values
  ('25000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'notif-lead-a@example.invalid'),
  ('25000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000002', 'notif-lead-b@example.invalid'),
  ('25000000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000003', 'notif-student@example.invalid');

insert into public.course_templates (id, code, title, level)
values ('35000000-0000-0000-0000-000000000001', 'NOTIF_T1', 'Notiftest Trener 1', 1);

insert into public.course_runs (id, template_id, title, start_year, starts_on, ends_on, status)
values
  ('45000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'Notiftest A', 2027, '2027-02-01', '2027-10-31', 'active'),
  ('45000000-0000-0000-0000-000000000002', '35000000-0000-0000-0000-000000000001', 'Notiftest B', 2027, '2027-02-01', '2027-10-31', 'active');

insert into public.role_assignments (profile_id, role, course_run_id, granted_by)
values
  ('15000000-0000-0000-0000-000000000001', 'course_lead', '45000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001'),
  ('15000000-0000-0000-0000-000000000002', 'course_lead', '45000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001');

insert into public.enrollments (id, course_run_id, profile_id, status)
values (
  '65000000-0000-0000-0000-000000000001',
  '45000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-000000000003',
  'active'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000001', true);

select isnt(
  public.enqueue_due_reminder('65000000-0000-0000-0000-000000000001'),
  null,
  'course lead enqueues a manual reminder for own participant'
);

select is(
  public.enqueue_due_reminder('65000000-0000-0000-0000-000000000001'),
  public.enqueue_due_reminder('65000000-0000-0000-0000-000000000001'),
  'duplicate reminder the same Oslo day returns the existing event'
);

reset role;

select is(
  (
    select count(*)::integer from public.outbox_events
    where idempotency_key like 'due_reminder:65000000-0000-0000-0000-000000000001:%'
  ),
  1,
  'duplicate manual reminder creates exactly one outbox event'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$select public.enqueue_due_reminder('65000000-0000-0000-0000-000000000001')$$,
  '42501',
  'REMINDER_FORBIDDEN',
  'lead of another course cannot send the reminder'
);

select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$select public.enqueue_due_reminder('65000000-0000-0000-0000-000000000001')$$,
  '42501',
  'REMINDER_FORBIDDEN',
  'students cannot send reminders'
);

reset role;

-- Worker-løpet: claim -> fail (retry) -> incident etter fem forsøk.

select is(
  (
    select count(*)::integer
    from public.claim_notification_events(array['notification.email'], 10, now())
  ),
  1,
  'worker claims the pending reminder event'
);

select results_eq(
  $$
    select status, attempts::integer from public.outbox_events
    where idempotency_key like 'due_reminder:65000000-0000-0000-0000-000000000001:%'
  $$,
  $$values ('processing'::text, 1)$$,
  'claimed event is processing with one attempt'
);

select is(
  public.fail_notification_event(
    (
      select id from public.outbox_events
      where idempotency_key like 'due_reminder:65000000-0000-0000-0000-000000000001:%'
    ),
    'SMTP_500',
    now() + interval '1 minute'
  ),
  'retry_scheduled',
  'first failure schedules a retry'
);

select isnt(
  (
    select delivery.next_retry_at
    from public.notification_deliveries as delivery
    join public.outbox_events as event on event.id = delivery.outbox_event_id
    where event.idempotency_key like 'due_reminder:65000000-0000-0000-0000-000000000001:%'
  ),
  null,
  'delivery row tracks the next retry time'
);

update public.outbox_events
set status = 'processing', attempts = 5
where idempotency_key like 'due_reminder:65000000-0000-0000-0000-000000000001:%';

select is(
  public.fail_notification_event(
    (
      select id from public.outbox_events
      where idempotency_key like 'due_reminder:65000000-0000-0000-0000-000000000001:%'
    ),
    'SMTP_500',
    now() + interval '1 minute'
  ),
  'incident_created',
  'fifth failure stops retrying and creates an incident'
);

select is(
  (
    select count(*)::integer
    from public.notification_incidents as incident
    join public.outbox_events as event on event.id = incident.outbox_event_id
    where event.idempotency_key like 'due_reminder:65000000-0000-0000-0000-000000000001:%'
  ),
  1,
  'incident row exists for the dead event'
);

-- Tokenrotasjon for invitasjoner.

insert into public.invitations (id, normalized_email, token_hash, course_run_id, role, expires_at, created_by)
values
  (
    '75000000-0000-0000-0000-000000000001',
    'rotate.open@example.invalid',
    repeat('a', 64),
    '45000000-0000-0000-0000-000000000001',
    'student',
    now() + interval '7 days',
    '15000000-0000-0000-0000-000000000001'
  ),
  (
    '75000000-0000-0000-0000-000000000002',
    'rotate.claimed@example.invalid',
    repeat('c', 64),
    '45000000-0000-0000-0000-000000000001',
    'student',
    now() + interval '7 days',
    '15000000-0000-0000-0000-000000000001'
  );

update public.invitations
set claimed_at = now(), claimed_by = '15000000-0000-0000-0000-000000000003'
where id = '75000000-0000-0000-0000-000000000002';

select public.rotate_invitation_token('75000000-0000-0000-0000-000000000001', repeat('b', 64));

select is(
  (select token_hash from public.invitations where id = '75000000-0000-0000-0000-000000000001'),
  repeat('b', 64),
  'rotation stores only the new hash and invalidates the old link'
);

select throws_ok(
  $$select public.rotate_invitation_token('75000000-0000-0000-0000-000000000002', repeat('d', 64))$$,
  'P0001',
  'INVITATION_ROTATE_INVALID',
  'claimed invitations cannot be rotated'
);

select * from finish();

rollback;
