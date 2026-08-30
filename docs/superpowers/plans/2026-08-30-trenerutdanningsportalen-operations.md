# Trenerutdanningsportalen Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levere lærerens operative deltakeroppfølging og administratorens sikre drift, varsling, identitetshåndtering, rapportering og objektive AI-søk.

**Architecture:** Lærer- og adminflater er projeksjoner over de samme autoritative domenedataene som studentreisen. Beregninger ligger i delte servermoduler, ikke i UI eller eksportkode. Varsler bruker transactional outbox; rapporter og AI-søk bruker en allowlist med identiske definisjoner slik at samme spørsmål alltid gir samme tall.

**Tech Stack:** Next.js, PostgreSQL/RLS, Zod, outbox worker, e-postadapter, ExcelJS, React-PDF, OpenAI structured output adapter, Vitest, MSW og Playwright.

---

### Task 1: Implementer anbefalt progresjonsplan og trafikklys

**Files:**
- Create: `portal/supabase/migrations/20261019090000_pace_plan.sql`
- Create: `portal/src/features/courses/pace/recommended-progress.ts`
- Create: `portal/src/features/courses/pace/classify-pace.ts`
- Create: `portal/src/features/courses/pace/index.ts`
- Test: `portal/tests/unit/courses/pace.test.ts`

- [ ] **Step 1: Skriv failing test for interpolasjon og terskler**

```ts
import { describe, expect, it } from "vitest";
import { recommendedProgress, classifyPace } from "@/features/courses/pace";

describe("course pace", () => {
  const milestones = [
    { at: new Date("2026-08-01T00:00:00Z"), percent: 40 },
    { at: new Date("2026-09-01T00:00:00Z"), percent: 60 },
  ];

  it("interpolates between teacher-defined milestones", () => {
    expect(recommendedProgress(milestones, new Date("2026-08-16T12:00:00Z"))).toBe(50);
  });

  it("uses green/yellow/red plus overdue hard deadline", () => {
    expect(classifyPace({ actual: 55, recommended: 60, hardDeadlineOverdue: false, greenLag: 5, redLag: 15 })).toBe("green");
    expect(classifyPace({ actual: 50, recommended: 60, hardDeadlineOverdue: false, greenLag: 5, redLag: 15 })).toBe("yellow");
    expect(classifyPace({ actual: 59, recommended: 60, hardDeadlineOverdue: true, greenLag: 5, redLag: 15 })).toBe("red");
  });
});
```

Run: `pnpm vitest tests/unit/courses/pace.test.ts --run`  
Expected: FAIL.

- [ ] **Step 2: Implementer deterministisk beregning**

Sort and validate milestones strictly increasing by timestamp and non-decreasing percent 0–100. Before first milestone return its percent; after last return last percent. Between two points use linear interpolation and round only final display value.

```ts
export type Pace = "green" | "yellow" | "red";

export function classifyPace(input: { actual: number; recommended: number; hardDeadlineOverdue: boolean; greenLag: number; redLag: number }): Pace {
  if (input.hardDeadlineOverdue) return "red";
  const lag = input.recommended - input.actual;
  if (lag <= input.greenLag) return "green";
  if (lag <= input.redLag) return "yellow";
  return "red";
}
```

Run: `pnpm vitest tests/unit/courses/pace.test.ts --run`  
Expected: PASS.

Create `portal/src/features/courses/pace/index.ts` with only `export { recommendedProgress } from "./recommended-progress";` and `export { classifyPace } from "./classify-pace";` so the tested import path is the public feature API.

- [ ] **Step 3: Lagre plan og endringshistorikk**

Migration adds `pace_plans` (`green_lag=5`, `red_lag=15`) and `pace_milestones`. Updates create a new plan version; active enrollments are reclassified asynchronously and audit records old/new thresholds. Only course lead/admin can write; teacher can read.

- [ ] **Step 4: Integrasjonstest tidszoner og planendring**

Store all timestamps UTC, render Europe/Oslo. Test DST boundary, same-day milestone, red hard deadline, and that changing plan does not alter stored activity completions.

Run: `pnpm test:integration --run tests/integration/courses/pace-plan.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add portal/supabase portal/src/features/courses/pace portal/tests
git commit -m "feat: add configurable course pace plan"
```

