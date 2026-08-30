begin;

select plan(12);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'user_accounts', 'user_accounts exists');
select has_table('public', 'course_templates', 'course_templates exists');
select has_table('public', 'course_runs', 'course_runs exists');
select has_table('public', 'course_sessions', 'course_sessions exists');
select has_table('public', 'role_assignments', 'role_assignments exists');
select has_table('public', 'enrollments', 'enrollments exists');
select has_table('public', 'invitations', 'invitations exists');
select has_table('public', 'audit_events', 'audit_events exists');
select has_table('public', 'outbox_events', 'outbox_events exists');

select ok(
  case
    when to_regclass('public.audit_events') is null then false
    else not has_table_privilege('authenticated', 'public.audit_events', 'UPDATE')
  end,
  'authenticated cannot update audit_events'
);

select ok(
  case
    when to_regclass('public.audit_events') is null then false
    else not has_table_privilege('authenticated', 'public.audit_events', 'DELETE')
  end,
  'authenticated cannot delete audit_events'
);

select * from finish();

rollback;
