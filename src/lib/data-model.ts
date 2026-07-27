export const USER_ROLES = ["super_admin", "admin", "contractor", "client"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CAPABILITIES = [
  "users.invite",
  "access.manage",
  "clients.view",
  "clients.manage",
  "engagements.view",
  "engagements.create",
  "engagements.update",
  "engagements.assign",
  "documents.view",
  "documents.upload",
  "documents.publish",
  "documents.delete",
  "documents.generate_pdf",
  "timeline.view",
  "timeline.internal_view",
  "timeline.manage",
  "messages.view",
  "messages.send",
  "messages.internal_view",
  "contracts.view",
  "contracts.manage",
  "finance.view",
  "finance.manage",
  "audit.view",
  "settings.manage",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type AccessScope = "global" | "assigned";
export type ResourceAudience = "internal" | "contractor" | "client";
export type EngagementStatus = "screening" | "active" | "paused" | "closed";
export type DocumentClassification = "endorsement" | "inspection" | "report" | "contract" | "invoice";

export type EngagementRecord = {
  id: string;
  clientId: string;
  status: EngagementStatus;
  jurisdiction: string;
  scope: string;
  primaryAdvisorId: string;
  createdAt: string;
};

export type PortalAccessBoundary = {
  engagementId: string;
  userId: string;
  role: UserRole;
  capabilities: Capability[];
  scope: AccessScope;
};

export type AuditEvent = {
  id: string;
  actorId: string;
  action: string;
  resourceType: "engagement" | "document" | "invoice" | "message" | "request" | "ai";
  resourceId: string;
  ipHash: string;
  userAgentHash: string;
  createdAt: string;
};
