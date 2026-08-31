# Trenerutdanningsportalen Learning and CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gjøre det mulig å redigere og publisere versjonert pensum, korte sider og scrollmoduler, laste opp og publisere eksterne filressurser, gjennomføre et modulbasert læringsløp og dokumentere quiz, innlevering, praksis, oppmøte, fullføring og diplom.

**Architecture:** Ferdig pensum lagres som versjonerte, strukturerte dokumenter med et begrenset blokkbibliotek. Presentasjoner og andre dokumenter lagres som separate, versjonerte filressurser; V1 bygger ikke en intern presentasjonseditor. Kursgjennomføringen bindes eksplisitt til publiserte innholds- og filversjoner. Læringshendelser lagres separat slik at publisering aldri omskriver studenthistorikk eller fjerner en allerede oppnådd fullføring. Progresjon og sluttgodkjenning beregnes av rene domenefunksjoner og materialiseres transaksjonelt for raske oversikter.

**Tech Stack:** Next.js server components/actions, PostgreSQL/Supabase Storage, skjemavalidert blokk-JSON, Zod, Vitest, Playwright, React-PDF og Nivå Klassisk Premium.

---

## Filansvar

- `portal/src/features/content/`: innholdsitem, kort/scroll-dokument, revisjon, publisering og filressurs.
- `portal/src/features/learning/`: modul/aktivitet, avhengighet, tilgang, progresjon og anbefalt neste aktivitet.
- `portal/src/features/assessment/`: quiz, forsøk, innlevering, vurdering og fristoverstyring.
- `portal/src/features/practice/`: praksisføringer, 45/9-timersregler, innsendings- og godkjenningsstatus.
- `portal/src/features/attendance/`: enkelttimer, 80-prosentkrav og universitetskontroll.
- `portal/src/features/completion/`: sluttregler, diplomjobb og feiring.

### Task 1: Opprett versjonert innholds- og filmodell

**Files:**

- Create: `portal/supabase/migrations/20260915090000_content.sql`
- Create: `portal/src/features/content/types.ts`
- Create: `portal/src/features/content/document-schema.ts`
- Create: `portal/src/lib/files/scan-upload.ts`
- Test: `portal/tests/unit/content/document-schema.test.ts`
- Test: `portal/tests/unit/files/scan-upload.test.ts`
- Test: `portal/supabase/tests/010_content_versions.test.sql`

- [x] **Step 1: Skriv failing test for korte sider, scrollsekvenser, filmetadata og bokmål**

Create `portal/tests/unit/content/document-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ContentDocument } from "@/features/content/document-schema";

describe("ContentDocument", () => {
  it("accepts structured Bokmål content and a permitted Trackman embed", () => {
    const result = ContentDocument.parse({
      locale: "nb-NO",
      format: "short_page",
      blocks: [
        { type: "heading", level: 2, text: "Ballfluktslover" },
        {
          type: "paragraph",
          text: "Ballens startretning påvirkes først og fremst av køllebladet.",
        },
        {
          type: "video",
          provider: "trackman",
          url: "https://ondemand.trackmangolf.com/example",
          required: true,
        },
      ],
    });
    expect(result.blocks).toHaveLength(3);
  });

  it("accepts a reusable scroll sequence with a stable mobile fallback", () => {
    const result = ContentDocument.parse({
      locale: "nb-NO",
      format: "scroll_story",
      blocks: [
        {
          type: "interactive_sequence",
          desktopMode: "scroll",
          mobileMode: "stacked",
          steps: [
            {
              id: "startretning",
              title: "Startretning",
              text: "Køllebladet påvirker startretningen.",
            },
            {
              id: "kurve",
              title: "Kurve",
              text: "Forholdet mellom blad og svingbane påvirker kurven.",
            },
          ],
        },
      ],
    });
    expect(result.format).toBe("scroll_story");
  });

  it("rejects arbitrary script and unsupported locale", () => {
    expect(() =>
      ContentDocument.parse({
        locale: "en-US",
        format: "short_page",
        blocks: [{ type: "html", value: "<script>alert(1)</script>" }],
      }),
    ).toThrow();
  });
});
```

Run: `pnpm vitest tests/unit/content/document-schema.test.ts --run`  
Expected: FAIL med manglende schema.

