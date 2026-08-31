import { describe, expect, it } from "vitest";

import {
  participantProgressSignal,
  sortDemoParticipants,
} from "@/features/demo/participants";

describe("demo participants", () => {
  it("keeps the three named demo stories at the top", () => {
    const participants = [
      { name: "Selma Dahl" },
      { name: "Jonas «henger etter»" },
      { name: "Kari Ferdig" },
      { name: "Trond «50%»" },
      { name: "Ada Åsen" },
    ];

    expect(
      sortDemoParticipants(participants, (participant) => participant.name).map(
        (participant) => participant.name,
      ),
    ).toEqual([
      "Kari Ferdig",
      "Trond «50%»",
      "Jonas «henger etter»",
      "Ada Åsen",
      "Selma Dahl",
    ]);
  });

  it("shows fullført, midtveis and henger etter as distinct signals", () => {
    expect(participantProgressSignal(100)).toEqual({
      label: "Fullført",
      tone: "success",
    });
    expect(participantProgressSignal(50)).toEqual({
      label: "Midtveis",
      tone: "attention",
    });
    expect(participantProgressSignal(20)).toEqual({
      label: "Henger etter",
      tone: "danger",
    });
  });
});
