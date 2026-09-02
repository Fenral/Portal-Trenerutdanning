export type MessageRow = Readonly<{
  id: string;
  enrollment_id: string;
  sender_profile_id: string;
  recipient_profile_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}>;

export type MessageThread = Readonly<{
  enrollmentId: string;
  counterpartProfileId: string;
  messages: readonly MessageRow[];
  lastMessage: MessageRow;
  unreadCount: number;
}>;

function isUnreadForViewer(row: MessageRow, viewerProfileId: string): boolean {
  return row.recipient_profile_id === viewerProfileId && row.read_at === null;
}

/**
 * Grupperer 1:1-meldinger til tråder per (enrollment, motpart), nyeste tråd
 * først og eldste melding først i tråden. Uleste teller kun meldinger
 * adressert til viewer.
 */
export function groupThreads(
  rows: readonly MessageRow[],
  viewerProfileId: string,
): MessageThread[] {
  const buckets = new Map<string, MessageRow[]>();

  for (const row of rows) {
    const counterpart =
      row.sender_profile_id === viewerProfileId
        ? row.recipient_profile_id
        : row.sender_profile_id;
    const key = `${row.enrollment_id}:${counterpart}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  const threads = [...buckets.values()].map((messages) => {
    const sorted = [...messages].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    const last = sorted[sorted.length - 1];
    const counterpartProfileId =
      last.sender_profile_id === viewerProfileId
        ? last.recipient_profile_id
        : last.sender_profile_id;

    return {
      enrollmentId: last.enrollment_id,
      counterpartProfileId,
      messages: sorted,
      lastMessage: last,
      unreadCount: sorted.filter((row) =>
        isUnreadForViewer(row, viewerProfileId),
      ).length,
    };
  });

  return threads.sort((a, b) =>
    b.lastMessage.created_at.localeCompare(a.lastMessage.created_at),
  );
}

export function countUnreadForViewer(
  rows: readonly MessageRow[],
  viewerProfileId: string,
): number {
  return rows.filter((row) => isUnreadForViewer(row, viewerProfileId)).length;
}
