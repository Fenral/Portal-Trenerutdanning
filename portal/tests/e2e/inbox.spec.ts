import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function expectNoSeriousViolations(
  page: import("@playwright/test").Page,
) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
}

test("teacher and student exchange 1:1 messages with unread markers", async ({
  browser,
}) => {
  const stamp = Date.now();
  const teacherMessage = `Hei Emil, husk praksisloggen. (${stamp})`;
  const studentReply = `Takk for påminnelsen, leverer i kveld. (${stamp})`;

  // Lærer starter samtalen fra deltakerprofilen.
  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await teacherPage.goto("/test-login?as=teacher-t3");
  await teacherPage.goto("/teacher/participants");
  await teacherPage
    .getByRole("link")
    .filter({ hasText: "Emil Berg" })
    .first()
    .click();
  await teacherPage.getByRole("link", { name: "Send melding" }).click();
  await expect(teacherPage).toHaveURL(/\/teacher\/inbox\//);
  await expect(
    teacherPage.getByRole("heading", { level: 1, name: "Emil Berg" }),
  ).toBeVisible();

  await teacherPage.getByLabel("Melding til Emil Berg").fill(teacherMessage);
  await teacherPage.getByRole("button", { name: "Send melding" }).click();
  await expect(teacherPage.getByRole("status")).toContainText(
    "Meldingen er sendt",
  );
  await expect(teacherPage.getByText(teacherMessage)).toBeVisible();

  // Trådlisten viser samtalen; axe på lærerflaten.
  await teacherPage.goto("/teacher/inbox");
  await expect(
    teacherPage.getByRole("heading", { level: 1, name: "Inbox" }),
  ).toBeVisible();
  await expect(
    teacherPage.getByRole("link").filter({ hasText: "Emil Berg" }),
  ).toBeVisible();
  await expectNoSeriousViolations(teacherPage);

  // Student ser uleste-merket i menyen, åpner tråden og svarer.
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await studentPage.goto("/test-login?as=student-emil");
  const messagesNav = studentPage.getByRole("link", { name: /Meldinger/ });
  await expect(messagesNav).toContainText(/\d+ uleste/);
  await messagesNav.click();
  await expect(studentPage).toHaveURL(/\/student\/messages$/);
  await expect(
    studentPage.getByRole("heading", { level: 1, name: "Meldinger" }),
  ).toBeVisible();
  const teacherThreadRow = studentPage
    .getByRole("link")
    .filter({ hasText: "Liv Trener 3" })
    .first();
  await expect(teacherThreadRow).toContainText("uleste");
  await expectNoSeriousViolations(studentPage);

  await teacherThreadRow.click();
  await expect(studentPage).toHaveURL(/\/student\/messages\/[0-9a-f-]+\//);
  await expect(studentPage.getByText(teacherMessage)).toBeVisible();
  await studentPage.getByLabel("Svar til Liv Trener 3").fill(studentReply);
  await studentPage.getByRole("button", { name: "Send svar" }).click();
  await expect(studentPage.getByRole("status")).toContainText(
    "Meldingen er sendt",
  );

  // Tråden er lest: menymerket er borte.
  await expect(
    studentPage.getByRole("link", { name: /Meldinger/ }),
  ).not.toContainText("uleste");

  // Læreren ser svaret med uleste-markering; åpning kvitterer ut.
  await teacherPage.goto("/teacher/inbox");
  const emilRow = teacherPage
    .getByRole("link")
    .filter({ hasText: "Emil Berg" })
    .first();
  await expect(emilRow).toContainText("uleste");
  await emilRow.click();
  // Vent til trådsiden faktisk er lastet: åpningen markerer som lest.
  await expect(teacherPage).toHaveURL(/\/teacher\/inbox\/[0-9a-f-]+$/);
  await expect(teacherPage.getByLabel("Melding til Emil Berg")).toBeVisible();
  await expect(teacherPage.getByText(studentReply)).toBeVisible();

  await teacherPage.goto("/teacher/inbox");
  const emilRowAfter = teacherPage
    .getByRole("link")
    .filter({ hasText: "Emil Berg" })
    .first();
  await expect(emilRowAfter).not.toContainText("uleste");
  await expect(emilRowAfter).toContainText("Lest");
});
