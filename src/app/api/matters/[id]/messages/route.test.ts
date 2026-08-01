// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const sql = Object.assign(vi.fn(), { transaction: vi.fn() });
const authMocks = vi.hoisted(() => ({ getAuthContext: vi.fn() }));
const accessMocks = vi.hoisted(() => ({
  getPortalAccessSummary: vi.fn(),
  authorizeCapability: vi.fn(),
}));
const notificationMocks = vi.hoisted(() => ({ notifyEngagementMembers: vi.fn() }));
const vaultMocks = vi.hoisted(() => ({
  uploadToVault: vi.fn(),
  deleteFromVault: vi.fn(),
  vaultPathname: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getAuthContext: authMocks.getAuthContext }));
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
vi.mock("@/lib/notifications", () => ({
  notifyEngagementMembers: notificationMocks.notifyEngagementMembers,
}));
vi.mock("@/lib/automations", () => ({ triggerPortalAutomations: vi.fn() }));
vi.mock("@/lib/vault", () => ({
  ALLOWED_MIME_TYPES: new Set(["application/pdf"]),
  MAX_UPLOAD_BYTES: 50 * 1024 * 1024,
  deleteFromVault: vaultMocks.deleteFromVault,
  sanitiseFilename: vi.fn((value: string) => value),
  uploadToVault: vaultMocks.uploadToVault,
  vaultPathname: vaultMocks.vaultPathname,
}));

import { POST } from "./route";

const context = {
  userId: "admin-1",
  role: "admin" as const,
  user: { id: "admin-1", name: "Admin", email: "admin@example.com", role: "admin" as const },
};
const access = {
  role: "admin" as const,
  capabilities: ["messages.send", "messages.view", "messages.internal_view"],
  scope: "global" as const,
  permissionProfile: null,
};

describe("Engagement message creation", () => {
  beforeEach(() => {
    sql.mockReset();
    sql.transaction.mockReset().mockResolvedValue([]);
    authMocks.getAuthContext.mockReset().mockResolvedValue(context);
    accessMocks.getPortalAccessSummary.mockReset().mockResolvedValue(access);
    accessMocks.authorizeCapability.mockReset().mockResolvedValue(true);
    notificationMocks.notifyEngagementMembers.mockReset().mockResolvedValue({ sent: 1, failed: 0, degraded: false });
    vaultMocks.uploadToVault.mockReset();
    vaultMocks.deleteFromVault.mockReset();
    vaultMocks.vaultPathname.mockReset();
  });

  it("keeps JSON message clients backward-compatible", async () => {
    sql
      .mockResolvedValueOnce([{ id: "matter-1", title: "Engagement", client_id: "client-1" }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{
        id: "message-1",
        matter_id: "matter-1",
        sender_id: "admin-1",
        body: "Status update",
        audience: "client",
        subject: null,
        thread_id: "thread-1",
        parent_message_id: null,
        created_at: "2026-08-01T00:00:00.000Z",
        attachments: [],
      }]);

    const response = await POST(new Request("http://localhost/api/matters/matter-1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Status update", audience: "client" }),
    }), { params: Promise.resolve({ id: "matter-1" }) });
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.message.attachments).toEqual([]);
    expect(sql.transaction).toHaveBeenCalledTimes(1);
    expect(vaultMocks.uploadToVault).not.toHaveBeenCalled();
  });

  it("rejects more than five attachments before reading the database", async () => {
    const boundary = "message-attachment-boundary";
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="body"\r\n\r\nDocuments attached\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="audience"\r\n\r\nclient\r\n`,
    ];
    for (let index = 0; index < 6; index++) {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="attachments"; filename="file-${index}.pdf"\r\nContent-Type: application/pdf\r\n\r\npdf\r\n`);
    }
    parts.push(`--${boundary}--\r\n`);

    const response = await POST(new Request("http://localhost/api/matters/matter-1/messages", {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: parts.join(""),
    }), { params: Promise.resolve({ id: "matter-1" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Attach no more than 5 files." });
    expect(sql).not.toHaveBeenCalled();
    expect(vaultMocks.uploadToVault).not.toHaveBeenCalled();
  });

  it("keeps every staff reply in the parent thread audience", async () => {
    const parentId = "11111111-1111-4111-8111-111111111111";
    sql
      .mockResolvedValueOnce([{ id: "matter-1", title: "Engagement", client_id: "client-1" }])
      .mockResolvedValueOnce([{ id: parentId, thread_id: "22222222-2222-4222-8222-222222222222", audience: "internal" }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{
        id: "message-2",
        matter_id: "matter-1",
        sender_id: "admin-1",
        body: "Internal reply",
        audience: "internal",
        thread_id: "22222222-2222-4222-8222-222222222222",
        parent_message_id: parentId,
        attachments: [],
      }]);

    const response = await POST(new Request("http://localhost/api/matters/matter-1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Internal reply", audience: "client", parentMessageId: parentId }),
    }), { params: Promise.resolve({ id: "matter-1" }) });

    expect(response.status).toBe(201);
    expect(notificationMocks.notifyEngagementMembers).toHaveBeenCalledWith(expect.objectContaining({
      audience: "internal",
    }));
    expect(sql.mock.calls.some((call) => call.slice(1).includes("internal"))).toBe(true);
  });

  it("conceals internal reply targets from staff without internal-message authority", async () => {
    const parentId = "11111111-1111-4111-8111-111111111111";
    accessMocks.getPortalAccessSummary.mockResolvedValue({
      ...access,
      capabilities: ["messages.send", "messages.view"],
    });
    sql
      .mockResolvedValueOnce([{ id: "matter-1", title: "Engagement", client_id: "client-1" }])
      .mockResolvedValueOnce([{ id: parentId, thread_id: "22222222-2222-4222-8222-222222222222", audience: "internal" }]);

    const response = await POST(new Request("http://localhost/api/matters/matter-1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Attempted reply", parentMessageId: parentId }),
    }), { params: Promise.resolve({ id: "matter-1" }) });

    expect(response.status).toBe(404);
    expect(sql.transaction).not.toHaveBeenCalled();
    expect(notificationMocks.notifyEngagementMembers).not.toHaveBeenCalled();
  });
});
