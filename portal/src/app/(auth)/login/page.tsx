import Link from "next/link";
import { isDemoMode } from "@/lib/supabase/environment";
import styles from "@/features/cms/studio.module.css";
import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main
      id="main-content"
      className={styles.root}
      style={{ maxWidth: 540, paddingTop: 80 }}
    >
      <p className={styles.eyebrow}>Trenerutdanning · Pensumverkstedet</p>
      <h1>Logg inn og fortsett.</h1>
      <p className={styles.lead}>
        Bruk kontoen du har fått tilgang til trenerutdanningen med.
      </p>
      {error && (
        <div className={styles.error} role="alert">
          E-post eller passord stemmer ikke. Prøv igjen.
        </div>
      )}
      <form
        action={loginAction}
        className={styles.fieldStack}
        style={{ marginTop: 28 }}
      >
        <label>
          E-post
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Passord
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="nivaa-button nivaa-button--primary">Logg inn</button>
      </form>
      {isDemoMode() && (
        <p className={styles.muted}>
          Prøver du systemet?{" "}
          <Link href="/test-login?as=admin">Åpne som demoadministrator</Link>.
        </p>
      )}
    </main>
  );
}
