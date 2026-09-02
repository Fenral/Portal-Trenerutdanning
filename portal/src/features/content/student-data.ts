import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ContentDocument,
  type ContentDocument as ContentDocumentValue,
} from "./document-schema";

type ContentItemRow = Readonly<{
  id: string;
  kind: string;
  title: string;
}>;

type ContentRevisionRow = Readonly<{
  id: string;
  content_item_id: string;
  revision_number: number;
  document: unknown;
  published_at: string | null;
}>;

type ContentBindingRow = Readonly<{
  course_run_id: string;
  content_item_id: string;
  content_revision_id: string;
}>;

type ResourceItemRow = Readonly<{
  id: string;
  title: string;
  description: string | null;
}>;

type ResourceRevisionRow = Readonly<{
  id: string;
  resource_item_id: string;
  revision_number: number;
  media_asset_id: string;
}>;

type ResourceBindingRow = Readonly<{
  course_run_id: string;
  resource_item_id: string;
  resource_revision_id: string;
}>;

type MediaAssetRow = Readonly<{
  id: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
}>;

export type StudentIdentityView = Readonly<{
  profileId: string | null;
  displayName: string;
  courseTitle: string;
  courseRunId: string | null;
}>;

export type StudentContentCard = Readonly<{
  id: string;
  title: string;
  kind: string;
  revisionNumber: number;
  heading: string;
  introduction: string;
  courseTitle: string;
}>;

export type StudentResourceView = Readonly<{
  id: string;
  title: string;
  description: string | null;
  revisionNumber: number;
  assetId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}>;

export type StudentSessionResource = StudentResourceView &
  Readonly<{ courseSessionId: string | null }>;

export type StudentContentView = Readonly<{
  item: ContentItemRow;
  revisionNumber: number;
  document: ContentDocumentValue;
  publishedAt: string | null;
  courseTitle: string;
  resources: readonly StudentResourceView[];
}>;

function assertNoQueryError(
  error: { code?: string; message: string } | null,
): void {
  if (error) {
    throw new Error(
      `STUDENT_CONTENT_QUERY_FAILED:${error.code ?? "UNKNOWN"}:${error.message}`,
    );
  }
}

function textSummary(document: ContentDocumentValue): Readonly<{
  heading: string;
  introduction: string;
}> {
  const heading = document.blocks.find((block) => block.type === "heading");
  const introduction = document.blocks.find(
    (block) => block.type === "paragraph",
  );

  return {
    heading:
      heading?.type === "heading" ? heading.text : "Pensum uten overskrift",
    introduction: introduction?.type === "paragraph" ? introduction.text : "",
  };
}

export async function loadStudentIdentity(
  client: SupabaseClient,
): Promise<StudentIdentityView> {
  const [profileResult, coursesResult] = await Promise.all([
    client.from("profiles").select("id,display_name").limit(1).maybeSingle(),
    client
      .from("course_runs")
      .select("id,title,start_year")
      .order("start_year", { ascending: false })
      .limit(1),
  ]);

  assertNoQueryError(profileResult.error);
  assertNoQueryError(coursesResult.error);

  return {
    profileId: profileResult.data?.id ?? null,
    displayName: profileResult.data?.display_name ?? "Student",
    courseTitle: coursesResult.data?.[0]?.title ?? "Aktivt kurs",
    courseRunId: coursesResult.data?.[0]?.id ?? null,
  };
}

