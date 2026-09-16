import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentDocument } from "@/features/content/document-schema";
import type { ContentKind, RevisionStatus } from "@/features/content/types";

export type CmsItem = {
  id: string;
  title: string;
  slug: string;
  kind: ContentKind;
  level: number | null;
  courseRunId: string | null;
  sourceItemId: string | null;
  sourceRevisionId: string | null;
};

export type CmsRevision = {
  id: string;
  revisionNumber: number;
  status: RevisionStatus;
  document: ContentDocument;
  changeNote: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type CmsCourse = {
  id: string;
  title: string;
  status: "draft" | "active" | "closed";
};

export type CmsAttachment = {
  id: string;
  itemId: string;
  title: string;
  author: string;
  audience: "teachers" | "course_members";
  filename: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  downloadUrl: string;
};

export type CmsEditor = {
  item: CmsItem;
  draft: CmsRevision;
  published: CmsRevision | null;
  history: CmsRevision[];
  courseBindings: {
    courseRunId: string;
    courseTitle: string;
    courseStatus: CmsCourse["status"];
    revisionId: string;
  }[];
  attachments: CmsAttachment[];
  courses: CmsCourse[];
};

export type CmsCatalogItem = CmsItem & {
  publishedRevision: number | null;
  draftRevision: number | null;
  updatedAt: string;
  availableVariantCourseIds: string[];
};
export type CmsCatalog = { items: CmsCatalogItem[]; courses: CmsCourse[] };

export type CmsSession = {
  client: SupabaseClient;
  admin: SupabaseClient;
  profileId: string;
  isGlobalManager: boolean;
  courseIds: string[];
};
