import { authorizeCmsItem, requireCmsSession, requireCmsStaff } from "./auth";
import {
  completeCmsAttachment,
  downloadCmsAttachment,
  prepareCmsAttachment,
  readCmsMultipart,
  uploadCmsAttachment,
} from "./attachments";
import { loadCmsCatalog, loadCmsEditor } from "./data";
import { assertCmsQuery, CmsError, cmsErrorResponse } from "./errors";
import {
  assertCmsMutationOrigin,
  AttachmentUploadInput,
  CmsId,
  CreateItemInput,
  PublishItemInput,
  readCmsJson,
  RestoreItemInput,
  SaveItemInput,
  VariantInput,
} from "./validation";

type ItemContext = { params: Promise<{ itemId: string }> };
type AttachmentContext = { params: Promise<{ attachmentId: string }> };
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

export async function cmsCatalogGET() {
  try {
    return json(await loadCmsCatalog(await requireCmsSession()));
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
export async function cmsItemsPOST(request: Request) {
  try {
    assertCmsMutationOrigin(request);
    const session = await requireCmsSession();
    if (!session.isGlobalManager)
      throw new CmsError(
        403,
        "Bare redaktører og administratorer kan opprette felles innhold.",
      );
    const input = CreateItemInput.parse(await readCmsJson(request));
    const result = await session.client.rpc("cms_create_item", {
      next_title: input.title,
      next_level: input.level,
      next_document: input.document,
    });
    assertCmsQuery(result.error);
    return json({ itemId: result.data }, 201);
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
export async function cmsItemGET(_request: Request, context: ItemContext) {
  try {
    const { itemId } = await context.params;
    return json(
      await loadCmsEditor(await requireCmsSession(), CmsId.parse(itemId)),
    );
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
export async function cmsItemPUT(request: Request, context: ItemContext) {
  try {
    assertCmsMutationOrigin(request);
    const session = await requireCmsSession();
    const itemId = CmsId.parse((await context.params).itemId);
    await authorizeCmsItem(session, itemId);
    const input = SaveItemInput.parse(await readCmsJson(request));
    const result = await session.client.rpc("cms_save_draft", {
      target_item_id: itemId,
      next_title: input.title,
      next_document: input.document,
      expected_updated_at: input.expectedUpdatedAt,
      save_note: input.changeNote,
    });
    assertCmsQuery(result.error);
    return json(await loadCmsEditor(session, itemId));
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
export async function cmsPublishPOST(request: Request, context: ItemContext) {
  try {
    assertCmsMutationOrigin(request);
    const session = await requireCmsSession();
    const itemId = CmsId.parse((await context.params).itemId);
    await authorizeCmsItem(session, itemId);
    const input = PublishItemInput.parse(await readCmsJson(request));
    const result = await session.client.rpc("cms_publish", {
      target_item_id: itemId,
      expected_updated_at: input.expectedUpdatedAt,
      publication_note: input.changeNote,
      target_course_run_ids: input.courseRunIds,
    });
    assertCmsQuery(result.error);
    return json(await loadCmsEditor(session, itemId));
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
export async function cmsRestorePOST(request: Request, context: ItemContext) {
  try {
    assertCmsMutationOrigin(request);
    const session = await requireCmsSession();
    const itemId = CmsId.parse((await context.params).itemId);
    await authorizeCmsItem(session, itemId);
    const input = RestoreItemInput.parse(await readCmsJson(request));
    const result = await session.client.rpc("cms_restore", {
      target_item_id: itemId,
      target_revision_id: input.revisionId,
      expected_updated_at: input.expectedUpdatedAt,
    });
    assertCmsQuery(result.error);
    return json(await loadCmsEditor(session, itemId));
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
export async function cmsVariantPOST(request: Request, context: ItemContext) {
  try {
    assertCmsMutationOrigin(request);
    const session = await requireCmsSession();
    requireCmsStaff(session);
    const itemId = CmsId.parse((await context.params).itemId);
    const input = VariantInput.parse(await readCmsJson(request));
    if (
      !session.isGlobalManager &&
      !session.courseIds.includes(input.courseRunId)
    )
      throw new CmsError(
        403,
        "Du kan bare lage varianter for kursene du underviser på.",
      );
    const result = await session.client.rpc("cms_create_variant", {
      target_item_id: itemId,
      target_course_id: input.courseRunId,
    });
    assertCmsQuery(result.error);
    return json({ itemId: result.data }, 201);
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
export async function cmsAttachmentsPOST(
  request: Request,
  context: ItemContext,
) {
  try {
    assertCmsMutationOrigin(request);
    const session = await requireCmsSession();
    const itemId = CmsId.parse((await context.params).itemId);
    await authorizeCmsItem(session, itemId);
    if (request.headers.get("content-type")?.startsWith("application/json")) {
      const input = AttachmentUploadInput.parse(await readCmsJson(request));
      if (input.phase === "prepare")
        return json(await prepareCmsAttachment(session, itemId, input), 201);
      return json(
        {
          attachment: await completeCmsAttachment(
            session,
            itemId,
            input.uploadId,
          ),
        },
        201,
      );
    }
    const attachment = await uploadCmsAttachment(
      session,
      itemId,
      await readCmsMultipart(request),
    );
    return json({ attachment }, 201);
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
export async function cmsAttachmentDownloadGET(
  _request: Request,
  context: AttachmentContext,
) {
  try {
    const session = await requireCmsSession();
    return await downloadCmsAttachment(
      session,
      CmsId.parse((await context.params).attachmentId),
    );
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
