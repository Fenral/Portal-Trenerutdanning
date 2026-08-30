export type Role =
  "student" | "course_teacher" | "course_lead" | "editor" | "administrator";

export type Permission =
  | "course.read"
  | "course.manage"
  | "content.edit"
  | "content.publish"
  | "assessment.grade"
  | "attendance.write"
  | "enrollment.withdraw"
  | "role.grant"
  | "report.export"
  | "admin_query.run"
  | "account.merge";

const grants: Readonly<Record<Role, readonly Permission[]>> = {
  student: ["course.read"],
  course_teacher: [
    "course.read",
    "assessment.grade",
    "attendance.write",
    "report.export",
  ],
  course_lead: [
    "course.read",
    "course.manage",
    "assessment.grade",
    "attendance.write",
    "enrollment.withdraw",
    "report.export",
  ],
  editor: ["course.read", "content.edit", "content.publish"],
  administrator: [
    "course.read",
    "course.manage",
    "content.edit",
    "content.publish",
    "assessment.grade",
    "attendance.write",
    "enrollment.withdraw",
    "role.grant",
    "report.export",
    "admin_query.run",
    "account.merge",
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return grants[role].includes(permission);
}
