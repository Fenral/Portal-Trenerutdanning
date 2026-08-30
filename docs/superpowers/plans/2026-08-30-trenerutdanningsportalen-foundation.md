# Trenerutdanningsportalen Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Etablere en sikker, testbar grunnmur med designsystem, datamodell, radtilgang, invitert innlogging, roller, kursgjennomføringer og revisjonsspor.

**Architecture:** `portal/` er en Next.js modulær monolitt. Supabase Auth identifiserer brukeren; PostgreSQL/RLS avgjør hvilke rader brukeren kan lese og endre. Alle privilegerte handlinger går gjennom server actions som kaller små domenetjenester og skriver append-only audit-events.

**Model policy:** Følg `docs/superpowers/plans/2026-08-30-modell-og-innsatsstyring.md`; klassifiser hver task N1–N4 før implementering.

**Tech Stack:** Next.js, React, TypeScript strict, Supabase local CLI/PostgreSQL/Auth/Storage, Zod, Vitest, Testing Library, Playwright, axe-core og GitHub Actions.

---

## Filansvar

- `portal/src/lib/env.ts`: validert miljøkonfigurasjon; ingen feature leser `process.env` direkte.
- `portal/src/lib/supabase/{server,browser,admin}.ts`: tre eksplisitte databaseklienter; admin-klienten kan aldri importeres i klientkode.
- `portal/src/features/access/`: tillatelsesmatrise, invitasjon og sesjonsbruker.
- `portal/src/features/courses/`: kursmal, kursgjennomføring, samlinger og kursansvar.
- `portal/src/features/audit/`: append-only audit-events og korrelasjons-ID.
- `portal/src/components/ui/`: komponenter som håndhever `DESIGN.md`.
- `portal/supabase/migrations/`: autoritativt skjema og RLS.
- `portal/tests/`: enhet, integrasjon, RLS og E2E.

### Task 1: Bootstrap produksjonsappen og CI

**Files:**
- Create: `portal/package.json`
- Create: `portal/tsconfig.json`
- Create: `portal/vitest.config.ts`
- Create: `portal/playwright.config.ts`
- Create: `portal/src/app/page.tsx`
- Create: `portal/tests/unit/smoke.test.tsx`
- Create: `.github/workflows/portal-ci.yml`

- [ ] **Step 1: Opprett appen med låst package manager**

Run:

```bash
pnpm create next-app@latest portal --ts --eslint --app --src-dir --no-tailwind --use-pnpm --import-alias "@/*"
cd portal
pnpm add @supabase/ssr @supabase/supabase-js zod
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test @axe-core/playwright prettier prettier-plugin-organize-imports supabase msw tsx
pnpm pkg set engines.node=">=24 <25"
pnpm pkg set packageManager="pnpm@10"
```

Expected: `portal/pnpm-lock.yaml` finnes og `pnpm install --frozen-lockfile` avslutter med kode `0`.

- [ ] **Step 2: Skriv en failing smoke-test før startsiden endres**

Create `portal/tests/unit/smoke.test.tsx`:

```ts
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("portal shell", () => {
  it("names the service and exposes the three demo roles", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Trenerutdanning" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Student" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Lærer" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Administrator" })).toBeVisible();
  });
});
```

Run: `pnpm vitest tests/unit/smoke.test.tsx --run`
Expected: FAIL fordi standard Next.js-side ikke har de fire navnene.

- [ ] **Step 3: Implementer minste startside som gjør testen grønn**

Replace `portal/src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main>
      <h1>Trenerutdanning</h1>
      <nav aria-label="Demo-roller">
        <a href="/student">Student</a>
        <a href="/teacher">Lærer</a>
        <a href="/admin">Administrator</a>
      </nav>
    </main>
  );
}
```

Add scripts to `portal/package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint .",
    "typecheck": "next typegen && tsc --noEmit",
    "test:unit": "vitest tests/unit",
    "test:integration": "vitest tests/integration",
    "test:rls": "supabase test db",
    "test:e2e": "playwright test"
  }
}
```

Run: `pnpm vitest tests/unit/smoke.test.tsx --run`
Expected: PASS, 1 test.

- [ ] **Step 4: Legg inn CI som ikke kan omgå kvalitetsporten**

