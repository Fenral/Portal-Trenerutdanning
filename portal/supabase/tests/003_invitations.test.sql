begin;

select plan(31);

select ok(
  to_regprocedure(
    'public.create_course_invitation(uuid,text,public.portal_role,text,timestamp with time zone,uuid)'
  ) is not null,
  'transactional invitation creator exists'
);
select ok(
  to_regprocedure('public.inspect_course_invitation(text,timestamp with time zone)') is not null,
  'server-only invitation inspector exists'
);
select ok(
  to_regprocedure('public.claim_course_invitation(text,uuid)') is not null,
  'transactional invitation claim exists'
);
select ok(
  to_regprocedure('public.mark_invitation_delivery(uuid,uuid)') is not null,
  'server-only delivery marker exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_course_invitation(uuid,text,public.portal_role,text,timestamp with time zone,uuid)',
    'EXECUTE'
  ),
  'authenticated callers can invoke the authorization-bound creator'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.claim_course_invitation(text,uuid)',
    'EXECUTE'
  ),
  'authenticated callers can invoke the identity-bound claim'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.claim_course_invitation(text,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot claim invitations'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.inspect_course_invitation(text,timestamp with time zone)',
    'EXECUTE'
  ),
  'exact invited email is not exposed to authenticated clients'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.mark_invitation_delivery(uuid,uuid)',
    'EXECUTE'
  ),
  'clients cannot mark notification delivery'
);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  (
    '21000000-0000-0000-0000-000000000001',
    'admin-invite@example.invalid',
    now(),
    '{"full_name":"Ada Admin"}'::jsonb
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    'lead-invite@example.invalid',
    now(),
    '{"full_name":"Lise Kursleder"}'::jsonb
  ),
  (
    '21000000-0000-0000-0000-000000000003',
    'nora@gmail.com',
    now(),
    '{"full_name":"Nora Nordmann"}'::jsonb
  ),
  (
    '21000000-0000-0000-0000-000000000004',
    'wrong@example.com',
    now(),
    '{"full_name":"Wrong User"}'::jsonb
  ),
  (
    '21000000-0000-0000-0000-000000000005',
    'teacher-invite@example.invalid',
    now(),
    '{"full_name":"Tor Lærer"}'::jsonb
  ),
  (
    '21000000-0000-0000-0000-000000000006',
    'unconfirmed@example.com',
    null,
    '{"full_name":"Ubekreftet Bruker"}'::jsonb
  );

insert into public.profiles (id, display_name, normalized_email)
values
  (
    '11000000-0000-0000-0000-000000000001',
    'Ada Admin',
    'admin-invite@example.invalid'
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    'Lise Kursleder',
    'lead-invite@example.invalid'
  ),
  (
    '11000000-0000-0000-0000-000000000003',
    'Nora Eksisterende',
    'nora@gmail.com'
  ),
  (
    '11000000-0000-0000-0000-000000000005',
    'Tor Lærer',
    'teacher-invite@example.invalid'
  );

insert into public.user_accounts (user_id, profile_id, normalized_email)
values
  (
    '21000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'admin-invite@example.invalid'
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    'lead-invite@example.invalid'
  ),
  (
    '21000000-0000-0000-0000-000000000005',
    '11000000-0000-0000-0000-000000000005',
    'teacher-invite@example.invalid'
  );

insert into public.course_templates (id, code, title, level)
values (
  '31000000-0000-0000-0000-000000000001',
  'INVITE_TEST',
  'Invitation test course',
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
  '41000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  'Invitation test run',
  2026,
  '2026-01-01',
  '2026-12-31',
  'active'
);

insert into public.role_assignments (
  id,
  profile_id,
  role,
  course_run_id,
  granted_by
)
values
  (
    '51000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'administrator',
    null,
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '51000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    'course_lead',
    '41000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '51000000-0000-0000-0000-000000000005',
    '11000000-0000-0000-0000-000000000005',
    'course_teacher',
    '41000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001'
  );

