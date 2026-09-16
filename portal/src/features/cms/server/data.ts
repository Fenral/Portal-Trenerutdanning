import type { SupabaseClient } from "@supabase/supabase-js";
import { ContentDocument } from "@/features/content/document-schema";
import type { ContentKind, RevisionStatus } from "@/features/content/types";
import { authorizeCmsItem, requireCmsStaff } from "./auth";
import { assertCmsQuery, CmsError } from "./errors";
import type {
  CmsAttachment,
  CmsCatalog,
  CmsCourse,
  CmsEditor,
  CmsItem,
  CmsRevision,
  CmsSession,
} from "./types";

type RevisionRow = {
  id: string;
  content_item_id: string;
  revision_number: number;
  status: RevisionStatus;
  document: unknown;
  change_note: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};
type MetadataRow = {
  content_item_id: string;
  level: number | null;
  course_run_id: string | null;
  source_item_id: string | null;
  source_revision_id: string | null;
};
export type AttachmentRow = {
  id: string;
  content_item_id: string;
  title: string;
  author: string;
  audience: "teachers" | "course_members";
  original_filename: string;
  mime_type: string;
  byte_size: number;
  created_at: string;
  storage_path: string;
};
const revisionColumns =
  "id,content_item_id,revision_number,status,document,change_note,created_at,updated_at,published_at";
const attachmentColumns =
  "id,content_item_id,title,author,audience,original_filename,mime_type,byte_size,created_at,storage_path";