Create `.github/workflows/portal-ci.yml`:

```yaml
name: portal-ci
on:
  pull_request:
    paths: ["portal/**", ".github/workflows/portal-ci.yml"]
  push:
    branches: [main, master]
jobs:
  verify:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: portal
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
          cache-dependency-path: portal/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test:unit --run
      - run: pnpm build
      - run: pnpm audit --prod --audit-level high
```

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:unit --run && pnpm build`  
Expected: alle fem kommandoer gir kode `0`.

- [ ] **Step 5: Commit**

```bash
git add portal .github/workflows/portal-ci.yml
git commit -m "chore: bootstrap trainer education portal"
```

### Task 2: Implementer Nivå Klassisk Premium som kodekontrakt

**Files:**
- Create: `portal/src/components/ui/tokens.css`
- Create: `portal/src/components/ui/Button.tsx`
- Create: `portal/src/components/ui/Status.tsx`
- Create: `portal/src/components/ui/Progress.tsx`
- Create: `portal/src/components/ui/ui.css`
- Modify: `portal/src/app/layout.tsx`
- Test: `portal/tests/unit/ui/Button.test.tsx`
- Test: `portal/tests/unit/ui/Status.test.tsx`

- [ ] **Step 1: Skriv failing komponenttester**

Create `portal/tests/unit/ui/Button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("uses one explicit visual priority", () => {
    render(<Button priority="primary">Fortsett modul</Button>);
    expect(screen.getByRole("button", { name: "Fortsett modul" })).toHaveAttribute(
      "data-priority",
      "primary",
    );
  });
});
```

Create `portal/tests/unit/ui/Status.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Status } from "@/components/ui/Status";

describe("Status", () => {
  it("never communicates pace with color alone", () => {
    render(<Status tone="warning">Litt bak</Status>);
    const status = screen.getByRole("status", { name: "Litt bak" });
    expect(status).toHaveTextContent("Litt bak");
    expect(status.querySelector("svg")).not.toBeNull();
  });
});
```

Run: `pnpm vitest tests/unit/ui --run`  
Expected: FAIL med importfeil for `Button` og `Status`.

- [ ] **Step 2: Kod tokens direkte fra den vedtatte designkontrakten**

Create `portal/src/components/ui/tokens.css`:

```css
:root {
  --nivaa-canvas: #f7f9f8;
  --nivaa-surface: #ffffff;
  --nivaa-surface-subtle: #f1f4f2;
  --nivaa-on-surface: #10221b;
  --nivaa-text-muted: #5f6b65;
  --nivaa-primary: #39724e;
  --nivaa-primary-hover: #2f6242;
  --nivaa-primary-active: #285438;
  --nivaa-primary-soft: #e6ece8;
  --nivaa-border: #e1e7e3;
  --nivaa-border-strong: #c6d0ca;
  --nivaa-focus: #315bce;
  --nivaa-success: #2f6b49;
  --nivaa-success-soft: #e5f1e9;
  --nivaa-warning: #8a5a13;
  --nivaa-warning-soft: #f8efd9;
  --nivaa-error: #a43e35;
  --nivaa-error-soft: #f7e8e5;
  --nivaa-ai: #405cf5;
  --nivaa-ai-soft: #e9ecff;
  --nivaa-radius-control: 8px;
  --nivaa-radius-field: 10px;
  --nivaa-radius-surface: 16px;
  --nivaa-shadow-card: 0 8px 24px rgba(16, 34, 27, 0.05);
}
```

- [ ] **Step 3: Implementer Button, Status og lineær Progress**

Create `portal/src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type Props = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    priority?: "primary" | "secondary" | "quiet";
  }
>;

export function Button({ priority = "secondary", children, ...props }: Props) {
  return (
    <button className={`nivaa-button nivaa-button--${priority}`} data-priority={priority} {...props}>
      {children}
    </button>
  );
}
```

Create `portal/src/components/ui/Status.tsx`:

```tsx
import type { PropsWithChildren } from "react";

