import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ContentDocument,
  type ContentDocument as ContentDocumentValue,
} from "@/features/content/document-schema";
import {
  loadStudentContent,
  type StudentContentView,
} from "@/features/content/student-data";
import { ContentRenderer } from "@/features/learning/ContentRenderer";

import { Presentation } from "./Presentation";
import { requireCmsSession } from "./server/auth";
import { loadCmsReadableAttachments } from "./server/data";

type PublishedItemRow = Readonly<{
  id: string;
  kind: string;
  title: string;
}>;

type PublishedRevisionRow = Readonly<{
  revision_number: number;
  document: unknown;
  published_at: string | null;
}>;

export async function loadPublishedContent(
  client: SupabaseClient,
  itemId: string,
  courseRunId?: string,
): Promise<StudentContentView | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const session = await requireCmsSession().catch(() => null);
  // Course links always retain their pinned edition. A manager opening the
  // global preview sees the newest publication, regardless of course upgrades.
  if (courseRunId || !session?.isGlobalManager)
    return loadStudentContent(client, itemId, courseRunId);

  const [itemResult, revisionResult] = await Promise.all([
    session.admin
      .from("content_items")
      .select("id,kind,title")
      .eq("id", itemId)
      .maybeSingle(),
    session.admin
      .from("content_revisions")
      .select("revision_number,document,published_at")
      .eq("content_item_id", itemId)
      .eq("status", "published")
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (itemResult.error || revisionResult.error) return null;
  if (!itemResult.data || !revisionResult.data) return null;

  const item = itemResult.data as PublishedItemRow;
  const revision = revisionResult.data as PublishedRevisionRow;
  const document = ContentDocument.parse(revision.document);
  const attachments = await loadCmsReadableAttachments(
    client,
    document.attachmentIds ?? [],
  );

  return {
    item,
    revisionNumber: revision.revision_number,
    document,
    publishedAt: revision.published_at,
    courseTitle: "Publisert forhåndsvisning",
    resources: [],
    attachments,
  };
}

function withoutAttachmentPlaceholders(
  document: ContentDocumentValue,
): ContentDocumentValue {
  return { ...document, attachmentIds: [] };
}

export function PublishedContent({
  content,
  teaching = false,
}: Readonly<{
  content: StudentContentView;
  teaching?: boolean;
}>) {
  const document = withoutAttachmentPlaceholders(content.document);

  return (
    <>
      {teaching ? (
        <Presentation document={document} title={content.item.title} />
      ) : (
        <ContentRenderer document={document} />
      )}

      {content.attachments.length ? (
        <section aria-labelledby="published-attachments-title">
          <h2 id="published-attachments-title">Vedlegg</h2>
          <ul>
            {content.attachments.map((attachment) => (
              <li key={attachment.id}>
                <a href={attachment.downloadUrl}>
                  {attachment.title || attachment.filename}
                </a>
                {attachment.author ? ` · ${attachment.author}` : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
