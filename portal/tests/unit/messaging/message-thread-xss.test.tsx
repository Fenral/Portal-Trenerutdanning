/** N4 reviewsjekk: meldingsbody rendres som tekst, aldri som HTML. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageThread, ThreadList } from "@/components/ui/MessageThread";
import type { MessageRow } from "@/features/messaging/threads";

const payload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';

const row: MessageRow = {
  id: "m1",
  enrollment_id: "e1",
  sender_profile_id: "teacher",
  recipient_profile_id: "student",
  body: payload,
  created_at: "2026-09-01T10:00:00.000Z",
  read_at: null,
};

describe("XSS i meldingsvisning", () => {
  it("MessageThread rendrer body som tekst", () => {
    const { container } = render(
      <MessageThread
        counterpartName={payload}
        messages={[row]}
        viewerProfileId="student"
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getAllByText(payload).length).toBeGreaterThan(0);
    expect(container.innerHTML).toContain("&lt;script&gt;");
  });

  it("ThreadList rendrer utdrag og navn som tekst", () => {
    const { container } = render(
      <ThreadList
        hrefFor={() => "/student/messages/e1/teacher"}
        items={[
          {
            thread: {
              enrollmentId: "e1",
              counterpartProfileId: "teacher",
              messages: [row],
              lastMessage: row,
              unreadCount: 1,
            },
            counterpartName: payload,
            counterpartClub: payload,
          },
        ]}
        viewerProfileId="student"
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).toContain("&lt;script&gt;");
  });
});
