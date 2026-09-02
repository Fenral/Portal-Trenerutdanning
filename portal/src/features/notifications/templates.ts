export type NotificationTemplate =
  | "invitation"
  | "due_reminder"
  | "review_result"
  | "new_deadline"
  | "recommended_before_session"
  | "access_withdrawn"
  | "access_reopened"
  | "completion";

export type EmailTemplateParams = Readonly<{
  firstName: string;
  courseTitle: string;
  dueOn?: string;
  actionUrl?: string;
}>;

export type RenderedEmail = Readonly<{ subject: string; text: string }>;

export function notificationKey(
  input: Readonly<{
    courseRunId: string;
    personId: string;
    type: string;
    scheduledAt: string | Date;
  }>,
): string {
  const scheduledAt = new Date(input.scheduledAt).toISOString();
  return `${input.courseRunId}:${input.personId}:${input.type}:${scheduledAt}`;
}

export function firstNameOf(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || "deltaker";
}

type TemplateCopy = Readonly<{
  subject: (courseTitle: string) => string;
  body: (courseTitle: string, dueOn?: string) => string;
}>;

const COPY: Record<NotificationTemplate, TemplateCopy> = {
  invitation: {
    subject: (course) => `Invitasjon til ${course}`,
    body: (course) =>
      `du er invitert til ${course} i Trenerutdanningsportalen. Bruk lenken under for å aktivere tilgangen din.`,
  },
  due_reminder: {
    subject: (course) => `Påminnelse fra ${course}`,
    body: (course, dueOn) =>
      `du har en handling som venter i ${course}.${dueOn ? ` Frist: ${dueOn}.` : ""} Logg inn i portalen for å se hva som gjenstår.`,
  },
  review_result: {
    subject: (course) => `Vurderingen din i ${course} er klar`,
    body: (course) =>
      `en vurdering i ${course} er ferdig, og resultatet er tilgjengelig i portalen.`,
  },
  new_deadline: {
    subject: (course) => `Ny frist i ${course}`,
    body: (course, dueOn) =>
      `du har fått en ny frist i ${course}.${dueOn ? ` Frist: ${dueOn}.` : ""} Logg inn i portalen for detaljer.`,
  },
  recommended_before_session: {
    subject: (course) => `Anbefalt før neste samling i ${course}`,
    body: (course, dueOn) =>
      `det er anbefalt innhold å gjennomføre før neste samling i ${course}.${dueOn ? ` Samlingen starter ${dueOn}.` : ""}`,
  },
  access_withdrawn: {
    subject: (course) => `Tilgangen din til ${course} er avsluttet`,
    body: (course) =>
      `tilgangen din til ${course} er avsluttet. Kontakt kurslederen din hvis du mener dette er feil.`,
  },
  access_reopened: {
    subject: (course) => `Tilgangen din til ${course} er gjenåpnet`,
    body: (course) =>
      `tilgangen din til ${course} er gjenåpnet, og du kan fortsette der du slapp.`,
  },
  completion: {
    subject: (course) => `Gratulerer – ${course} er fullført`,
    body: (course) =>
      `du har fullført ${course}. Diplomet ditt er tilgjengelig i portalen.`,
  },
};

export function renderEmail(
  template: NotificationTemplate,
  params: EmailTemplateParams,
): RenderedEmail {
  // PII-minimering: kun disse fire feltene kan nå e-posten, alt annet ignoreres.
  const { firstName, courseTitle, dueOn, actionUrl } = params;
  const copy = COPY[template];
  const lines = [`Hei ${firstName},`, "", copy.body(courseTitle, dueOn)];
  if (actionUrl) {
    lines.push("", `Gå til portalen: ${actionUrl}`);
  }
  lines.push("", "Vennlig hilsen", "Trenerutdanningsportalen");

  return { subject: copy.subject(courseTitle), text: lines.join("\n") };
}
