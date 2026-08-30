export const CONTENT_KINDS = [
  "lesson",
  "quiz",
  "assignment",
  "practice_requirement",
  "attendance_requirement",
  "knowledge_test",
] as const;

export const REVISION_STATUSES = ["draft", "published", "superseded"] as const;

export const RESOURCE_AUDIENCES = ["teachers", "course_members"] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];
export type RevisionStatus = (typeof REVISION_STATUSES)[number];
export type ResourceAudience = (typeof RESOURCE_AUDIENCES)[number];