- [x] **Step 2: Implementer en eksplisitt blokk-union**

Create `portal/src/features/content/document-schema.ts`:

```ts
import { z } from "zod";

const Heading = z.object({
  type: z.literal("heading"),
  level: z.union([z.literal(2), z.literal(3)]),
  text: z.string().min(1).max(180),
});
const Paragraph = z.object({
  type: z.literal("paragraph"),
  text: z.string().min(1).max(10_000),
});
const Image = z.object({
  type: z.literal("image"),
  assetId: z.string().uuid(),
  alt: z.string().min(1).max(240),
  caption: z.string().max(500).optional(),
});
const File = z.object({
  type: z.literal("file"),
  assetId: z.string().uuid(),
  label: z.string().min(1).max(120),
});
const ExternalLink = z.object({
  type: z.literal("external_link"),
  url: z.string().url(),
  label: z.string().min(1).max(120),
});
const Video = z.object({
  type: z.literal("video"),
  provider: z.enum(["youtube", "trackman", "uploaded"]),
  url: z.string().url(),
  required: z.boolean(),
});
const Callout = z.object({
  type: z.literal("callout"),
  tone: z.enum(["info", "practice", "warning"]),
  title: z.string().min(1).max(120),
  text: z.string().min(1).max(2_000),
});
const InteractiveSequence = z.object({
  type: z.literal("interactive_sequence"),
  desktopMode: z.enum(["scroll", "next_previous"]),
  mobileMode: z.literal("stacked"),
  steps: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/),
        title: z.string().min(1).max(120),
        text: z.string().min(1).max(2_000),
        assetId: z.string().uuid().optional(),
      }),
    )
    .min(2)
    .max(30),
});

export const ContentBlock = z.discriminatedUnion("type", [
  Heading,
  Paragraph,
  Image,
  File,
  ExternalLink,
  Video,
  Callout,
  InteractiveSequence,
]);
export const ContentDocument = z.object({
  locale: z.literal("nb-NO"),
  format: z.enum(["short_page", "scroll_story"]),
  blocks: z.array(ContentBlock).min(1).max(200),
});
export type ContentDocument = z.infer<typeof ContentDocument>;
```

Run: `pnpm vitest tests/unit/content/document-schema.test.ts --run`  
Expected: PASS, 3 tester.

- [x] **Step 3: Opprett innhold, revisjoner, assets og kursbindinger**

Migration must define the following tables. Implement `scan-upload.ts` as a fail-closed adapter to the Gate G2-approved EU ClamAV endpoint: `clean` permits promotion from private quarantine, `infected`, timeout, malformed response and unavailable scanner reject promotion and emit only correlation/error code. Unit tests mock all five outcomes. Media uploads must pass magic-byte/MIME validation and this scanner before a `media_assets` row becomes available to content:

```sql
create type public.content_kind as enum ('lesson','quiz','assignment','practice_requirement','attendance_requirement','knowledge_test');
create type public.revision_status as enum ('draft','published','superseded');
create type public.resource_audience as enum ('teachers','course_members');

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind public.content_kind not null,
  slug text not null unique,
  title text not null,
  locale text not null default 'nb-NO' check (locale = 'nb-NO'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id),
  revision_number integer not null check (revision_number > 0),
  status public.revision_status not null,
  document jsonb not null,
  change_note text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  published_by uuid references public.profiles(id),
  published_at timestamptz,
  unique(content_item_id, revision_number)
);
create unique index one_draft_per_item on public.content_revisions(content_item_id) where status='draft';
create unique index one_published_per_item on public.content_revisions(content_item_id) where status='published';

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 524288000),
  alt_text text,
  sha256 text not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.resource_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  audience public.resource_audience not null,
  content_item_id uuid references public.content_items(id),
  course_run_id uuid references public.course_runs(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.resource_revisions (
  id uuid primary key default gen_random_uuid(),
  resource_item_id uuid not null references public.resource_items(id),
  revision_number integer not null check (revision_number > 0),
  status public.revision_status not null,
  media_asset_id uuid not null references public.media_assets(id),
  change_note text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  published_by uuid references public.profiles(id),
  published_at timestamptz,
  unique(resource_item_id, revision_number)
);

create table public.course_content_bindings (
  course_run_id uuid not null references public.course_runs(id),
  content_item_id uuid not null references public.content_items(id),
  content_revision_id uuid not null references public.content_revisions(id),
  bound_at timestamptz not null default now(),
  bound_by uuid not null references public.profiles(id),
  primary key(course_run_id, content_item_id)
);

create table public.course_resource_bindings (
  course_run_id uuid not null references public.course_runs(id),
  resource_item_id uuid not null references public.resource_items(id),
  resource_revision_id uuid not null references public.resource_revisions(id),
  bound_at timestamptz not null default now(),
  bound_by uuid not null references public.profiles(id),
  primary key(course_run_id, resource_item_id)
);
```

