import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.fn();
const policyMocks = vi.hoisted(() => ({
  getPortalAccessSummary: vi.fn(),
  authorizeCapability: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
}));
const dbMocks = vi.hoisted(() => ({
  logMatterEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => sql),
  logMatterEvent: dbMocks.logMatterEvent,
}));
vi.mock("@/lib/schema-readiness", () => ({
  assertRequiredSchemaVersions: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/auth", () => ({
  getAuthContext: authMocks.getAuthContext,
}));
vi.mock("@/lib/automations", () => ({
  triggerPortalAutomations: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/access-control", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/access-control")>();
  return {
    ...actual,
    getPortalAccessSummary: policyMocks.getPortalAccessSummary,
    authorizeCapability: policyMocks.authorizeCapability,
  };
});

import { GET, PATCH } from "./route";

describe("Client engagement-file filtering", () => {
  beforeEach(() => {
    sql.mockReset();
    authMocks.getAuthContext.mockReset();
    policyMocks.getPortalAccessSummary.mockReset();
    policyMocks.authorizeCapability.mockReset();
    dbMocks.logMatterEvent.mockReset();
  });

  it("removes internal notes, events, and documents from a client response", async () => {
    authMocks.getAuthContext.mockResolvedValue({
      userId: "client-1",
      role: "client",
      user: {
        id: "client-1",
        name: "Private Client",
        email: "client@example.com",
        role: "client",
      },
    });
    policyMocks.getPortalAccessSummary.mockResolvedValue({
      role: "client",
      capabilities: ["engagements.view", "documents.view", "timeline.view"],
      scope: "assigned",
      permissionProfile: null,
    });
    policyMocks.authorizeCapability.mockResolvedValue(true);
    sql
      .mockResolvedValueOnce([{
        id: "engagement-1",
        client_id: "client-record-1",
        title: "Private engagement",
        notes: "Internal negotiation strategy",
        client_name: "Private Client",
        client_email: "client@example.com",
        client_phone: "310-555-0100",
      }])
      .mockResolvedValueOnce([
        { id: "event-internal", visibility: "internal", event_type: "note_added", content: "Internal note" },
        { id: "event-client", visibility: "client", event_type: "status_changed", content: "Published update" },
      ])
      .mockResolvedValueOnce([
        {
          id: "doc-internal",
          visibility: "internal",
          publication_status: "published",
          name: "Internal redline",
        },
        {
          id: "doc-pending",
          visibility: "client",
          publication_status: "pending_review",
          name: "Pending report",
        },
        {
          id: "doc-client",
          visibility: "client",
          publication_status: "published",
          name: "Published report",
        },
      ]);

    const response = await GET(
      new Request("http://localhost/api/matters/engagement-1"),
      { params: Promise.resolve({ id: "engagement-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.matter.notes).toBeNull();
    expect(body.events.map((event: { id: string }) => event.id)).toEqual(["event-client"]);
    expect(body.documents.map((document: { id: string }) => document.id)).toEqual(["doc-client"]);
  });

  it("returns 404 when the membership policy denies the engagement", async () => {
    authMocks.getAuthContext.mockResolvedValue({
      userId: "client-1",
      role: "client",
      user: {
        id: "client-1",
        name: "Private Client",
        email: "client@example.com",
        role: "client",
      },
    });
    policyMocks.getPortalAccessSummary.mockResolvedValue({
      role: "client",
      capabilities: ["engagements.view"],
      scope: "assigned",
      permissionProfile: null,
    });
    policyMocks.authorizeCapability.mockResolvedValue(false);

    const response = await GET(
      new Request("http://localhost/api/matters/other-engagement"),
      { params: Promise.resolve({ id: "other-engagement" }) },
    );

    expect(response.status).toBe(404);
    expect(sql).not.toHaveBeenCalled();
  });
});

describe("Engagement workflow transition gates", () => {
  beforeEach(() => {
    sql.mockReset();
    authMocks.getAuthContext.mockReset();
    policyMocks.getPortalAccessSummary.mockReset();
    policyMocks.authorizeCapability.mockReset();
    dbMocks.logMatterEvent.mockReset();
    authMocks.getAuthContext.mockResolvedValue({
      userId: "admin-1",
      role: "admin",
      user: { id: "admin-1", name: "Admin", email: "admin@example.com", role: "admin" },
    });
    policyMocks.getPortalAccessSummary.mockResolvedValue({
      role: "admin",
      capabilities: ["engagements.view", "engagements.update"],
      scope: "global",
      permissionProfile: null,
    });
    policyMocks.authorizeCapability.mockResolvedValue(true);
  });

  it("refuses to advance when required persisted work remains unresolved", async () => {
    sql
      .mockResolvedValueOnce([{ id: "matter-1", status: "assessment", version: 3 }])
      .mockResolvedValueOnce([{ value: { requireWorkflowGates: true } }])
      .mockResolvedValueOnce([{ id: "item-1", title: "Publish assessment evidence", status: "pending", stage_key: "assessment" }]);

    const response = await PATCH(
      new Request("http://localhost/api/matters/matter-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "review", version: 3 }),
      }),
      { params: Promise.resolve({ id: "matter-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.blockers).toEqual([
      { id: "item-1", title: "Publish assessment evidence", status: "pending", stage_key: "assessment" },
    ]);
    expect(body.overrideAvailable).toBe(false);
    expect(sql).toHaveBeenCalledTimes(3);
  });

  it("allows a documented Super Admin override and records its reason", async () => {
    authMocks.getAuthContext.mockResolvedValue({
      userId: "super-1",
      role: "super_admin",
      user: { id: "super-1", name: "Super Admin", email: "super@example.com", role: "super_admin" },
    });
    policyMocks.getPortalAccessSummary.mockResolvedValue({
      role: "super_admin",
      capabilities: [],
      scope: "global",
      permissionProfile: null,
    });
    sql
      .mockResolvedValueOnce([{ id: "matter-1", status: "assessment", version: 3 }])
      .mockResolvedValueOnce([{ value: { requireWorkflowGates: true } }])
      .mockResolvedValueOnce([{ id: "item-1", title: "Publish assessment evidence", status: "blocked", stage_key: "assessment" }])
      .mockResolvedValueOnce([{ id: "matter-1", status: "review", version: 4 }]);

    const response = await PATCH(
      new Request("http://localhost/api/matters/matter-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "review",
          version: 3,
          overrideReason: "Client directed an immediate review.",
        }),
      }),
      { params: Promise.resolve({ id: "matter-1" }) },
    );

    expect(response.status).toBe(200);
    expect(dbMocks.logMatterEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "workflow_override",
      metadata: expect.objectContaining({
        reason: "Client directed an immediate review.",
        incompleteItemIds: ["item-1"],
      }),
    }));
  });

  it("refuses to skip unresolved requirements in intermediate stages", async () => {
    sql
      .mockResolvedValueOnce([{ id: "matter-1", status: "assessment", version: 3 }])
      .mockResolvedValueOnce([{ value: { requireWorkflowGates: true } }])
      .mockResolvedValueOnce([
        { id: "item-current", title: "Assessment complete", status: "completed", stage_key: "assessment" },
        { id: "item-review", title: "Recommendation approved", status: "pending", stage_key: "review" },
        { id: "item-target", title: "Field progress documented", status: "pending", stage_key: "oversight" },
      ]);

    const response = await PATCH(
      new Request("http://localhost/api/matters/matter-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "oversight", version: 3 }),
      }),
      { params: Promise.resolve({ id: "matter-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.blockers).toEqual([
      { id: "item-review", title: "Recommendation approved", status: "pending", stage_key: "review" },
    ]);
  });

  it("rejects stale inline edits with an optimistic concurrency conflict", async () => {
    sql
      .mockResolvedValueOnce([{ id: "matter-1", status: "assessment", version: 4 }])
      .mockResolvedValueOnce([{ value: { requireWorkflowGates: true } }])
      .mockResolvedValueOnce([]);

    const response = await PATCH(
      new Request("http://localhost/api/matters/matter-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: "urgent", version: 3 }),
      }),
      { params: Promise.resolve({ id: "matter-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("version_conflict");
  });
});