const path = {
  success: "M4 9l3 3 7-7",
  warning: "M9 3l6 11H3zM9 7v3M9 12.5v.1",
  error: "M9 3l6 11H3zM9 7v3M9 12.5v.1",
  info: "M9 3a6 6 0 100 12A6 6 0 009 3zm0 5v4m0-6v.1",
};

export function Status({ tone, children }: PropsWithChildren<{ tone: keyof typeof path }>) {
  return (
    <span className={`nivaa-status nivaa-status--${tone}`} role="status" aria-label={String(children)}>
      <svg aria-hidden="true" viewBox="0 0 18 18"><path d={path[tone]} /></svg>
      {children}
    </span>
  );
}
```

Create `portal/src/components/ui/Progress.tsx`:

```tsx
export function Progress({ value, label }: { value: number; label: string }) {
  const safeValue = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="nivaa-progress">
      <div className="nivaa-progress__label"><span>{label}</span><strong>{safeValue} %</strong></div>
      <div className="nivaa-progress__track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}>
        <span style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}
```

Create `portal/src/components/ui/ui.css` with focus and 44 px target rules from `DESIGN.md`; import both CSS files and Manrope through `next/font/google` in `layout.tsx`.

Run: `pnpm vitest tests/unit/ui --run`  
Expected: PASS, 2 tests.

- [ ] **Step 4: Kontroller design og tilgjengelighet i en isolert rute**

Create `portal/src/app/design-system/page.tsx` rendering primary/secondary buttons, four statuses and 0/62/100 progress. Run `pnpm dev`, open `/design-system` at 390×844 and 1280×900, then run:

```bash
node C:/Users/siver/.agents/skills/impeccable/scripts/detect.mjs --json portal/src/components/ui portal/src/app/design-system
```

Expected: `[]`; axe har 0 serious/critical funn; ingen gradient, sirkelprosent eller golfdekor.

- [ ] **Step 5: Commit**

```bash
git add portal/src/components portal/src/app/layout.tsx portal/src/app/design-system portal/tests/unit/ui
git commit -m "feat: codify Nivaa design system"
```

### Task 3: Opprett kjerneskjema og uforanderlig audit-logg

**Files:**
- Create: `portal/supabase/config.toml`
- Create: `portal/supabase/migrations/20260830190811_core.sql`
- Create: `portal/src/features/audit/types.ts`
- Test: `portal/supabase/tests/001_core_schema.test.sql`

- [ ] **Step 1: Skriv failing databasespesifikasjon**

Create `portal/supabase/tests/001_core_schema.test.sql`:

```sql
begin;
select plan(12);
select has_table('public', 'profiles');
select has_table('public', 'user_accounts');
select has_table('public', 'role_assignments');
select has_table('public', 'course_templates');
select has_table('public', 'course_runs');
select has_table('public', 'course_sessions');
select has_table('public', 'enrollments');
select has_table('public', 'invitations');
select has_table('public', 'audit_events');
select has_table('public', 'outbox_events');
select ok(
  case when to_regclass('public.audit_events') is null then false
  else not has_table_privilege('authenticated', 'public.audit_events', 'UPDATE') end,
  'authenticated cannot update audit_events'
);
select ok(
  case when to_regclass('public.audit_events') is null then false
  else not has_table_privilege('authenticated', 'public.audit_events', 'DELETE') end,
  'authenticated cannot delete audit_events'
);
select * from finish();
rollback;
```

Run: `pnpm supabase start && pnpm test:rls`  
Expected: FAIL, alle 12 kontrakter mangler.

- [ ] **Step 2: Implementer enums, tabeller og constraints**

Create `portal/supabase/migrations/20260830190811_core.sql` with:

```sql
create extension if not exists pgcrypto;
create type public.portal_role as enum ('student','course_teacher','course_lead','editor','administrator');
create type public.enrollment_status as enum ('invited','active','withdrawn','completed');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  normalized_email text not null,
  phone text,
  club_name text,
  birth_year smallint check (birth_year between 1900 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_unique on public.profiles(lower(normalized_email));

create table public.user_accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  normalized_email text not null,
  is_active boolean not null default true,
  linked_at timestamptz not null default now(),
  unique(profile_id, normalized_email)
);

create table public.course_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  level smallint check (level between 1 and 3),
  created_at timestamptz not null default now()
);

