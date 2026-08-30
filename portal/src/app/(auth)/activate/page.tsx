import { Button } from "@/components/ui/Button";
import { maskEmail } from "@/features/access/invitations/claim-invitation";
import { SupabaseInvitationRepository } from "@/features/access/invitations/supabase-repository";
import { hashInvitationToken } from "@/features/access/invitations/token";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { requestInvitationSignIn } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type ActivatePageProps = Readonly<{
  searchParams: Promise<
    Readonly<Record<string, string | string[] | undefined>>
  >;
}>;

const errorMessages: Readonly<Record<string, string>> = {
  invalid: "Invitasjonslenken er ugyldig. Be kursansvarlig sende en ny.",
  expired: "Invitasjonslenken har utløpt. Be kursansvarlig sende en ny.",
  already_claimed: "Invitasjonen er allerede brukt. Logg inn med e-posten din.",
  email_mismatch:
    "E-posten som ble brukt stemmer ikke med invitasjonen. Prøv lenken på nytt.",
  email_failed:
    "Vi kunne ikke sende innloggingslenken nå. Vent ett minutt og prøv igjen.",
  auth_failed: "Innloggingen kunne ikke fullføres. Prøv invitasjonen på nytt.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function MessageCard({ title, body }: { title: string; body: string }) {
  return (
    <main className={styles.shell} id="main-content">
      <section className={styles.card}>
        <p className={styles.eyebrow}>Nivå · trenerutdanning</p>
        <h1>{title}</h1>
        <p className={styles.lead}>{body}</p>
      </section>
    </main>
  );
}

export default async function ActivatePage({
  searchParams,
}: ActivatePageProps) {
  const parameters = await searchParams;
  const status = firstValue(parameters.status);
  const error = firstValue(parameters.error);

  if (status === "check-email") {
    return (
      <MessageCard
        body="Vi har sendt en sikker engangslenke. Åpne e-posten på denne enheten for å fullføre."
        title="Sjekk e-posten din"
      />
    );
  }

  if (error) {
    return (
      <MessageCard
        body={errorMessages[error] ?? errorMessages.invalid}
        title="Aktiveringen stoppet"
      />
    );
  }

  const rawToken = firstValue(parameters.token);

  if (!rawToken || rawToken.length < 20) {
    return (
      <MessageCard body={errorMessages.invalid} title="Ugyldig invitasjon" />
    );
  }

  const adminClient = createSupabaseAdminClient();
  const repository = new SupabaseInvitationRepository(adminClient, adminClient);
  const invitation = await repository.inspectByHash({
    tokenHash: hashInvitationToken(rawToken),
    now: new Date(),
  });

  if (!invitation || invitation.claimState !== "valid") {
    const reason = invitation?.claimState ?? "invalid";
    return (
      <MessageCard
        body={errorMessages[reason] ?? errorMessages.invalid}
        title="Invitasjonen kan ikke brukes"
      />
    );
  }

  return (
    <main className={styles.shell} id="main-content">
      <section className={styles.card}>
        <p className={styles.eyebrow}>Nivå · trenerutdanning</p>
        <h1>Aktiver tilgangen din</h1>
        <p className={styles.lead}>
          Vi sender en sikker engangslenke til{" "}
          <strong>{maskEmail(invitation.normalizedEmail)}</strong>.
        </p>
        <form action={requestInvitationSignIn} className={styles.actions}>
          <input name="token" type="hidden" value={rawToken} />
          <Button priority="primary" type="submit">
            Send innloggingslenke
          </Button>
        </form>
        <p className={styles.help}>
          Du trenger ikke passord. Lenken virker bare én gang og må åpnes innen
          kort tid.
        </p>
      </section>
    </main>
  );
}
