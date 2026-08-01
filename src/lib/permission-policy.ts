import {
  CAPABILITIES,
  type AccessScope,
  type Capability,
  type UserRole,
} from "@/lib/data-model";

export const CLIENT_CAPABILITIES: readonly Capability[] = [
  "clients.view",
  "engagements.view",
  "documents.view",
  "documents.upload",
  "timeline.view",
  "messages.view",
  "messages.send",
  "contracts.view",
  "finance.view",
];

export const SUPER_ADMIN_ONLY_CAPABILITIES: readonly Capability[] = [
  "access.manage",
  "settings.manage",
];

export const ADMIN_PROFILE_CAPABILITIES: readonly Capability[] = CAPABILITIES.filter(
  (capability) => !SUPER_ADMIN_ONLY_CAPABILITIES.includes(capability),
);

export const ADMIN_DEFAULT_CAPABILITIES: readonly Capability[] = [
  "users.invite",
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
];

export const CONTRACTOR_PROFILE_CAPABILITIES: readonly Capability[] = [
  "engagements.view",
  "engagements.update",
  "documents.view",
  "documents.upload",
  "documents.generate_pdf",
  "timeline.view",
  "timeline.manage",
  "messages.view",
  "messages.send",
  "contracts.view",
  "finance.view",
];

export const CONTRACTOR_DEFAULT_CAPABILITIES: readonly Capability[] = [
  "engagements.view",
  "documents.view",
  "documents.upload",
  "timeline.view",
  "timeline.manage",
  "messages.view",
  "messages.send",
];

type RolePermissionPolicy = {
  authority: "fixed" | "profile";
  scope: AccessScope | "configurable";
  defaultCapabilities: readonly Capability[];
  capabilityCeiling: readonly Capability[];
};

export const ROLE_PERMISSION_MATRIX = {
  super_admin: {
    authority: "fixed",
    scope: "global",
    defaultCapabilities: CAPABILITIES,
    capabilityCeiling: CAPABILITIES,
  },
  admin: {
    authority: "profile",
    scope: "configurable",
    defaultCapabilities: ADMIN_DEFAULT_CAPABILITIES,
    capabilityCeiling: ADMIN_PROFILE_CAPABILITIES,
  },
  contractor: {
    authority: "profile",
    scope: "assigned",
    defaultCapabilities: CONTRACTOR_DEFAULT_CAPABILITIES,
    capabilityCeiling: CONTRACTOR_PROFILE_CAPABILITIES,
  },
  client: {
    authority: "fixed",
    scope: "assigned",
    defaultCapabilities: CLIENT_CAPABILITIES,
    capabilityCeiling: CLIENT_CAPABILITIES,
  },
} as const satisfies Record<UserRole, RolePermissionPolicy>;

export function profileCapabilityCeiling(
  role: "admin" | "contractor",
): readonly Capability[] {
  return ROLE_PERMISSION_MATRIX[role].capabilityCeiling;
}
