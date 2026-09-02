-- Skrivevei for resource_items.course_session_id: redaktørflaten kobler en
-- kursressurs til en samling (null = «Felles for kurset»). Samlingen må høre
-- til ressursens eget kull eller et kull ressursen er bundet til.
create function public.set_resource_session(
  target_resource_item_id uuid,
  actor_profile_id uuid,
  target_course_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  resource_course_run_id uuid;
begin
  if actor_profile_id is distinct from private.current_profile_id()
    or not (
      private.is_administrator()
      or private.has_global_role('editor'::public.portal_role)
    )
  then
    raise exception using
      errcode = '42501',
      message = 'RESOURCE_SESSION_FORBIDDEN';
  end if;

  select course_run_id
  into resource_course_run_id
  from public.resource_items
  where id = target_resource_item_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'RESOURCE_NOT_FOUND';
  end if;

  if target_course_session_id is not null and not exists (
    select 1
    from public.course_sessions as course_session
    where course_session.id = target_course_session_id
      and (
        course_session.course_run_id = resource_course_run_id
        or exists (
          select 1
          from public.course_resource_bindings as binding
          where binding.resource_item_id = target_resource_item_id
            and binding.course_run_id = course_session.course_run_id
        )
      )
  ) then
    raise exception using
      errcode = '22023',
      message = 'RESOURCE_SESSION_COURSE_MISMATCH';
  end if;

  update public.resource_items
  set course_session_id = target_course_session_id
  where id = target_resource_item_id;

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    after_data
  )
  values (
    actor_profile_id,
    'content.resource_session_set',
    'resource_item',
    target_resource_item_id::text,
    jsonb_build_object(
      'resourceItemId', target_resource_item_id,
      'courseSessionId', target_course_session_id
    )
  );
end;
$$;

revoke all on function public.set_resource_session(uuid, uuid, uuid) from public, anon;
grant execute on function public.set_resource_session(uuid, uuid, uuid) to authenticated;