Add partial unique indexes for one draft and one published revision per content/resource item. Add a trigger that rejects UPDATE/DELETE when `old.status in ('published','superseded')`; only status transition `published → superseded` through the publishing function is allowed. Course bindings always reference the explicitly published revision. A later rebind never changes historical activity completions.

- [x] **Step 4: Test uforanderlighet og én publisert versjon**

pgTAP must prove direct update of a published document or resource fails, second draft fails, publish transaction supersedes old version, course bindings remain on explicitly selected revisions and a rebind cannot delete or rewrite an existing completion.

Run: `pnpm supabase db reset && pnpm test:rls`  
Expected: PASS; attempting `update content_revisions set document='{}' where status='published'` raises `published_revision_is_immutable`.

- [x] **Step 5: Commit**

```bash
git add portal/supabase portal/src/features/content portal/tests/unit/content
git commit -m "feat: add immutable versioned content model"
```

### Task 2: Implementer kladd, publisering og separate filressurser

**Files:**

- Create: `portal/src/features/content/publish-content.ts`
- Create: `portal/src/features/content/update-draft.ts`
- Create: `portal/src/app/(editor)/editor/content/[itemId]/page.tsx`
- Create: `portal/src/app/(editor)/editor/content/[itemId]/ResourcePanel.tsx`
- Test: `portal/tests/unit/content/publish-content.test.ts`
- Test: `portal/tests/e2e/content-publishing.spec.ts`

- [x] **Step 1: Skriv failing publiseringstest**

```ts
import { describe, expect, it } from "vitest";
import { planPublication } from "@/features/content/publish-content";

describe("planPublication", () => {
  it("requires an explicit change note and creates a new immutable revision", () => {
    expect(
      planPublication({
        currentRevision: 2,
        changeNote: "Oppdatert illustrasjon",
        hasDraft: true,
      }),
    ).toEqual({
      nextRevision: 3,
      supersedeRevision: 2,
      changeNote: "Oppdatert illustrasjon",
    });
  });

  it("rejects publish without a draft", () => {
    expect(() =>
      planPublication({
        currentRevision: 2,
        changeNote: "Ingen endring",
        hasDraft: false,
      }),
    ).toThrow("Ingen kladd å publisere");
  });
});
```

Run: `pnpm vitest tests/unit/content/publish-content.test.ts --run`  
Expected: FAIL.

- [x] **Step 2: Implementer ren publiseringsplan og databasefunksjon**

```ts
export function planPublication(input: {
  currentRevision: number | null;
  changeNote: string;
  hasDraft: boolean;
}) {
  if (!input.hasDraft) throw new Error("Ingen kladd å publisere");
  const changeNote = input.changeNote.trim();
  if (changeNote.length < 3) throw new Error("Endringsnotat er påkrevd");
  return {
    nextRevision: (input.currentRevision ?? 0) + 1,
    supersedeRevision: input.currentRevision,
    changeNote,
  };
}
```

Database function `publish_content(item_id, actor_id, change_note)` locks all revisions for the item, validates editor/admin role, marks current published as superseded, promotes the existing draft revision to published, creates one fresh draft copy with the next revision number and writes `content.published` audit-event in one transaction.

- [x] **Step 3: Bygg redaktørflaten uten autosave til publisert**

Editor page uses the validated content-block schema rather than arbitrary HTML. It has persistent status `Kladd`, `Publisert vN` and `Sist endret`. Save updates only draft. Publish requires a change note and explicit selection of affected active course runs. `ResourcePanel` links zero, one or many file resources. Each resource has independent draft/published status, audience (`kun lærere` eller `lærere og studenter`), preview/download metadata and version history.

