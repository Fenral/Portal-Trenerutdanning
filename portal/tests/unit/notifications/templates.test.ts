import { describe, expect, it } from "vitest";

import {
  firstNameOf,
  notificationKey,
  renderEmail,
  type EmailTemplateParams,
  type NotificationTemplate,
} from "@/features/notifications/templates";

const ALL_TEMPLATES: readonly NotificationTemplate[] = [
  "invitation",
  "due_reminder",
  "review_result",
  "new_deadline",
  "recommended_before_session",
  "access_withdrawn",
  "access_reopened",
  "completion",
];

const FORBIDDEN_VALUES = {
  grade: "Bestått med glans",
  submissionText: "Hemmelig innleveringstekst",
  phone: "90000101",
  rawToken: "RAW_SECRET_TOKEN_VALUE",
} as const;

describe("notificationKey", () => {
  it("is deterministic and normalizes the timestamp to ISO UTC", () => {
    expect(
      notificationKey({
        courseRunId: "c1",
        personId: "p1",
        type: "due_reminder",
        scheduledAt: "2026-10-24T08:00:00Z",
      }),
    ).toBe("c1:p1:due_reminder:2026-10-24T08:00:00.000Z");

    expect(
      notificationKey({
        courseRunId: "c1",
        personId: "p1",
        type: "due_reminder",
        scheduledAt: new Date("2026-10-24T09:00:00+01:00"),
      }),
    ).toBe("c1:p1:due_reminder:2026-10-24T08:00:00.000Z");
  });

  it("separates different types and days", () => {
    const base = {
      courseRunId: "c1",
      personId: "p1",
      scheduledAt: "2026-10-24T08:00:00Z",
    };
    expect(notificationKey({ ...base, type: "due_reminder" })).not.toBe(
      notificationKey({ ...base, type: "completion" }),
    );
  });
});

describe("renderEmail", () => {
  const params: EmailTemplateParams = {
    firstName: "Nora",
    courseTitle: "Trener 3",
    dueOn: "12. september",
    actionUrl: "https://portal.example/logg-inn",
  };

  it.each(ALL_TEMPLATES)(
    "%s contains first name, course and portal link",
    (template) => {
      const email = renderEmail(template, params);
      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.text).toContain("Nora");
      expect(`${email.subject}\n${email.text}`).toContain("Trener 3");
      expect(email.text).toContain("https://portal.example/logg-inn");
    },
  );

  it.each(ALL_TEMPLATES)(
    "%s never leaks grade, submission text, phone or raw token",
    (template) => {
      const sneaky = {
        ...params,
        ...FORBIDDEN_VALUES,
      } as unknown as EmailTemplateParams;
      const email = renderEmail(template, sneaky);
      const rendered = `${email.subject}\n${email.text}`;
      for (const forbidden of Object.values(FORBIDDEN_VALUES)) {
        expect(rendered).not.toContain(forbidden);
      }
      expect(rendered).not.toContain("vurderingskommentar");
    },
  );

  it("includes the due date only when provided", () => {
    expect(renderEmail("due_reminder", params).text).toContain("12. september");
    expect(
      renderEmail("due_reminder", { ...params, dueOn: undefined }).text,
    ).not.toContain("Frist");
  });

  it("review_result announces availability without the result itself", () => {
    const email = renderEmail("review_result", params);
    expect(email.text).toContain("tilgjengelig i portalen");
  });
});

describe("firstNameOf", () => {
  it("uses only the first given name", () => {
    expect(firstNameOf("Nora K Vik")).toBe("Nora");
    expect(firstNameOf("  ")).toBe("deltaker");
  });
});