create table public.course_runs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.course_templates(id),
  title text not null,
  start_year smallint not null check (start_year between 2020 and 2100),
  location_name text,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  status text not null default 'draft' check (status in ('draft','active','closed')),
  created_at timestamptz not null default now()
);

create table public.course_sessions (
  id uuid primary key default gen_random_uuid(),
  course_run_id uuid not null references public.course_runs(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  location_text text,
  sort_order smallint not null check (sort_order > 0),
  unique(course_run_id, sort_order)
);

create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  role public.portal_role not null,
  course_template_id uuid references public.course_templates(id),
  course_run_id uuid references public.course_runs(id),
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (num_nonnulls(course_template_id, course_run_id) <= 1)
);
create unique index role_assignments_active_unique
  on public.role_assignments(profile_id, role, coalesce(course_template_id, '00000000-0000-0000-0000-000000000000'), coalesce(course_run_id, '00000000-0000-0000-0000-000000000000'))
  where revoked_at is null;

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_run_id uuid not null references public.course_runs(id),
  profile_id uuid not null references public.profiles(id),
  status public.enrollment_status not null default 'invited',
  status_changed_at timestamptz not null default now(),
  status_reason text,
  unique(course_run_id, profile_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null,
  token_hash text not null unique,
  course_run_id uuid not null references public.course_runs(id),
  role public.portal_role not null,
  expires_at timestamptz not null,
  claimed_by uuid references public.profiles(id),
  claimed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_profile_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  correlation_id uuid not null default gen_random_uuid(),
  reason text,
  before_data jsonb,
  after_data jsonb
);

-- Reopening is an audit action that returns the enrollment to `active`;
-- it is not a durable enrollment status.

-- Enable RLS and revoke anon/authenticated before any policies are added.
-- The audit table also has a trigger that rejects UPDATE and DELETE for every role.

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  idempotency_key text not null unique,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','delivered','failed')),
  attempts smallint not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now()
);
revoke all on public.outbox_events from anon, authenticated;
```

- [ ] **Step 3: Definer TypeScript-kontrakten som senere tasks må gjenbruke**

Create `portal/src/features/audit/types.ts`:

```ts
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
```

Run: `pnpm supabase db reset --local --no-seed && pnpm test:rls`
Expected: PASS, 12 tests.

- [ ] **Step 4: Kjør målrettet databasekontroll**

Run `pnpm supabase db lint --local --schema public,private --level warning --fail-on error` and `pnpm supabase db advisors --local --type all --level warn --fail-on error`; expected no issues.

- [ ] **Step 5: Commit**

```bash
git add portal/supabase portal/src/features/audit
git commit -m "feat: add core course and audit schema"
```

### Task 4: Implementer tillatelsesmatrise og RLS

**Files:**
- Create: `portal/src/features/access/permissions.ts`
- Create: `portal/src/features/access/authorize.ts`
- Create: `portal/supabase/migrations/20260830200442_rls.sql`
- Test: `portal/tests/unit/access/permissions.test.ts`
- Test: `portal/supabase/tests/002_rls.test.sql`

- [ ] **Step 1: Skriv failing domenetest for rettigheter**

Create `portal/tests/unit/access/permissions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { can } from "@/features/access/permissions";

describe("permission matrix", () => {
  it("keeps AI and account merge administrator-only", () => {
    expect(can("administrator", "admin_query.run")).toBe(true);
    expect(can("administrator", "account.merge")).toBe(true);
    expect(can("course_lead", "admin_query.run")).toBe(false);
    expect(can("editor", "account.merge")).toBe(false);
  });

  it("allows course lead, but not teacher, to withdraw enrollment", () => {
    expect(can("course_lead", "enrollment.withdraw")).toBe(true);
    expect(can("course_teacher", "enrollment.withdraw")).toBe(false);
  });
});
```

Run: `pnpm vitest tests/unit/access/permissions.test.ts --run`  
Expected: FAIL med manglende modul.

- [ ] **Step 2: Implementer én eksplisitt matrise**

Create `portal/src/features/access/permissions.ts`:

```ts
export type Role = "student" | "course_teacher" | "course_lead" | "editor" | "administrator";
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
  course_teacher: ["course.read", "assessment.grade", "attendance.write", "report.export"],
  course_lead: ["course.read", "course.manage", "assessment.grade", "attendance.write", "enrollment.withdraw", "report.export"],
  editor: ["course.read", "content.edit", "content.publish"],
  administrator: ["course.read", "course.manage", "content.edit", "content.publish", "assessment.grade", "attendance.write", "enrollment.withdraw", "role.grant", "report.export", "admin_query.run", "account.merge"],
};

