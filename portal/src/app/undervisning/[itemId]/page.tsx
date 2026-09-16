import Link from "next/link";
import { notFound } from "next/navigation";

import {
  loadPublishedContent,
  PublishedContent,
} from "@/features/cms/PublishedContent";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "@/features/cms/published.module.css";

export const dynamic = "force-dynamic";

export default async function TeachingContentPage({
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
    <main id="main-content" className={`${styles.page} ${styles.teaching}`}>
      <nav className={styles.navigation} aria-label="Undervisningsnavigasjon">
        <Link
          href={`/pensum/${itemId}${courseRunId ? `?courseRunId=${courseRunId}` : ""}`}
        >
          ← Les pensumversjonen
        </Link>
        <small>
          Publisert versjon {content.revisionNumber} · {content.courseTitle}
        </small>
      </nav>
      <h1>{content.item.title}</h1>
      <PublishedContent content={content} teaching />
    </main>
  );
}
