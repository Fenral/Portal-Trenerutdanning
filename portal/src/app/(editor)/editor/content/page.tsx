import Link from "next/link";

import { loadContentCatalog } from "@/features/content/editor-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

export default async function ContentCatalogPage() {
  const catalog = await loadContentCatalog(await createSupabaseServerClient());

  return (
    <main className={styles.shell} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Pensum · hovedbibliotek</p>
          <h1>Innhold</h1>
          <p>
            Rediger kladden, publiser en låst versjon og velg hvilke aktive kull
            som skal oppgraderes.
          </p>
        </div>
        <span className={styles.countBadge}>
          {catalog.length} innholdselement
        </span>
      </header>

      <section className={styles.catalog} aria-label="Innholdsbibliotek">
        {catalog.map((item) => (
          <Link
            className={styles.catalogCard}
            href={`/editor/content/${item.id}`}
            key={item.id}
          >
            <span className={styles.kind}>{item.kind}</span>
            <h2>{item.heading}</h2>
            <p>{item.title}</p>
            <dl>
              <div>
                <dt>Publisert</dt>
                <dd>
                  {item.publishedRevision
                    ? `v${item.publishedRevision}`
                    : "Ikke publisert"}
                </dd>
              </div>
              <div>
                <dt>Kladd</dt>
                <dd>{item.draftRevision ? `v${item.draftRevision}` : "–"}</dd>
              </div>
              <div>
                <dt>Filer</dt>
                <dd>{item.resourceCount}</dd>
              </div>
            </dl>
            <small>
              Sist endret {dateFormatter.format(new Date(item.updatedAt))}
            </small>
          </Link>
        ))}
      </section>
    </main>
  );
}
