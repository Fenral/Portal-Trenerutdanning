import {
  ContentDocument,
  type ContentDocument as ContentDocumentValue,
} from "./document-schema";

export type DraftTextUpdate = Readonly<{
  currentDocument: unknown;
  heading: string;
  introduction: string;
  format: ContentDocumentValue["format"];
}>;

export function updateDraftDocument(
  input: DraftTextUpdate,
): ContentDocumentValue {
  const currentDocument = ContentDocument.parse(input.currentDocument);
  const headingIndex = currentDocument.blocks.findIndex(
    (block) => block.type === "heading",
  );
  const paragraphIndex = currentDocument.blocks.findIndex(
    (block) => block.type === "paragraph",
  );

  if (headingIndex === -1 || paragraphIndex === -1) {
    throw new Error("Kladden mangler redigerbar tittel eller ingress");
  }

  const blocks = currentDocument.blocks.map((block, index) => {
    if (index === headingIndex && block.type === "heading") {
      return { ...block, text: input.heading.trim() };
    }

    if (index === paragraphIndex && block.type === "paragraph") {
      return { ...block, text: input.introduction.trim() };
    }

    return block;
  });

  return ContentDocument.parse({
    ...currentDocument,
    format: input.format,
    blocks,
  });
}
