# Trenerutdanningsportalen Checkin, Migration and Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importere Checkin- og historikkdata sikkert og idempotent, migrere V1-innhold, verifisere hele produktet og sette portalen i produksjon med dokumentert rollback og beredskap.

**Architecture:** Checkin-filer behandles som ubetrodde inngangsdata: last opp, skann, fingerprint header, forhåndsvis, valider og commit én gang. Manglende rader endrer aldri tilgang. Produksjonssetting bruker migrering fremover, backup/restore-bevis, syntetisk generalprøve og begrenset pilot før Trener 3-kullet inviteres.

**Tech Stack:** ExcelJS, Zod, PostgreSQL staging/import jobs, Supabase Storage, Playwright, axe-core, k6, GitHub Actions, Sentry og runbooks.

---

### Task 1: Lås Checkins faktiske Excel-kontrakt

**Files:**
- Create: `portal/docs/integrations/checkin-excel-contract.md`
- Create: `portal/tests/fixtures/checkin/checkin-original-redacted.xlsx`
- Create: `portal/tests/fixtures/checkin/expected-normalized.json`
- Create: `portal/scripts/verify-redacted-checkin-fixture.ts`
- Create: `portal/src/features/imports/checkin/header-fingerprint.ts`
- Test: `portal/tests/unit/imports/header-fingerprint.test.ts`

- [ ] **Step 1: Gjennomfør Gate G1 uten å lagre ekte personer i Git**

NGF exports the original Checkin participant report containing at least one private payment, one club invoice and one Youth Drive selection. Make a working copy, replace every name/email/phone/order ID with synthetic values, preserve workbook name, sheet names, column names, data types and option labels, then store only the redacted copy under `tests/fixtures`.

`verify-redacted-checkin-fixture.ts` opens every sheet with ExcelJS, inspects raw/formula/hyperlink cell values and fails unless every email ends in `.invalid`, every phone is in the documented `+47 900 00 1xx` synthetic range and every external ID starts `DEMO-`. Run:

```bash
pnpm tsx scripts/verify-redacted-checkin-fixture.ts tests/fixtures/checkin/checkin-original-redacted.xlsx
```

Expected: only `.invalid` emails and documented synthetic phone range. A second person signs `checkin-excel-contract.md` confirming redaction.

- [ ] **Step 2: Dokumenter hver faktisk kolonne**

The contract table must have exact exported header, canonical field, type, required/optional, example, normalization and retention. Canonical V1 fields are:

```ts
export type CheckinParticipantRow = Readonly<{
  externalEventId: string;
  externalParticipantId: string | null;
  externalOrderUserId: string | null;
  name: string;
  email: string;
  phone: string | null;
  clubName: string | null;
  birthYear: number | null;
  ageEligibilityConfirmed: boolean | null;
  paymentStatus: "paid" | "pending" | "invoice" | "unknown";
  youthDriveSelected: boolean;
}>;
```

If the export lacks stable IDs, document that limitation and use composite import identity only for staging; account matching still requires confirmation and stable portal person ID.

- [ ] **Step 3: Skriv failing fingerprint-test**

```ts
import { describe, expect, it } from "vitest";
import { headerFingerprint } from "@/features/imports/checkin/header-fingerprint";

describe("headerFingerprint", () => {
  it("is insensitive to column order and surrounding whitespace", () => {
    expect(headerFingerprint([" Navn ", "E-post", "Klubb"])).toBe(headerFingerprint(["Klubb", "Navn", "E-post"]));
  });

  it("changes when a header is renamed", () => {
    expect(headerFingerprint(["Navn", "E-post"])).not.toBe(headerFingerprint(["Navn", "Epost"]));
  });
});
```

Run: `pnpm vitest tests/unit/imports/header-fingerprint.test.ts --run`  
Expected: FAIL.

- [ ] **Step 4: Implementer fingerprint og lås fixture-resultat**

Normalize Unicode NFKC, trim, collapse whitespace and lowercase Norwegian locale; sort; SHA-256 JSON array. Write the exact expected fingerprint and sheet name in the contract. Unknown fingerprint is always a preview error, never a best-effort production import.

Run: `pnpm vitest tests/unit/imports/header-fingerprint.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add portal/docs/integrations portal/tests/fixtures/checkin portal/src/features/imports/checkin portal/tests/unit/imports
git commit -m "test: lock redacted Checkin export contract"
```

### Task 2: Implementer trygg forhåndsvisning og idempotent Checkin-import

