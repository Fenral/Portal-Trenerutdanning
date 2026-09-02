import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ContentDocument,
  type ContentDocument as ContentDocumentValue,
} from "./document-schema";
import type { ContentKind, ResourceAudience, RevisionStatus } from "./types";

type ContentItemRow = Readonly<{
  id: string;
  kind: ContentKind;
  slug: string;
  title: string;
  locale: string;
  created_at: string;
}>;

type ContentRevisionRow = Readonly<{
  id: string;
  content_item_id: string;
  revision_number: number;
  status: RevisionStatus;
  document: unknown;
  change_note: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}>;

type CourseBindingRow = Readonly<{
  course_run_id: string;
  content_revision_id: string;
}>;

type CourseRunRow = Readonly<{
  id: string;
  title: string;
  status: "draft" | "active" | "closed";
}>;

type ResourceItemRow = Readonly<{
  id: string;
  title: string;
  description: string | null;
  audience: ResourceAudience;
  course_session_id: string | null;
}>;

type CourseSessionRow = Readonly<{
  id: string;
  course_run_id: string;
  title: string;
}>;

type ResourceRevisionRow = Readonly<{
  id: string;
  resource_item_id: string;
  revision_number: number;
  status: RevisionStatus;
  media_asset_id: string;
  change_note: string;
  updated_at: string;
  published_at: string | null;
}>;

type MediaAssetRow = Readonly<{
  id: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
}>;

type ResourceBindingRow = Readonly<{
  course_run_id: string;
  resource_item_id: string;
  resource_revision_id: string;
}>;

export type ContentRevisionView = Readonly<{
  id: string;
  revisionNumber: number;
  status: RevisionStatus;
  document: ContentDocumentValue;
  changeNote: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}>;

export type CourseBindingView = Readonly<{
  courseRunId: string;
  courseTitle: string;
  courseStatus: CourseRunRow["status"];
  revisionId: string;
}>;

export type ResourceView = Readonly<{
  id: string;
  title: string;
  description: string | null;
  audience: ResourceAudience;
  published: Readonly<{
    id: string;
    revisionNumber: number;
    assetId: string;
    filename: string;
    mimeType: string;
    byteSize: number;
    publishedAt: string | null;
  }> | null;
  draftRevisionNumber: number | null;
  history: ReadonlyArray<
    Readonly<{
      revisionNumber: number;
      status: RevisionStatus;
      changeNote: string;
      updatedAt: string;
    }>
  >;
  courseTitles: readonly string[];
  courseRunIds: readonly string[];
  courseSessionId: string | null;
}>;

export type SessionOption = Readonly<{
  id: string;
  courseRunId: string;
  title: string;
  courseTitle: string;
}>;

export type ContentEditorView = Readonly<{
  item: ContentItemRow;
  draft: ContentRevisionView;
  published: ContentRevisionView | null;
  history: readonly ContentRevisionView[];
  courseBindings: readonly CourseBindingView[];
  resources: readonly ResourceView[];
  sessionOptions: readonly SessionOption[];
}>;

export type ContentCatalogItem = Readonly<{
  id: string;
  kind: ContentKind;
  title: string;
  heading: string;
  publishedRevision: number | null;
  draftRevision: number | null;
  resourceCount: number;
  updatedAt: string;
}>;

function assertNoQueryError(error: { message: string } | null): void {
  if (error) {
    throw new Error("CONTENT_EDITOR_QUERY_FAILED");
  }
}