**Bevisst avgrensning:** Sikker filopplasting er ikke aktivert ennå. UI-et viser statusen eksplisitt. Privat lagringsbøtte, EU-skanner og karanteneflyt må konfigureres før opplastingsknappen kan åpnes; dette skal ikke simuleres som ferdig funksjonalitet.

- [x] **Step 4: E2E-test at student ikke ser kladd**

Test edits title from `Ballfluktslover` to `Ballens startretning`, saves draft, verifies student still sees old title, publishes with note, upgrades the demo course binding and verifies student sees new title without losing an existing completion. Also verify a lesson publishes without files, many resources can be attached, a teacher-only resource stays hidden from students, PDF is previewable/downloadable and PowerPoint/Excel are downloadable.

Run: `pnpm playwright test tests/e2e/content-publishing.spec.ts`
Expected: PASS; version history shows both revisions.

- [x] **Step 5: Commit**

```bash
git add portal/src/features/content portal/src/app/\(editor\) portal/tests
git commit -m "feat: add draft and publish workflow"
```

### Task 3: Opprett læringsstruktur, avhengigheter og progresjonsmotor

**Files:**

- Create: `portal/supabase/migrations/20260922090000_learning.sql`
- Create: `portal/src/features/learning/progress.ts`
- Create: `portal/src/features/learning/access.ts`
- Create: `portal/src/features/learning/next-activity.ts`
- Test: `portal/tests/unit/learning/progress.test.ts`
- Test: `portal/tests/unit/learning/access.test.ts`

- [x] **Step 1: Skriv failing progresjonstest**

```ts
import { describe, expect, it } from "vitest";
import { calculateProgress } from "@/features/learning/progress";

describe("calculateProgress", () => {
  it("uses required weights and ignores optional activities", () => {
    const activities = [
      { id: "a", required: true, weight: 1 },
      { id: "b", required: true, weight: 2 },
      { id: "c", required: false, weight: 10 },
    ];
    expect(calculateProgress(activities, new Set(["a", "c"]))).toEqual({
      completedWeight: 1,
      totalWeight: 3,
      percentage: 33,
    });
  });

  it("returns zero for an empty unpublished path", () => {
    expect(calculateProgress([], new Set())).toEqual({
      completedWeight: 0,
      totalWeight: 0,
      percentage: 0,
    });
  });
});
```

Run: `pnpm vitest tests/unit/learning/progress.test.ts --run`  
Expected: FAIL.

- [x] **Step 2: Implementer ren, deterministisk progresjon**

```ts
export type ProgressActivity = Readonly<{
  id: string;
  required: boolean;
  weight: number;
}>;

export function calculateProgress(
  activities: readonly ProgressActivity[],
  completed: ReadonlySet<string>,
) {
  const required = activities.filter((activity) => activity.required);
  const totalWeight = required.reduce(
    (sum, activity) => sum + activity.weight,
    0,
  );
  const completedWeight = required
    .filter((activity) => completed.has(activity.id))
    .reduce((sum, activity) => sum + activity.weight, 0);
  const percentage =
    totalWeight === 0 ? 0 : Math.round((completedWeight / totalWeight) * 100);
  return { completedWeight, totalWeight, percentage };
}
```

Run: `pnpm vitest tests/unit/learning/progress.test.ts --run`  
Expected: PASS, 2 tests.

- [x] **Step 3: Opprett moduler, aktiviteter, prerequisites og completions**

Migration adds `learning_paths`, `modules`, `activities`, `activity_prerequisites`, `activity_completions` and `enrollment_progress`. Constraints: weight `>0`, sort order unique per parent, completion unique `(enrollment_id, activity_id)`, completion references the bound content revision, and student may insert completion only for own active enrollment through a security-definer function that checks access.

- [x] **Step 4: Skriv og implementer låseforklaring**

`getActivityAccess(activityId, completions, prerequisites)` returns:

```ts
type ActivityAccess =
  | { state: "open" }
  | {
      state: "locked";
      missing: readonly { activityId: string; title: string }[];
    };
```