export async function loadStudentContentCatalog(
  client: SupabaseClient,
): Promise<StudentContentCard[]> {
  const { data: bindingData, error: bindingError } = await client
    .from("course_content_bindings")
    .select("course_run_id,content_item_id,content_revision_id");
  assertNoQueryError(bindingError);

  const bindings = (bindingData ?? []) as ContentBindingRow[];
  if (!bindings.length) return [];

  const itemIds = [
    ...new Set(bindings.map((binding) => binding.content_item_id)),
  ];
  const revisionIds = [
    ...new Set(bindings.map((binding) => binding.content_revision_id)),
  ];
  const courseRunIds = [
    ...new Set(bindings.map((binding) => binding.course_run_id)),
  ];
  const [itemsResult, revisionsResult, coursesResult] = await Promise.all([
    client.from("content_items").select("id,kind,title").in("id", itemIds),
    client
      .from("content_revisions")
      .select("id,content_item_id,revision_number,document,published_at")
      .in("id", revisionIds),
    client.from("course_runs").select("id,title").in("id", courseRunIds),
  ]);

  assertNoQueryError(itemsResult.error);
  assertNoQueryError(revisionsResult.error);
  assertNoQueryError(coursesResult.error);

  const itemById = new Map(
    ((itemsResult.data ?? []) as ContentItemRow[]).map((item) => [
      item.id,
      item,
    ]),
  );
  const revisionById = new Map(
    ((revisionsResult.data ?? []) as ContentRevisionRow[]).map((revision) => [
      revision.id,
      revision,
    ]),
  );
  const courseById = new Map(
    (coursesResult.data ?? []).map((course) => [course.id, course.title]),
  );
  const seenItems = new Set<string>();

  return bindings.flatMap((binding) => {
    if (seenItems.has(binding.content_item_id)) return [];

    const item = itemById.get(binding.content_item_id);
    const revision = revisionById.get(binding.content_revision_id);
    if (!item || !revision) return [];

    seenItems.add(binding.content_item_id);
    const document = ContentDocument.parse(revision.document);
    const summary = textSummary(document);

    return [
      {
        id: item.id,
        title: item.title,
        kind: item.kind,
        revisionNumber: revision.revision_number,
        heading: summary.heading,
        introduction: summary.introduction,
        courseTitle: courseById.get(binding.course_run_id) ?? "Aktivt kurs",
      },
    ];
  });
}

export async function loadStudentSessionResources(
  client: SupabaseClient,
  courseRunId: string,
): Promise<readonly StudentSessionResource[]> {
  const { data: bindingData, error: bindingError } = await client
    .from("course_resource_bindings")
    .select("course_run_id,resource_item_id,resource_revision_id")
    .eq("course_run_id", courseRunId);
  assertNoQueryError(bindingError);

  const bindings = (bindingData ?? []) as ResourceBindingRow[];
  if (!bindings.length) return [];

  const itemIds = [...new Set(bindings.map((row) => row.resource_item_id))];
  const revisionIds = [
    ...new Set(bindings.map((row) => row.resource_revision_id)),
  ];

  const [itemsResult, revisionsResult] = await Promise.all([
    client
      .from("resource_items")
      .select("id,title,description,course_session_id,created_at")
      .eq("audience", "course_members")
      .in("id", itemIds)
      .order("created_at"),
    client
      .from("resource_revisions")
      .select("id,resource_item_id,revision_number,media_asset_id")
      .in("id", revisionIds),
  ]);

  assertNoQueryError(itemsResult.error);
  assertNoQueryError(revisionsResult.error);

  const items = (itemsResult.data ?? []) as ReadonlyArray<
    ResourceItemRow & Readonly<{ course_session_id: string | null }>
  >;
  const revisions = (revisionsResult.data ?? []) as ResourceRevisionRow[];
  const assetIds = [
    ...new Set(revisions.map((revision) => revision.media_asset_id)),
  ];
  const { data: assetData, error: assetError } = assetIds.length
    ? await client
        .from("media_assets")
        .select("id,original_filename,mime_type,byte_size")
        .in("id", assetIds)
    : { data: [], error: null };
  assertNoQueryError(assetError);

  const revisionByItemId = new Map(
    revisions.map((revision) => [revision.resource_item_id, revision]),
  );
  const assetById = new Map(
    ((assetData ?? []) as MediaAssetRow[]).map((asset) => [asset.id, asset]),
  );

  return items.flatMap((item) => {
    const revision = revisionByItemId.get(item.id);
    const asset = revision ? assetById.get(revision.media_asset_id) : null;
    return revision && asset
      ? [
          {
            id: item.id,
            title: item.title,
            description: item.description,
            courseSessionId: item.course_session_id,
            revisionNumber: revision.revision_number,
            assetId: asset.id,
            filename: asset.original_filename,
            mimeType: asset.mime_type,
            byteSize: asset.byte_size,
          },
        ]
      : [];
  });
}

