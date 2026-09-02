import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ rpc })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { anonymizePersonAction } from "@/app/(admin)/admin/people/duplicates/actions";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const validFields = {
  profileId: "profile-1",
  caseReference: "SAK-2026-014",
  approverProfileId: "approver-1",
};

describe("anonymizePersonAction confirmation (WCAG 3.3.4)", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("rejects submission without explicit confirmation and never calls the RPC", async () => {
    await expect(anonymizePersonAction(formData(validFields))).rejects.toThrow(
      "REDIRECT:/admin/people/duplicates?notice=anonymize-confirm-required",
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("proceeds when confirmation checkbox value is present", async () => {
    await expect(
      anonymizePersonAction(formData({ ...validFields, confirm: "yes" })),
    ).rejects.toThrow("REDIRECT:/admin/people/duplicates?notice=anonymize-ok");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
