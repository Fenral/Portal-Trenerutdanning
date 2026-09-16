-- CMS Studio is additive: existing revision/publication RPC contracts are unchanged.
create table public.cms_content_metadata (
  content_item_id uuid primary key references public.content_items(id) on delete restrict,
  level integer check (level between 1 and 4),
  course_run_id uuid references public.course_runs(id) on delete restrict,
  source_item_id uuid references public.content_items(id) on delete restrict,
  source_revision_id uuid,
  created_at timestamptz not null default now(),
  foreign key (source_revision_id, source_item_id) references public.content_revisions(id, content_item_id) on delete restrict,
  check ((course_run_id is null and source_item_id is null and source_revision_id is null)
    or (course_run_id is not null and source_item_id is not null and source_revision_id is not null)),
  check (content_item_id is distinct from source_item_id)
);
create index cms_content_metadata_course_idx on public.cms_content_metadata(course_run_id);

create table public.cms_course_overrides (
  course_run_id uuid not null references public.course_runs(id) on delete restrict,
  source_item_id uuid not null references public.content_items(id) on delete restrict,
  local_item_id uuid not null unique references public.cms_content_metadata(content_item_id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (course_run_id, source_item_id),
  check (source_item_id <> local_item_id)
);

-- Original documents are private downloads. No malware-scanning status is asserted.
create table public.cms_attachments (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 180),
  author text not null check (char_length(btrim(author)) between 1 and 180),
  audience public.resource_audience not null,
  original_filename text not null check (char_length(original_filename) between 1 and 240),
  mime_type text not null check (mime_type in ('application/pdf', 'application/msword', 'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  byte_size bigint not null check (byte_size between 1 and 20971520),
  storage_path text not null unique,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (storage_path = content_item_id::text || '/' || id::text)
);
create index cms_attachments_item_idx on public.cms_attachments(content_item_id);

-- Two-step uploads bypass application host request-size limits. Pending objects
-- are not attachments and cannot be selected or downloaded by portal users.
create table public.cms_attachment_uploads (
  id uuid primary key,
  content_item_id uuid not null references public.content_items(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 180),
  author text not null check (char_length(btrim(author)) between 1 and 180),
  audience public.resource_audience not null,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size between 1 and 20971520),
  storage_path text not null unique,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  rejected_at timestamptz,
  check (storage_path = content_item_id::text || '/' || id::text)
);
create index cms_attachment_uploads_expiry_idx on public.cms_attachment_uploads(expires_at);
alter table public.cms_attachment_uploads enable row level security;
revoke all on table public.cms_attachment_uploads from public, anon, authenticated;
grant all on table public.cms_attachment_uploads to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cms-attachments', 'cms-attachments', false, 20971520, array[
  'application/pdf', 'application/msword', 'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]) on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Deliberately no storage.objects policy: authenticated users use the checked
-- download route, which always forces Content-Disposition: attachment.

create function private.cms_global_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_administrator() or private.has_global_role('editor'::public.portal_role)
$$;

create function private.cms_course_staff(target_course_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_course_role(target_course_id, array['course_teacher','course_lead']::public.portal_role[])
$$;

create function private.cms_can_edit(target_item_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.cms_global_manager() or exists (
    select 1 from public.cms_content_metadata m
    where m.content_item_id = target_item_id and private.cms_course_staff(m.course_run_id)
  )
$$;

create function private.cms_attachment_readable(target_attachment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cms_attachments a where a.id = target_attachment_id and (
      private.cms_can_edit(a.content_item_id)
      or exists (
        select 1 from public.cms_content_metadata m
        join public.content_revisions r on r.id = m.source_revision_id
        where m.source_item_id = a.content_item_id and private.cms_can_edit(m.content_item_id)
          and coalesce(r.document -> 'attachmentIds', '[]'::jsonb) ? a.id::text
      )
      or exists (
        select 1 from public.course_content_bindings b
        join public.content_revisions r on r.id = b.content_revision_id
        where r.status in ('published', 'superseded')
          and coalesce(r.document -> 'attachmentIds', '[]'::jsonb) ? a.id::text
          and (private.cms_course_staff(b.course_run_id)
            or (a.audience = 'course_members' and private.is_enrolled(b.course_run_id)))
          and not exists (
            select 1 from public.cms_course_overrides o
            join public.course_content_bindings lb on lb.course_run_id = o.course_run_id and lb.content_item_id = o.local_item_id
            where o.course_run_id = b.course_run_id and o.source_item_id = b.content_item_id
          )
      )
    )
  )
$$;

create function private.cms_validate_document(target_item_id uuid, next_document jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare attachment_id text;
begin
  if next_document is null or jsonb_typeof(next_document) <> 'object'
    or next_document ->> 'locale' is distinct from 'nb-NO'
    or coalesce(next_document ->> 'format', '') not in ('short_page','scroll_story')
    or coalesce(jsonb_typeof(next_document -> 'blocks'), '') <> 'array'
    or octet_length(next_document::text) > 2097152 then
    raise exception using errcode = '22023', message = 'CMS_INVALID_DOCUMENT';
  end if;
  if next_document ? 'attachmentIds' and jsonb_typeof(next_document -> 'attachmentIds') <> 'array' then
    raise exception using errcode = '22023', message = 'CMS_INVALID_ATTACHMENTS';
  end if;
  if jsonb_array_length(coalesce(next_document -> 'attachmentIds', '[]'::jsonb)) > 100 then
    raise exception using errcode = '22023', message = 'CMS_INVALID_ATTACHMENTS';
  end if;
  for attachment_id in select jsonb_array_elements_text(coalesce(next_document -> 'attachmentIds', '[]'::jsonb)) loop
    if not exists (
      select 1 from public.cms_attachments a where a.id::text = attachment_id and (
        a.content_item_id = target_item_id or exists (
          select 1 from public.cms_content_metadata m
          join public.content_revisions source on source.id = m.source_revision_id
          where m.content_item_id = target_item_id and m.source_item_id = a.content_item_id
            and coalesce(source.document -> 'attachmentIds', '[]'::jsonb) ? attachment_id
        )
      )
    ) then
      raise exception using errcode = '22023', message = 'CMS_INVALID_ATTACHMENT_REFERENCE';
    end if;
  end loop;
end;
$$;

-- Keep course-local scope and attachment ownership intact when a legacy editor
-- calls the older RPCs. Their signatures and publication behavior stay intact.
create function private.cms_guard_local_binding()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.cms_content_metadata m
    where m.content_item_id = new.content_item_id and m.course_run_id is not null
      and m.course_run_id <> new.course_run_id) then
    raise exception using errcode = '42501', message = 'CMS_FORBIDDEN';
  end if;
  return new;
end;
$$;
create trigger cms_bindings_preserve_local_scope before insert or update on public.course_content_bindings
  for each row execute function private.cms_guard_local_binding();

create function private.cms_guard_attachment_references()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.document ? 'attachmentIds' then
    perform private.cms_validate_document(new.content_item_id, new.document);
  end if;
  return new;
end;
$$;
create trigger cms_revisions_validate_attachments before insert or update of document on public.content_revisions
  for each row execute function private.cms_guard_attachment_references();
revoke all on function private.cms_guard_local_binding(), private.cms_guard_attachment_references() from public, anon, authenticated;

create function public.cms_create_item(next_title text, next_level integer, next_document jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare item_id uuid := gen_random_uuid(); actor uuid := private.current_profile_id();
begin
  if actor is null or not private.cms_global_manager() then
    raise exception using errcode = '42501', message = 'CMS_FORBIDDEN';
  end if;
  insert into public.content_items(id, kind, slug, title, created_by)
    values (item_id, 'lesson', 'cms-' || item_id::text, btrim(next_title), actor);
  insert into public.cms_content_metadata(content_item_id, level) values(item_id, next_level);
  perform private.cms_validate_document(item_id, next_document);
  insert into public.content_revisions(content_item_id, revision_number, document, change_note, created_by)
    values(item_id, 1, next_document, 'Innhold opprettet', actor);
  insert into public.audit_events(actor_profile_id, action, entity_type, entity_id)
    values(actor, 'cms.created', 'content_item', item_id::text);
  return item_id;
end;
$$;

create function public.cms_save_draft(target_item_id uuid, next_title text, next_document jsonb, expected_updated_at timestamptz, save_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare draft public.content_revisions%rowtype;
begin
  if not private.cms_can_edit(target_item_id) then
    raise exception using errcode = '42501', message = 'CMS_FORBIDDEN';
  end if;
  perform 1 from public.content_items where id = target_item_id for update;
  select * into draft from public.content_revisions where content_item_id = target_item_id and status = 'draft' for update;
  if draft.id is null then raise exception using errcode = 'P0002', message = 'CMS_DRAFT_NOT_FOUND'; end if;
  if expected_updated_at is null or draft.updated_at is distinct from expected_updated_at then
    raise exception using errcode = 'P0001', message = 'CMS_CONFLICT';
  end if;
  perform private.cms_validate_document(target_item_id, next_document);
  update public.content_items set title = btrim(next_title) where id = target_item_id;
  update public.content_revisions set document = next_document, change_note = btrim(save_note) where id = draft.id;
  insert into public.audit_events(actor_profile_id, action, entity_type, entity_id)
    values(private.current_profile_id(), 'cms.draft_saved', 'content_revision', draft.id::text);
  return draft.id;
end;
$$;

create function public.cms_publish(target_item_id uuid, expected_updated_at timestamptz, publication_note text, target_course_run_ids uuid[] default array[]::uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  draft public.content_revisions%rowtype;
  actor uuid := private.current_profile_id();
  local_course uuid;
  course_id uuid;
  course_ids uuid[] := coalesce(target_course_run_ids, array[]::uuid[]);
  next_number integer;
begin
  if actor is null or not private.cms_can_edit(target_item_id) then
    raise exception using errcode = '42501', message = 'CMS_FORBIDDEN';
  end if;
  if publication_note is null or char_length(btrim(publication_note)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'CMS_NOTE_REQUIRED';
  end if;
  perform 1 from public.content_items where id = target_item_id for update;
  select * into draft from public.content_revisions where content_item_id = target_item_id and status = 'draft' for update;
  if draft.id is null then raise exception using errcode = 'P0002', message = 'CMS_DRAFT_NOT_FOUND'; end if;
  if expected_updated_at is null or draft.updated_at is distinct from expected_updated_at then
    raise exception using errcode = 'P0001', message = 'CMS_CONFLICT';
  end if;
  perform private.cms_validate_document(target_item_id, draft.document);
  select course_run_id into local_course from public.cms_content_metadata where content_item_id = target_item_id;
  if local_course is not null then
    if exists(select 1 from unnest(course_ids) c where c is distinct from local_course) then
      raise exception using errcode = '42501', message = 'CMS_FORBIDDEN';
    end if;
    course_ids := array[local_course];
  end if;
  foreach course_id in array course_ids loop
    perform 1 from public.course_runs where id = course_id and status in ('draft','active') for share;
    if not found then raise exception using errcode = '22023', message = 'CMS_COURSE_CLOSED'; end if;
  end loop;
  perform set_config('app.revision_publication', 'on', true);
  update public.content_revisions set status = 'superseded' where content_item_id = target_item_id and status = 'published';
  update public.content_revisions set status = 'published', change_note = btrim(publication_note), published_by = actor, published_at = now() where id = draft.id;
  select coalesce(max(revision_number), 0) + 1 into next_number from public.content_revisions where content_item_id = target_item_id;
  insert into public.content_revisions(content_item_id, revision_number, document, change_note, created_by)
    values(target_item_id, next_number, draft.document, 'Kladd fra publisert versjon', actor);
  foreach course_id in array course_ids loop
    insert into public.course_content_bindings(course_run_id, content_item_id, content_revision_id, bound_by)
      values(course_id, target_item_id, draft.id, actor)
      on conflict(course_run_id, content_item_id) do update
      set content_revision_id = excluded.content_revision_id, bound_by = excluded.bound_by, bound_at = now();
  end loop;
  insert into public.audit_events(actor_profile_id, action, entity_type, entity_id, after_data)
    values(actor, 'cms.published', 'content_revision', draft.id::text, jsonb_build_object('courseRunIds', course_ids));
  return draft.id;
end;
$$;

create function public.cms_restore(target_item_id uuid, target_revision_id uuid, expected_updated_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare draft public.content_revisions%rowtype; source public.content_revisions%rowtype;
begin
  if not private.cms_can_edit(target_item_id) then raise exception using errcode = '42501', message = 'CMS_FORBIDDEN'; end if;
  perform 1 from public.content_items where id = target_item_id for update;
  select * into draft from public.content_revisions where content_item_id = target_item_id and status = 'draft' for update;
  if draft.id is null then raise exception using errcode = 'P0002', message = 'CMS_DRAFT_NOT_FOUND'; end if;
  if expected_updated_at is null or draft.updated_at is distinct from expected_updated_at then
    raise exception using errcode = 'P0001', message = 'CMS_CONFLICT';
  end if;
  select * into source from public.content_revisions where id = target_revision_id and content_item_id = target_item_id and status in ('published','superseded');
  if source.id is null then raise exception using errcode = 'P0002', message = 'CMS_REVISION_NOT_FOUND'; end if;
  perform private.cms_validate_document(target_item_id, source.document);
  update public.content_revisions set document = source.document, change_note = 'Gjenopprettet fra versjon ' || source.revision_number::text where id = draft.id;
  insert into public.audit_events(actor_profile_id, action, entity_type, entity_id, after_data)
    values(private.current_profile_id(), 'cms.restored', 'content_revision', draft.id::text, jsonb_build_object('sourceRevisionId', source.id));
  return draft.id;
end;
$$;

create function public.cms_create_variant(target_item_id uuid, target_course_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  source public.content_revisions%rowtype;
  original public.content_items%rowtype;
  item_id uuid := gen_random_uuid();
  actor uuid := private.current_profile_id();
begin
  if actor is null or not (private.cms_global_manager() or private.cms_course_staff(target_course_id)) then
    raise exception using errcode = '42501', message = 'CMS_FORBIDDEN';
  end if;
  -- The source lock serializes concurrent variant creation and publication.
  select * into original from public.content_items where id = target_item_id for update;
  if original.id is null then raise exception using errcode = 'P0002', message = 'CMS_ITEM_NOT_FOUND'; end if;
  if exists(select 1 from public.cms_content_metadata where content_item_id = target_item_id and course_run_id is not null) then
    raise exception using errcode = '22023', message = 'CMS_VARIANT_SOURCE_MUST_BE_GLOBAL';
  end if;
  perform 1 from public.course_runs where id = target_course_id and status in ('draft','active') for share;
  if not found then raise exception using errcode = '22023', message = 'CMS_COURSE_CLOSED'; end if;
  if exists(select 1 from public.cms_course_overrides where source_item_id = target_item_id and course_run_id = target_course_id) then
    raise exception using errcode = '23505', message = 'CMS_VARIANT_EXISTS';
  end if;
  if private.cms_global_manager() then
    select * into source from public.content_revisions where content_item_id = target_item_id and status = 'published';
  else
    select r.* into source from public.content_revisions r
      join public.course_content_bindings b on b.content_revision_id = r.id
      where b.content_item_id = target_item_id and b.course_run_id = target_course_id and r.status in ('published','superseded');
  end if;
  if source.id is null then raise exception using errcode = '22023', message = 'CMS_SOURCE_UNPUBLISHED'; end if;
  insert into public.content_items(id, kind, slug, title, created_by)
    values(item_id, original.kind, 'cms-' || item_id::text, original.title, actor);
  insert into public.cms_content_metadata(content_item_id, level, course_run_id, source_item_id, source_revision_id)
    values(item_id, (select level from public.cms_content_metadata where content_item_id = target_item_id), target_course_id, target_item_id, source.id);
  insert into public.content_revisions(content_item_id, revision_number, document, change_note, created_by)
    values(item_id, 1, source.document, 'Kursvariant fra versjon ' || source.revision_number::text, actor);
  insert into public.cms_course_overrides(course_run_id, source_item_id, local_item_id, created_by)
    values(target_course_id, target_item_id, item_id, actor);
  insert into public.audit_events(actor_profile_id, action, entity_type, entity_id, after_data)
    values(actor, 'cms.variant_created', 'content_item', item_id::text, jsonb_build_object('sourceRevisionId', source.id, 'courseRunId', target_course_id));
  return item_id;
end;
$$;

alter table public.cms_content_metadata enable row level security;
alter table public.cms_course_overrides enable row level security;
alter table public.cms_attachments enable row level security;
revoke all on table public.cms_content_metadata, public.cms_course_overrides, public.cms_attachments from anon, authenticated;
grant select on table public.cms_content_metadata, public.cms_course_overrides, public.cms_attachments to authenticated;
grant all on table public.cms_content_metadata, public.cms_course_overrides, public.cms_attachments to service_role;

create policy cms_metadata_select on public.cms_content_metadata for select to authenticated using (
  private.cms_can_edit(content_item_id) or (course_run_id is not null and private.is_enrolled(course_run_id))
);
create policy cms_overrides_select on public.cms_course_overrides for select to authenticated using (
  private.cms_global_manager() or private.cms_course_staff(course_run_id) or private.is_enrolled(course_run_id)
);
create policy cms_attachments_select on public.cms_attachments for select to authenticated using (private.cms_attachment_readable(id));
create policy cms_local_items_select on public.content_items for select to authenticated using (private.cms_can_edit(id));
create policy cms_local_revisions_select on public.content_revisions for select to authenticated using (private.cms_can_edit(content_item_id));

revoke all on function private.cms_global_manager(), private.cms_course_staff(uuid), private.cms_can_edit(uuid), private.cms_attachment_readable(uuid), private.cms_validate_document(uuid,jsonb) from public, anon, authenticated;
grant execute on function private.cms_global_manager(), private.cms_course_staff(uuid), private.cms_can_edit(uuid), private.cms_attachment_readable(uuid) to authenticated;
revoke all on function public.cms_create_item(text,integer,jsonb), public.cms_save_draft(uuid,text,jsonb,timestamptz,text), public.cms_publish(uuid,timestamptz,text,uuid[]), public.cms_restore(uuid,uuid,timestamptz), public.cms_create_variant(uuid,uuid) from public, anon;
grant execute on function public.cms_create_item(text,integer,jsonb), public.cms_save_draft(uuid,text,jsonb,timestamptz,text), public.cms_publish(uuid,timestamptz,text,uuid[]), public.cms_restore(uuid,uuid,timestamptz), public.cms_create_variant(uuid,uuid) to authenticated;
