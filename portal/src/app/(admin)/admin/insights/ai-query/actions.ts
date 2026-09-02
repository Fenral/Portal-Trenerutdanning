"use server";

import { notFound } from "next/navigation";

import { can } from "@/features/access/permissions";
import { actorRoleFor } from "@/features/admin-query/authorize";
import {
  AdminQueryError,
  executeIntent,
  type AdminQueryAnswer,
} from "@/features/admin-query/execute-intent";
import { QueryIntent } from "@/features/admin-query/intents";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminQueryState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "answered"; answer: AdminQueryAnswer }>
  | Readonly<{ status: "error"; message: string }>;

/**
 * Kjører ett forhåndsdefinert, objektivt spørsmål. Kun administratorer
 * (can(role, "admin_query.run")) slipper til; alle andre får notFound().
 * Selve spørringen kjøres med den påloggede administratorens RLS-klient,
 * aldri admin-klienten.
 */
export async function runAdminQueryAction(
  _previous: AdminQueryState,
  formData: FormData,
): Promise<AdminQueryState> {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) notFound();

  const role = await actorRoleFor(user.id, createSupabaseAdminClient());
  if (!role || !can(role, "admin_query.run")) notFound();

  const intent = formData.get("intent");
  const courseRunId = formData.get("courseRunId");
  const parsed = QueryIntent.safeParse(
    intent === "t1_location_distribution"
      ? { intent }
      : { intent, filters: { courseRunId } },
  );
  if (!parsed.success) {
    return {
      status: "error",
      message: "Spørsmålet er ikke på listen over objektive spørsmål.",
    };
  }

  try {
    const answer = await executeIntent(serverClient, parsed.data);
    return { status: "answered", answer };
  } catch (error) {
    if (error instanceof AdminQueryError) {
      return { status: "error", message: error.message };
    }
    return {
      status: "error",
      message: "Spørringen kunne ikke fullføres. Prøv igjen.",
    };
  }
}