**Files:**
- Create: `portal/supabase/migrations/20261102090000_imports.sql`
- Create: `portal/src/features/imports/checkin/read-workbook.ts`
- Create: `portal/src/features/imports/checkin/normalize-row.ts`
- Create: `portal/src/features/imports/checkin/preview-import.ts`
- Create: `portal/src/features/imports/checkin/commit-import.ts`
- Create: `portal/src/app/(admin)/admin/imports/checkin/page.tsx`
- Create: `portal/tests/fixtures/checkin/unknown-schema.xlsx`
- Create: `portal/tests/fixtures/checkin/formula-cell.xlsx`
- Test: `portal/tests/unit/imports/checkin-parser.test.ts`
- Test: `portal/tests/integration/imports/checkin-import.test.ts`

- [ ] **Step 1: Skriv failing parser- og formeltest**

```ts
const result = await readCheckinWorkbook("tests/fixtures/checkin/checkin-original-redacted.xlsx");
expect(result.rows).toEqual(expect.arrayContaining([expect.objectContaining({ email: "nora.vik@example.invalid", youthDriveSelected: true })]));
await expect(readCheckinWorkbook("tests/fixtures/checkin/unknown-schema.xlsx")).rejects.toThrow("Ukjent Checkin-kolonneoppsett");
await expect(readCheckinWorkbook("tests/fixtures/checkin/formula-cell.xlsx")).rejects.toThrow("Formler er ikke tillatt");
```

Run: `pnpm vitest tests/unit/imports/checkin-parser.test.ts --run`  
Expected: FAIL.

- [ ] **Step 2: Parse arbeidsboken som ubetrodd data**

Reuse the fail-closed `scan-upload.ts` adapter from the Learning/CMS plan. Upload first to a private quarantine bucket, verify file magic bytes and MIME, stream it to the Gate G2-approved EU ClamAV endpoint, and move it to processing only on `OK`; timeout or unavailable scanner fails closed. Limit 10 MB, one approved sheet, 5,000 rows, 200 columns and 20,000 characters per cell. Reject macros, formulas, external links, merged header cells and unknown fingerprint. Normalize email/name/phone, keep source row number and report every rejected row without exposing other rows.

- [ ] **Step 3: Opprett staging, preview og audit-tabeller**

Migration adds `import_jobs`, `import_rows`, `external_references`, `commercial_status_snapshots`. Job states: `uploaded`, `parsed`, `previewed`, `committed`, `failed`. Unique `(provider, course_run_id, file_sha256)` makes same file idempotent. Unique `(provider, external_event_id, external_order_user_id)` prevents duplicate course place where stable ID exists.

- [ ] **Step 4: Implementer preview og commit-regler**

Preview classifies `new`, `update`, `unchanged`, `possible_duplicate`, `age_review` and `rejected`. For a course starting in year `Y`, a participant with birth year `B` is eligible when `Y - B >= 15`; this matches «året deltakeren fyller 15». If neither birth year nor a Checkin eligibility field exists, administrator must confirm `ageEligibilityConfirmed` before invitation. Commit requires unchanged preview hash and administrator permission. New/updated eligible rows create invitation candidates regardless payment status. Rows missing from the new file create no withdrawal, no access change and no deletion. Raw file is deleted after commit/failure retention window; job keeps hash, headers, counts and per-row outcome.

Integration assertions:

```ts
expect(firstCommit).toMatchObject({ created: 11, updated: 3, removed: 0 });
expect(secondCommit).toMatchObject({ created: 0, updated: 0, unchanged: 14, removed: 0 });
expect(await accessOfPersonOmittedFromSecondFile()).toBe("active");
```

