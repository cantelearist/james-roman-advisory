import { describe, expect, it } from "vitest";

import { canCreateSignedDownload, decidePostUploadReview } from "./scanning";

describe("document scanning and quarantine policy", () => {
  it("keeps completed uploads unavailable until manual review or scanning clears them", () => {
    expect(decidePostUploadReview()).toEqual({
      status: "scan_pending",
      clientVisible: false,
      requiresAdvisorReview: true,
      reason: "manual_quarantine",
    });
  });

  it("creates signed downloads only for available documents", () => {
    expect(canCreateSignedDownload("available")).toBe(true);
    expect(canCreateSignedDownload("pending_upload")).toBe(false);
    expect(canCreateSignedDownload("scan_pending")).toBe(false);
    expect(canCreateSignedDownload("quarantined")).toBe(false);
    expect(canCreateSignedDownload("scan_failed")).toBe(false);
    expect(canCreateSignedDownload("archived")).toBe(false);
    expect(canCreateSignedDownload("deleted")).toBe(false);
  });
});
