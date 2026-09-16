# Trener-CMS Implementation Plan

> For agentic workers: execute bounded implementation tasks in the isolated cms-system worktree. Use explicit file ownership and one targeted self-review; user has requested speed and full autonomy.

**Goal:** Deliver the agreed shared coach-education CMS on the existing portal.

**Architecture:** Reuse Next.js, Supabase authentication, immutable content revisions and course bindings. Add a responsive authoring studio, sandboxed code modules, original-file attachments, AI proposals and web presentation output.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Supabase PostgreSQL/Storage, Vitest.

## Execution

- [x] Inspect existing portal and create `.worktrees/cms-system` from `codex/portal-v1`; install locked dependencies.
- [x] Implement the module document schema, isolated renderer, templates, self-check and presentation/export components in `portal/src/features/cms/`; integrate existing ContentRenderer.
- [x] Implement additive migration, scoped CMS repository and `/api/cms` routes for catalog, creating, saving, publishing, restoring, variants and original attachments. Preserve course bindings and detect concurrent edits.
- [x] Implement authenticated AI proposals with configured provider, bounded requests and schema validation in `portal/src/features/cms/ai/` and `/api/cms/ai`. Live credentials remain an external prerequisite.
- [x] Build `/editor/studio` library and `/editor/studio/[itemId]` workbench using the approved visual direction. Integrate navigation and course/student consumption.
- [x] Apply migrations to the relevant existing database; configure available runtime services and start the system.
- [x] Run `pnpm typecheck`, targeted CMS unit tests and `pnpm build`; exercise create → edit → publish → read plus original-file upload/download. Fix concrete failures once per change.
- [x] Commit the completed code, deploy to the existing portal host when available, and record exact tested state and any external configuration requirement in `portal/docs/cms-operations.md`. Preview READY on Vercel; existing production alias preserved.

## External follow-up

- [ ] Complete secure OpenAI key setup after the user's explicit choice, configure server runtime and verify a real proposal. Key setup question is pending; the UI accurately shows AI as disconnected.

## API boundary

`GET /api/cms/catalog` returns `{items, courses}`. `POST /api/cms/items` takes `{title, level, document}` and returns `{itemId}`. `GET /api/cms/items/:id` returns editor state. `PUT` takes `{document, title, expectedUpdatedAt, changeNote}`. Child endpoints `publish`, `restore`, `variant`, and `attachments` implement the respective operation. All errors have a human-readable `{error}` and suitable HTTP status.

Editor state includes `item`, `draft`, `published`, `history`, `courseBindings`, `attachments`, and `courses`. Revision shape uses existing ContentRevisionView. Item metadata includes `level`, `courseRunId`, `sourceItemId`, and `sourceRevisionId`. Uploads return `{attachment}`. AI returns `{document, summary}` and never writes directly.

## Verification focus

Schema compatibility; isolation of arbitrary code; authorization; concurrent-save rejection; immutable published versions; explicit course upgrades; original attachment bytes; valid AI response handling. Avoid repeated general audits and unrelated refactors.