insert into public.invitations (
  id,
  normalized_email,
  token_hash,
  course_run_id,
  role,
  expires_at,
  created_by,
  created_at
)
values (
  '71000000-0000-0000-0000-000000000003',
  'nora@gmail.com',
  repeat('c', 64),
  '41000000-0000-0000-0000-000000000001',
  'student',
  now() - interval '1 hour',
  '11000000-0000-0000-0000-000000000001',
  now() - interval '2 hours'
), (
  '71000000-0000-0000-0000-000000000006',
  'unconfirmed@example.com',
  repeat('e', 64),
  '41000000-0000-0000-0000-000000000001',
  'student',
  now() + interval '1 hour',
  '11000000-0000-0000-0000-000000000001',
  now()
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '21000000-0000-0000-0000-000000000005',
  true
);

select throws_ok(
  $$
    select public.create_course_invitation(
      '41000000-0000-0000-0000-000000000001',
      'blocked@example.com',
      'student',
      repeat('d', 64),
      now() + interval '1 day',
      '61000000-0000-0000-0000-000000000005'
    )
  $$,
  '42501',
  'INVITATION_CREATE_FORBIDDEN',
  'course teacher cannot create an invitation'
);

select set_config(
  'request.jwt.claim.sub',
  '21000000-0000-0000-0000-000000000002',
  true
);

select lives_ok(
  $$
    select public.create_course_invitation(
      '41000000-0000-0000-0000-000000000001',
      ' Nora@GMAIL.com ',
      'student',
      repeat('a', 64),
      now() + interval '1 day',
      '61000000-0000-0000-0000-000000000001'
    )
  $$,
  'course lead can create a course invitation'
);

select set_config(
  'request.jwt.claim.sub',
  '21000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$
    select public.create_course_invitation(
      '41000000-0000-0000-0000-000000000001',
      ' Kari@Golfforbundet.no ',
      'student',
      repeat('b', 64),
      now() + interval '1 day',
      '61000000-0000-0000-0000-000000000002'
    )
  $$,
  'administrator can invite an internal email address'
);

reset role;

select is(
  (
    select normalized_email
    from public.invitations
    where token_hash = repeat('a', 64)
  ),
  'nora@gmail.com',
  'creator normalizes a private email address'
);
select is(
  (
    select normalized_email
    from public.invitations
    where token_hash = repeat('b', 64)
  ),
  'kari@golfforbundet.no',
  'creator accepts and normalizes an internal email address'
);
select is(
  (
    select payload
    from public.outbox_events
    where idempotency_key = 'invitation.email:' || (
      select id::text
      from public.invitations
      where token_hash = repeat('a', 64)
    )
  ),
  jsonb_build_object(
    'invitationId',
    (
      select id
      from public.invitations
      where token_hash = repeat('a', 64)
    )
  ),
  'outbox contains only the opaque invitation id'
);
select ok(
  not exists (
    select 1
    from public.audit_events
    where correlation_id = '61000000-0000-0000-0000-000000000001'
      and (
        coalesce(before_data::text, '') like '%nora@gmail.com%'
        or coalesce(after_data::text, '') like '%' || repeat('a', 64) || '%'
      )
  ),
  'creation audit contains no email or token hash'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '21000000-0000-0000-0000-000000000004',
  true
);

select throws_ok(
  $$select public.claim_course_invitation(repeat('a', 64), '61000000-0000-0000-0000-000000000003')$$,
  'P0001',
  'INVITATION_EMAIL_MISMATCH',
  'another authenticated email cannot claim the invitation'
);

select set_config(
  'request.jwt.claim.sub',
  '21000000-0000-0000-0000-000000000003',
  true
);

select throws_ok(
  $$select public.claim_course_invitation(repeat('c', 64), '61000000-0000-0000-0000-000000000004')$$,
  'P0001',
  'INVITATION_EXPIRED',
  'expired invitation cannot be claimed'
);