### Task 2: Bygg lærerens kursoversikt, arbeidskø og deltakerprofil

**Files:**
- Create: `portal/src/features/reporting/teacher-dashboard-query.ts`
- Create: `portal/src/app/(teacher)/teacher/page.tsx`
- Create: `portal/src/app/(teacher)/teacher/courses/[courseRunId]/page.tsx`
- Create: `portal/src/app/(teacher)/teacher/courses/[courseRunId]/participants/[personId]/page.tsx`
- Create: `portal/src/app/(teacher)/teacher/courses/[courseRunId]/ParticipantTable.tsx`
- Test: `portal/tests/integration/reporting/teacher-dashboard.test.ts`
- Test: `portal/tests/e2e/teacher-follow-up.spec.ts`

- [ ] **Step 1: Skriv failing querytest for arbeidskørekkefølge**

Seed one overdue student, one awaiting review, one revision required and one green. Query must return priorities in this order: `overdue_deadline`, `awaiting_review`, `revision_required`, then no-action students excluded.

```ts
expect(result.queue.map((item) => item.reason)).toEqual([
  "overdue_deadline",
  "awaiting_review",
  "revision_required",
]);
expect(result.participants[0]).toMatchObject({
  name: "Nora Vik",
  progressPercent: 62,
  moduleCount: "7 av 11",
  practice: "24 / 45 t",
});
```

Run: `pnpm vitest tests/integration/reporting/teacher-dashboard.test.ts --run`  
Expected: FAIL.

- [ ] **Step 2: Implementer én typed query-projeksjon**

`getTeacherDashboard(actorPersonId, courseRunId, filter)` authorizes scoped course role before query. It returns only fields required by UI, excludes withdrawn from cohort average, includes withdrawn in an explicit status filter, and never returns data from another course.

- [ ] **Step 3: Bygg kursmeny og deltakerliste**

Sidebar groups by Trener 1/2/3; Trener 1 locations are collapsible. Table columns: name/club, total percent, modules `x av y`, practice, assignment, attendance and text+icon pace. Filters: all, green, yellow, red, withdrawn and action type. Table rows are keyboard-activatable links, not click-only `<tr>` handlers.

- [ ] **Step 4: Bygg deltakerprofil og E2E-test**

Profile shows contact, actual vs recommended linear timeline, module details, effective deadlines, practice, attendance, submissions and audit summary. Actions respect permissions: teacher can assess/message/extend; course lead additionally withdraw/reopen and assign staff.

Run: `pnpm playwright test tests/e2e/teacher-follow-up.spec.ts`  
Expected: PASS at 390 px and 1280 px; axe 0 serious/critical; teacher assigned to T3 receives 404 for T2 participant URL.

- [ ] **Step 5: Commit**

```bash
git add portal/src/features/reporting/teacher-dashboard-query.ts portal/src/app/\(teacher\) portal/tests
git commit -m "feat: add teacher follow-up workspace"
```

### Task 3: Implementer idempotente varsler og manuelle påminnelser

**Files:**
- Create: `portal/supabase/migrations/20261023090000_notifications.sql`
- Create: `portal/src/features/notifications/outbox.ts`
- Create: `portal/src/features/notifications/process-outbox.ts`
- Create: `portal/src/features/notifications/templates.ts`
- Create: `portal/src/features/notifications/smtp-transport.ts`
- Create: `portal/src/app/api/cron/notifications/route.ts`
- Test: `portal/tests/unit/notifications/templates.test.ts`
- Test: `portal/tests/integration/notifications/outbox.test.ts`

- [ ] **Step 1: Skriv failing idempotens- og personverntest**

```ts
expect(notificationKey({ courseRunId: "c1", personId: "p1", type: "deadline", scheduledAt: "2026-10-24T08:00:00Z" })).toBe(
  "c1:p1:deadline:2026-10-24T08:00:00.000Z",
);
expect(renderEmail("deadline", { firstName: "Nora", courseTitle: "Trener 3", dueOn: "12. september" }).text).not.toContain("vurderingskommentar");
```

Run: `pnpm vitest tests/unit/notifications --run`  
Expected: FAIL.

- [ ] **Step 2: Implementer nøkkel og minimert e-postmal**

