import Link from "next/link";
import { notFound } from "next/navigation";

import { loadStudentContentCatalog } from "@/features/content/student-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "@/features/cms/published.module.css";

export const dynamic = "force-dynamic";

export default async function PublishedContentCatalogPage() {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) notFound();

  const items = await loadStudentContentCatalog(client);

  return (
    <main id="main-content" className={styles.page}>
      <nav className={styles.navigation}>
        <Link href="/">← Trenerutdanning</Link>
      </nav>
      <header className={styles.header}>
        <p>Trenerutdanning · Felles innhold</p>
        <h1>Pensum</h1>
      </header>
      {items.length ? (
        <ul className={styles.catalog}>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/pensum/${item.id}`}>{item.heading}</Link>
              <p>{item.introduction}</p>
              <small>{item.courseTitle}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>Ingen publiserte pensumelementer er tilgjengelige for deg.</p>
      )}
    </main>
  );
}
