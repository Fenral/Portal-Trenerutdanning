import { describe, expect, it } from "vitest";

import {
  CURRENT_DIPLOMA_TEMPLATE_VERSION,
  diplomaStoragePath,
  needsDiplomaRefresh,
  type CertificateRecord,
} from "@/features/completion/diploma-storage";

const certificate: CertificateRecord = {
  id: "certificate-1",
  course_run_id: "course-1",
  certificate_number: "NGF-2027-1",
  template_version: "digital-v1",
  display_name: "Ada Nordmann",
  course_title: "Trener 3 · 2027–2028",
  completed_on: "2028-03-19",
  storage_path: "course-1/certificate-1/diplom.pdf",
  sha256: "a".repeat(64),
};

describe("diploma storage versioning", () => {
  it("refreshes a previously generated diploma when the official template changes", () => {
    expect(needsDiplomaRefresh(certificate)).toBe(true);
  });

  it("reuses a complete diploma generated with the current official template", () => {
    expect(
      needsDiplomaRefresh({
        ...certificate,
        template_version: CURRENT_DIPLOMA_TEMPLATE_VERSION,
        storage_path: diplomaStoragePath(certificate),
      }),
    ).toBe(false);
  });

  it("uses a versioned path so the old generated file stays recoverable", () => {
    expect(diplomaStoragePath(certificate)).toContain(
      CURRENT_DIPLOMA_TEMPLATE_VERSION,
    );
  });
});
