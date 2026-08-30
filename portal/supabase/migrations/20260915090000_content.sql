create type public.content_kind as enum (
  'lesson',
  'quiz',
  'assignment',
  'practice_requirement',
  'attendance_requirement',
  'knowledge_test'
);

create type public.revision_status as enum (
  'draft',
  'published',
  'superseded'
);

create type public.resource_audience as enum (
  'teachers',
  'course_members'
);

create type public.media_scan_status as enum (
  'quarantined',
  'clean',
  'rejected'
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind public.content_kind not null,
  slug text not null
    constraint content_items_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null
    constraint content_items_title_length
    check (char_length(btrim(title)) between 2 and 180),
  locale text not null default 'nb-NO'
    constraint content_items_locale_bokmal
    check (locale = 'nb-NO'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint content_items_slug_unique unique (slug)
);

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete restrict,
  revision_number integer not null
    constraint content_revisions_number_positive
    check (revision_number > 0),
  status public.revision_status not null default 'draft',
  document jsonb not null
    constraint content_revisions_document_shape
    check (
      jsonb_typeof(document) = 'object'
      and document ->> 'locale' = 'nb-NO'
      and document ->> 'format' in ('short_page', 'scroll_story')
      and jsonb_typeof(document -> 'blocks') = 'array'
    ),
  change_note text not null
    constraint content_revisions_change_note_length
    check (char_length(btrim(change_note)) between 3 and 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  constraint content_revisions_item_number_unique
    unique (content_item_id, revision_number),
  constraint content_revisions_id_item_unique
    unique (id, content_item_id),
  constraint content_revisions_publication_consistent check (
    (
      status = 'draft'
      and published_by is null
      and published_at is null
    )
    or (
      status in ('published', 'superseded')
      and published_by is not null
      and published_at is not null
    )
  )
);

create unique index one_draft_per_content_item
  on public.content_revisions (content_item_id)
  where status = 'draft';

create unique index one_published_per_content_item
  on public.content_revisions (content_item_id)
  where status = 'published';

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null
    constraint media_assets_storage_path_length
    check (char_length(btrim(storage_path)) between 3 and 500),
  original_filename text not null
    constraint media_assets_filename_length
    check (char_length(btrim(original_filename)) between 1 and 255),
  mime_type text not null
    constraint media_assets_mime_type_allowed
    check (
      mime_type in (
        'application/pdf',
        'application/msword',
        'application/vnd.ms-excel',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'video/mp4'
      )
    ),
  byte_size bigint not null
    constraint media_assets_byte_size_range
    check (byte_size > 0 and byte_size <= 524288000),
  alt_text text
    constraint media_assets_alt_text_length
    check (alt_text is null or char_length(btrim(alt_text)) between 1 and 240),
  sha256 text not null
    constraint media_assets_sha256_format
    check (sha256 ~ '^[0-9a-f]{64}$'),
  scan_status public.media_scan_status not null default 'quarantined',
  scan_error_code text,
  scanned_at timestamptz,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint media_assets_storage_path_unique unique (storage_path),
  constraint media_assets_scan_consistent check (
    (
      scan_status = 'quarantined'
      and scanned_at is null
      and scan_error_code is null
    )
    or (
      scan_status = 'clean'
      and scanned_at is not null
      and scan_error_code is null
    )
    or (
      scan_status = 'rejected'
      and scanned_at is not null
      and char_length(btrim(scan_error_code)) > 0
    )
  )
);

create index media_assets_scan_status_idx
  on public.media_assets (scan_status, created_at);

