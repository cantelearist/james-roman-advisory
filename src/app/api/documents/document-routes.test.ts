import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const {
  mockGetAuthContext,
  mockCanUpload,
  mockCanViewDocuments,
  mockAdminFrom,
  mockServerFrom,
  mockWriteAudit,
  mockEnforceRateLimit,
  mockSameOriginGuard,
  mockCreateSignedUploadUrl,
  mockCreateSignedUrl,
  adminInsertMock,
  adminUpdateMock,
  adminSelectSingleMock,
  serverSelectSingleMock,
} = vi.hoisted(() => {
  const mockGetAuthContext = vi.fn();
  const mockCanUpload = vi.fn();
  const mockCanViewDocuments = vi.fn();
  const mockWriteAudit = vi.fn();
  const mockEnforceRateLimit = vi.fn();
  const mockSameOriginGuard = vi.fn();
  const mockCreateSignedUploadUrl = vi.fn();
  const mockCreateSignedUrl = vi.fn();

  const adminInsertMock = vi.fn();
  const adminUpdateMock = vi.fn();
  const adminSelectSingleMock = vi.fn();
  const serverSelectSingleMock = vi.fn();

  function makeAdminQuery() {
    const q: Record<string, unknown> = {};
    q.select = vi.fn(() => q);
    q.insert = adminInsertMock;
    q.update = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    q.single = adminSelectSingleMock;
    (q.update as ReturnType<typeof vi.fn>).mockReturnValue(q);
    return q;
  }

  function makeServerQuery() {
    const q: Record<string, unknown> = {};
    q.select = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    q.single = serverSelectSingleMock;
    return q;
  }

  const mockAdminFrom = vi.fn(() => makeAdminQuery());
  const mockServerFrom = vi.fn(() => makeServerQuery());

  return {
    mockGetAuthContext,
    mockCanUpload,
    mockCanViewDocuments,
    mockWriteAudit,
    mockEnforceRateLimit,
    mockSameOriginGuard,
    mockCreateSignedUploadUrl,
    mockCreateSignedUrl,
    adminInsertMock,
    adminUpdateMock,
    adminSelectSingleMock,
    serverSelectSingleMock,
    mockAdminFrom,
    mockServerFrom,
  };
});

vi.mock("@/lib/crm/auth", () => ({
  getCurrentAuthContext: mockGetAuthContext,
  isTeamRole: (role: string) => ["owner", "admin", "advisor"].includes(role),
}));

vi.mock("@/lib/crm/data", () => ({
  userCanUploadToMatter: mockCanUpload,
  userCanViewMatterDocuments: mockCanViewDocuments,
}));

vi.mock("@/lib/crm/audit", () => ({
  writeAuditEvent: mockWriteAudit,
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/request-guard", () => ({
  enforceSameOriginRequest: mockSameOriginGuard,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: mockAdminFrom,
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl: mockCreateSignedUploadUrl,
        createSignedUrl: mockCreateSignedUrl,
      })),
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: mockServerFrom,
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const advisorContext = {
  userId: "advisor-1",
  email: "advisor@example.com",
  profile: {
    id: "advisor-1",
    tenant_id: "tenant-1",
    email: "advisor@example.com",
    full_name: "James Advisor",
    role: "advisor",
    mfa_required: false,
    disabled_at: null,
  },
};

const clientContext = {
  ...advisorContext,
  userId: "client-1",
  email: "client@example.com",
  profile: { ...advisorContext.profile, id: "client-1", email: "client@example.com", role: "client" },
};

const availableDocument = {
  id: "doc-1",
  tenant_id: "tenant-1",
  matter_id: "matter-1",
  uploaded_by: "client-1",
  title: "Contract Draft.pdf",
  storage_bucket: "case-files",
  storage_path: "tenant-1/matter-1/doc-1-contract-draft.pdf",
  mime_type: "application/pdf",
  size_bytes: 102400,
  visibility: "client",
  status: "available",
};

