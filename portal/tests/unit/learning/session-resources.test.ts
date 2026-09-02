import { describe, expect, it } from "vitest";

import { groupSessionResources } from "@/features/learning/session-resources";

const sessions = [{ id: "s1" }, { id: "s2" }];

const resources = [
  { id: "r1", courseSessionId: "s1" },
  { id: "r2", courseSessionId: null },
  { id: "r3", courseSessionId: "slettet-samling" },
];

describe("groupSessionResources", () => {
  it("places a coupled resource under its session", () => {
    const grouped = groupSessionResources(sessions, resources);

    expect(grouped.sessions[0]?.resources.map((r) => r.id)).toEqual(["r1"]);
  });

  it("keeps every session, also without files, in original order", () => {
    const grouped = groupSessionResources(sessions, resources);

    expect(grouped.sessions.map((entry) => entry.session.id)).toEqual([
      "s1",
      "s2",
    ]);
    expect(grouped.sessions[1]?.resources).toEqual([]);
  });

  it("treats uncoupled and orphaned resources as shared for the course", () => {
    const grouped = groupSessionResources(sessions, resources);

    expect(grouped.shared.map((r) => r.id)).toEqual(["r2", "r3"]);
  });
});
