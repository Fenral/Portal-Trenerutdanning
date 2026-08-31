alter table public.content_revisions
add column updated_at timestamptz not null default now();

alter table public.resource_revisions
add column updated_at timestamptz not null default now();

create function private.touch_revision_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger content_revisions_touch_updated_at
before update on public.content_revisions
for each row execute function private.touch_revision_updated_at();

create trigger resource_revisions_touch_updated_at
before update on public.resource_revisions
for each row execute function private.touch_revision_updated_at();

create function public.save_content_draft(
  target_content_item_id uuid,
  actor_profile_id uuid,
  next_document jsonb,
  save_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft_revision_id uuid;
begin
  if actor_profile_id is distinct from private.current_profile_id()
    or not (
      private.is_administrator()
      or private.has_global_role('editor'::public.portal_role)
    )
  then
    raise exception using
      errcode = '42501',
      message = 'CONTENT_SAVE_FORBIDDEN';
  end if;

  if char_length(btrim(save_note)) < 3 then
    raise exception using
      errcode = '22023',
      message = 'CONTENT_SAVE_NOTE_REQUIRED';
  end if;

  update public.content_revisions
  set
    document = next_document,
    change_note = btrim(save_note)
  where content_item_id = target_content_item_id
    and status = 'draft'
  returning id into draft_revision_id;

  if draft_revision_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'CONTENT_DRAFT_NOT_FOUND';
  end if;

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    after_data
  )
  values (
    actor_profile_id,
    'content.draft_saved',
    'content_revision',
    draft_revision_id::text,
    jsonb_build_object('contentItemId', target_content_item_id)
  );

  return draft_revision_id;
end;
$$;

create function public.publish_content_and_rebind(
  target_content_item_id uuid,
  actor_profile_id uuid,
  publication_note text,
  target_course_run_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  published_revision_id uuid;
  target_course_run_id uuid;
begin
  published_revision_id := public.publish_content(
    target_content_item_id,
    actor_profile_id,
    publication_note
  );

  foreach target_course_run_id in array coalesce(
    target_course_run_ids,
    array[]::uuid[]
  )
  loop
    if not exists (
      select 1
      from public.course_runs as course_run
      where course_run.id = target_course_run_id
        and course_run.status = 'active'
    ) then
      raise exception using
        errcode = '22023',
        message = 'CONTENT_REBIND_ACTIVE_COURSE_REQUIRED';
    end if;

    insert into public.course_content_bindings (
      course_run_id,
      content_item_id,
      content_revision_id,
      bound_by,
      bound_at
    )
    values (
      target_course_run_id,
      target_content_item_id,
      published_revision_id,
      actor_profile_id,
      now()
    )
    on conflict (course_run_id, content_item_id)
    do update set
      content_revision_id = excluded.content_revision_id,
      bound_by = excluded.bound_by,
      bound_at = excluded.bound_at;

    insert into public.audit_events (
      actor_profile_id,
      action,
      entity_type,
      entity_id,
      after_data
    )
    values (
      actor_profile_id,
      'content.course_rebound',
      'course_content_binding',
      target_course_run_id::text || ':' || target_content_item_id::text,
      jsonb_build_object(
        'courseRunId', target_course_run_id,
        'contentItemId', target_content_item_id,
        'contentRevisionId', published_revision_id
      )
    );
  end loop;

  return published_revision_id;
end;
$$;

revoke all on function private.touch_revision_updated_at() from public, anon, authenticated;
revoke all on function public.save_content_draft(uuid, uuid, jsonb, text) from public, anon;
revoke all on function public.publish_content_and_rebind(uuid, uuid, text, uuid[]) from public, anon;

grant execute on function public.save_content_draft(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.publish_content_and_rebind(uuid, uuid, text, uuid[]) to authenticated;