function makeRequest(url: string, options?: RequestInit) {
  return new Request(url, {
    headers: { "Content-Type": "application/json", origin: "https://www.jamesroman.la" },
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Signed Upload Route
// ---------------------------------------------------------------------------

import { POST as signedUploadPOST } from "./signed-upload/route";

describe("POST /api/documents/signed-upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSameOriginGuard.mockReturnValue(null);
    mockEnforceRateLimit.mockReturnValue(null);
    mockGetAuthContext.mockResolvedValue(advisorContext);
    mockCanUpload.mockResolvedValue(true);
    adminInsertMock.mockResolvedValue({ error: null });
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.supabase.co/signed-upload-url", token: "tok-123" },
      error: null,
    });
    mockWriteAudit.mockResolvedValue(undefined);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("doc-uuid-1234-5678-90ab-cdef01234567");
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthContext.mockResolvedValue(null);
    const res = await signedUploadPOST(
      makeRequest("https://www.jamesroman.la/api/documents/signed-upload", {
        method: "POST",
        body: JSON.stringify({ matterId: "11111111-1111-4111-8111-111111111111", fileName: "doc.pdf" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns the same-origin guard response when triggered", async () => {
    const guardResponse = new Response("Forbidden", { status: 403 });
    mockSameOriginGuard.mockReturnValue(guardResponse);
    const res = await signedUploadPOST(
      makeRequest("https://www.jamesroman.la/api/documents/signed-upload", {
        method: "POST",
        body: JSON.stringify({ matterId: "11111111-1111-4111-8111-111111111111", fileName: "doc.pdf" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate limited", async () => {
    mockEnforceRateLimit.mockReturnValue(
      new Response(JSON.stringify({ message: "Too many requests." }), { status: 429 }),
    );
    const res = await signedUploadPOST(
      makeRequest("https://www.jamesroman.la/api/documents/signed-upload", {
        method: "POST",
        body: JSON.stringify({ matterId: "11111111-1111-4111-8111-111111111111", fileName: "doc.pdf" }),
      }),
    );
    expect(res.status).toBe(429);
  });

  it("returns 403 when user cannot upload to matter", async () => {
    mockCanUpload.mockResolvedValue(false);
    const res = await signedUploadPOST(
      makeRequest("https://www.jamesroman.la/api/documents/signed-upload", {
        method: "POST",
        body: JSON.stringify({ matterId: "11111111-1111-4111-8111-111111111111", fileName: "doc.pdf" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ message: "Matter access denied." });
  });

  it("returns 400 for invalid request body", async () => {
    const res = await signedUploadPOST(
      makeRequest("https://www.jamesroman.la/api/documents/signed-upload", {
        method: "POST",
        body: JSON.stringify({ matterId: "not-a-uuid", fileName: "" }),
      }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toBe("Please review the upload request.");
  });

  it("returns signed upload URL and document id on success", async () => {
    const res = await signedUploadPOST(
      makeRequest("https://www.jamesroman.la/api/documents/signed-upload", {
        method: "POST",
        body: JSON.stringify({
          matterId: "11111111-1111-4111-8111-111111111111",
          fileName: "Contract Draft.pdf",
          contentType: "application/pdf",
          sizeBytes: 102400,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signedUrl).toBe("https://storage.supabase.co/signed-upload-url");
    expect(json.token).toBe("tok-123");
    expect(json.documentId).toBeDefined();
    expect(json.bucket).toBe("case-files");
  });

  it("writes an audit event on successful signed upload creation", async () => {
    await signedUploadPOST(
      makeRequest("https://www.jamesroman.la/api/documents/signed-upload", {
        method: "POST",
        body: JSON.stringify({
          matterId: "11111111-1111-4111-8111-111111111111",
          fileName: "Agreement.pdf",
        }),
      }),
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "document.signed_upload_created",
        resourceType: "document",
      }),
    );
  });

  it("returns 500 when storage URL creation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateSignedUploadUrl.mockResolvedValue({ data: null, error: new Error("storage error") });
    const res = await signedUploadPOST(
      makeRequest("https://www.jamesroman.la/api/documents/signed-upload", {
        method: "POST",
        body: JSON.stringify({ matterId: "11111111-1111-4111-8111-111111111111", fileName: "doc.pdf" }),
      }),
    );
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Signed Download Route
// ---------------------------------------------------------------------------

import { GET as downloadGET } from "./[documentId]/download/route";

const downloadParams = Promise.resolve({ documentId: "doc-1" });

describe("GET /api/documents/[documentId]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockReturnValue(null);
    mockGetAuthContext.mockResolvedValue(advisorContext);
    mockCanViewDocuments.mockResolvedValue(true);
    adminSelectSingleMock.mockResolvedValue({ data: availableDocument, error: null });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.supabase.co/signed-download-url" },
      error: null,
    });
    adminInsertMock.mockResolvedValue({ error: null });
    mockWriteAudit.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthContext.mockResolvedValue(null);
    const res = await downloadGET(makeRequest("https://www.jamesroman.la/api/documents/doc-1/download"), {
      params: downloadParams,
    });
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockEnforceRateLimit.mockReturnValue(
      new Response(JSON.stringify({ message: "Too many requests." }), { status: 429 }),
    );
    const res = await downloadGET(makeRequest("https://www.jamesroman.la/api/documents/doc-1/download"), {
      params: downloadParams,
    });
    expect(res.status).toBe(429);
  });

  it("returns 404 when document does not exist", async () => {
    adminSelectSingleMock.mockResolvedValue({ data: null, error: new Error("not found") });
    const res = await downloadGET(makeRequest("https://www.jamesroman.la/api/documents/doc-1/download"), {
      params: downloadParams,
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for deleted documents", async () => {
    adminSelectSingleMock.mockResolvedValue({
      data: { ...availableDocument, status: "deleted" },
      error: null,
    });
    const res = await downloadGET(makeRequest("https://www.jamesroman.la/api/documents/doc-1/download"), {
      params: downloadParams,
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when user cannot view matter documents", async () => {
    mockCanViewDocuments.mockResolvedValue(false);
    const res = await downloadGET(makeRequest("https://www.jamesroman.la/api/documents/doc-1/download"), {
      params: downloadParams,
    });
    expect(res.status).toBe(403);
  });

  it("blocks download of quarantined documents (scan_pending)", async () => {
    adminSelectSingleMock.mockResolvedValue({
      data: { ...availableDocument, status: "scan_pending" },
      error: null,
    });
    const res = await downloadGET(makeRequest("https://www.jamesroman.la/api/documents/doc-1/download"), {
      params: downloadParams,
    });
    // Team members see 409 (not available yet), not 403.
    expect(res.status).toBe(409);
  });

  it("blocks client download of quarantined internal-visibility document", async () => {
    mockGetAuthContext.mockResolvedValue(clientContext);
    adminSelectSingleMock.mockResolvedValue({
      data: { ...availableDocument, visibility: "internal", status: "available" },
      error: null,
    });
    const res = await downloadGET(makeRequest("https://www.jamesroman.la/api/documents/doc-1/download"), {
      params: downloadParams,
    });
    expect(res.status).toBe(403);
  });

  it("returns signed download URL on success", async () => {
    const res = await downloadGET(makeRequest("https://www.jamesroman.la/api/documents/doc-1/download"), {
      params: downloadParams,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signedUrl).toBe("https://storage.supabase.co/signed-download-url");
    expect(json.expiresIn).toBe(120);
  });

  it("writes an audit event on successful download URL creation", async () => {
    await downloadGET(makeRequest("https://www.jamesroman.la/api/documents/doc-1/download"), {
      params: downloadParams,
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "document.signed_download_created",
        resourceType: "document",
      }),
    );
  });

  it("returns 500 when storage URL creation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: new Error("storage error") });
    const res = await downloadGET(makeRequest("https://www.jamesroman.la/api/documents/doc-1/download"), {
      params: downloadParams,
    });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Complete Upload Route
// ---------------------------------------------------------------------------

import { POST as completePOST } from "./[documentId]/complete/route";

const completeParams = Promise.resolve({ documentId: "doc-1" });

describe("POST /api/documents/[documentId]/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSameOriginGuard.mockReturnValue(null);
    mockGetAuthContext.mockResolvedValue(advisorContext);
    mockCanUpload.mockResolvedValue(true);

    // server client: document read
    serverSelectSingleMock.mockResolvedValue({
      data: { ...availableDocument, status: "pending_upload", uploaded_by: "advisor-1" },
      error: null,
    });

    // admin client: status update + file_access_events insert
    mockAdminFrom.mockImplementation(() => {
      const q: Record<string, unknown> = {};
      q.select = vi.fn(() => q);
      q.insert = adminInsertMock;
      q.update = vi.fn(() => q);
      q.eq = vi.fn(() => q);
      q.single = adminSelectSingleMock;
      (q.update as ReturnType<typeof vi.fn>).mockReturnValue(q);
      return q;
    });
    adminInsertMock.mockResolvedValue({ error: null });
    adminUpdateMock.mockResolvedValue({ error: null });

    // Patch the update chain to resolve correctly
    const updateChain = { eq: vi.fn() };
    updateChain.eq.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    mockWriteAudit.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthContext.mockResolvedValue(null);
    const res = await completePOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/complete", { method: "POST", body: "{}" }),
      { params: completeParams },
    );
    expect(res.status).toBe(401);
  });

  it("returns same-origin guard response when triggered", async () => {
    const guardResponse = new Response("Forbidden", { status: 403 });
    mockSameOriginGuard.mockReturnValue(guardResponse);
    const res = await completePOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/complete", { method: "POST", body: "{}" }),
      { params: completeParams },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when document does not exist", async () => {
    serverSelectSingleMock.mockResolvedValue({ data: null, error: new Error("not found") });
    const res = await completePOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/complete", { method: "POST", body: "{}" }),
      { params: completeParams },
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when user cannot upload to the matter", async () => {
    mockCanUpload.mockResolvedValue(false);
    const res = await completePOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/complete", { method: "POST", body: "{}" }),
      { params: completeParams },
    );
    expect(res.status).toBe(403);
  });

  it("transitions document to scan_pending on successful completion", async () => {
    const res = await completePOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/complete", { method: "POST", body: "{}" }),
      { params: completeParams },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("scan_pending");
    expect(json.reviewRequired).toBe(true);
  });

  it("accepts an optional checksum in the request body", async () => {
    const checksum = "a".repeat(64);
    const res = await completePOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/complete", {
        method: "POST",
        body: JSON.stringify({ checksumSha256: checksum }),
      }),
      { params: completeParams },
    );
    expect(res.status).toBe(200);
  });

  it("rejects malformed checksum format", async () => {
    const res = await completePOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/complete", {
        method: "POST",
        body: JSON.stringify({ checksumSha256: "not-a-valid-sha256" }),
      }),
      { params: completeParams },
    );
    expect(res.status).toBe(400);
  });

  it("writes an audit event on completion", async () => {
    await completePOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/complete", { method: "POST", body: "{}" }),
      { params: completeParams },
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "document.upload_completed",
        resourceType: "document",
        resourceId: "doc-1",
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Document Review Route
// ---------------------------------------------------------------------------

import { POST as reviewPOST } from "./[documentId]/review/route";

const reviewParams = Promise.resolve({ documentId: "doc-1" });

const scanPendingDocument = {
  ...availableDocument,
  status: "scan_pending",
  visibility: "internal",
};

describe("POST /api/documents/[documentId]/review", () => {
  function makeReviewQuery({
    selectResult = { data: scanPendingDocument, error: null },
    updateError = null as Error | null,
    insertError = null as Error | null,
  } = {}) {
    adminSelectSingleMock.mockResolvedValue(selectResult);
    adminInsertMock.mockResolvedValue({ error: insertError });

    mockAdminFrom.mockImplementation(() => {
      const q: Record<string, unknown> = {};
      q.select = vi.fn(() => q);
      q.insert = adminInsertMock;
      q.update = vi.fn(() => ({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: updateError }),
        }),
      }));
      q.eq = vi.fn(() => q);
      q.single = adminSelectSingleMock;
      return q;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockSameOriginGuard.mockReturnValue(null);
    mockEnforceRateLimit.mockReturnValue(null);
    mockGetAuthContext.mockResolvedValue(advisorContext);
    mockWriteAudit.mockResolvedValue(undefined);
    makeReviewQuery();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthContext.mockResolvedValue(null);
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(401);
  });

  it("returns same-origin guard response when triggered", async () => {
    mockSameOriginGuard.mockReturnValue(new Response("Forbidden", { status: 403 }));
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when a client attempts to review", async () => {
    mockGetAuthContext.mockResolvedValue(clientContext);
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ message: "Document review requires team access." });
  });

  it("returns 429 when rate limited", async () => {
    mockEnforceRateLimit.mockReturnValue(
      new Response(JSON.stringify({ message: "Too many requests." }), { status: 429 }),
    );
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid action value", async () => {
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "invalidaction" }),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing action field", async () => {
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when document does not exist", async () => {
    makeReviewQuery({ selectResult: { data: null, error: new Error("not found") } });
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for deleted documents", async () => {
    makeReviewQuery({ selectResult: { data: { ...scanPendingDocument, status: "deleted" }, error: null } });
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when document belongs to a different tenant", async () => {
    makeReviewQuery({
      selectResult: { data: { ...scanPendingDocument, tenant_id: "other-tenant" }, error: null },
    });
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when document is not in scan_pending status", async () => {
    makeReviewQuery({ selectResult: { data: { ...scanPendingDocument, status: "available" }, error: null } });
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.message).toBe("Document is not awaiting review.");
    expect(json.currentStatus).toBe("available");
  });

  it("returns 409 when document is already quarantined", async () => {
    makeReviewQuery({
      selectResult: { data: { ...scanPendingDocument, status: "quarantined" }, error: null },
    });
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(409);
  });

  it("approves document: transitions status to available", async () => {
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("available");
    expect(json.action).toBe("approve");
  });

  it("rejects document: transitions status to quarantined", async () => {
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "reject", reason: "Suspicious content detected." }),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("quarantined");
    expect(json.action).toBe("reject");
  });

  it("writes audit event with correct action on approve", async () => {
    await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: reviewParams },
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "document.review_approved",
        resourceType: "document",
        resourceId: "doc-1",
      }),
    );
  });

  it("writes audit event with correct action and reason on reject", async () => {
    await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "reject", reason: "Looks wrong." }),
      }),
      { params: reviewParams },
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "document.review_rejected",
        resourceType: "document",
        resourceId: "doc-1",
        metadata: expect.objectContaining({ reason: "Looks wrong.", nextStatus: "quarantined" }),
      }),
    );
  });

  it("includes null reason in audit metadata when none provided", async () => {
    await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: reviewParams },
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ reason: null }),
      }),
    );
  });

  it("returns 500 when the database update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    makeReviewQuery({ updateError: new Error("db write failed") });
    const res = await reviewPOST(
      makeRequest("https://www.jamesroman.la/api/documents/doc-1/review", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: reviewParams },
    );
    expect(res.status).toBe(500);
  });
});