export function can(role: Role, permission: Permission): boolean {
  return grants[role].includes(permission);
}
```

Run: `pnpm vitest tests/unit/access/permissions.test.ts --run`  
Expected: PASS, 3 tests, including the server authorization guard.

- [ ] **Step 3: Implementer databasefunksjoner som speiler matrisen**

Create `portal/supabase/migrations/20260830200442_rls.sql` with `security definer` helpers in the non-exposed `private` schema: `current_profile_id()` (maps `auth.uid()` through `user_accounts`), `has_global_role(role)`, `is_administrator()`, `has_course_role(course_run_id, roles[])` and `is_enrolled(course_run_id)`. Every helper must check `(select auth.uid())`, use `set search_path = ''`, qualify every relation, revoke default execution and grant only `USAGE`/`EXECUTE` to `authenticated`. RLS is already enabled on all core tables; grant only `SELECT` on the six tables used by the portal. Policies must enforce:

```sql
create policy profiles_self_or_course_staff_select on public.profiles
for select to authenticated using (
  id = (select private.current_profile_id())
  or (select private.is_administrator())
  or exists (
    select 1
    from public.enrollments e
    where e.profile_id = profiles.id
      and private.has_course_role(e.course_run_id, array['course_teacher','course_lead']::public.portal_role[])
  )
);

