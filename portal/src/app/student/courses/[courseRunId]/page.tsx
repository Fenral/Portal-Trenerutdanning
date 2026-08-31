import { notFound } from "next/navigation";

import { LearningOverview } from "@/features/learning/LearningOverview";
import { loadStudentLearningPath } from "@/features/learning/student-learning-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ courseRunId: string }>;
}>;

export default async function StudentCoursePage({ params }: PageProps) {
  const { courseRunId } = await params;
  const client = await createSupabaseServerClient();
  const learningPath = await loadStudentLearningPath(client, courseRunId);

  if (!learningPath) notFound();

  return <LearningOverview learningPath={learningPath} />;
}