Run: `pnpm vitest tests/integration/imports/checkin-import.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: E2E og commit**

E2E uploads, previews, confirms, downloads error rows and repeats upload. UI explicitly says «Manglende rader trekkes aldri automatisk». Keyboard and axe pass.

```bash
git add portal/supabase portal/src/features/imports portal/src/app/\(admin\)/admin/imports portal/tests
git commit -m "feat: import Checkin participants idempotently"
```

### Task 3: Implementer historikkimport og studentens årsavgrensning

**Files:**
- Create: `portal/src/features/imports/history/history-row.ts`
- Create: `portal/src/features/imports/history/commit-history.ts`
- Create: `portal/src/app/(admin)/admin/imports/history/page.tsx`
- Create: `portal/tests/fixtures/history/passed-history.xlsx`
- Test: `portal/tests/integration/imports/history-import.test.ts`
- Test: `portal/tests/e2e/student-history-visibility.spec.ts`

- [ ] **Step 1: Skriv failing T3-startårstest**

```ts
expect(normalizeHistoryRow({ level: "Trener 3", courseYear: "2026/2027", name: "Nora Vik", club: "Fjordglimt GK", email: "nora@example.invalid", passed: "Ja" })).toMatchObject({
  level: 3,
  startYear: 2026,
  passed: true,
});
```

Run: `pnpm vitest tests/integration/imports/history-import.test.ts --run`  
Expected: FAIL.

- [ ] **Step 2: Definer nøyaktig minimumsskjema**

Required columns: `Navn`, `Klubb`, `E-post`, `Trinn`, `Startår`, `Bestått`. Only accepted pass values after normalization: `ja`, `true`, `1`, `bestått`. Unknown values reject row. T3 uses `Startår`, never completion year.

- [ ] **Step 3: Commit historikk uten falsk detaljprogresjon**

Store `historical_qualifications` with source import, level, start year, passed boolean and optional course label. Do not invent modules, grades, practice or attendance. Link exact email only as a suggestion; admin confirms ambiguous person match.

- [ ] **Step 4: Test visibility**

Admin can report historical passed status. Current student sees only active current course progress; historical qualification may appear later in a separate competence view but is hidden in V1. Direct student query to historical table fails RLS.

Run: `pnpm playwright test tests/e2e/student-history-visibility.spec.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add portal/src/features/imports/history portal/src/app/\(admin\)/admin/imports/history portal/tests
git commit -m "feat: import passed historical qualifications"
```

### Task 4: Implementer Ungdomsdriven som ikke-blokkerende adminoppgave

**Files:**
- Create: `portal/src/features/imports/checkin/youth-drive.ts`
- Create: `portal/src/features/admin-tasks/create-youth-invoice-task.ts`
- Test: `portal/tests/unit/imports/youth-drive.test.ts`
- Test: `portal/tests/integration/admin-tasks/youth-drive.test.ts`

- [ ] **Step 1: Skriv failing regeltest**

```ts
expect(evaluateYouthDrive({ selected: true, attended: false })).toEqual({ blocksCompletion: false, task: "invoice_club_difference" });
expect(evaluateYouthDrive({ selected: true, attended: true })).toEqual({ blocksCompletion: false, task: null });
expect(evaluateYouthDrive({ selected: false, attended: false })).toEqual({ blocksCompletion: false, task: null });
```

Run: `pnpm vitest tests/unit/imports/youth-drive.test.ts --run`  
Expected: FAIL.

- [ ] **Step 2: Implementer ren regel og typed task**

Task stores course run, person, club, reason, status and source attendance/import IDs. It has no amount field. Duplicate evaluation uses unique `(course_run_id, person_id, task_type)`.

- [ ] **Step 3: Wire oppmøte til oppgave**

After Youth Drive attendance is closed, evaluate selected participants. Absence creates task; correcting attendance to present resolves it with audit. Completion evaluator continues regardless. UI action opens Checkin/accounting instructions, never invoices or edits payment.

- [ ] **Step 4: Integrasjonstest**

Run evaluator twice → one task. Complete course while task open → enrollment completed and diploma issued. Mark handled → audit with administrator. No amount appears in DB JSON, logs, PDF or Excel.

Run: `pnpm vitest tests/integration/admin-tasks/youth-drive.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add portal/src/features/imports/checkin/youth-drive.ts portal/src/features/admin-tasks portal/tests
git commit -m "feat: track Youth Drive club follow-up"
```

### Task 5: Etabler innholdsfabrikk og migrer pilotinnhold

**Files:**
- Create: `portal/content/inventory.csv`
- Create: `portal/content/templates/lesson.md`
- Create: `portal/content/templates/presentation.md`
- Create: `portal/scripts/validate-content-inventory.ts`
- Create: `portal/docs/content/content-production-runbook.md`
- Test: `portal/tests/unit/content/inventory.test.ts`

- [ ] **Step 1: Lås Gate G4 i maskinlesbar inventar**

CSV columns exactly:

```text
content_id,level,module_title,content_type,source_path,owner,reviewer,required,student_visible,prerequisite_ids,status,target_publish_date
```

Allowed status: `inventory`, `drafting`, `subject_review`, `language_review`, `ready_to_publish`, `published`. Every required V1 row needs owner, reviewer and date; duplicate ID and dangling prerequisite fail validation.

- [ ] **Step 2: Skriv failing inventartest**

```ts
expect(validateInventory(validFixture)).toEqual({ valid: true, errors: [] });
expect(validateInventory([{ content_id: "T1-BALL-01", required: "true", owner: "", reviewer: "" }])).toEqual({
  valid: false,
  errors: expect.arrayContaining([expect.stringContaining("owner"), expect.stringContaining("reviewer")]),
});
```

Run: `pnpm vitest tests/unit/content/inventory.test.ts --run`  
Expected: FAIL.

- [ ] **Step 3: Implementer validering og maler**

Lesson template contains learning outcome, prior knowledge, body blocks, image alt text, case, summary, control questions, sources, student completion mode and presentation link. Presentation template separately contains audience, teaching objective, slide purpose, speaker note, student visibility and source lesson revision.

- [ ] **Step 4: Migrer vertikal pilot «Ballfluktslover og balltreff»**

Import reviewed NGF PowerPoint/text into structured lesson and separately published presentation. Add permitted Trackman video with English-language label, five-question quiz and explicit prerequisite. Subject owner approves factual sequence; language reviewer approves Bokmål; UU reviewer approves alt text/captions. Publish to synthetic T1 run first, then controlled pilot.

- [ ] **Step 5: Kjør innholdsgate og commit**

```bash
pnpm tsx scripts/validate-content-inventory.ts content/inventory.csv
pnpm vitest tests/unit/content/inventory.test.ts --run
git add portal/content portal/scripts/validate-content-inventory.ts portal/docs/content portal/tests/unit/content/inventory.test.ts
git commit -m "docs: establish reviewed content production pipeline"
```

Expected: no missing owner/reviewer/date, no dangling prerequisites, pilot content at `published` with revision IDs recorded.

### Task 6: Sikkerhet, personvern og generert-kodekontroll

**Files:**
- Create: `portal/docs/security/threat-model.md`
- Create: `portal/docs/security/privacy-data-map.md`
- Create: `portal/docs/security/code-review-checklist.md`
- Create: `portal/src/features/people/retention-policy.ts`
- Create: `.github/workflows/codeql.yml`
- Create: `portal/tests/security/authorization-matrix.spec.ts`
- Create: `portal/tests/security/log-redaction.test.ts`

- [ ] **Step 1: Skriv trusselmodell før hardening**

Cover invitation theft, cross-course IDOR, service-role leakage, malicious Excel, stored XSS in content, formula injection, attachment malware, mass export, prompt injection, duplicate merge corruption, audit tampering, notification replay and backup exposure. Each threat has owner, preventive control, detection, test and residual severity.

- [ ] **Step 2: Automatiser kodekontroll**

Run `pnpm add @sentry/nextjs` and commit the updated lockfile. CI adds CodeQL, secret scan, dependency audit, migration lint and license allowlist. Sentry initialization must use `sendDefaultPii: false` and a `beforeSend` scrubber tested against the same PII fixture as application logging. `code-review-checklist.md` requires reviewer to inspect generated code for:

```markdown
- [ ] All authorization occurs server-side and is backed by an RLS test.
- [ ] No service-role key, PII, token or uploaded content enters client bundle/logs.
- [ ] Domain rule has a failing-then-passing test and does not live only in UI.
- [ ] Migration has rollback/restore note and preserves audit/history.
- [ ] New dependency has owner, license, maintenance evidence and documented purpose.
- [ ] UI passes keyboard, 390/1280 viewport, axe and DESIGN.md review.
- [ ] Medium/high-risk code has approval from a reviewer other than the code generator; low-risk text/style is self-checked and sampled weekly.
```

Only rows relevant to the changed files are required; non-relevant rows are marked `N/A` with one-line reason. This keeps ordinary feedback within the 3–6 minute fast gate defined in the master plan.

- [ ] **Step 3: Test hele autorisasjonsmatrisen**

For student, teacher A, teacher B, course lead, editor and admin, test every sensitive route and direct repository operation. Expected: access only for correct role/scope; unauthorized response is 404 where resource existence is sensitive.

- [ ] **Step 4: Test logging og rate limits**

Inject email, phone, assignment text, magic token and file name into failing requests; captured application/Sentry events contain correlation ID and error code but none of the injected values. Rate-limit activation attempts, exports, AI queries and file imports per person/IP; tests use injected clock and no external cache dependency. `retention-policy.ts` maps each data category to the exact NGF-approved period from the privacy data map; production startup rejects missing policy values, and purge jobs skip legal holds while recording counts and audit IDs.

- [ ] **Step 5: Kjør og commit sikkerhetsgate**

```bash
pnpm test:rls
pnpm playwright test tests/security/authorization-matrix.spec.ts
pnpm vitest tests/security/log-redaction.test.ts --run
pnpm audit --prod --audit-level high
git add portal/docs/security portal/tests/security .github/workflows/codeql.yml
git commit -m "security: enforce portal release controls"
```

Expected: no critical/high finding. Another security reviewer signs the threat model.

### Task 7: UU-, ytelses- og restore-gate

**Files:**
- Create: `portal/tests/accessibility/critical-pages.spec.ts`
- Create: `portal/tests/performance/critical-journeys.js`
- Create: `portal/docs/runbooks/backup-restore.md`
- Create: `portal/docs/runbooks/incident-response.md`
- Create: `portal/docs/evidence/nonfunctional-gate.md`

- [ ] **Step 1: Test WCAG på kritiske sider**

Run student home/activity/quiz/practice, teacher list/profile and admin import/query at 390×844, 768×1024 and 1280×900. Automated axe: zero serious/critical. Manual: keyboard, 200% zoom, screen-reader landmarks/labels, error summary, focus in modal/drawer, reduced motion and status not color-only.

- [ ] **Step 2: Kjør målbar lasttest**

k6 scenario: 150 concurrent authenticated users for 10 minutes; 70% student reads, 15% activity completions, 10% teacher dashboard, 5% report request. Acceptance: HTTP error <1%, p95 cached/read <2s, p95 writes <3s, no duplicate completion/outbox, database CPU <70% and connection saturation <80%.

- [ ] **Step 3: Bevis backup og restore**

Baseline minimum: RPO 24 hours, RTO 8 hours unless Gate G5 tightens it. Create encrypted backup from staging, restore into isolated project, run row counts, foreign-key checks, sample certificate access and critical E2E. Record start/end, checksums, operator and cleanup. Never test restore by overwriting production.

- [ ] **Step 4: Test incident response**

Tabletop two incidents: cross-course data exposure and failed notification queue. Runbook includes containment, key rotation, evidence preservation, DPO escalation, affected-user assessment, status communication, recovery and postmortem owner.

- [ ] **Step 5: Commit evidence**

```bash
git add portal/tests/accessibility portal/tests/performance portal/docs/runbooks portal/docs/evidence/nonfunctional-gate.md
git commit -m "test: verify accessibility performance and recovery"
```

### Task 8: UAT, release candidate, produksjonssetting og rollback

**Files:**
- Create: `portal/docs/uat/v1-script.md`
- Create: `portal/docs/runbooks/deployment.md`
- Create: `portal/docs/runbooks/rollback.md`
- Create: `portal/docs/release/v1.0.0-rc.1.md`
- Create: `portal/tests/e2e/full-pilot-journey.spec.ts`

- [ ] **Step 1: Kjør rollebasert UAT med fiktive data**

Named NGF representatives execute student, course teacher, course lead, editor and administrator scripts. Every script has precondition, exact action, expected result, screenshot/evidence and sign-off. Severity 1/2 findings block RC; severity 3 needs owner/date.

- [ ] **Step 2: Kjør full pilotreise og kvalitetsport**

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit --run
pnpm test:integration --run
pnpm test:rls
pnpm build
pnpm playwright test
pnpm audit --prod --audit-level high
```

