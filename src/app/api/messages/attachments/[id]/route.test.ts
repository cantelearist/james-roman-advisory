import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.fn();
const authMocks = vi.hoisted(() => ({ getAuthContext: vi.fn() }));
const accessMocks = vi.hoisted(() => ({
  getPortalAccessSummary: vi.fn(),
  authorizeCapability: vi.fn(),
}));
const dbMocks = vi.hoisted(() => ({ logFileAccess: vi.fn() }));
const vaultMocks = vi.hoisted(() => ({ downloadFromVault: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getAuthContext: authMocks.getAuthContext }));
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => sql),
  logFileAccess: dbMocks.logFileAccess,
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
vi.mock("@/lib/vault", () => ({ downloadFromVault: vaultMocks.downloadFromVault }));

import { GET } from "./route";

const context = {
  userId: "client-1",
  role: "client" as const,
  user: { id: "client-1", name: "Client", email: "client@example.com", role: "client" as const },
};

describe("Message attachment download", () => {
  beforeEach(() => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "blob-token");
    sql.mockReset();
    authMocks.getAuthContext.mockReset();
    accessMocks.getPortalAccessSummary.mockReset();
    accessMocks.authorizeCapability.mockReset();
    dbMocks.logFileAccess.mockReset();
    vaultMocks.downloadFromVault.mockReset();
  });

  it("requires an authenticated first-party session", async () => {
    authMocks.getAuthContext.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/messages/attachments/doc-1"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(response.status).toBe(401);
    expect(sql).not.toHaveBeenCalled();
  });

  it("conceals attachments when message capability is absent", async () => {
    authMocks.getAuthContext.mockResolvedValue(context);
    accessMocks.getPortalAccessSummary.mockResolvedValue({
      role: "client",
      capabilities: [],
      scope: "assigned",
      permissionProfile: null,
    });
    const response = await GET(new Request("http://localhost/api/messages/attachments/doc-1"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(response.status).toBe(404);
    expect(sql).not.toHaveBeenCalled();
  });

  it("rejects malformed version identifiers before querying attachment data", async () => {
    authMocks.getAuthContext.mockResolvedValue(context);
    accessMocks.getPortalAccessSummary.mockResolvedValue({
      role: "client",
      capabilities: ["messages.view"],
      scope: "assigned",
      permissionProfile: null,
    });
    const response = await GET(new Request("http://localhost/api/messages/attachments/doc-1?versionId=not-an-id"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(response.status).toBe(400);
    expect(sql).not.toHaveBeenCalled();
  });

  it("does not expose internal attachments to a client", async () => {
    authMocks.getAuthContext.mockResolvedValue(context);
    accessMocks.getPortalAccessSummary.mockResolvedValue({
      role: "client",
      capabilities: ["messages.view"],
      scope: "assigned",
      permissionProfile: null,
    });
    accessMocks.authorizeCapability.mockResolvedValue(true);
    sql.mockResolvedValueOnce([{
      id: "doc-1",
      matter_id: "matter-1",
      original_name: "private.pdf",
      content_type: "application/pdf",
      blob_pathname: "vault/private.pdf",
      archived_at: null,
      audience: "internal",
    }]);
    const response = await GET(new Request("http://localhost/api/messages/attachments/doc-1"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(response.status).toBe(404);
    expect(vaultMocks.downloadFromVault).not.toHaveBeenCalled();
  });

  it("enforces engagement scope before reading storage", async () => {
    authMocks.getAuthContext.mockResolvedValue(context);
    accessMocks.getPortalAccessSummary.mockResolvedValue({
      role: "client",
      capabilities: ["messages.view"],
      scope: "assigned",
      permissionProfile: null,
    });
    accessMocks.authorizeCapability.mockResolvedValue(false);
    sql.mockResolvedValueOnce([{
      id: "doc-1",
      matter_id: "matter-1",
      original_name: "client.pdf",
      content_type: "application/pdf",
      blob_pathname: "vault/client.pdf",
      archived_at: null,
      audience: "client",
    }]);
    const response = await GET(new Request("http://localhost/api/messages/attachments/doc-1"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(response.status).toBe(404);
    expect(vaultMocks.downloadFromVault).not.toHaveBeenCalled();
  });

  it("streams a permitted attachment through the proxy and records access", async () => {
    authMocks.getAuthContext.mockResolvedValue(context);
    accessMocks.getPortalAccessSummary.mockResolvedValue({
      role: "client",
      capabilities: ["messages.view"],
      scope: "assigned",
      permissionProfile: null,
    });
    accessMocks.authorizeCapability.mockResolvedValue(true);
    sql.mockResolvedValueOnce([{
      id: "doc-1",
      matter_id: "matter-1",
      original_name: "client-report.pdf",
      content_type: "application/pdf",
      blob_pathname: "vault/client-report.pdf",
      archived_at: null,
      audience: "client",
    }]);
    vaultMocks.downloadFromVault.mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("report"));
          controller.close();
        },
      }),
      blob: { contentType: "application/pdf" },
    });

    const response = await GET(new Request("http://localhost/api/messages/attachments/doc-1"), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("report");
    expect(vaultMocks.downloadFromVault).toHaveBeenCalledWith("vault/client-report.pdf");
    expect(dbMocks.logFileAccess).toHaveBeenCalledWith(expect.objectContaining({
      documentId: "doc-1",
      userId: "client-1",
      eventType: "download",
    }));
  });

  it("streams an explicitly selected historical version through the same proxy", async () => {
    const versionId = "33333333-3333-4333-8333-333333333333";
    authMocks.getAuthContext.mockResolvedValue(context);
    accessMocks.getPortalAccessSummary.mockResolvedValue({
      role: "client",
      capabilities: ["messages.view"],
      scope: "assigned",
      permissionProfile: null,
    });
    accessMocks.authorizeCapability.mockResolvedValue(true);
    sql.mockResolvedValueOnce([{
      id: "doc-1",
      matter_id: "matter-1",
      original_name: "client-report-v1.pdf",
      content_type: "application/pdf",
      blob_pathname: "vault/client-report-v1.pdf",
      archived_at: null,
      audience: "client",
    }]);
    vaultMocks.downloadFromVault.mockResolvedValue({
      statusCode: 200,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("version one"));
          controller.close();
        },
      }),
      blob: { contentType: "application/pdf" },
    });

    const response = await GET(new Request(`http://localhost/api/messages/attachments/doc-1?versionId=${versionId}`), {
      params: Promise.resolve({ id: "doc-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("version one");
    expect(vaultMocks.downloadFromVault).toHaveBeenCalledWith("vault/client-report-v1.pdf");
  });
});