Tests must cover `steg 1 før steg 2`, all required lessons before knowledge test, optional activity not blocking and circular dependency rejected at publish time.

Run: `pnpm vitest tests/unit/learning --run`  
Expected: PASS; a locked UI lists exact missing titles.

- [x] **Step 5: Commit**

```bash
git add portal/supabase portal/src/features/learning portal/tests/unit/learning
git commit -m "feat: add learning path and progress engine"
```

### Task 4: Implementer læringsspiller og fullføringsmodus

**Files:**

- Create: `portal/src/app/(student)/student/courses/[courseRunId]/page.tsx`
- Create: `portal/src/app/(student)/student/courses/[courseRunId]/activities/[activityId]/page.tsx`
- Create: `portal/src/features/learning/complete-activity.ts`
- Create: `portal/src/features/learning/ContentRenderer.tsx`
- Test: `portal/tests/e2e/student-learning.spec.ts`

- [ ] **Step 1: Skriv failing E2E for én tydelig neste handling**

```ts
import { test, expect } from "@playwright/test";

test("student sees one next action and a reason for locked knowledge test", async ({
  page,
}) => {
  await page.goto("/test-login?as=student-nora");
  await expect(
    page.getByRole("heading", { name: "Fortsett der du slapp" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Planlegging av treningsøkt" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Kunnskapsprøve" }).click();
  await expect(
    page.getByText("Fullfør Ballfluktslover og Balltreff først"),
  ).toBeVisible();
});
```

Run: `pnpm playwright test tests/e2e/student-learning.spec.ts`  
Expected: FAIL fordi rutene mangler.

- [ ] **Step 2: Render bare allowlistede blokker**

`ContentRenderer` switches exhaustively on `ContentBlock.type`; external links receive `rel="noopener noreferrer"`; uploaded media uses signed, short-lived URL; video iframe uses provider-specific allowlist and descriptive title. No raw HTML block exists.

- [ ] **Step 3: Implementer fullføringsmodus**

Activities support `manual`, `reach_end`, `quiz_pass`, `submission_approved`, `practice_approved`, `attendance_met`. Short pages may require explicit «Marker som fullført» or `reach_end`; scrollsider lar studenten gå videre. Video completion records explicit continuation, not surveillance-based anti-cheat. `completeActivity` rechecks prerequisites and active enrollment server-side before insert.

- [ ] **Step 4: Gjør studentreisen responsiv og UU-testet**

Follow `DESIGN.md`: next action first, total percentage, modules as `x av y`, no circular progress. Test at navigation, video alternative, focus order and locked explanation work at 390 px and 1280 px. Run axe.

Run: `pnpm playwright test tests/e2e/student-learning.spec.ts`  
Expected: PASS and 0 serious/critical axe findings.

- [ ] **Step 5: Commit**

```bash
git add portal/src/app/\(student\) portal/src/features/learning portal/tests/e2e/student-learning.spec.ts
git commit -m "feat: add accessible student learning player"
```

### Task 5: Implementer quiz og kunnskapsprøve

**Files:**

- Create: `portal/supabase/migrations/20261001090000_quiz.sql`
- Create: `portal/src/features/assessment/quiz/grade-attempt.ts`
- Create: `portal/src/features/assessment/quiz/attempt-policy.ts`
- Create: `portal/src/features/assessment/quiz/index.ts`
- Create: `portal/src/app/(student)/student/quiz/[activityId]/page.tsx`
- Test: `portal/tests/unit/assessment/quiz.test.ts`
- Test: `portal/tests/integration/assessment/quiz-attempt.test.ts`

- [ ] **Step 1: Skriv failing test for automatisk retting og valgfri delay**

```ts
import { describe, expect, it } from "vitest";
import { gradeAttempt, nextAttemptAt } from "@/features/assessment/quiz";

describe("quiz", () => {
  it("grades against immutable question versions", () => {
    expect(
      gradeAttempt(
        [{ questionId: "q1", correctOptionId: "b", points: 1 }],
        [{ questionId: "q1", optionId: "b" }],
        100,
      ),
    ).toEqual({ earned: 1, possible: 1, percent: 100, passed: true });
  });

  it("applies delay only after a failed attempt when configured", () => {
    const now = new Date("2026-10-01T10:00:00Z");
    expect(
      nextAttemptAt({ passed: false, delayHours: 24 }, now)?.toISOString(),
    ).toBe("2026-10-02T10:00:00.000Z");
    expect(nextAttemptAt({ passed: false, delayHours: 0 }, now)).toBeNull();
  });
});
```