create table public.resource_items (
  id uuid primary key default gen_random_uuid(),
  title text not null
    constraint resource_items_title_length
    check (char_length(btrim(title)) between 2 and 180),
  description text
    constraint resource_items_description_length
    check (description is null or char_length(btrim(description)) between 1 and 2000),
  audience public.resource_audience not null,
  content_item_id uuid references public.content_items(id) on delete restrict,
  course_run_id uuid references public.course_runs(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint resource_items_scope_exactly_one check (
    num_nonnulls(content_item_id, course_run_id) = 1
  )
);

create index resource_items_content_item_id_idx
  on public.resource_items (content_item_id)
  where content_item_id is not null;

create index resource_items_course_run_id_idx
  on public.resource_items (course_run_id)
  where course_run_id is not null;

create table public.resource_revisions (
  id uuid primary key default gen_random_uuid(),
  resource_item_id uuid not null references public.resource_items(id) on delete restrict,
  revision_number integer not null
    constraint resource_revisions_number_positive
    check (revision_number > 0),
  status public.revision_status not null default 'draft',
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  change_note text not null
    constraint resource_revisions_change_note_length
    check (char_length(btrim(change_note)) between 3 and 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  constraint resource_revisions_item_number_unique
    unique (resource_item_id, revision_number),
  constraint resource_revisions_id_item_unique
    unique (id, resource_item_id),
  constraint resource_revisions_publication_consistent check (
    (
      status = 'draft'
      and published_by is null
      and published_at is null
    )
    or (
      status in ('published', 'superseded')
      and published_by is not null
      and published_at is not null
    )
  )
);

create unique index one_draft_per_resource_item
  on public.resource_revisions (resource_item_id)
  where status = 'draft';

create unique index one_published_per_resource_item
  on public.resource_revisions (resource_item_id)
  where status = 'published';

create table public.course_content_bindings (
  course_run_id uuid not null references public.course_runs(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete restrict,
  content_revision_id uuid not null,
  bound_at timestamptz not null default now(),
  bound_by uuid not null references public.profiles(id) on delete restrict,
  primary key (course_run_id, content_item_id),
  constraint course_content_bindings_revision_item_fk
    foreign key (content_revision_id, content_item_id)
    references public.content_revisions (id, content_item_id)
    on delete restrict
);

create index course_content_bindings_revision_id_idx
  on public.course_content_bindings (content_revision_id);

create table public.course_resource_bindings (
  course_run_id uuid not null references public.course_runs(id) on delete cascade,
  resource_item_id uuid not null references public.resource_items(id) on delete restrict,
  resource_revision_id uuid not null,
  bound_at timestamptz not null default now(),
  bound_by uuid not null references public.profiles(id) on delete restrict,
  primary key (course_run_id, resource_item_id),
  constraint course_resource_bindings_revision_item_fk
    foreign key (resource_revision_id, resource_item_id)
    references public.resource_revisions (id, resource_item_id)
    on delete restrict
);

create index course_resource_bindings_revision_id_idx
  on public.course_resource_bindings (resource_revision_id);

create function private.protect_content_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status not in ('published', 'superseded') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'published'
    and new.status = 'superseded'
    and current_setting('app.revision_publication', true) = 'on'
    and new.id = old.id
    and new.content_item_id = old.content_item_id
    and new.revision_number = old.revision_number
    and new.document = old.document
    and new.change_note = old.change_note
    and new.created_by = old.created_by
    and new.created_at = old.created_at
    and new.published_by = old.published_by
    and new.published_at = old.published_at
  then
    return new;
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'published_revision_is_immutable';
end;
$$;

create trigger content_revisions_protect_published
before update or delete on public.content_revisions
for each row execute function private.protect_content_revision();

create function private.protect_resource_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status not in ('published', 'superseded') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'published'
    and new.status = 'superseded'
    and current_setting('app.revision_publication', true) = 'on'
    and new.id = old.id
    and new.resource_item_id = old.resource_item_id
    and new.revision_number = old.revision_number
    and new.media_asset_id = old.media_asset_id
    and new.change_note = old.change_note
    and new.created_by = old.created_by
    and new.created_at = old.created_at
    and new.published_by = old.published_by
    and new.published_at = old.published_at
  then
    return new;
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'published_resource_revision_is_immutable';
end;
$$;

create trigger resource_revisions_protect_published
before update or delete on public.resource_revisions
for each row execute function private.protect_resource_revision();

create function private.require_clean_resource_asset()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.media_assets as asset
    where asset.id = new.media_asset_id
      and asset.scan_status = 'clean'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'resource_asset_not_clean';
  end if;

  return new;
end;
$$;

create trigger resource_revisions_require_clean_asset
before insert or update on public.resource_revisions
for each row execute function private.require_clean_resource_asset();

create function private.require_published_content_binding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.content_revisions as revision
    where revision.id = new.content_revision_id
      and revision.content_item_id = new.content_item_id
      and revision.status = 'published'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'content_binding_requires_published_revision';
  end if;

  return new;
end;
$$;

create trigger course_content_bindings_require_published
before insert or update on public.course_content_bindings
for each row execute function private.require_published_content_binding();

create function private.require_published_resource_binding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.resource_revisions as revision
    where revision.id = new.resource_revision_id
      and revision.resource_item_id = new.resource_item_id
      and revision.status = 'published'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'resource_binding_requires_published_revision';
  end if;

  return new;
end;
$$;

create trigger course_resource_bindings_require_published
before insert or update on public.course_resource_bindings
for each row execute function private.require_published_resource_binding();

create function public.publish_content(
  target_content_item_id uuid,
  actor_profile_id uuid,
  publication_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft_revision public.content_revisions%rowtype;
  published_revision public.content_revisions%rowtype;
  next_revision_number integer;
begin
  if actor_profile_id is distinct from private.current_profile_id()
    or not (
      private.is_administrator()
      or private.has_global_role('editor'::public.portal_role)
    )
  then
    raise exception using
      errcode = '42501',
      message = 'CONTENT_PUBLISH_FORBIDDEN';
  end if;

  if char_length(btrim(publication_note)) < 3 then
    raise exception using
      errcode = '22023',
      message = 'CONTENT_CHANGE_NOTE_REQUIRED';
  end if;

  perform 1
  from public.content_items
  where id = target_content_item_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CONTENT_ITEM_NOT_FOUND';
  end if;

  select revision.*
  into draft_revision
  from public.content_revisions as revision
  where revision.content_item_id = target_content_item_id
    and revision.status = 'draft'
  for update;

  if draft_revision.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'CONTENT_DRAFT_NOT_FOUND';
  end if;

  select revision.*
  into published_revision
  from public.content_revisions as revision
  where revision.content_item_id = target_content_item_id
    and revision.status = 'published'
  for update;

  perform set_config('app.revision_publication', 'on', true);

  if published_revision.id is not null then
    update public.content_revisions
    set status = 'superseded'
    where id = published_revision.id;
  end if;

  update public.content_revisions
  set
    status = 'published',
    change_note = btrim(publication_note),
    published_by = actor_profile_id,
    published_at = now()
  where id = draft_revision.id;

  select coalesce(max(revision_number), 0) + 1
  into next_revision_number
  from public.content_revisions
  where content_item_id = target_content_item_id;

  insert into public.content_revisions (
    content_item_id,
    revision_number,
    status,
    document,
    change_note,
    created_by
  )
  values (
    target_content_item_id,
    next_revision_number,
    'draft',
    draft_revision.document,
    'Kladd fra publisert versjon',
    actor_profile_id
  );

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    after_data
  )
  values (
    actor_profile_id,
    'content.published',
    'content_revision',
    draft_revision.id::text,
    jsonb_build_object(
      'contentItemId', target_content_item_id,
      'revisionNumber', draft_revision.revision_number
    )
  );

  return draft_revision.id;
end;
$$;

create function public.publish_resource(
  target_resource_item_id uuid,
  actor_profile_id uuid,
  publication_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  resource_item public.resource_items%rowtype;
  draft_revision public.resource_revisions%rowtype;
  published_revision public.resource_revisions%rowtype;
  next_revision_number integer;
begin
  if actor_profile_id is distinct from private.current_profile_id() then
    raise exception using
      errcode = '42501',
      message = 'RESOURCE_PUBLISH_FORBIDDEN';
  end if;

  select item.*
  into resource_item
  from public.resource_items as item
  where item.id = target_resource_item_id
  for update;

  if resource_item.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'RESOURCE_ITEM_NOT_FOUND';
  end if;

  if not (
    private.is_administrator()
    or private.has_global_role('editor'::public.portal_role)
    or (
      resource_item.course_run_id is not null
      and private.has_course_role(
        resource_item.course_run_id,
        array['course_lead']::public.portal_role[]
      )
    )
  ) then
    raise exception using
      errcode = '42501',
      message = 'RESOURCE_PUBLISH_FORBIDDEN';
  end if;

  if char_length(btrim(publication_note)) < 3 then
    raise exception using
      errcode = '22023',
      message = 'RESOURCE_CHANGE_NOTE_REQUIRED';
  end if;

  select revision.*
  into draft_revision
  from public.resource_revisions as revision
  where revision.resource_item_id = target_resource_item_id
    and revision.status = 'draft'
  for update;

  if draft_revision.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'RESOURCE_DRAFT_NOT_FOUND';
  end if;

  select revision.*
  into published_revision
  from public.resource_revisions as revision
  where revision.resource_item_id = target_resource_item_id
    and revision.status = 'published'
  for update;

  perform set_config('app.revision_publication', 'on', true);

  if published_revision.id is not null then
    update public.resource_revisions
    set status = 'superseded'
    where id = published_revision.id;
  end if;

  update public.resource_revisions
  set
    status = 'published',
    change_note = btrim(publication_note),
    published_by = actor_profile_id,
    published_at = now()
  where id = draft_revision.id;

  select coalesce(max(revision_number), 0) + 1
  into next_revision_number
  from public.resource_revisions
  where resource_item_id = target_resource_item_id;

  insert into public.resource_revisions (
    resource_item_id,
    revision_number,
    status,
    media_asset_id,
    change_note,
    created_by
  )
  values (
    target_resource_item_id,
    next_revision_number,
    'draft',
    draft_revision.media_asset_id,
    'Kladd fra publisert versjon',
    actor_profile_id
  );

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    after_data
  )
  values (
    actor_profile_id,
    'resource.published',
    'resource_revision',
    draft_revision.id::text,
    jsonb_build_object(
      'resourceItemId', target_resource_item_id,
      'revisionNumber', draft_revision.revision_number
    )
  );

  return draft_revision.id;
end;
$$;

revoke all on function private.protect_content_revision() from public, anon, authenticated;
revoke all on function private.protect_resource_revision() from public, anon, authenticated;
revoke all on function private.require_clean_resource_asset() from public, anon, authenticated;
revoke all on function private.require_published_content_binding() from public, anon, authenticated;
revoke all on function private.require_published_resource_binding() from public, anon, authenticated;
revoke all on function public.publish_content(uuid, uuid, text) from public, anon;
revoke all on function public.publish_resource(uuid, uuid, text) from public, anon;

grant execute on function public.publish_content(uuid, uuid, text) to authenticated;
grant execute on function public.publish_resource(uuid, uuid, text) to authenticated;

alter table public.content_items enable row level security;
alter table public.content_revisions enable row level security;
alter table public.media_assets enable row level security;
alter table public.resource_items enable row level security;
alter table public.resource_revisions enable row level security;
alter table public.course_content_bindings enable row level security;
alter table public.course_resource_bindings enable row level security;

revoke all on table public.content_items from anon, authenticated;
revoke all on table public.content_revisions from anon, authenticated;
revoke all on table public.media_assets from anon, authenticated;
revoke all on table public.resource_items from anon, authenticated;
revoke all on table public.resource_revisions from anon, authenticated;
revoke all on table public.course_content_bindings from anon, authenticated;
revoke all on table public.course_resource_bindings from anon, authenticated;

grant select on table public.content_items to authenticated;
grant select on table public.content_revisions to authenticated;
grant select on table public.media_assets to authenticated;
grant select on table public.resource_items to authenticated;
grant select on table public.resource_revisions to authenticated;
grant select on table public.course_content_bindings to authenticated;
grant select on table public.course_resource_bindings to authenticated;

create policy course_content_bindings_scoped_select
on public.course_content_bindings
for select
to authenticated
using (
  (select private.is_administrator())
  or (select private.has_global_role('editor'::public.portal_role))
  or private.is_enrolled(course_run_id)
  or private.has_course_role(
    course_run_id,
    array['course_teacher', 'course_lead']::public.portal_role[]
  )
);

create policy content_items_scoped_select
on public.content_items
for select
to authenticated
using (
  (select private.is_administrator())
  or (select private.has_global_role('editor'::public.portal_role))
  or exists (
    select 1
    from public.course_content_bindings as binding
    where binding.content_item_id = content_items.id
      and (
        private.is_enrolled(binding.course_run_id)
        or private.has_course_role(
          binding.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy content_revisions_scoped_select
on public.content_revisions
for select
to authenticated
using (
  (select private.is_administrator())
  or (select private.has_global_role('editor'::public.portal_role))
  or exists (
    select 1
    from public.course_content_bindings as binding
    where binding.content_revision_id = content_revisions.id
      and (
        private.is_enrolled(binding.course_run_id)
        or private.has_course_role(
          binding.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy course_resource_bindings_scoped_select
on public.course_resource_bindings
for select
to authenticated
using (
  (select private.is_administrator())
  or (select private.has_global_role('editor'::public.portal_role))
  or private.is_enrolled(course_run_id)
  or private.has_course_role(
    course_run_id,
    array['course_teacher', 'course_lead']::public.portal_role[]
  )
);

create policy resource_items_scoped_select
on public.resource_items
for select
to authenticated
using (
  (select private.is_administrator())
  or (select private.has_global_role('editor'::public.portal_role))
  or (
    course_run_id is not null
    and private.has_course_role(
      course_run_id,
      array['course_teacher', 'course_lead']::public.portal_role[]
    )
  )
  or exists (
    select 1
    from public.course_resource_bindings as binding
    where binding.resource_item_id = resource_items.id
      and (
        private.has_course_role(
          binding.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
        or (
          resource_items.audience = 'course_members'
          and private.is_enrolled(binding.course_run_id)
        )
      )
  )
);

create policy resource_revisions_scoped_select
on public.resource_revisions
for select
to authenticated
using (
  (select private.is_administrator())
  or (select private.has_global_role('editor'::public.portal_role))
  or exists (
    select 1
    from public.resource_items as item
    where item.id = resource_revisions.resource_item_id
      and item.course_run_id is not null
      and private.has_course_role(
        item.course_run_id,
        array['course_teacher', 'course_lead']::public.portal_role[]
      )
  )
  or exists (
    select 1
    from public.course_resource_bindings as binding
    join public.resource_items as item
      on item.id = binding.resource_item_id
    where binding.resource_revision_id = resource_revisions.id
      and (
        private.has_course_role(
          binding.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
        or (
          item.audience = 'course_members'
          and private.is_enrolled(binding.course_run_id)
        )
      )
  )
);

create policy media_assets_scoped_select
on public.media_assets
for select
to authenticated
using (
  scan_status = 'clean'
  and (
    (select private.is_administrator())
    or (select private.has_global_role('editor'::public.portal_role))
    or exists (
      select 1
      from public.resource_revisions as revision
      where revision.media_asset_id = media_assets.id
    )
  )
);
