import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  buildDiplomaContent,
  diplomaTemplateForCourse,
  generateDiploma,
} from "@/features/completion/generate-diploma";

const diplomaInput = {
  templateVersion: "demo-v1",
  displayName: "Selma Dahl",
  courseTitle: "Trener 3 2027",
  completedOn: "2027-12-18",
  certificateNumber: "T3-2027-0001",
} as const;

describe("generateDiploma", () => {
  it.each([
    ["Trener 1 · Oslo GK", "trener-1.jpg"],
    ["Trener 2 · 2027", "trener-2.jpg"],
    ["PGA Coach – Trener 3 · 2027–2028", "trener-3.jpg"],
  ])("uses the official level template for %s", (courseTitle, filename) => {
    expect(diplomaTemplateForCourse(courseTitle).filename).toBe(filename);
  });

  it("renders the exact recipient and course in a valid one-page PDF", async () => {
    const content = buildDiplomaContent(diplomaInput);
    const bytes = await generateDiploma(diplomaInput);
    const pdf = await PDFDocument.load(bytes);

    expect(new TextDecoder().decode(bytes.slice(0, 8))).toMatch(/^%PDF-/);
    expect(content).toMatchObject({
      recipient: "Selma Dahl",
      course: "Trener 3 2027",
    });
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
    expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89, 1);
    expect(pdf.getTitle()).toBe("Diplom - Selma Dahl");
    expect(pdf.getSubject()).toContain("Selma Dahl");
    expect(pdf.getSubject()).toContain("Trener 3 2027");
  });

  it("rejects a certificate without a supported trainer level", () => {
    expect(() => diplomaTemplateForCourse("Etterutdanning 2027")).toThrow(
      "DIPLOMA_LEVEL_NOT_SUPPORTED",
    );
  });

  it("is byte-for-byte deterministic for the same certificate input", async () => {
    const first = await generateDiploma(diplomaInput);
    const second = await generateDiploma(diplomaInput);

    expect(second).toEqual(first);
  });
});