E-mail contains first name, course, action, due date and secure portal link—never grade, submission text, health, phone or magic token in logs. Templates: invitation, due reminder, review result available, new deadline, recommended-before-session, access withdrawn/reopened and completion.

- [ ] **Step 3: Opprett outbox og worker**

Run `pnpm add nodemailer` and `pnpm add -D @types/nodemailer`; commit the updated lockfile. The migration adds `scheduled_reminders` and `notification_deliveries` while reusing the core `outbox_events` table. Its unique key prevents duplicates. Worker claims with `for update skip locked`, sends through `SmtpNotificationTransport`, stores provider message ID, attempt count and next retry using exponential schedule 1m/5m/30m/2h/12h. Before retrying an `invitation.email`, it mints a new raw token in worker memory, stores only the new SHA-256 hash and invalidates the previous link. After five failures it creates admin incident and stops retrying. Cron route requires timing-safe comparison of `CRON_SECRET` and is not available without it. Production startup fails unless Gate G2-approved SMTP host, port, sender domain and credentials are present; Supabase Auth uses the same approved sender domain.

- [ ] **Step 4: Test planlagt og manuell påminnelse**

Run worker twice → one provider call. Provider 500 then success → two attempts, one delivered event. Course teacher manual reminder only to scoped participants. Fixed reminders calculate Europe/Oslo time then persist UTC. No SMS adapter in V1.

Run: `pnpm vitest tests/integration/notifications/outbox.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add portal/supabase portal/src/features/notifications portal/src/app/api/cron/notifications portal/tests
git commit -m "feat: add reliable portal notifications"
```

### Task 4: Implementer trukket/gjenåpnet og reversibel kontosammenslåing

**Files:**
- Create: `portal/supabase/migrations/20261027090000_people_operations.sql`
- Create: `portal/src/features/people/enrollment-lifecycle.ts`
- Create: `portal/src/features/people/duplicate-score.ts`
- Create: `portal/src/features/people/merge-people.ts`
- Create: `portal/src/features/people/anonymize-person.ts`
- Create: `portal/src/app/(admin)/admin/people/duplicates/page.tsx`
- Test: `portal/tests/unit/people/enrollment-lifecycle.test.ts`
- Test: `portal/tests/integration/people/merge-people.test.ts`

- [ ] **Step 1: Skriv failing status- og duplikattest**

```ts
import { describe, expect, it } from "vitest";
import { transitionEnrollment } from "@/features/people/enrollment-lifecycle";
import { duplicateScore } from "@/features/people/duplicate-score";

describe("people operations", () => {
  it("withdraws and reopens without changing deadlines", () => {
    expect(transitionEnrollment("active", "withdraw")).toBe("withdrawn");
    expect(transitionEnrollment("withdrawn", "reopen")).toBe("reopened");
  });

  it("requires more than a similar name", () => {
    expect(duplicateScore({ name: "Nora Vik", club: "Fjordglimt GK", email: "nora@example.com", phone: "90000101" }, { name: "Nora K Vik", club: "Fjordglimt GK", email: "nora.k@example.com", phone: "90000101" })).toBeGreaterThanOrEqual(80);
    expect(duplicateScore({ name: "Nora Vik", club: "Fjordglimt GK", email: "a@example.com", phone: null }, { name: "Nora Viken", club: "Annen GK", email: "b@example.com", phone: null })).toBeLessThan(80);
  });
});
```

Run: `pnpm vitest tests/unit/people --run`  
Expected: FAIL.

- [ ] **Step 2: Implementer statusregler**

Only course lead/admin can withdraw/reopen. Withdrawal disables course access immediately, excludes from cohort average and keeps deadlines/submissions unchanged. Reopen restores access; it never extends deadlines. Both require reason and audit event.

- [ ] **Step 3: Implementer forslag uten automatisk merge**

Normalize Norwegian names, email and E.164 phone. Score requires at least two signals or exact stable external ID. Suggestions are visible only to administrator. A suggestion never changes user or course data.

- [ ] **Step 4: Implementer transaksjonell, reversibel merge**