Run: `pnpm vitest tests/unit/assessment/quiz.test.ts --run`  
Expected: FAIL.

- [ ] **Step 2: Implementer pure grading og attempt policy**

Use integer points, explicit pass percent and server time. Never return correct answers until attempt is submitted. Unlimited attempts is represented by `max_attempts = null`; delay is `retry_delay_hours >= 0`.

Create `portal/src/features/assessment/quiz/index.ts` exporting only `gradeAttempt` and `nextAttemptAt`, matching the test import exactly.

- [ ] **Step 3: Opprett immutable questions og attempts**

Migration adds `question_versions`, `quiz_definitions`, `quiz_question_links`, `quiz_attempts`, `quiz_answers`. Each attempt stores quiz revision, exact question-version IDs, score, passed, started/submitted timestamps and `next_attempt_at`. A unique idempotency key prevents double submission.

- [ ] **Step 4: Integrasjonstest concurrency og lås**

Submit same key twice → one attempt. Submit before `next_attempt_at` → typed `retry_delayed`. Change question draft after attempt → historical result unchanged. Pass knowledge test → associated activity completion created once.

Run: `pnpm vitest tests/integration/assessment/quiz-attempt.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add portal/supabase portal/src/features/assessment/quiz portal/src/app/\(student\)/student/quiz portal/tests
git commit -m "feat: add auto-graded quizzes and retry policy"
```

### Task 6: Implementer innlevering, vurderingsskala og ny frist

**Files:**

- Create: `portal/supabase/migrations/20261005090000_assignments.sql`
- Create: `portal/src/features/assessment/assignments/state-machine.ts`
- Create: `portal/src/features/assessment/assignments/submit.ts`
- Create: `portal/src/features/assessment/assignments/review.ts`
- Test: `portal/tests/unit/assessment/assignment-state.test.ts`
- Test: `portal/tests/e2e/assignment-resubmission.spec.ts`

- [ ] **Step 1: Skriv failing tilstandstest**

```ts
import { describe, expect, it } from "vitest";
import { transitionSubmission } from "@/features/assessment/assignments/state-machine";

describe("assignment state", () => {
  it("allows revision and resubmission without overwriting history", () => {
    expect(transitionSubmission("submitted", "request_revision")).toBe(
      "revision_required",
    );
    expect(transitionSubmission("revision_required", "resubmit")).toBe(
      "submitted",
    );
  });

  it("does not let a student approve their own work", () => {
    expect(() => transitionSubmission("submitted", "student_approve")).toThrow(
      "Ugyldig overgang",
    );
  });
});
```

Run: `pnpm vitest tests/unit/assessment/assignment-state.test.ts --run`  
Expected: FAIL.

- [ ] **Step 2: Implementer eksplisitt state machine**

Allowed transitions: `draft→submitted`, `submitted→approved|revision_required|graded`, `revision_required→submitted`. `approved` and `graded` can be reopened only by teacher/admin with reason. Scale is discriminated union:

```ts
type AssessmentResult =
  | { scale: "pass_fail"; value: "approved" | "not_approved"; comment: string }
  | {
      scale: "letter";
      value: "A" | "B" | "C" | "D" | "E" | "F";
      comment: string;
    };
```

- [ ] **Step 3: Opprett submissions, versions, reviews og deadline overrides**

Store each submission version separately with typed attachments. Every attachment stays in private quarantine until magic-byte validation and the shared ClamAV scan pass; rejected/quarantined files cannot be referenced by a submission. `deadline_overrides` requires teacher/lead/admin, new date, reason and audit event. Server computes effective deadline as latest valid override else activity deadline. Student cannot submit after effective deadline unless an override exists.

- [ ] **Step 4: E2E-test komplett utbedringsrunde**

Student submits document, teacher sets `Må utbedres` with comment and new deadline, student sees old version read-only, uploads revision and clicks `Send inn`, teacher approves. Assert two submission versions, two events and one activity completion.

