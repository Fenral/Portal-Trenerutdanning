import Link from "next/link";

import type { ThreadListItem } from "@/features/messaging/data";
import type { MessageRow } from "@/features/messaging/threads";

import styles from "./MessageThread.module.css";

const timestampFormatter = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatMessageTime(isoTimestamp: string): string {
  return timestampFormatter.format(new Date(isoTimestamp));
}

/**
 * Trådliste for begge roller. Status vises alltid med symbol OG tekst:
 * uleste som pill, ellers Sendt/Lest for siste melding.
 */
export function ThreadList({
  hrefFor,
  items,
  viewerProfileId,
}: Readonly<{
  hrefFor: (item: ThreadListItem) => string;
  items: readonly ThreadListItem[];
  viewerProfileId: string;
}>) {
  return (
    <ol className={styles.threadList}>
      {items.map((item) => {
        const { thread, counterpartName, counterpartClub } = item;
        const last = thread.lastMessage;
        const ownLast = last.sender_profile_id === viewerProfileId;
        return (
          <li key={`${thread.enrollmentId}:${thread.counterpartProfileId}`}>
            {/* prefetch=false: åpning markerer tråden som lest, og det skal
                ikke skje på hover-prefetch. */}
            <Link
              className={styles.threadRow}
              href={hrefFor(item)}
              prefetch={false}
            >
              <span className={styles.threadName}>
                <strong>{counterpartName}</strong>
                {counterpartClub ? <small>{counterpartClub}</small> : null}
              </span>
              <p className={styles.threadExcerpt}>
                {ownLast ? "Du: " : ""}
                {last.body}
              </p>
              {thread.unreadCount > 0 ? (
                <span className={styles.unread}>
                  <span aria-hidden="true">●</span> {thread.unreadCount} uleste
                </span>
              ) : (
                <span className={styles.readState}>
                  {ownLast && last.read_at === null ? "Sendt" : "Lest"}
                </span>
              )}
              <time className={styles.threadTime} dateTime={last.created_at}>
                {formatMessageTime(last.created_at)}
              </time>
              <span aria-hidden="true" className={styles.threadArrow}>
                →
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** Meldingshistorikk for én 1:1-tråd; egen melding høyrestilles. */
export function MessageThread({
  counterpartName,
  messages,
  viewerProfileId,
}: Readonly<{
  counterpartName: string;
  messages: readonly MessageRow[];
  viewerProfileId: string;
}>) {
  if (messages.length === 0) {
    return (
      <section aria-label="Meldingshistorikk" className={styles.empty}>
        <h2>Ingen meldinger ennå</h2>
        <p>Start samtalen med feltet under.</p>
      </section>
    );
  }

  return (
    <ol aria-label="Meldingshistorikk" className={styles.thread}>
      {messages.map((message) => {
        const own = message.sender_profile_id === viewerProfileId;
        return (
          <li
            className={styles.message}
            data-own={own || undefined}
            key={message.id}
          >
            <p className={styles.messageMeta}>
              <strong>{own ? "Du" : counterpartName}</strong>
              <time dateTime={message.created_at}>
                {formatMessageTime(message.created_at)}
              </time>
            </p>
            <p className={styles.messageBody}>{message.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
