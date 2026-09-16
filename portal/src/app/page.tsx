import Link from "next/link";
import { requireCmsSession } from "@/features/cms/server/auth";
import styles from "@/features/cms/studio.module.css";
import { isDemoMode } from "@/lib/supabase/environment";

export default async function Home() {
  const session = await requireCmsSession().catch(() => null);
  const canOpenStudio = Boolean(
    session && (session.isGlobalManager || session.courseIds.length),
  );

  return (
    <main
      id="main-content"
      className={styles.root}
      style={{ maxWidth: 760, paddingTop: 80 }}
    >
      <p className={styles.eyebrow}>Trenerutdanning · Norges Golfforbund</p>
      <h1>Pensum som er klart for trenerhverdagen.</h1>
      <p className={styles.lead}>
        I Pensumverkstedet lager og tilpasser redaktører og kurslærere innhold
        til trenerutdanningen.
      </p>
      <div style={{ marginTop: 28 }}>
        <Link
          className="nivaa-button nivaa-button--primary"
          href={canOpenStudio ? "/editor/studio" : "/login"}
        >
          {canOpenStudio ? "Åpne Pensumverkstedet" : "Logg inn"}
        </Link>
      </div>
      {isDemoMode() && (
        <nav
          aria-label="Demo-roller"
          className={styles.createPanel}
          style={{ marginTop: 40 }}
        >
          <p className={styles.eyebrow}>Prøv demoen som</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            <Link href="/test-login?as=student-selma">Student</Link>
            <Link href="/test-login?as=teacher-t3">Kurslærer</Link>
            <Link href="/test-login?as=admin">Administrator</Link>
          </div>
        </nav>
      )}
    </main>
  );
}