Run: `pnpm playwright test tests/e2e/assignment-resubmission.spec.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add portal/supabase portal/src/features/assessment/assignments portal/tests
git commit -m "feat: add versioned assignment assessment"
```

### Task 7: Implementer elektronisk praksis og godkjenningsflyt

**Files:**

- Create: `portal/supabase/migrations/20261009090000_practice.sql`
- Create: `portal/src/features/practice/totals.ts`
- Create: `portal/src/features/practice/state-machine.ts`
- Create: `portal/src/app/(student)/student/practice/page.tsx`
- Create: `portal/src/app/(teacher)/teacher/practice/[submissionId]/page.tsx`
- Test: `portal/tests/unit/practice/totals.test.ts`
- Test: `portal/tests/integration/practice/approval.test.ts`

- [ ] **Step 1: Skriv failing 45/9-timersregler**

```ts
import { describe, expect, it } from "vitest";
import {
  calculatePracticeTotals,
  canSubmitPractice,
} from "@/features/practice/totals";

describe("practice totals", () => {
  it("allows submission at 45 total hours with at most 9 planning hours", () => {
    const totals = calculatePracticeTotals([
      { minutes: 2160, category: "delivery" },
      { minutes: 540, category: "planning" },
    ]);
    expect(totals).toEqual({
      totalMinutes: 2700,
      planningMinutes: 540,
      deliveryMinutes: 2160,
    });
    expect(canSubmitPractice(totals)).toEqual({ ok: true });
  });

  it("rejects 45 hours when planning exceeds 9 hours", () => {
    expect(
      canSubmitPractice({
        totalMinutes: 2700,
        planningMinutes: 600,
        deliveryMinutes: 2100,
      }),
    ).toEqual({ ok: false, reason: "planning_limit" });
  });
});
```

Run: `pnpm vitest tests/unit/practice/totals.test.ts --run`  
Expected: FAIL.

- [ ] **Step 2: Implementer regler i hele minutter**

Constants: `REQUIRED_MINUTES=2700`, `MAX_PLANNING_MINUTES=540`. Reject non-positive entry duration, overlapping duplicate idempotency key and planning total above max at write time. `canSubmitPractice` reports `missing_minutes` or `planning_limit` with concrete numbers.

- [ ] **Step 3: Opprett entries, submission og events**

Tables: `practice_entries`, `practice_submissions`, `practice_submission_events`. Submission snapshot stores included entry IDs and totals. Modes: `manual_review` or `auto_approve`; optional `auto_delay_hours`. A scheduled job promotes due `submitted` records to `approved_auto`. Spot-check transition `approved_auto→revision_required` requires reason and keeps previous completion event in audit.

- [ ] **Step 4: Integrasjonstest manuell, delay og spot-check**

Use injected clock. Assert cannot submit at 44h59m, auto approval not visible at 23h59m, approves at 24h, duplicate job run creates no second approval, teacher can revoke, student can fix and resubmit.

Run: `pnpm vitest tests/integration/practice/approval.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add portal/supabase portal/src/features/practice portal/src/app/\(student\)/student/practice portal/src/app/\(teacher\)/teacher/practice portal/tests
git commit -m "feat: add electronic practice workflow"
```

### Task 8: Implementer oppmøte, sluttregler og diplom

**Files:**

- Create: `portal/supabase/migrations/20261013090000_completion.sql`
- Create: `portal/src/features/attendance/percentage.ts`
- Create: `portal/src/features/completion/evaluate-completion.ts`
- Create: `portal/src/features/completion/generate-diploma.ts`
- Create: `portal/src/app/(student)/student/certificates/page.tsx`
- Test: `portal/tests/unit/completion/evaluate-completion.test.ts`
- Test: `portal/tests/integration/completion/diploma.test.ts`

- [ ] **Step 1: Skriv failing sluttregeltest**