export async function loadStudentContent(
  client: SupabaseClient,
  itemId: string,
  courseRunId?: string,
): Promise<StudentContentView | null> {
  let bindingQuery = client
    .from("course_content_bindings")
    .select("course_run_id,content_item_id,content_revision_id")
    .eq("content_item_id", itemId)
    .limit(1);

  if (courseRunId) {
    bindingQuery = bindingQuery.eq("course_run_id", courseRunId);
  }

  const { data: bindingData, error: bindingError } =
    await bindingQuery.maybeSingle();
  assertNoQueryError(bindingError);

  if (!bindingData) return null;
  const binding = bindingData as ContentBindingRow;

  const [itemResult, revisionResult, courseResult, resourceBindingsResult] =
    await Promise.all([
      client
        .from("content_items")
        .select("id,kind,title")
        .eq("id", itemId)
        .maybeSingle(),
      client
        .from("content_revisions")
        .select("id,content_item_id,revision_number,document,published_at")
        .eq("id", binding.content_revision_id)
        .maybeSingle(),
      client
        .from("course_runs")
        .select("id,title")
        .eq("id", binding.course_run_id)
        .maybeSingle(),
      client
        .from("course_resource_bindings")
        .select("course_run_id,resource_item_id,resource_revision_id")
        .eq("course_run_id", binding.course_run_id),
    ]);

  assertNoQueryError(itemResult.error);
  assertNoQueryError(revisionResult.error);
  assertNoQueryError(courseResult.error);
  assertNoQueryError(resourceBindingsResult.error);

  if (!itemResult.data || !revisionResult.data) return null;

  const resourceBindings = (resourceBindingsResult.data ??
    []) as ResourceBindingRow[];
  const resourceItemIds = [
    ...new Set(resourceBindings.map((row) => row.resource_item_id)),
  ];
  const resourceRevisionIds = [
    ...new Set(resourceBindings.map((row) => row.resource_revision_id)),
  ];

  let resources: StudentResourceView[] = [];

  if (resourceItemIds.length && resourceRevisionIds.length) {
    const [resourceItemsResult, resourceRevisionsResult] = await Promise.all([
      client
        .from("resource_items")
        .select("id,title,description")
        .eq("content_item_id", itemId)
        .in("id", resourceItemIds),
      client
        .from("resource_revisions")
        .select("id,resource_item_id,revision_number,media_asset_id")
        .in("id", resourceRevisionIds),
    ]);

    assertNoQueryError(resourceItemsResult.error);
    assertNoQueryError(resourceRevisionsResult.error);

    const resourceItems = (resourceItemsResult.data ?? []) as ResourceItemRow[];
    const resourceRevisions = (resourceRevisionsResult.data ??
      []) as ResourceRevisionRow[];
    const assetIds = [
      ...new Set(resourceRevisions.map((revision) => revision.media_asset_id)),
    ];
    const { data: assetData, error: assetError } = assetIds.length
      ? await client
          .from("media_assets")
          .select("id,original_filename,mime_type,byte_size")
          .in("id", assetIds)
      : { data: [], error: null };
    assertNoQueryError(assetError);

    const revisionByItemId = new Map(
      resourceRevisions.map((revision) => [
        revision.resource_item_id,
        revision,
      ]),
    );
    const assetById = new Map(
      ((assetData ?? []) as MediaAssetRow[]).map((asset) => [asset.id, asset]),
    );

    resources = resourceItems.flatMap((item) => {
      const revision = revisionByItemId.get(item.id);
      const asset = revision ? assetById.get(revision.media_asset_id) : null;
      return revision && asset
        ? [
            {
              id: item.id,
              title: item.title,
              description: item.description,
              revisionNumber: revision.revision_number,
              assetId: asset.id,
              filename: asset.original_filename,
              mimeType: asset.mime_type,
              byteSize: asset.byte_size,
            },
          ]
        : [];
    });
  }

  const revision = revisionResult.data as ContentRevisionRow;

  return {
    item: itemResult.data as ContentItemRow,
    revisionNumber: revision.revision_number,
    document: ContentDocument.parse(revision.document),
    publishedAt: revision.published_at,
    courseTitle: courseResult.data?.title ?? "Aktivt kurs",
    resources,
  };
}