select set_config(
  'request.jwt.claim.sub',
  '21000000-0000-0000-0000-000000000006',
  true
);

select throws_ok(
  $$select public.claim_course_invitation(repeat('e', 64), '61000000-0000-0000-0000-000000000009')$$,
  'P0001',
  'INVITATION_EMAIL_UNVERIFIED',
  'an unconfirmed account cannot claim an invitation for the same email'
);

select set_config(
  'request.jwt.claim.sub',
  '21000000-0000-0000-0000-000000000003',
  true
);

select is(
  public.claim_course_invitation(
    repeat('a', 64),
    '61000000-0000-0000-0000-000000000006'
  ),
  '/student',
  'matching authenticated email claims the invitation'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.profiles
    where normalized_email = 'nora@gmail.com'
  ),
  1,
  'claim reuses the stable profile for the invited email'
);
select ok(
  exists (
    select 1
    from public.user_accounts
    where user_id = '21000000-0000-0000-0000-000000000003'
      and profile_id = '11000000-0000-0000-0000-000000000003'
      and is_active
  ),
  'claim links the Supabase identity to the stable profile'
);
select ok(
  exists (
    select 1
    from public.enrollments
    where course_run_id = '41000000-0000-0000-0000-000000000001'
      and profile_id = '11000000-0000-0000-0000-000000000003'
      and status = 'active'
  ),
  'claim creates an active enrollment'
);
select ok(
  exists (
    select 1
    from public.role_assignments
    where course_run_id = '41000000-0000-0000-0000-000000000001'
      and profile_id = '11000000-0000-0000-0000-000000000003'
      and role = 'student'
      and revoked_at is null
  ),
  'claim creates the course-scoped role'
);
select ok(
  exists (
    select 1
    from public.invitations
    where token_hash = repeat('a', 64)
      and claimed_by = '11000000-0000-0000-0000-000000000003'
      and claimed_at is not null
  ),
  'claim consumes the invitation exactly once'
);
select ok(
  exists (
    select 1
    from public.audit_events
    where correlation_id = '61000000-0000-0000-0000-000000000006'
      and action = 'invitation.claimed'
      and actor_profile_id = '11000000-0000-0000-0000-000000000003'
  ),
  'claim writes a correlated audit event'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '21000000-0000-0000-0000-000000000003',
  true
);

select throws_ok(
  $$select public.claim_course_invitation(repeat('a', 64), '61000000-0000-0000-0000-000000000007')$$,
  'P0001',
  'INVITATION_ALREADY_CLAIMED',
  'consumed invitation cannot be reused'
);

reset role;
set local role service_role;

select lives_ok(
  $$
    select public.mark_invitation_delivery(
      (
        select id
        from public.invitations
        where token_hash = repeat('b', 64)
      ),
      '61000000-0000-0000-0000-000000000008'
    )
  $$,
  'server worker can mark delivery'
);

select lives_ok(
  $$
    select public.mark_invitation_delivery(
      (
        select id
        from public.invitations
        where token_hash = repeat('b', 64)
      ),
      '61000000-0000-0000-0000-000000000008'
    )
  $$,
  'delivery marker is safe to retry'
);

reset role;

select ok(
  exists (
    select 1
    from public.outbox_events
    where idempotency_key = 'invitation.email:' || (
      select id::text
      from public.invitations
      where token_hash = repeat('b', 64)
    )
      and status = 'delivered'
      and delivered_at is not null
  ),
  'delivery marker completes the matching outbox event'
);
select is(
  (
    select count(*)::integer
    from public.audit_events
    where correlation_id = '61000000-0000-0000-0000-000000000008'
      and action = 'invitation.email_delivered'
  ),
  1,
  'delivery retry does not duplicate the audit event'
);

select * from finish();

rollback;
