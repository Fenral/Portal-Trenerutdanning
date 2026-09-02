import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { loadAdminDashboard } from "@/features/reporting/admin-dashboard-query";

/**
 * Minimal thenable query-builder-mock: alle filter-/sorteringskall er
 * kjedbare og resultatet er radene registrert for tabellen.
 */
function mockClient(
  rowsByTable: Readonly<Record<string, readonly unknown[]>>,
): SupabaseClient {
  return {
    from(table: string) {
      const rows = rowsByTable[table] ?? [];
      const builder: Record<string, unknown> = {
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(resolve({ data: rows, error: null }));
        },
      };
      for (const method of ["select", "eq", "is", "not", "order", "limit"]) {
        builder[method] = () => builder;
      }
      return builder;
    },
  } as unknown as SupabaseClient;
}

const runId = "b1010000-0000-0000-0000-000000000001";
const templateId = "a1000000-0000-0000-0000-000000000001";

const baseRows = {
  completion_admin_tasks: [
    {
      id: "task-1",
      enrollment_id: "enr-1",
      course_run_id: runId,
      created_at: "2026-08-01T10:00:00+02:00",
    },
  ],
  notification_incidents: [
    {
      id: "incident-1",
      last_error_code: "SMTP_TIMEOUT",
      created_at: "2026-08-20T08:00:00+02:00",
    },
  ],
  profiles: [
    {
      id: "p-1",
      display_name: "Jakob Fjell",
      normalized_email: "jakob.fjell@nivaa.invalid",
      club_name: "Sandane GK",
      phone: "90000001",
    },
    {
      id: "p-2",
      display_name: "Jakob B Fjell",
      normalized_email: "jakob.b.fjell@nivaa.invalid",
      club_name: "Sandane GK",
      phone: "90000001",
    },
    {
      id: "p-3",
      display_name: "Nora Nordmann",
      normalized_email: "nora@nivaa.invalid",
      club_name: "Fana GK",
      phone: null,
    },
  ],
  person_merges: [],
  course_runs: [
    { id: runId, title: "Trener 1 · Kristiansund", template_id: templateId },
  ],
  course_templates: [{ id: templateId, title: "Trener 1", level: 1 }],
  enrollments: [
    { id: "enr-1", profile_id: "p-1", course_run_id: runId, status: "active" },
    { id: "enr-2", profile_id: "p-3", course_run_id: runId, status: "active" },
    {
      id: "enr-3",
      profile_id: "p-2",
      course_run_id: runId,
      status: "withdrawn",
    },
  ],
  enrollment_progress: [
    { enrollment_id: "enr-1", percentage: 40 },
    { enrollment_id: "enr-2", percentage: 60 },
    { enrollment_id: "enr-3", percentage: 100 },
  ],
  notification_deliveries: [{ delivered_at: "2026-08-30T06:00:00+02:00" }],
} as const;

describe("loadAdminDashboard", () => {
  it("joins open invoice tasks with participant and course", async () => {
    const dashboard = await loadAdminDashboard(mockClient(baseRows));

    expect(dashboard.invoiceTasks).toEqual([
      {
        id: "task-1",
        participantName: "Jakob Fjell",
        courseTitle: "Trener 1 · Kristiansund",
        createdAt: "2026-08-01T10:00:00+02:00",
      },
    ]);
  });

  it("returns open notification incidents", async () => {
    const dashboard = await loadAdminDashboard(mockClient(baseRows));

    expect(dashboard.incidents).toEqual([
      {
        id: "incident-1",
        lastErrorCode: "SMTP_TIMEOUT",
        createdAt: "2026-08-20T08:00:00+02:00",
      },
    ]);
  });

  it("counts duplicate suggestions at or above the threshold", async () => {
    const dashboard = await loadAdminDashboard(mockClient(baseRows));

    // p-1 og p-2 deler navn, klubb og telefon; p-3 matcher ingen.
    expect(dashboard.duplicateSuggestionCount).toBe(1);
  });

  it("summarises the course portfolio per level with cohort average", async () => {
    const dashboard = await loadAdminDashboard(mockClient(baseRows));

    expect(dashboard.portfolio).toEqual([
      {
        level: 1,
        templateTitle: "Trener 1",
        activeRunCount: 1,
        activeParticipantCount: 2,
        // Kullsnitt per course_progress-definisjonen: snitt ekskl. trukket.
        cohortAverageProgress: 50,
      },
    ]);
  });

  it("exposes the latest successful notification delivery", async () => {
    const dashboard = await loadAdminDashboard(mockClient(baseRows));

    expect(dashboard.lastNotificationDeliveredAt).toBe(
      "2026-08-30T06:00:00+02:00",
    );

    const empty = await loadAdminDashboard(
      mockClient({ ...baseRows, notification_deliveries: [] }),
    );
    expect(empty.lastNotificationDeliveredAt).toBeNull();
  });

  it("follows reportDefinitions.course_progress.excludeStatuses instead of a hardcoded status", async () => {
    vi.resetModules();
    vi.doMock("@/features/reporting/definitions", async (importOriginal) => {
      const actual =
        await importOriginal<
          typeof import("@/features/reporting/definitions")
        >();
      return {
        ...actual,
        reportDefinitions: {
          ...actual.reportDefinitions,
          course_progress: {
            ...actual.reportDefinitions.course_progress,
            excludeStatuses: ["withdrawn", "invited"],
          },
        },
      };
    });
    try {
      const { loadAdminDashboard: load } =
        await import("@/features/reporting/admin-dashboard-query");
      const dashboard = await load(
        mockClient({
          ...baseRows,
          enrollments: [
            ...baseRows.enrollments,
            {
              id: "enr-4",
              profile_id: "p-3",
              course_run_id: runId,
              status: "invited",
            },
          ],
          enrollment_progress: [
            ...baseRows.enrollment_progress,
            { enrollment_id: "enr-4", percentage: 0 },
          ],
        }),
      );

      // Med «invited» i excludeStatuses skal både antall og snitt følge etter.
      expect(dashboard.portfolio[0]).toMatchObject({
        activeParticipantCount: 2,
        cohortAverageProgress: 50,
      });
    } finally {
      vi.doUnmock("@/features/reporting/definitions");
      vi.resetModules();
    }
  });

  it("uses null cohort average when a level has no participants", async () => {
    const dashboard = await loadAdminDashboard(
      mockClient({ ...baseRows, enrollments: [], enrollment_progress: [] }),
    );

    expect(dashboard.portfolio[0]).toMatchObject({
      activeParticipantCount: 0,
      cohortAverageProgress: null,
    });
    expect(dashboard.invoiceTasks[0]?.participantName).toBe("Ukjent deltaker");
  });
});
