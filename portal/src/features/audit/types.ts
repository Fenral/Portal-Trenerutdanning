export type AuditAction =
  | "role.granted"
  | "role.revoked"
  | "invitation.created"
  | "invitation.claimed"
  | "enrollment.withdrawn"
  | "enrollment.reopened"
  | "enrollment.completed"
  | "course.created"
  | "course.updated"
  | "content.published"
  | "content.binding_updated"
  | "assignment.submitted"
  | "assignment.reviewed"
  | "assignment.deadline_extended"
  | "practice.submitted"
  | "practice.approved"
  | "practice.revision_required"
  | "attendance.recorded"
  | "attendance.overridden"
  | "completion.overridden"
  | "certificate.issued"
  | "import.previewed"
  | "import.committed"
  | "person.merged"
  | "person.merge_reversed"
  | "person.anonymized"
  | "notification.delivered"
  | "notification.failed"
  | "admin_task.updated";

export type AuditEvent = Readonly<{
  actorProfileId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  correlationId: string;
  reason: string | null;
  beforeData: unknown;
  afterData: unknown;
}>;
