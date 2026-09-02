export type EnrollmentStatus = "invited" | "active" | "withdrawn" | "completed";

export type EnrollmentAction = "withdraw" | "reopen";

export function transitionEnrollment(
  current: EnrollmentStatus,
  action: EnrollmentAction,
): EnrollmentStatus {
  if (current === "active" && action === "withdraw") return "withdrawn";
  if (current === "withdrawn" && action === "reopen") return "active";
  throw new Error(`Ugyldig overgang: ${current} → ${action}`);
}
