import { describe, expect, it, vi } from "vitest";

import { createCourseRun } from "@/features/courses/create-course-run";
import { CourseRunInput } from "@/features/courses/schema";

const TEMPLATE_ID = "10000000-0000-4000-8000-000000000001";
const LEAD_PROFILE_ID = "20000000-0000-4000-8000-000000000001";
const CORRELATION_ID = "30000000-0000-4000-8000-000000000001";

describe("course run", () => {
  it("uses the start year for a two-year Trener 3 cohort", () => {
    const parsed = CourseRunInput.parse({
      templateCode: "T3",
      templateId: TEMPLATE_ID,
      title: "Trener 3",
      startYear: 2026,
      startsOn: "2026-02-15",
      endsOn: "2027-03-21",
      sessions: 6,
      leadProfileId: LEAD_PROFILE_ID,
      correlationId: CORRELATION_ID,
    });

    expect(parsed.displayYear).toBe("2026–2027");
  });

  it("requires a location for Trener 1", () => {
    expect(() =>
      CourseRunInput.parse({
        templateCode: "T1",
        templateId: TEMPLATE_ID,
        title: "Trener 1",
        startYear: 2026,
        startsOn: "2026-04-10",
        endsOn: "2026-09-06",
        sessions: 2,
        leadProfileId: LEAD_PROFILE_ID,
        correlationId: CORRELATION_ID,
      }),
    ).toThrow("Trener 1 krever kurssted");
  });

  it("rejects reversed dates and an empty session plan", () => {
    expect(() =>
      CourseRunInput.parse({
        templateCode: "T2",
        templateId: TEMPLATE_ID,
        title: "Trener 2",
        startYear: 2026,
        startsOn: "2026-09-18",
        endsOn: "2026-03-20",
        sessions: 0,
        leadProfileId: LEAD_PROFILE_ID,
        correlationId: CORRELATION_ID,
      }),
    ).toThrow();
  });

  it("passes only validated values to the transaction repository", async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({
        courseRunId: "40000000-0000-4000-8000-000000000001",
      }),
    };

    await expect(
      createCourseRun(
        {
          templateCode: "T2",
          templateId: TEMPLATE_ID,
          title: " Trener 2 2026 ",
          startYear: 2026,
          startsOn: "2026-03-20",
          endsOn: "2026-09-18",
          sessions: 3,
          sessionPlan: [
            {
              title: "Samling 1",
              startsAt: "2026-03-20T13:00:00+01:00",
              endsAt: "2026-03-20T18:00:00+01:00",
              locationText: "Elverum / Terningen Arena",
            },
            {
              title: "Samling 2",
              startsAt: "2026-05-01T09:00:00+02:00",
              endsAt: "2026-05-03T16:00:00+02:00",
              locationText: "Elverum Golfklubb",
            },
            {
              title: "Samling 3",
              startsAt: "2026-09-18T09:00:00+02:00",
              endsAt: "2026-09-18T16:00:00+02:00",
              locationText: "Elverum Golfklubb",
            },
          ],
          leadProfileId: LEAD_PROFILE_ID,
          correlationId: CORRELATION_ID,
        },
        { repository },
      ),
    ).resolves.toEqual({
      courseRunId: "40000000-0000-4000-8000-000000000001",
      displayYear: "2026",
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Trener 2 2026",
        sessions: 3,
        sessionPlan: expect.arrayContaining([
          expect.objectContaining({ title: "Samling 1", sortOrder: 1 }),
          expect.objectContaining({ title: "Samling 3", sortOrder: 3 }),
        ]),
      }),
    );
  });
});
