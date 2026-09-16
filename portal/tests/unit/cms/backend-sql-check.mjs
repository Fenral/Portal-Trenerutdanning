// Standalone PostgreSQL verification without a remote database or Docker.
// Install @electric-sql/pglite into a temporary directory, then run:
// node tests/unit/cms/backend-sql-check.mjs <absolute-path-to-pglite/dist/index.js>
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create schema storage; create schema extensions;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to authenticated;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
`);
for (const filename of [
  "20260830190811_core.sql",
  "20260830200442_rls.sql",
  "20260915090000_content.sql",
  "20260915091000_content_editor.sql",
  "20261126090000_cms_studio.sql",
]) {
  const sql = await readFile(resolve("supabase/migrations", filename), "utf8");
  // PostgreSQL provides gen_random_uuid directly; no other pgcrypto APIs are
  // used by these migrations. The hosted Supabase extension stays unchanged.
  await db.exec(
    sql.replace(
      "create extension if not exists pgcrypto with schema extensions;",
      "",
    ),
  );
}
const editor = "00000000-0000-4000-8000-000000000001";
const teacher = "00000000-0000-4000-8000-000000000002";
const learner = "00000000-0000-4000-8000-000000000003";
const outsider = "00000000-0000-4000-8000-000000000004";
const courseA = "00000000-0000-4000-8000-000000000010";
const courseB = "00000000-0000-4000-8000-000000000011";
const template = "00000000-0000-4000-8000-000000000012";
const memberAttachment = "00000000-0000-4000-8000-000000000020";
const teacherAttachment = "00000000-0000-4000-8000-000000000021";
const unboundAttachment = "00000000-0000-4000-8000-000000000022";
for (const [index, id] of [editor, teacher, learner, outsider].entries()) {
  await db.query("insert into auth.users(id) values($1)", [id]);
  await db.query(
    "insert into profiles(id,display_name,normalized_email) values($1,$2,$3)",
    [id, `User ${index}`, `user${index}@example.test`],
  );
  await db.query(
    "insert into user_accounts(user_id,profile_id,normalized_email) values($1,$1,$2)",
    [id, `user${index}@example.test`],
  );
}
await db.query(
  "insert into course_templates(id,code,title,level) values($1,'CMS','CMS course',1)",
  [template],
);
for (const id of [courseA, courseB])
  await db.query(
    "insert into course_runs(id,template_id,title,start_year,starts_on,ends_on,status) values($1,$2,'Test course',2026,'2026-10-01','2026-11-01','active')",
    [id, template],
  );
await db.query(
  "insert into role_assignments(profile_id,role,granted_by) values($1,'editor',$1)",
  [editor],
);
await db.query(
  "insert into role_assignments(profile_id,role,course_run_id,granted_by) values($1,'course_teacher',$2,$3),($4,'course_teacher',$5,$3)",
  [teacher, courseA, editor, outsider, courseB],
);
await db.query(
  "insert into enrollments(profile_id,course_run_id,status) values($1,$2,'active')",
  [learner, courseA],
);

async function asUser(id, sql, params = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
const document = (text, attachmentIds = []) => ({
  locale: "nb-NO",
  format: "short_page",
  blocks: [{ type: "paragraph", text }],
  attachmentIds,
});
async function draft(item) {
  return (
    await db.query(
      "select id, updated_at::text as version,document from content_revisions where content_item_id=$1 and status='draft'",
      [item],
    )
  ).rows[0];
}
async function rejects(user, sql, params, message) {
  await assert.rejects(
    () => asUser(user, sql, params),
    (error) => error.message.includes(message),
  );
}
let checks = 0;
await rejects(
  teacher,
  "select cms_create_item($1,1,$2)",
  ["Forbidden global", document("Draft")],
  "CMS_FORBIDDEN",
);
checks++;
const item = (
  await asUser(editor, "select cms_create_item($1,1,$2) as id", [
    "CMS item",
    document("Version one"),
  ])
).rows[0].id;
let token = await draft(item);
for (const [id, audience] of [
  [memberAttachment, "course_members"],
  [teacherAttachment, "teachers"],
  [unboundAttachment, "course_members"],
]) {
  await db.query(
    "insert into cms_attachments(id,content_item_id,title,author,audience,original_filename,mime_type,byte_size,storage_path,created_by) values($1,$2,'Original document','Author',$3,'document.pdf','application/pdf',20,$4,$5)",
    [id, item, audience, `${item}/${id}`, editor],
  );
}
await asUser(editor, "select cms_save_draft($1,$2,$3,$4,'Saved version')", [
  item,
  "Saved title",
  document("Version one", [memberAttachment, teacherAttachment]),
  token.version,
]);
await rejects(
  editor,
  "select cms_save_draft($1,'Stale title',$2,$3,'Stale write')",
  [item, document("Stale write"), token.version],
  "CMS_CONFLICT",
);
assert.equal(
  (await db.query("select title from content_items where id=$1", [item]))
    .rows[0].title,
  "Saved title",
);
checks++;
token = await draft(item);
const first = (
  await asUser(
    editor,
    "select cms_publish($1,$2,'First publication',$3::uuid[]) as id",
    [item, token.version, [courseA, courseB]],
  )
).rows[0].id;
await rejects(
  editor,
  "select cms_publish($1,$2,'Stale publication','{}')",
  [item, token.version],
  "CMS_CONFLICT",
);
checks++;
token = await draft(item);
await asUser(
  editor,
  "select cms_save_draft($1,'Second title',$2,$3,'Second version')",
  [item, document("Version two", [memberAttachment]), token.version],
);
token = await draft(item);
const second = (
  await asUser(
    editor,
    "select cms_publish($1,$2,'Second publication',$3::uuid[]) as id",
    [item, token.version, [courseA]],
  )
).rows[0].id;
const bindings = (
  await db.query(
    "select course_run_id,content_revision_id from course_content_bindings where content_item_id=$1",
    [item],
  )
).rows;
assert.equal(
  bindings.find((binding) => binding.course_run_id === courseA)
    .content_revision_id,
  second,
);
assert.equal(
  bindings.find((binding) => binding.course_run_id === courseB)
    .content_revision_id,
  first,
);
checks++;
await assert.rejects(
  () =>
    db.query("update content_revisions set document=$1 where id=$2", [
      document("Mutated snapshot"),
      first,
    ]),
  /immutable/,
);
checks++;
token = await draft(item);
await asUser(editor, "select cms_restore($1,$2,$3)", [
  item,
  first,
  token.version,
]);
assert.equal((await draft(item)).document.blocks[0].text, "Version one");
assert.equal(
  (
    await db.query("select document from content_revisions where id=$1", [
      second,
    ])
  ).rows[0].document.blocks[0].text,
  "Version two",
);
checks++;
token = await draft(item);
await rejects(
  teacher,
  "select cms_save_draft($1,'Escalated title',$2,$3,'Teacher edit')",
  [item, document("Forbidden"), token.version],
  "CMS_FORBIDDEN",
);
checks++;
const variant = (
  await asUser(teacher, "select cms_create_variant($1,$2) as id", [
    item,
    courseA,
  ])
).rows[0].id;
assert.equal((await draft(variant)).document.blocks[0].text, "Version two");
await rejects(
  teacher,
  "select cms_create_variant($1,$2)",
  [item, courseB],
  "CMS_FORBIDDEN",
);
await rejects(
  teacher,
  "select cms_create_variant($1,$2)",
  [item, courseA],
  "CMS_VARIANT_EXISTS",
);
checks++;
token = await draft(variant);
await rejects(
  outsider,
  "select cms_save_draft($1,'Another course',$2,$3,'Invalid scope')",
  [variant, document("Cross-course"), token.version],
  "CMS_FORBIDDEN",
);
await rejects(
  teacher,
  "select cms_save_draft($1,'Hidden source file',$2,$3,'Invalid attachment')",
  [variant, document("Leak", [unboundAttachment]), token.version],
  "CMS_INVALID_ATTACHMENT_REFERENCE",
);
checks++;
await asUser(
  teacher,
  "select cms_save_draft($1,'Local title',$2,$3,'Local version')",
  [variant, document("Course-local", [memberAttachment]), token.version],
);
token = await draft(variant);
await asUser(teacher, "select cms_publish($1,$2,'Local publication','{}')", [
  variant,
  token.version,
]);
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from course_content_bindings where content_item_id=$1 and course_run_id=$2",
      [variant, courseA],
    )
  ).rows[0].n,
  1,
);
checks++;
await rejects(
  editor,
  "select publish_content_and_rebind($1,$2,'Wrong course',$3::uuid[])",
  [variant, editor, [courseB]],
  "CMS_FORBIDDEN",
);
await rejects(
  editor,
  "select save_content_draft($1,$2,$3,'Wrong attachment')",
  [variant, editor, document("Legacy bypass", [unboundAttachment])],
  "CMS_INVALID_ATTACHMENT_REFERENCE",
);
checks++;
const learnerFiles = (
  await asUser(learner, "select id from cms_attachments order by id")
).rows.map((row) => row.id);
assert.deepEqual(learnerFiles, [memberAttachment]);
checks++;
assert.equal(
  (
    await asUser(
      learner,
      "select count(*)::int as n from content_revisions where content_item_id=$1 and status='draft'",
      [variant],
    )
  ).rows[0].n,
  0,
);
assert.equal(
  (
    await asUser(
      outsider,
      "select count(*)::int as n from content_revisions where content_item_id=$1",
      [variant],
    )
  ).rows[0].n,
  0,
);
checks++;
await db.query(
  "update role_assignments set revoked_at=now() where profile_id=$1",
  [teacher],
);
token = await draft(variant);
await rejects(
  teacher,
  "select cms_publish($1,$2,'Revoked role','{}')",
  [variant, token.version],
  "CMS_FORBIDDEN",
);
checks++;
assert.equal(
  (
    await db.query(
      "select public from storage.buckets where id='cms-attachments'",
    )
  ).rows[0].public,
  false,
);
checks++;
console.log(
  `CMS PostgreSQL verification: ${checks} checks passed (migrations, CAS, snapshots, course variants, RLS, attachment audience).`,
);
await db.close();