Expected: all code `0`. Archive CI run, coverage, Playwright report, axe result, performance report, migration version and reviewer approvals in release note.

- [ ] **Step 3: Tag release candidate and perform synthetic general rehearsal**

Deploy `v1.0.0-rc.1` to production infrastructure with outbound email routed to a test sink. Import synthetic Checkin workbook twice, invite 15 fake people, complete one journey, generate reports/diploma, restore backup and verify observability. Then purge all rehearsal identities through documented admin anonymization.

- [ ] **Step 4: Load production course configuration with two-person control**

One admin creates course/sessions and imports Checkin preview; a second verifies counts, date/location, Youth Drive field, teachers and sample contacts before commit. Send invitations first to two internal canaries; after successful login, release remaining batch. No bulk send without preview count and owner approval.

- [ ] **Step 5: Go live with rollback window**

Deployment runbook records migration, version, backup ID and health checks. For 60 minutes after invitation batch, monitor auth failures, email delivery, RLS/404 anomalies, import errors and queue age. Roll back application on sustained error >2% for 10 minutes or any cross-course access; do not roll back schema destructively. Suspend invitations if learning remains safe but email/import fails.

```bash
git add portal/docs/uat portal/docs/runbooks portal/docs/release portal/tests/e2e/full-pilot-journey.spec.ts
git commit -m "release: prepare trainer portal v1 candidate"
git tag -a v1.0.0-rc.1 -m "Trainer education portal V1 release candidate"
```

Expected: named NGF launch owner signs release note; support rota active; version and rollback target recorded; start readiness confirmed no later than 22. januar 2027.
