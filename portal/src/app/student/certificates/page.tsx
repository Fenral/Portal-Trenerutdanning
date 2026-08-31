import { CertificateCelebration } from "@/features/completion/CertificateCelebration";
import {
  type CertificateRecord,
  ensureDiplomaStored,
} from "@/features/completion/diploma-storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

export default async function CertificatesPage() {
  const client = await createSupabaseServerClient();
  const certificates = await client
    .from("certificates")
    .select(
      "id,course_run_id,certificate_number,template_version,display_name,course_title,completed_on,storage_path,sha256",
    )
    .order("completed_on", { ascending: false });

  if (certificates.error) throw new Error(certificates.error.message);

  const rows = (certificates.data ?? []) as CertificateRecord[];
  const adminClient = createSupabaseAdminClient();
  const diplomas = await Promise.all(
    rows.map(async (certificate) => {
      const stored = await ensureDiplomaStored(adminClient, certificate);
      const signedUrl = await client.storage
        .from("certificates")
        .createSignedUrl(stored.path, 60 * 15, {
          download: `Diplom-${certificate.certificate_number}.pdf`,
        });
      if (signedUrl.error) throw new Error(signedUrl.error.message);

      return { certificate, url: signedUrl.data.signedUrl };
    }),
  );

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <span className={styles.eyebrow}>Dokumentasjon</span>
        <h1>Mine diplomer</h1>
        <p>Fullførte trenerutdanninger samles her og kan lastes ned på nytt.</p>
      </header>

      {diplomas[0] ? (
        <CertificateCelebration
          certificateId={diplomas[0].certificate.id}
          displayName={diplomas[0].certificate.display_name}
        />
      ) : null}

      {diplomas.length === 0 ? (
        <section className={styles.emptyState}>
          <span aria-hidden="true">◇</span>
          <h2>Veggen venter på ditt første diplom</h2>
          <p>Diplomet kommer hit automatisk når alle kurskrav er godkjent.</p>
        </section>
      ) : (
        <section aria-label="Diplomveggen" className={styles.wall}>
          {diplomas.map(({ certificate, url }) => (
            <article className={styles.frame} key={certificate.id}>
              <div className={styles.diploma}>
                <span className={styles.wordmark}>TRENERLØFTET</span>
                <strong>DIPLOM</strong>
                <small>tildeles</small>
                <b>{certificate.display_name}</b>
                <span>{certificate.course_title}</span>
              </div>
              <div className={styles.details}>
                <span>
                  <strong>{certificate.course_title}</strong>
                  <small>Fullført {formatDate(certificate.completed_on)}</small>
                </span>
                <a className="nivaa-button nivaa-button--secondary" href={url}>
                  Last ned PDF
                </a>
              </div>
              <small className={styles.number}>
                Diplomnr. {certificate.certificate_number}
              </small>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