function toRevisionView(row: ContentRevisionRow): ContentRevisionView {
  return {
    id: row.id,
    revisionNumber: row.revision_number,
    status: row.status,
    document: ContentDocument.parse(row.document),
    changeNote: row.change_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

export function summarizeContentDocument(document: unknown): Readonly<{
  heading: string;
  introduction: string;
}> {
  const parsed = ContentDocument.parse(document);
  const heading = parsed.blocks.find((block) => block.type === "heading");
  const introduction = parsed.blocks.find(
    (block) => block.type === "paragraph",
  );

  return {
    heading:
      heading?.type === "heading" ? heading.text : "Innhold uten overskrift",
    introduction: introduction?.type === "paragraph" ? introduction.text : "",
  };
}

export async function loadContentCatalog(
  adminClient: SupabaseClient,
): Promise<ContentCatalogItem[]> {
  const [itemsResult, revisionsResult, resourcesResult] = await Promise.all([
    adminClient
      .from("content_items")
      .select("id,kind,slug,title,locale,created_at")
      .order("title"),
    adminClient
      .from("content_revisions")
      .select(
        "id,content_item_id,revision_number,status,document,change_note,created_at,updated_at,published_at",
      )
      .order("revision_number", { ascending: false }),
    adminClient.from("resource_items").select("id,content_item_id"),
  ]);

  assertNoQueryError(itemsResult.error);
  assertNoQueryError(revisionsResult.error);
  assertNoQueryError(resourcesResult.error);

  const items = (itemsResult.data ?? []) as ContentItemRow[];
  const revisions = (revisionsResult.data ?? []) as ContentRevisionRow[];
  const resources = (resourcesResult.data ?? []) as Array<{
    id: string;
    content_item_id: string | null;
  }>;

  return items.map((item) => {
    const itemRevisions = revisions.filter(
      (revision) => revision.content_item_id === item.id,
    );
    const published = itemRevisions.find(
      (revision) => revision.status === "published",
    );
    const draft = itemRevisions.find((revision) => revision.status === "draft");
    const summary = summarizeContentDocument(
      draft?.document ?? published?.document,
    );

    return {
      id: item.id,
      kind: item.kind,
      title: item.title,
      heading: summary.heading,
      publishedRevision: published?.revision_number ?? null,
      draftRevision: draft?.revision_number ?? null,
      resourceCount: resources.filter(
        (resource) => resource.content_item_id === item.id,
      ).length,
      updatedAt: draft?.updated_at ?? published?.updated_at ?? item.created_at,
    };
  });
}

export async function loadContentEditor(
  adminClient: SupabaseClient,
  itemId: string,
): Promise<ContentEditorView | null> {
  const [itemResult, revisionsResult, bindingsResult, resourcesResult] =
    await Promise.all([
      adminClient
        .from("content_items")
        .select("id,kind,slug,title,locale,created_at")
        .eq("id", itemId)
        .maybeSingle(),
      adminClient
        .from("content_revisions")
        .select(
          "id,content_item_id,revision_number,status,document,change_note,created_at,updated_at,published_at",
        )
        .eq("content_item_id", itemId)
        .order("revision_number", { ascending: false }),
      adminClient
        .from("course_content_bindings")
        .select("course_run_id,content_revision_id")
        .eq("content_item_id", itemId),
      adminClient
        .from("resource_items")
        .select("id,title,description,audience,course_session_id")
        .eq("content_item_id", itemId)
        .order("created_at"),
    ]);

  assertNoQueryError(itemResult.error);
  assertNoQueryError(revisionsResult.error);
  assertNoQueryError(bindingsResult.error);
  assertNoQueryError(resourcesResult.error);

  if (!itemResult.data) {
    return null;
  }

  const revisionRows = (revisionsResult.data ?? []) as ContentRevisionRow[];
  const revisions = revisionRows.map(toRevisionView);
  const draft = revisions.find((revision) => revision.status === "draft");

  if (!draft) {
    throw new Error("CONTENT_DRAFT_NOT_FOUND");
  }

  const bindingRows = (bindingsResult.data ?? []) as CourseBindingRow[];
  const resourceRows = (resourcesResult.data ?? []) as ResourceItemRow[];
  const courseRunIds = [
    ...new Set(bindingRows.map((row) => row.course_run_id)),
  ];
  const resourceIds = resourceRows.map((resource) => resource.id);

  const [courseRunsResult, resourceRevisionsResult, resourceBindingsResult] =
    await Promise.all([
      courseRunIds.length
        ? adminClient
            .from("course_runs")
            .select("id,title,status")
            .in("id", courseRunIds)
        : Promise.resolve({ data: [], error: null }),
      resourceIds.length
        ? adminClient
            .from("resource_revisions")
            .select(
              "id,resource_item_id,revision_number,status,media_asset_id,change_note,updated_at,published_at",
            )
            .in("resource_item_id", resourceIds)
            .order("revision_number", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      resourceIds.length
        ? adminClient
            .from("course_resource_bindings")
            .select("course_run_id,resource_item_id,resource_revision_id")
            .in("resource_item_id", resourceIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  assertNoQueryError(courseRunsResult.error);
  assertNoQueryError(resourceRevisionsResult.error);
  assertNoQueryError(resourceBindingsResult.error);

  const courseRuns = (courseRunsResult.data ?? []) as CourseRunRow[];
  const resourceRevisions = (resourceRevisionsResult.data ??
    []) as ResourceRevisionRow[];
  const resourceBindings = (resourceBindingsResult.data ??
    []) as ResourceBindingRow[];
  const assetIds = [
    ...new Set(resourceRevisions.map((revision) => revision.media_asset_id)),
  ];
  const boundRunIds = [
    ...new Set(resourceBindings.map((binding) => binding.course_run_id)),
  ];
  const missingRunIds = boundRunIds.filter(
    (runId) => !courseRuns.some((course) => course.id === runId),
  );
  const [assetsResult, sessionsResult, missingRunsResult] = await Promise.all([
    assetIds.length
      ? adminClient
          .from("media_assets")
          .select("id,original_filename,mime_type,byte_size")
          .in("id", assetIds)
      : Promise.resolve({ data: [], error: null }),
    boundRunIds.length
      ? adminClient
          .from("course_sessions")
          .select("id,course_run_id,title")
          .in("course_run_id", boundRunIds)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    missingRunIds.length
      ? adminClient
          .from("course_runs")
          .select("id,title,status")
          .in("id", missingRunIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  assertNoQueryError(assetsResult.error);
  assertNoQueryError(sessionsResult.error);
  assertNoQueryError(missingRunsResult.error);
  const assets = (assetsResult.data ?? []) as MediaAssetRow[];
  const sessionRows = (sessionsResult.data ?? []) as CourseSessionRow[];
  const allCourseRuns = [
    ...courseRuns,
    ...((missingRunsResult.data ?? []) as CourseRunRow[]),
  ];
  const courseById = new Map(
    allCourseRuns.map((course) => [course.id, course]),
  );
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  return {
    item: itemResult.data as ContentItemRow,
    draft,
    published:
      revisions.find((revision) => revision.status === "published") ?? null,
    history: revisions.filter((revision) => revision.status !== "draft"),
    courseBindings: bindingRows.flatMap((binding) => {
      const course = courseById.get(binding.course_run_id);
      return course
        ? [
            {
              courseRunId: course.id,
              courseTitle: course.title,
              courseStatus: course.status,
              revisionId: binding.content_revision_id,
            },
          ]
        : [];
    }),
    resources: resourceRows.map((resource) => {
      const revisionsForResource = resourceRevisions.filter(
        (revision) => revision.resource_item_id === resource.id,
      );
      const publishedRevision = revisionsForResource.find(
        (revision) => revision.status === "published",
      );
      const asset = publishedRevision
        ? assetById.get(publishedRevision.media_asset_id)
        : null;

      return {
        id: resource.id,
        title: resource.title,
        description: resource.description,
        audience: resource.audience,
        published:
          publishedRevision && asset
            ? {
                id: publishedRevision.id,
                revisionNumber: publishedRevision.revision_number,
                assetId: asset.id,
                filename: asset.original_filename,
                mimeType: asset.mime_type,
                byteSize: asset.byte_size,
                publishedAt: publishedRevision.published_at,
              }
            : null,
        draftRevisionNumber:
          revisionsForResource.find((revision) => revision.status === "draft")
            ?.revision_number ?? null,
        history: revisionsForResource.map((revision) => ({
          revisionNumber: revision.revision_number,
          status: revision.status,
          changeNote: revision.change_note,
          updatedAt: revision.updated_at,
        })),
        courseTitles: resourceBindings
          .filter((binding) => binding.resource_item_id === resource.id)
          .flatMap((binding) => {
            const course = courseById.get(binding.course_run_id);
            return course ? [course.title] : [];
          }),
        courseRunIds: resourceBindings
          .filter((binding) => binding.resource_item_id === resource.id)
          .map((binding) => binding.course_run_id),
        courseSessionId: resource.course_session_id,
      };
    }),
    sessionOptions: sessionRows.map((session) => ({
      id: session.id,
      courseRunId: session.course_run_id,
      title: session.title,
      courseTitle: courseById.get(session.course_run_id)?.title ?? "",
    })),
  };
}
