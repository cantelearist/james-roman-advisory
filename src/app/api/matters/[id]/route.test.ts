import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.fn();
const policyMocks = vi.hoisted(() => ({
  getPortalAccessSummary: vi.fn(),
  authorizeCapability: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  ensureVaultTables: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn(() => sql),
  logMatterEvent: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getAuthContext: authMocks.getAuthContext,
}));
vi.mock("@/lib/access-control", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/access-control")>();
  return {
    ...actual,
    getPortalAccessSummary: policyMocks.getPortalAccessSummary,
    authorizeCapability: policyMocks.authorizeCapability,
  };
});

import { GET } from "./route";

describe("Client engagement-file filtering", () => {
  beforeEach(() => {
    sql.mockReset();
    authMocks.getAuthContext.mockReset();
    policyMocks.getPortalAccessSummary.mockReset();
    policyMocks.authorizeCapability.mockReset();
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
