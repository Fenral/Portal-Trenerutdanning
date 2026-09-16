import { Studio } from "@/features/cms/Studio";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  return (
    <Studio
      itemId={itemId}
      aiAvailable={Boolean(process.env.OPENAI_API_KEY?.trim())}
    />
  );
}