Separate auth accounts from stable people. `person_merges` stores source/target, actor, reason, affected row mapping and source snapshot. Merge moves non-conflicting accounts, roles, enrollments and records to target; same-course conflicts are resolved deterministically by keeping the more advanced enrollment and storing both IDs. Reversal is allowed only if affected rows have not changed since merge; otherwise it returns `manual_reversal_required` without partial changes.

Integration tests: unauthorized teacher rejected; merge preserves two auth logins pointing to one person; no duplicate enrollment; reports count one person; reversal restores exact IDs; double merge is idempotent. `anonymizePerson` is a separate administrator-only legal workflow requiring case reference and second-person approval; it disables auth accounts, replaces direct identifiers with irreversible placeholders, deletes contact fields/files not under retention hold and preserves only pseudonymous course aggregates plus an audit record. It is never exposed as «Slett» in the course-leader UI.

Run: `pnpm vitest tests/integration/people/merge-people.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add portal/supabase portal/src/features/people portal/src/app/\(admin\)/admin/people portal/tests
git commit -m "feat: add reversible participant lifecycle operations"
```

### Task 5: Implementer én rapportdefinisjon for UI, PDF og Excel

**Files:**
- Create: `portal/src/features/reporting/definitions.ts`
- Create: `portal/src/features/reporting/report-types.ts`
- Create: `portal/src/features/reporting/course-progress-report.ts`
- Create: `portal/src/features/reporting/export-excel.ts`
- Create: `portal/src/features/reporting/export-pdf.tsx`
- Create: `portal/src/app/api/reports/course-progress/route.ts`
- Test: `portal/tests/unit/reporting/definitions.test.ts`
- Test: `portal/tests/integration/reporting/exports.test.ts`

- [ ] **Step 1: Skriv failing definisjonstest**

```ts
expect(definitions.student_progress.description).toBe("Fullførte obligatoriske progresjonspoeng delt på alle obligatoriske progresjonspoeng.");
expect(definitions.cohort_average.excludeStatuses).toEqual(["withdrawn"]);
expect(definitions.completed.predicate).toBe("progress_percentage = 100 AND enrollment_status = completed");
```

Run: `pnpm vitest tests/unit/reporting/definitions.test.ts --run`  
Expected: FAIL.

- [ ] **Step 2: Implementer immutable rapportmetadata**

Definitions include ID, Norwegian label, description, filters, excluded statuses, formula version and source tables. Report types are `course_progress`, `practice`, `attendance`, `assessments`, `deadlines`, `completion` and `t1_location_distribution`. All UI metrics and AI answers import these definitions; no duplicated formula string.

- [ ] **Step 3: Implementer report query og eksportadaptere**

Run `pnpm add exceljs @react-pdf/renderer` and commit the updated lockfile. A typed builder exists for all seven report types; `buildCourseProgressReport(actor, courseRunId, asOf)` returns metadata plus rows with name, club, email, progress, module count, practice, assignment, attendance and status. Excel uses fixed headers, frozen row, autofilter and ISO dates. PDF repeats header, page number, filters, definition and generated-at. Filenames are sanitized.

- [ ] **Step 4: Test innholdslikhet og autorisasjon**

Parse generated XLSX and PDF text for each of the seven report types; assert same rows and formulas as the corresponding UI/query projection. For progress: 15 rows, same cohort average, withdrawn excluded from average but present when explicit filter includes them. Verify Norwegian characters, unauthorized cross-course export gets 404, and no cell derived from imported/user data starts with `=`, `+`, `-` or `@` (prefix apostrophe in Excel).

Run: `pnpm vitest tests/integration/reporting/exports.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add portal/src/features/reporting portal/src/app/api/reports portal/tests
git commit -m "feat: export consistent course reports"
```

### Task 6: Implementer objektivt administratorstyrt AI-søk

**Files:**
- Create: `portal/src/features/admin-query/intents.ts`
- Create: `portal/src/features/admin-query/parse-query.ts`
- Create: `portal/src/features/admin-query/execute-intent.ts`
- Create: `portal/src/features/admin-query/prompt.ts`
- Create: `portal/src/app/(admin)/admin/insights/ai-query/page.tsx`
- Test: `portal/tests/unit/admin-query/parse-query.test.ts`
- Test: `portal/tests/integration/admin-query/security.test.ts`