```ts
import { describe, expect, it } from "vitest";
import { evaluateCompletion } from "@/features/completion/evaluate-completion";

describe("course completion", () => {
  it("requires 100 percent, 80 percent attendance, practice and university for T3", () => {
    expect(
      evaluateCompletion({
        level: 3,
        progress: 100,
        attendance: 79.9,
        practiceApproved: true,
        universityCompleted: true,
      }),
    ).toEqual({ complete: false, missing: ["attendance"] });
    expect(
      evaluateCompletion({
        level: 3,
        progress: 100,
        attendance: 80,
        practiceApproved: true,
        universityCompleted: true,
      }),
    ).toEqual({ complete: true, missing: [] });
  });

  it("does not block T1 completion on absent Youth Drive", () => {
    expect(
      evaluateCompletion({
        level: 1,
        progress: 100,
        attendance: 80,
        practiceApproved: true,
        universityCompleted: null,
        youthDriveSelected: true,
        youthDriveAttended: false,
      }),
    ).toEqual({
      complete: true,
      missing: [],
      adminTasks: ["invoice_youth_drive_difference"],
    });
  });
});
```

Run: `pnpm vitest tests/unit/completion/evaluate-completion.test.ts --run`  
Expected: FAIL.

- [ ] **Step 2: Implementer prosent og slutt-evaluator**

Attendance uses planned minutes vs present minutes and rounds only for display; gate compares raw ratio `>=0.8`. Manual override requires admin ID and reason. Evaluator returns `complete`, exact missing gate codes and non-blocking admin task codes. Never infer university completion.

- [ ] **Step 3: Opprett attendance, requirements, certificate og outbox**

Tables: `attendance_records`, `university_requirements`, `completion_overrides` and `certificates`. Completing is one transaction: lock enrollment, reevaluate, change status once, enqueue one certificate event in the existing `outbox_events`, create course completion audit and optional youth invoice task.

- [ ] **Step 4: Generer diplom deterministisk og test det**

Run `pnpm add pdf-lib` and commit the updated lockfile. `generateDiploma` takes `{ templateVersion, displayName, courseTitle, completedOn, certificateNumber }`; it never queries global state. Use NGF-provided template from Gate G3 and embedded licensed font. Test PDF header `%PDF`, extracted text contains exact name/course, second job with same certificate ID does not create another file, and student can access only own signed URL.

Run: `pnpm vitest tests/integration/completion/diploma.test.ts --run`  
Expected: PASS.

- [ ] **Step 5: Implementer feiring og commit**

Completion page announces success to screen reader, respects `prefers-reduced-motion`, uses confetti only once, calls `navigator.vibrate(50)` only after user action and shows diploma on «Mine diplomer».

```bash
git add portal/supabase portal/src/features/attendance portal/src/features/completion portal/src/app/\(student\)/student/certificates portal/tests
git commit -m "feat: complete courses and issue diplomas"
```

### Task 9: Kjør vertikal Learning/CMS-gate

**Files:**

- Create: `portal/tests/e2e/vertical-learning-slice.spec.ts`
- Create: `portal/docs/evidence/learning-cms-gate.md`

- [ ] **Step 1: Seed pilotmodulen**

Seed «Trener 1 — Ballfluktslover og balltreff» with one short lesson, permitted English Trackman video, five-question quiz, prerequisite to assignment, 45-hour practice requirement and two sessions. Use only reviewed NGF text; mark seed synthetic if production content is unavailable.

- [ ] **Step 2: Skriv én E2E-reise før siste wiring**

Test editor draft/publish → student lesson/video/quiz/assignment/practice → teacher revision/approval/attendance → automatic completion/diploma. Run and capture the first failing checkpoint.

- [ ] **Step 3: Wire bare manglende server actions og UI**

No new domain rule may be implemented in React. Each missing path must call the already-tested services from Tasks 1–8 and surface typed errors.

- [ ] **Step 4: Kjør komplett kvalitetsport**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit --run
pnpm test:integration --run
pnpm test:rls
pnpm build
pnpm playwright test tests/e2e/vertical-learning-slice.spec.ts
```

Expected: alle kode `0`; axe 0 serious/critical; screenshot godkjent på 390 px og 1280 px; en annen reviewer finner ingen høye/kritiske avvik.

- [ ] **Step 5: Dokumenter bevis og commit**

`learning-cms-gate.md` records commit SHA, exact test outputs, seed revision, reviewer and known low-severity issues with owner/date.

```bash
git add portal/tests/e2e/vertical-learning-slice.spec.ts portal/docs/evidence/learning-cms-gate.md
git commit -m "test: verify complete learning vertical slice"
```
