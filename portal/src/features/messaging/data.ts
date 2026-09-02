import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveTeacherCourseAccess } from "@/features/access/teacher-course";

import {
  countUnreadForViewer,
  groupThreads,
  type MessageRow,
  type MessageThread,
} from "./threads";

const MESSAGE_COLUMNS =
  "id,enrollment_id,sender_profile_id,recipient_profile_id,body,created_at,read_at";

function assertNoQueryError(error: { message: string } | null): void {
  if (error) throw new Error(`MESSAGING_QUERY_FAILED:${error.message}`);
}

export type ThreadListItem = Readonly<{
  thread: MessageThread;
  counterpartName: string;
  counterpartClub: string | null;
}>;

export type TeacherInboxView = Readonly<{
  courseTitle: string;
  viewerProfileId: string;
  threads: readonly ThreadListItem[];
}>;

async function loadMessages(
  client: SupabaseClient,
  filter: Readonly<{ enrollmentId?: string }> = {},
): Promise<MessageRow[]> {
  let query = client
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .order("created_at", { ascending: true });
  if (filter.enrollmentId)
    query = query.eq("enrollment_id", filter.enrollmentId);
  const result = await query;
  assertNoQueryError(result.error);
  return (result.data ?? []) as MessageRow[];
}

async function loadProfileNames(
  client: SupabaseClient,
  profileIds: readonly string[],
): Promise<Map<string, { name: string; club: string | null }>> {
  if (profileIds.length === 0) return new Map();
  const result = await client
    .from("profiles")
    .select("id,display_name,club_name")
    .in("id", [...profileIds]);
  assertNoQueryError(result.error);
  return new Map(
    (result.data ?? []).map((row) => [
      row.id as string,
      {
        name: (row.display_name as string) ?? "Ukjent",
        club: (row.club_name as string | null) ?? null,
      },
    ]),
  );
}

/** Lærerens trådliste: én tråd per deltaker læreren har utvekslet meldinger med. */
export async function loadTeacherInbox(
  client: SupabaseClient,
): Promise<TeacherInboxView | null> {
  const access = await resolveTeacherCourseAccess(client);
  if (!access.isTeacher) return null;

  const rows = await loadMessages(client);
  const threads = groupThreads(rows, access.profileId);
  const names = await loadProfileNames(
    client,
    threads.map((thread) => thread.counterpartProfileId),
  );

  return {
    courseTitle: access.run?.title ?? "Aktivt kurs",
    viewerProfileId: access.profileId,
    threads: threads.map((thread) => ({
      thread,
      counterpartName:
        names.get(thread.counterpartProfileId)?.name ?? "Ukjent deltaker",
      counterpartClub: names.get(thread.counterpartProfileId)?.club ?? null,
    })),
  };
}

export type TeacherThreadView = Readonly<{
  enrollmentId: string;
  viewerProfileId: string;
  participantProfileId: string;
  participantName: string;
  participantClub: string | null;
  enrollmentActive: boolean;
  messages: readonly MessageRow[];
}>;

/** Lærerens trådvisning mot én deltaker; markerer tråden som lest. */
export async function loadTeacherThread(
  client: SupabaseClient,
  enrollmentId: string,
): Promise<TeacherThreadView | null> {
  const access = await resolveTeacherCourseAccess(client);
  if (!access.isTeacher) return null;

  const enrollment = await client
    .from("enrollments")
    .select("id,profile_id,status")
    .eq("id", enrollmentId)
    .maybeSingle();
  assertNoQueryError(enrollment.error);
  if (!enrollment.data) return null;

  const participantProfileId = enrollment.data.profile_id as string;
  if (participantProfileId === access.profileId) return null;

  const marked = await client.rpc("mark_messages_read", {
    target_enrollment_id: enrollmentId,
    target_counterpart_profile_id: participantProfileId,
  });
  assertNoQueryError(marked.error);

  const [messages, names] = await Promise.all([
    loadMessages(client, { enrollmentId }),
    loadProfileNames(client, [participantProfileId]),
  ]);

  return {
    enrollmentId,
    viewerProfileId: access.profileId,
    participantProfileId,
    participantName: names.get(participantProfileId)?.name ?? "Ukjent deltaker",
    participantClub: names.get(participantProfileId)?.club ?? null,
    enrollmentActive: enrollment.data.status === "active",
    messages,
  };
}

export type StudentThreadsView = Readonly<{
  viewerProfileId: string;
  threads: readonly ThreadListItem[];
}>;

async function loadCounterpartNames(
  client: SupabaseClient,
): Promise<Map<string, string>> {
  // Definer-RPC: studenter kan ikke lese lærerprofiler via profiles-RLS.
  const result = await client.rpc("message_thread_counterparts");
  assertNoQueryError(result.error);
  const rows = (result.data ?? []) as ReadonlyArray<{
    profile_id: string;
    display_name: string;
  }>;
  return new Map(rows.map((row) => [row.profile_id, row.display_name]));
}

/** Studentens trådliste: én tråd per lærer/kursleder. */
export async function loadStudentThreads(
  client: SupabaseClient,
  viewerProfileId: string,
): Promise<StudentThreadsView> {
  const [rows, names] = await Promise.all([
    loadMessages(client),
    loadCounterpartNames(client),
  ]);
  const threads = groupThreads(rows, viewerProfileId);

  return {
    viewerProfileId,
    threads: threads.map((thread) => ({
      thread,
      counterpartName: names.get(thread.counterpartProfileId) ?? "Kurslærer",
      counterpartClub: null,
    })),
  };
}

export type StudentThreadView = Readonly<{
  enrollmentId: string;
  viewerProfileId: string;
  teacherProfileId: string;
  teacherName: string;
  messages: readonly MessageRow[];
}>;

/** Studentens trådvisning mot én lærer; markerer tråden som lest. */
export async function loadStudentThread(
  client: SupabaseClient,
  viewerProfileId: string,
  enrollmentId: string,
  teacherProfileId: string,
): Promise<StudentThreadView | null> {
  const marked = await client.rpc("mark_messages_read", {
    target_enrollment_id: enrollmentId,
    target_counterpart_profile_id: teacherProfileId,
  });
  assertNoQueryError(marked.error);

  const [rows, names] = await Promise.all([
    loadMessages(client, { enrollmentId }),
    loadCounterpartNames(client),
  ]);
  const thread = groupThreads(rows, viewerProfileId).find(
    (candidate) => candidate.counterpartProfileId === teacherProfileId,
  );
  if (!thread) return null;

  return {
    enrollmentId,
    viewerProfileId,
    teacherProfileId,
    teacherName: names.get(teacherProfileId) ?? "Kurslærer",
    messages: thread.messages,
  };
}

/** Antall uleste meldinger til viewer, for menymerket. */
export async function countUnreadMessages(
  client: SupabaseClient,
  viewerProfileId: string | null,
): Promise<number> {
  if (!viewerProfileId) return 0;
  const result = await client
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_profile_id", viewerProfileId)
    .is("read_at", null);
  assertNoQueryError(result.error);
  return result.count ?? 0;
}

export { countUnreadForViewer };
