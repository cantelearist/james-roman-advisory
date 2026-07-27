import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { renderRcaPdf } from "./pdf";

describe("RCA PDF renderer", () => {
  it("returns valid PDF bytes for a styled document", async () => {
    const bytes = await renderRcaPdf({
      title: "Remediation Oversight Brief",
      subtitle: "Private engagement record",
      reference: "JRA-2026-TEST",
      generatedAt: "2026-07-25",
      sections: [
        { heading: "Scope", body: "Independent review of the remediation plan." },
        { heading: "Next actions", body: ["Confirm contractor insurance", "Schedule site review"] },
      ],
    });

    expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe("%PDF-1.7");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(bytes.byteLength).toBeGreaterThan(500);
  });

  it("creates additional pages for long sections", async () => {
    const bytes = await renderRcaPdf({
      title: "Long Form Record",
      sections: [{ heading: "Evidence", body: Array.from({ length: 80 }, (_, i) => `Evidence item ${i + 1} with review notes.`) }],
    });

    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThan(1);
  });
});
