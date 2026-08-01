import { describe, expect, it } from "vitest";

import {
  canReceiveAudience,
  hasCapability,
  profileCapabilityCeiling,
  type PortalAccessSummary,
} from "@/lib/access-control";
import { CAPABILITIES } from "@/lib/data-model";
import {
  ROLE_PERMISSION_MATRIX,
  SUPER_ADMIN_ONLY_CAPABILITIES,
} from "@/lib/permission-policy";

function summary(
  role: PortalAccessSummary["role"],
  capabilities: PortalAccessSummary["capabilities"] = [],
  scope: PortalAccessSummary["scope"] = "assigned",
): PortalAccessSummary {
  return { role, capabilities, scope, permissionProfile: null };
}

describe("Private Office capability policy", () => {
  it("defines one complete policy entry for every role", () => {
    expect(Object.keys(ROLE_PERMISSION_MATRIX).sort()).toEqual([
      "admin",
      "client",
      "contractor",
      "super_admin",
    ]);
    expect(ROLE_PERMISSION_MATRIX.super_admin.defaultCapabilities).toEqual(CAPABILITIES);
    expect(ROLE_PERMISSION_MATRIX.super_admin.scope).toBe("global");
    expect(ROLE_PERMISSION_MATRIX.client.scope).toBe("assigned");
    expect(ROLE_PERMISSION_MATRIX.contractor.scope).toBe("assigned");
    expect(ROLE_PERMISSION_MATRIX.admin.scope).toBe("configurable");
  });

  it("keeps every default profile inside its role ceiling", () => {
    for (const role of ["admin", "contractor"] as const) {
      const policy = ROLE_PERMISSION_MATRIX[role];
      expect(policy.authority).toBe("profile");
      for (const capability of policy.defaultCapabilities) {
        expect(policy.capabilityCeiling, `${role}: ${capability}`).toContain(capability);
      }
    }
  });

  it("reserves access and workspace settings for Super Admin", () => {
    expect(SUPER_ADMIN_ONLY_CAPABILITIES).toEqual(["access.manage", "settings.manage"]);
    for (const role of ["admin", "contractor", "client"] as const) {
      expect(ROLE_PERMISSION_MATRIX[role].capabilityCeiling).not.toContain("access.manage");
      expect(ROLE_PERMISSION_MATRIX[role].capabilityCeiling).not.toContain("settings.manage");
    }
  });

  it("gives Super Admin authority regardless of profile capabilities", () => {
    const access = summary("super_admin", [], "global");
    expect(hasCapability(access, "access.manage")).toBe(true);
    expect(hasCapability(access, "finance.manage")).toBe(true);
    expect(hasCapability(access, "documents.delete")).toBe(true);
  });

  it("limits Admin and Contractor authority to their assigned capabilities", () => {
    const admin = summary("admin", ["engagements.view", "finance.view"], "global");
    const contractor = summary("contractor", ["engagements.view", "documents.upload"]);

    expect(hasCapability(admin, "finance.view")).toBe(true);
    expect(hasCapability(admin, "finance.manage")).toBe(false);
    expect(hasCapability(contractor, "documents.upload")).toBe(true);
    expect(hasCapability(contractor, "clients.manage")).toBe(false);
  });

  it("does not let a Client inherit staff operations", () => {
    const client = summary("client", ["engagements.view", "documents.view"]);
    expect(hasCapability(client, "engagements.view")).toBe(true);
    expect(hasCapability(client, "engagements.update")).toBe(false);
    expect(hasCapability(client, "access.manage")).toBe(false);
  });

  it("keeps Contractor profiles below the external-collaborator ceiling", () => {
    const ceiling = profileCapabilityCeiling("contractor");
    expect(ceiling).toContain("documents.upload");
    expect(ceiling).toContain("messages.send");
    expect(ceiling).not.toContain("users.invite");
    expect(ceiling).not.toContain("clients.manage");
    expect(ceiling).not.toContain("finance.manage");
    expect(ceiling).not.toContain("access.manage");
  });
});

describe("Private Office resource audiences", () => {
  it("lets internal operators receive every audience", () => {
    for (const role of ["super_admin", "admin"] as const) {
      expect(canReceiveAudience(role, "internal")).toBe(true);
      expect(canReceiveAudience(role, "contractor", "pending_review")).toBe(true);
      expect(canReceiveAudience(role, "client")).toBe(true);
    }
  });

  it("limits Contractors to contractor material and published client material", () => {
    expect(canReceiveAudience("contractor", "internal")).toBe(false);
    expect(canReceiveAudience("contractor", "contractor", "pending_review")).toBe(true);
    expect(canReceiveAudience("contractor", "client", "published")).toBe(true);
    expect(canReceiveAudience("contractor", "client", "pending_review")).toBe(false);
  });

  it("limits Clients to published client material", () => {
    expect(canReceiveAudience("client", "internal")).toBe(false);
    expect(canReceiveAudience("client", "contractor")).toBe(false);
    expect(canReceiveAudience("client", "client", "pending_review")).toBe(false);
    expect(canReceiveAudience("client", "client", "published")).toBe(true);
  });
});
