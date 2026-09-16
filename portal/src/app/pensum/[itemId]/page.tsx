import Link from "next/link";
import { notFound } from "next/navigation";

import {
  loadPublishedContent,
  PublishedContent,
} from "@/features/cms/PublishedContent";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "@/features/cms/published.module.css";

export const dynamic = "force-dynamic";

export default async function PublishedContentPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ itemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const [{ itemId }, query] = await Promise.all([params, searchParams]);
  const courseRunId =
    typeof query.courseRunId === "string" ? query.courseRunId : undefined;
  const content = await loadPublishedContent(
    await createSupabaseServerClient(),
    itemId,
    courseRunId,
  );
  if (!content) notFound();

  return (
    <main id="main-content" className={styles.page}>
      <nav className={styles.navigation} aria-label="Pensumnavigasjon">
        <Link href="/pensum">← Til pensum</Link>
        <Link
          href={`/undervisning/${itemId}${courseRunId ? `?courseRunId=${courseRunId}` : ""}`}
        >
          Start undervisning →
        </Link>
      </nav>
      <header className={styles.header}>
        <p>{content.courseTitle}</p>
        <h1>{content.item.title}</h1>
        <small>Publisert versjon {content.revisionNumber}</small>
      </header>
      <PublishedContent content={content} />
    </main>
  );
}