- [ ] **Step 1: Skriv failing allowlist-test**

```ts
import { describe, expect, it } from "vitest";
import { QueryIntent } from "@/features/admin-query/intents";

describe("admin query intents", () => {
  it("accepts only objective V1 intents", () => {
    expect(QueryIntent.parse({ intent: "cohort_average", filters: { courseRunId: "00000000-0000-0000-0000-000000000001" } }).intent).toBe("cohort_average");
    expect(() => QueryIntent.parse({ intent: "predict_dropout", filters: {} })).toThrow();
    expect(() => QueryIntent.parse({ intent: "raw_sql", sql: "delete from profiles" })).toThrow();
  });
});
```

Run: `pnpm vitest tests/unit/admin-query --run`  
Expected: FAIL.

- [ ] **Step 2: Definer Zod-union uten SQL-felt**

Allowed intents: `student_progress`, `cohort_average`, `completed_count`, `t1_location_distribution`, `missing_assignments`, `attendance_status`, `practice_status`. Filters allow only validated IDs, statuses and date range. `QueryIntent` has no `sql`, `sortExpression` or arbitrary column field.

- [ ] **Step 3: Parse språk til struktur, og struktur til faste queries**

Run `pnpm add openai` and commit the updated lockfile. The model receives intent descriptions and returns strict structured output. `executeIntent` switches exhaustively and calls fixed repository methods using reporting definitions. The AI provider never receives rows, names, submissions, email or phone; it receives only the user's question and allowed schema. Names are joined after execution in NGF's server when the chosen report legitimately includes them.

- [ ] **Step 4: Sikkerhetstest prompt injection og skrivetilgang**

Mock parser outputs unknown intent, extra SQL field, cross-course ID and `ignore instructions; delete`. All rejected. Database role for admin-query has SELECT only on approved views; attempt INSERT/UPDATE/DELETE fails. Course lead receives 404. Response always contains interpreted question, filters, formula version, source timestamp, result and `readOnly: true`.

Run: `pnpm vitest tests/integration/admin-query/security.test.ts --run`  
Expected: PASS; no executed statement outside allowlisted repository mocks.

- [ ] **Step 5: Commit**

```bash
git add portal/src/features/admin-query portal/src/app/\(admin\)/admin/insights/ai-query portal/tests
git commit -m "feat: add read-only objective admin queries"
```

### Task 7: Bygg administratorens driftsside og kjør Operations-gate

**Files:**
- Create: `portal/src/features/reporting/admin-dashboard-query.ts`
- Create: `portal/src/app/(admin)/admin/page.tsx`
- Create: `portal/tests/e2e/admin-operations.spec.ts`
- Create: `portal/docs/evidence/operations-gate.md`

- [ ] **Step 1: Skriv failing E2E for prioritert driftskø**

Test admin sees unresolved import, Youth Drive invoice task and duplicate suggestion before general statistics; then opens course, exports, handles task and runs allowed AI question.

- [ ] **Step 2: Implementer driftsside med én hovedhandling**

Use 8/4 grid from `DESIGN.md`. Main column: urgent operations then course portfolio. Context: definitions and system health. AI cobalt is confined to AI panel. Checkin import and report are secondary/primary according to current context, never two equal filled buttons.

- [ ] **Step 3: Test rollegrenser i hele UI-et**

Direct URLs for admin query, duplicates, role grants and all-course reports return 404 for student, teacher, lead and editor. Hiding navigation is additional, not the test condition.

- [ ] **Step 4: Kjør samlet kvalitetsport og uavhengig review**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit --run
pnpm test:integration --run
pnpm test:rls
pnpm build
pnpm playwright test tests/e2e/teacher-follow-up.spec.ts tests/e2e/admin-operations.spec.ts
pnpm audit --prod --audit-level high
```

Expected: alle kode `0`, axe 0 serious/critical, ingen cross-course lekkasje, uavhengig reviewer godkjenner.

- [ ] **Step 5: Dokumenter og commit**

```bash
git add portal/src/app/\(admin\) portal/src/features/reporting/admin-dashboard-query.ts portal/tests/e2e/admin-operations.spec.ts portal/docs/evidence/operations-gate.md
git commit -m "feat: complete teacher and admin operations"
```