create policy enrollments_self_or_staff_select on public.enrollments
for select to authenticated using (
  profile_id = (select private.current_profile_id())
  or (select private.is_administrator())
  or private.has_course_role(course_run_id, array['course_teacher','course_lead']::public.portal_role[])
);
```

Students receive no direct update/delete policy on enrollments, roles, invitations or audit events.

- [ ] **Step 4: Test positive og negative radtilgang**

In `002_rls.test.sql`, create two courses, one student per course, one teacher assigned only to course A and one admin. Use `set_config('request.jwt.claim.sub', uuid, true)` and `set local role authenticated`. Assert:

- student A sees own profile and enrollment, not student B;
- teacher A sees course A students, not course B;
- editor cannot see participant contacts without course role;
- admin sees both;
- authenticated cannot update/delete `audit_events`.

Run: `pnpm supabase db reset --local --no-seed && pnpm test:rls`
Expected: PASS, 48 assertions; changing teacher A policy to `true` makes the cross-course negative test fail.

- [ ] **Step 5: Commit**

```bash
git add portal/src/features/access portal/supabase/migrations portal/supabase/tests
git commit -m "feat: enforce scoped portal permissions"
```

### Task 5: Implementer e-postinvitasjon og passordfri aktivering

**Files:**
- Create: `portal/src/features/access/invitations/schema.ts`
- Create: `portal/src/features/access/invitations/create-invitation.ts`
- Create: `portal/src/features/access/invitations/claim-invitation.ts`
- Create: `portal/src/features/notifications/transport.ts`
- Create: `portal/src/features/notifications/console-transport.ts`
- Create: `portal/src/lib/supabase/admin.ts`
- Create: `portal/src/lib/supabase/server.ts`
- Create: `portal/src/app/(auth)/activate/page.tsx`
- Create: `portal/src/app/(auth)/activate/actions.ts`
- Create: `portal/src/app/(auth)/auth/callback/route.ts`
- Create: `portal/supabase/migrations/*_invitation_flow.sql`
- Test: `portal/supabase/tests/003_invitations.test.sql`
- Test: `portal/tests/unit/access/invitations.test.ts`
- Test: `portal/tests/e2e/invitation.spec.ts`

- [x] **Step 1: Skriv failing test for normalisering, utløp og e-postbinding**

Create `portal/tests/unit/access/invitations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateInvitationClaim } from "@/features/access/invitations/claim-invitation";

describe("invitation claim", () => {
  const invitation = { normalizedEmail: "nora@example.com", expiresAt: new Date("2026-09-02T12:00:00Z"), claimedAt: null };

  it("accepts the same private email case-insensitively", () => {
    expect(validateInvitationClaim(invitation, " Nora@Example.com ", new Date("2026-09-01T12:00:00Z"))).toEqual({ ok: true });
  });

  it("rejects another email and expired links", () => {
    expect(validateInvitationClaim(invitation, "other@example.com", new Date("2026-09-01T12:00:00Z"))).toEqual({ ok: false, reason: "email_mismatch" });
    expect(validateInvitationClaim(invitation, "nora@example.com", new Date("2026-09-03T12:00:00Z"))).toEqual({ ok: false, reason: "expired" });
  });
});
```

Run: `pnpm vitest tests/unit/access/invitations.test.ts --run`  
Expected: FAIL med manglende funksjon.

- [x] **Step 2: Implementer ren validering og tokenhåndtering**

Create `claim-invitation.ts`:

```ts
type Invitation = Readonly<{ normalizedEmail: string; expiresAt: Date; claimedAt: Date | null }>;
type ClaimResult = { ok: true } | { ok: false; reason: "email_mismatch" | "expired" | "already_claimed" };

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function validateInvitationClaim(invitation: Invitation, email: string, now: Date): ClaimResult {
  if (invitation.claimedAt) return { ok: false, reason: "already_claimed" };
  if (invitation.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  if (invitation.normalizedEmail !== normalizeEmail(email)) return { ok: false, reason: "email_mismatch" };
  return { ok: true };
}
```

Create `create-invitation.ts` using `crypto.randomBytes(32).toString('base64url')`; store only `sha256(rawToken)`. In the same transaction enqueue an `invitation.email` event whose payload contains only `invitationId`, with one unique invitation idempotency key. The raw token and exact email may only exist in request/worker memory while `NotificationTransport` sends the message. The recovery worker in Operations Task 3 must rotate the hash before a retry and invalidate the previous link. `ConsoleNotificationTransport` emits masked metadata only and must never log raw token, activation URL or exact email.

Run: `pnpm vitest tests/unit/access/invitations.test.ts --run`  
Expected: PASS, 2 tests.

- [x] **Step 3: Implementer aktiveringsreisen**

`/activate` validates the hash server-side, displays only masked email, triggers Supabase email OTP for the exact invitation email and stores token in an HttpOnly, SameSite=Lax cookie for 20 minutes (`Secure` is mandatory outside local HTTP development). Callback verifies the authenticated Supabase user and email inside the database transaction, claims the invitation with a row lock, creates or reuses a stable profile, links the Supabase identity through `user_accounts`, creates enrollment/role assignment and writes `invitation.claimed` audit event.

Use this transaction signature in `claim-invitation.ts`:

```ts
export type ClaimInvitationCommand = Readonly<{
  rawToken: string;
  authenticatedUserId: string;
  authenticatedEmail: string;
  now: Date;
  correlationId: string;
}>;
```

Return only `{ status: "claimed", destination: string }` or a typed public error; database errors are logged by correlation ID without PII.

- [x] **Step 4: E2E-test privat og intern e-post samt produksjonsavslag**

Test two invitations (`@gmail.com`, `@golfforbundet.no`), wrong-email rejection, reuse rejection and expired-link refresh. Add build-time test proving `ConsoleNotificationTransport` throws when `NODE_ENV=production`.

Run: `pnpm playwright test tests/e2e/invitation.spec.ts`  
Expected: PASS; exactly one profile and one enrollment per invitation.

- [x] **Step 5: Commit**

```bash
git add portal/src/features/access/invitations portal/src/features/notifications portal/src/app/\(auth\) portal/tests
git commit -m "feat: add secure email invitation flow"
```

### Task 6: Implementer kursgjennomføringer, samlinger og fiktive seed-data

**Files:**
- Create: `portal/src/features/courses/schema.ts`
- Create: `portal/src/features/courses/create-course-run.ts`
- Create: `portal/src/app/(admin)/admin/courses/page.tsx`
- Create: `portal/src/app/(admin)/admin/courses/new/page.tsx`
- Create: `portal/src/app/test-login/route.ts`
- Create: `portal/supabase/seed.sql`
- Test: `portal/tests/unit/courses/create-course-run.test.ts`
- Test: `portal/tests/e2e/admin-courses.spec.ts`

- [x] **Step 1: Skriv failing kursvalidering**

```ts
import { describe, expect, it } from "vitest";
import { CourseRunInput } from "@/features/courses/schema";

describe("course run", () => {
  it("uses the start year for a two-year Trainer 3 cohort", () => {
    const parsed = CourseRunInput.parse({ templateCode: "T3", title: "Trener 3", startYear: 2026, startsOn: "2026-02-15", endsOn: "2027-03-21", sessions: 6 });
    expect(parsed.displayYear).toBe("2026–2027");
  });

  it("requires a location for Trainer 1", () => {
    expect(() => CourseRunInput.parse({ templateCode: "T1", title: "Trener 1", startYear: 2026, startsOn: "2026-04-10", endsOn: "2026-09-06", sessions: 2 })).toThrow();
  });
});
```

Run: `pnpm vitest tests/unit/courses/create-course-run.test.ts --run`  
Expected: FAIL.

- [x] **Step 2: Implementer schema og displayår**

```ts
import { z } from "zod";

export const CourseRunInput = z.object({
  templateCode: z.enum(["T1", "T2", "T3"]),
  title: z.string().min(2).max(120),
  startYear: z.number().int().min(2020).max(2100),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  locationName: z.string().min(2).max(120).optional(),
  sessions: z.number().int().positive(),
}).superRefine((value, context) => {
  if (value.templateCode === "T1" && !value.locationName) context.addIssue({ code: "custom", message: "Trener 1 krever kurssted", path: ["locationName"] });
  if (value.endsOn < value.startsOn) context.addIssue({ code: "custom", message: "Sluttdato må være etter startdato", path: ["endsOn"] });
}).transform((value) => ({
  ...value,
  displayYear: value.templateCode === "T3" ? `${value.startYear}–${value.startYear + 1}` : String(value.startYear),
}));
```

Run: `pnpm vitest tests/unit/courses/create-course-run.test.ts --run`  
Expected: PASS, 2 tests.

- [x] **Step 3: Implementer transaksjonell kursoppretting**

`createCourseRun` inserts run, ordered sessions, initial admin/course-lead assignment and `course.created` audit-event in one database function. If session 3 fails validation, no run remains. Server action validates with `CourseRunInput` and checks `course.manage` before calling the function.

- [x] **Step 4: Seed og E2E-test den avtalte demostrukturen**

`seed.sql` must create nine T1 locations, one T2 cohort, one T3 2026–2027 cohort, exact demonstration dates from the requirements, 15 fictional `.invalid` users and scoped course staff. `test-login/route.ts` accepts only allowlisted synthetic aliases when `E2E_TEST_MODE=true`; otherwise it calls `notFound()` before reading the alias. E2E asserts T1 expands/collapses and T3 shows six sessions across two years. A production-mode integration test expects `/test-login?as=admin` to return `404`.

Run:

```bash
pnpm supabase db reset
pnpm playwright test tests/e2e/admin-courses.spec.ts
```

Expected: PASS; `select count(*) from course_runs where template_id=(select id from course_templates where code='T1')` returns `9`.

- [x] **Step 5: Commit og full foundation-gate**

Update `.github/workflows/portal-ci.yml` with a fast required job for format/lint/types/unit/build and path-filtered jobs: database/RLS when migrations or access/import/people code changes, Playwright/axe when app/components change, and dependency audit when lockfile/package changes. Add one nightly workflow that runs the full suite. Then run the full suite once for the Foundation gate:

```bash
git add portal/src/features/courses portal/src/app/\(admin\) portal/src/app/test-login portal/supabase/seed.sql portal/tests .github/workflows/portal-ci.yml
git commit -m "feat: add course runs and demonstration data"
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:unit --run && pnpm test:integration --run && pnpm test:rls && pnpm build && pnpm playwright test
```

Expected: alle kommandoer gir kode `0`; en uavhengig reviewer godkjenner Foundation før Learning/CMS-planen starter.
