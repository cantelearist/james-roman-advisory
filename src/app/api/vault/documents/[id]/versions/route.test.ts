import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.fn();
const authMocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
}));
const accessMocks = vi.hoisted(() => ({
  getPortalAccessSummary: vi.fn(),
  authorizeCapability: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: authMocks.getAuthContext,
}));
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => sql),
  logFileAccess: vi.fn(),
}));
vi.mock("@/lib/schema-readiness", () => ({
  assertRequiredSchemaVersions: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/access-control", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/access-control")>();
  return {
    ...actual,
    getPortalAccessSummary: accessMocks.getPortalAccessSummary,
    authorizeCapability: accessMocks.authorizeCapability,
  };
});
vi.mock("@/lib/automations", () => ({
  triggerPortalAutomations: vi.fn(),
}));
vi.mock("@/lib/notifications", () => ({
  notifyEngagementMembers: vi.fn(),
}));
vi.mock("@/lib/vault", () => ({
  ALLOWED_MIME_TYPES: new Set(["application/pdf"]),
  MAX_UPLOAD_BYTES: 50 * 1024 * 1024,
  deleteFromVault: vi.fn(),
  sanitiseFilename: vi.fn((value: string) => value),
  uploadToVault: vi.fn(),
  vaultPathname: vi.fn(),
}));

import { GET } from "./route";

describe("Document version visibility", () => {
  beforeEach(() => {
    sql.mockReset();
    authMocks.getAuthContext.mockReset();
    accessMocks.getPortalAccessSummary.mockReset();
    accessMocks.authorizeCapability.mockReset();
  });

  it("requires an authenticated first-party session", async () => {
    authMocks.getAuthContext.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/vault/documents/doc-1/versions"),
      { params: Promise.resolve({ id: "doc-1" }) },
    );

    expect(response.status).toBe(401);
    expect(sql).not.toHaveBeenCalled();
  });

  it("does not expose pending client documents to a client", async () => {
    authMocks.getAuthContext.mockResolvedValue({
      userId: "client-1",
      role: "client",
      user: { id: "client-1", name: "Client", email: "client@example.com", role: "client" },
    });
    accessMocks.getPortalAccessSummary.mockResolvedValue({
      role: "client",
      capabilities: ["documents.view"],
      scope: "assigned",
      permissionProfile: null,
    });
    accessMocks.authorizeCapability.mockResolvedValue(true);
    sql.mockResolvedValueOnce([{
      id: "doc-1",
      matter_id: "matter-1",
      visibility: "client",
      publication_status: "pending_review",
    }]);

    const response = await GET(
      new Request("http://localhost/api/vault/documents/doc-1/versions"),
      { params: Promise.resolve({ id: "doc-1" }) },
    );

    expect(response.status).toBe(404);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("returns version history but not audit history without audit capability", async () => {
    authMocks.getAuthContext.mockResolvedValue({
      userId: "client-1",
      role: "client",
      user: { id: "client-1", name: "Client", email: "client@example.com", role: "client" },
    });
    accessMocks.getPortalAccessSummary.mockResolvedValue({
      role: "client",
      capabilities: ["documents.view"],
      scope: "assigned",
      permissionProfile: null,
    });
    accessMocks.authorizeCapability.mockResolvedValue(true);
    sql
      .mockResolvedValueOnce([{
        id: "doc-1",
        matter_id: "matter-1",
        visibility: "client",
        publication_status: "published",
      }])
      .mockResolvedValueOnce([{ id: "version-1", version_number: 1 }]);

    const response = await GET(
      new Request("http://localhost/api/vault/documents/doc-1/versions"),
      { params: Promise.resolve({ id: "doc-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.versions).toEqual([{ id: "version-1", version_number: 1 }]);
    expect(body.accessEvents).toEqual([]);
    expect(sql).toHaveBeenCalledTimes(2);
  });
});
