import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.fn();
const authMocks = vi.hoisted(() => ({ getAuthContext: vi.fn() }));
const accessMocks = vi.hoisted(() => ({
  getPortalAccessSummary: vi.fn(),
  authorizeCapability: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthContext: authMocks.getAuthContext }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => sql) }));
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

import { GET } from "./route";

const context = {
  userId: "client-1",
  role: "client" as const,
  user: { id: "client-1", name: "Client", email: "client@example.com", role: "client" as const },
};

describe("Message attachment metadata", () => {
  beforeEach(() => {
    sql.mockReset();
    authMocks.getAuthContext.mockReset().mockResolvedValue(context);
    accessMocks.getPortalAccessSummary.mockReset().mockResolvedValue({
      role: "client",
      capabilities: ["messages.view"],
      scope: "assigned",
      permissionProfile: null,
    });
    accessMocks.authorizeCapability.mockReset().mockResolvedValue(true);
  });

  it("conceals internal correspondence metadata from clients", async () => {
    sql.mockResolvedValueOnce([{
      id: "doc-1",
      matter_id: "matter-1",
      name: "Internal notes",
      archived_at: null,
      audience: "internal",
    }]);
    const response = await GET(new Request("http://localhost/api/messages/attachments/doc-1/metadata"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(response.status).toBe(404);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("returns safe metadata and versions without storage pathnames", async () => {
    sql
      .mockResolvedValueOnce([{
        id: "doc-1",
        matter_id: "matter-1",
        name: "Client report",
        original_name: "client-report.pdf",
        content_type: "application/pdf",
        size_bytes: 2048,
        created_at: "2026-08-01T00:00:00.000Z",
        archived_at: null,
        audience: "client",
        uploaded_by_name: "Advisor",
      }])
      .mockResolvedValueOnce([{
        id: "version-1",
        version_number: 1,
        original_name: "client-report.pdf",
        size_bytes: 2048,
        content_type: "application/pdf",
        created_at: "2026-08-01T00:00:00.000Z",
        uploaded_by_name: "Advisor",
      }]);
    const response = await GET(new Request("http://localhost/api/messages/attachments/doc-1/metadata"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.versions).toHaveLength(1);
    expect(body.accessEvents).toEqual([]);
    expect(JSON.stringify(body)).not.toContain("blob_pathname");
    expect(JSON.stringify(body)).not.toContain("vault/");
  });
});
