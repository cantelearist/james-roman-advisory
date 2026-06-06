import type { DocumentStatus } from "@/lib/crm/types";

export type UploadReviewDecision = {
  status: DocumentStatus;
  clientVisible: boolean;
  requiresAdvisorReview: boolean;
  reason: "manual_quarantine";
};

export function decidePostUploadReview(): UploadReviewDecision {
  return {
    status: "scan_pending",
    clientVisible: false,
    requiresAdvisorReview: true,
    reason: "manual_quarantine",
  };
}

export function canCreateSignedDownload(status: DocumentStatus) {
  return status === "available";
}
