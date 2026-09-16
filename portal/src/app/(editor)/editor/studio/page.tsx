import { Library } from "@/features/cms/Library";
import { requireCmsSession } from "@/features/cms/server/auth";

export default async function StudioLibraryPage() {
  const session = await requireCmsSession();
  return <Library isGlobalManager={session.isGlobalManager} />;
}
