import { describe, expect, it } from "vitest";

import {
  canReceiveAudience,
  hasCapability,
  profileCapabilityCeiling,
  type PortalAccessSummary,
} from "@/lib/access-control";

function summary(
  role: PortalAccessSummary["role"],
  capabilities: PortalAccessSummary["capabilities"] = [],
  scope: PortalAccessSummary["scope"] = "assigned",
): PortalAccessSummary {
  return { role, capabilities, scope, permissionProfile: null };
}

describe("Private Office capability policy", () => {
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
