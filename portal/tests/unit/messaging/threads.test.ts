import { describe, expect, it } from "vitest";

import {
  countUnreadForViewer,
  groupThreads,
  type MessageRow,
} from "@/features/messaging/threads";

const TEACHER = "aa000000-0000-0000-0000-000000000001";
const OTHER_TEACHER = "aa000000-0000-0000-0000-000000000002";
const STUDENT = "bb000000-0000-0000-0000-000000000001";
const ENROLLMENT_A = "ee000000-0000-0000-0000-000000000001";
const ENROLLMENT_B = "ee000000-0000-0000-0000-000000000002";

function message(overrides: Partial<MessageRow>): MessageRow {
  return {
    id: crypto.randomUUID(),
    enrollment_id: ENROLLMENT_A,
    sender_profile_id: TEACHER,
    recipient_profile_id: STUDENT,
    body: "Hei",
    created_at: "2026-11-12T10:00:00.000Z",
    read_at: null,
    ...overrides,
  };
}

describe("groupThreads", () => {
  it("groups messages into one thread per enrollment and counterpart", () => {
    const rows = [
      message({ created_at: "2026-11-12T10:00:00.000Z" }),
      message({
        sender_profile_id: STUDENT,
        recipient_profile_id: TEACHER,
        created_at: "2026-11-12T11:00:00.000Z",
      }),
      message({
        enrollment_id: ENROLLMENT_B,
        sender_profile_id: OTHER_TEACHER,
        created_at: "2026-11-12T09:00:00.000Z",
      }),
    ];

    const threads = groupThreads(rows, STUDENT);

    expect(threads).toHaveLength(2);
    const [first, second] = threads;
    // Nyeste tråd først.
    expect(first.enrollmentId).toBe(ENROLLMENT_A);
    expect(first.counterpartProfileId).toBe(TEACHER);
    expect(first.messages).toHaveLength(2);
    expect(second.counterpartProfileId).toBe(OTHER_TEACHER);
  });

  it("sorts messages oldest first inside a thread and picks the last message", () => {
    const rows = [
      message({ body: "Nyest", created_at: "2026-11-12T12:00:00.000Z" }),
      message({ body: "Eldst", created_at: "2026-11-12T08:00:00.000Z" }),
    ];

    const [thread] = groupThreads(rows, STUDENT);

    expect(thread.messages.map((row) => row.body)).toEqual(["Eldst", "Nyest"]);
    expect(thread.lastMessage.body).toBe("Nyest");
  });

  it("counts only unread messages addressed to the viewer", () => {
    const rows = [
      // Ulest til viewer: teller.
      message({ read_at: null }),
      // Lest til viewer: teller ikke.
      message({ read_at: "2026-11-12T10:30:00.000Z" }),
      // Ulest, men sendt AV viewer: teller ikke.
      message({
        sender_profile_id: STUDENT,
        recipient_profile_id: TEACHER,
        read_at: null,
      }),
    ];

    const [thread] = groupThreads(rows, STUDENT);

    expect(thread.unreadCount).toBe(1);
  });

  it("sums unread across threads for the shell badge", () => {
    const rows = [
      message({ read_at: null }),
      message({ read_at: null }),
      message({
        enrollment_id: ENROLLMENT_B,
        sender_profile_id: OTHER_TEACHER,
        read_at: null,
      }),
      message({
        sender_profile_id: STUDENT,
        recipient_profile_id: TEACHER,
        read_at: null,
      }),
    ];

    expect(countUnreadForViewer(rows, STUDENT)).toBe(3);
    expect(countUnreadForViewer(rows, TEACHER)).toBe(1);
  });

  it("returns an empty list for no messages", () => {
    expect(groupThreads([], STUDENT)).toEqual([]);
  });
});