export function toCmsAttachment(row: AttachmentRow): CmsAttachment {
  return {
    id: row.id,
    itemId: row.content_item_id,
    title: row.title,
    author: row.author,
    audience: row.audience,
    filename: row.original_filename,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    createdAt: row.created_at,
    downloadUrl: `/api/cms/attachments/${row.id}/download`,
  };
}
function toRevision(row: RevisionRow): CmsRevision {
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
function toItem(
  row: { id: string; title: string; slug: string; kind: ContentKind },
  metadata?: MetadataRow,
): CmsItem {
  return {
    ...row,
    level: metadata?.level ?? null,
    courseRunId: metadata?.course_run_id ?? null,
    sourceItemId: metadata?.source_item_id ?? null,
    sourceRevisionId: metadata?.source_revision_id ?? null,
  };
}

export async function loadCmsCourses(
  session: CmsSession,
): Promise<CmsCourse[]> {
  requireCmsStaff(session);
  let query = session.admin
    .from("course_runs")
    .select("id,title,status")
    .order("created_at", { ascending: false });
  if (!session.isGlobalManager) query = query.in("id", session.courseIds);
  const result = await query;
  assertCmsQuery(result.error);
  return (result.data ?? []) as CmsCourse[];
}

export async function loadCmsCatalog(session: CmsSession): Promise<CmsCatalog> {
  requireCmsStaff(session);
  const courses = await loadCmsCourses(session);
  let visibleIds: string[] | undefined;
  let allowedPublishedIds: Set<string> | undefined;
  let ownItemIds: Set<string> | undefined;
  let scopedBindings: {
    content_item_id: string;
    content_revision_id: string;
    course_run_id: string;
  }[] = [];
  if (!session.isGlobalManager) {
    const [locals, bindings] = await Promise.all([
      session.admin
        .from("cms_content_metadata")
        .select("content_item_id")
        .in("course_run_id", session.courseIds),
      session.admin
        .from("course_content_bindings")
        .select("content_item_id,content_revision_id,course_run_id")
        .in("course_run_id", session.courseIds),
    ]);
    assertCmsQuery(locals.error);
    assertCmsQuery(bindings.error);
    scopedBindings = bindings.data ?? [];
    ownItemIds = new Set(
      (locals.data ?? []).map((row) => row.content_item_id as string),
    );
    visibleIds = [
      ...new Set([
        ...ownItemIds,
        ...(bindings.data ?? []).map((row) => row.content_item_id as string),
      ]),
    ];
    allowedPublishedIds = new Set(
      (bindings.data ?? []).map((row) => row.content_revision_id as string),
    );
    if (!visibleIds.length) return { items: [], courses };
  }
  let itemsQuery = session.admin
    .from("content_items")
    .select("id,title,slug,kind,created_at")
    .order("created_at", { ascending: false });
  if (visibleIds) itemsQuery = itemsQuery.in("id", visibleIds);
  const itemsResult = await itemsQuery;
  assertCmsQuery(itemsResult.error);
  const items = (itemsResult.data ?? []) as {
    id: string;
    title: string;
    slug: string;
    kind: ContentKind;
    created_at: string;
  }[];
  if (!items.length) return { items: [], courses };
  const ids = items.map((item) => item.id);
  const [metadata, revisions] = await Promise.all([
    session.admin
      .from("cms_content_metadata")
      .select(
        "content_item_id,level,course_run_id,source_item_id,source_revision_id",
      )
      .in("content_item_id", ids),
    session.admin
      .from("content_revisions")
      .select("id,content_item_id,revision_number,status,updated_at")
      .in("content_item_id", ids)
      .order("revision_number", { ascending: false }),
  ]);
  assertCmsQuery(metadata.error);
  assertCmsQuery(revisions.error);
  const metadataById = new Map(
    ((metadata.data ?? []) as MetadataRow[]).map((row) => [
      row.content_item_id,
      row,
    ]),
  );
  const variantCoursesBySource = new Map<string, Set<string>>();
  const openCourseIds = new Set(
    courses
      .filter((course) => course.status !== "closed")
      .map((course) => course.id),
  );
  for (const row of (metadata.data ?? []) as MetadataRow[]) {
    if (!row.source_item_id || !row.course_run_id) continue;
    const courseIds =
      variantCoursesBySource.get(row.source_item_id) ?? new Set();
    courseIds.add(row.course_run_id);
    variantCoursesBySource.set(row.source_item_id, courseIds);
  }
  return {
    courses,
    items: items.map((row) => {
      const editable = session.isGlobalManager || ownItemIds?.has(row.id);
      const itemRevisions = (revisions.data ?? []).filter(
        (revision) =>
          revision.content_item_id === row.id &&
          (editable || allowedPublishedIds?.has(revision.id)),
      );
      const draft = editable
        ? itemRevisions.find((revision) => revision.status === "draft")
        : undefined;
      const published = itemRevisions.find(
        (revision) => revision.status !== "draft",
      );
      const item = toItem(
        { id: row.id, title: row.title, slug: row.slug, kind: row.kind },
        metadataById.get(row.id),
      );
      const existingVariantCourses = variantCoursesBySource.get(row.id);
      const candidateCourseIds = session.isGlobalManager
        ? [...openCourseIds]
        : scopedBindings
            .filter(
              (binding) =>
                binding.content_item_id === row.id &&
                openCourseIds.has(binding.course_run_id),
            )
            .map((binding) => binding.course_run_id);
      return {
        ...item,
        publishedRevision: published?.revision_number ?? null,
        draftRevision: draft?.revision_number ?? null,
        updatedAt: draft?.updated_at ?? published?.updated_at ?? row.created_at,
        availableVariantCourseIds:
          item.courseRunId === null && published
            ? [
                ...new Set(
                  candidateCourseIds.filter(
                    (courseId) => !existingVariantCourses?.has(courseId),
                  ),
                ),
              ]
            : [],
      };
    }),
  };
}

export async function loadCmsEditor(
  session: CmsSession,
  itemId: string,
): Promise<CmsEditor> {
  const item = await authorizeCmsItem(session, itemId);
  const [revisions, bindings, ownAttachments, courses, sourceRevision] =
    await Promise.all([
      session.admin
        .from("content_revisions")
        .select(revisionColumns)
        .eq("content_item_id", itemId)
        .order("revision_number", { ascending: false }),
      session.admin
        .from("course_content_bindings")
        .select("course_run_id,content_revision_id")
        .eq("content_item_id", itemId),
      session.admin
        .from("cms_attachments")
        .select(attachmentColumns)
        .eq("content_item_id", itemId)
        .order("created_at", { ascending: false }),
      loadCmsCourses(session),
      item.sourceRevisionId
        ? session.admin
            .from("content_revisions")
            .select("document")
            .eq("id", item.sourceRevisionId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
  assertCmsQuery(revisions.error);
  assertCmsQuery(bindings.error);
  assertCmsQuery(ownAttachments.error);
  assertCmsQuery(sourceRevision.error);
  const sourceAttachmentIds = sourceRevision.data
    ? (ContentDocument.parse(sourceRevision.data.document).attachmentIds ?? [])
    : [];
  let inheritedAttachments: AttachmentRow[] = [];
  if (sourceAttachmentIds.length && item.sourceItemId) {
    const inherited = await session.admin
      .from("cms_attachments")
      .select(attachmentColumns)
      .eq("content_item_id", item.sourceItemId)
      .in("id", sourceAttachmentIds);
    assertCmsQuery(inherited.error);
    inheritedAttachments = (inherited.data ?? []) as AttachmentRow[];
  }
  const revisionViews = ((revisions.data ?? []) as RevisionRow[]).map(
    toRevision,
  );
  const draft = revisionViews.find((revision) => revision.status === "draft");
  if (!draft) throw new CmsError(404, "Innholdet mangler en redigerbar kladd.");
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  return {
    item,
    draft,
    published:
      revisionViews.find((revision) => revision.status === "published") ?? null,
    history: revisionViews.filter((revision) => revision.status !== "draft"),
    courses,
    courseBindings: (bindings.data ?? []).flatMap((row) => {
      const course = coursesById.get(row.course_run_id);
      return course
        ? [
            {
              courseRunId: course.id,
              courseTitle: course.title,
              courseStatus: course.status,
              revisionId: row.content_revision_id as string,
            },
          ]
        : [];
    }),
    attachments: [
      ...((ownAttachments.data ?? []) as AttachmentRow[]),
      ...inheritedAttachments,
    ].map(toCmsAttachment),
  };
}

export type ResolvedCourseContent = {
  courseRunId: string;
  sourceItemId: string;
  itemId: string;
  revisionId: string;
};

/** Use the authenticated client. Draft-only variants never replace the bound source. */
export async function resolveCourseContent(
  client: SupabaseClient,
  courseRunId: string,
  sourceItemId: string,
): Promise<ResolvedCourseContent | null> {
  const override = await client
    .from("cms_course_overrides")
    .select("local_item_id")
    .eq("course_run_id", courseRunId)
    .eq("source_item_id", sourceItemId)
    .maybeSingle();
  assertCmsQuery(override.error);
  if (override.data) {
    const local = await client
      .from("course_content_bindings")
      .select("content_revision_id")
      .eq("course_run_id", courseRunId)
      .eq("content_item_id", override.data.local_item_id)
      .maybeSingle();
    assertCmsQuery(local.error);
    if (local.data)
      return {
        courseRunId,
        sourceItemId,
        itemId: override.data.local_item_id,
        revisionId: local.data.content_revision_id,
      };
  }
  const source = await client
    .from("course_content_bindings")
    .select("content_revision_id")
    .eq("course_run_id", courseRunId)
    .eq("content_item_id", sourceItemId)
    .maybeSingle();
  assertCmsQuery(source.error);
  return source.data
    ? {
        courseRunId,
        sourceItemId,
        itemId: sourceItemId,
        revisionId: source.data.content_revision_id,
      }
    : null;
}

/** RLS checks attachment audience against the actual bound publication. */
export async function loadCmsReadableAttachments(
  client: SupabaseClient,
  attachmentIds: readonly string[],
): Promise<CmsAttachment[]> {
  if (!attachmentIds.length) return [];
  const result = await client
    .from("cms_attachments")
    .select(attachmentColumns)
    .in("id", [...attachmentIds]);
  assertCmsQuery(result.error);
  return ((result.data ?? []) as AttachmentRow[]).map(toCmsAttachment);
}
