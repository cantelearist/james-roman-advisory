import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sql = vi.fn();
const sendConsultationNotification = vi.hoisted(() => vi.fn());
const ratelimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({
  ensureConsultationsTable: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn(() => sql),
}));
vi.mock("@/lib/email", () => ({ sendConsultationNotification }));
vi.mock("@/lib/ratelimit", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  ratelimit,
}));

import { POST } from "./route";

const validBody = {
  name: "Private Client",
  email: "client@example.com",
  market: "Malibu",
  matter: "Remediation oversight",
  message: "Please review a hazardous materials remediation protocol privately.",
};

function requestFor(body: unknown) {
  return new Request("http://localhost/api/consultations", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/consultations", () => {
  beforeEach(() => {
    sendConsultationNotification.mockReset();
    sendConsultationNotification.mockResolvedValue({ status: "sent" });
    ratelimit.mockReset();
    ratelimit.mockResolvedValue({
      available: true,
      blocked: false,
      remaining: 4,
      reset: Date.now() + 60_000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts valid consultation requests and returns a private reference", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(crypto, "randomUUID").mockReturnValue("12345678-1234-4234-9234-123456789abc");

    const response = await POST(requestFor(validBody));
    const json = await response.json();

    expect(response.status).toBe(202);
    expect(json.referenceId).toBe(`JRA-${new Date().getUTCFullYear()}-12345678`);
    expect(json.message).toContain("private review record");
    expect(console.info).toHaveBeenCalledWith(
      "consultation.received",
      expect.objectContaining({
        referenceId: json.referenceId,
        audit: expect.objectContaining({
          nameInitials: "PC",
          emailDomain: "example.com",
        }),
      }),
    );
    expect(sendConsultationNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: json.referenceId,
        email: validBody.email,
      }),
    );
  });

  it("waits for notification delivery before completing the response", async () => {
    let resolveDelivery!: () => void;
    let responseSettled = false;
    sendConsultationNotification.mockImplementation(
      () => new Promise<void>((resolve) => { resolveDelivery = resolve; }),
    );
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(crypto, "randomUUID").mockReturnValue("12345678-1234-4234-9234-123456789abc");

    const responsePromise = POST(requestFor(validBody));
    void responsePromise.then(() => { responseSettled = true; });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sendConsultationNotification).toHaveBeenCalled();
    expect(responseSettled).toBe(false);

    resolveDelivery();
    const response = await responsePromise;
    expect(response.status).toBe(202);
  });

  it("returns field errors for invalid requests", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      requestFor({
        ...validBody,
        email: "bad",
        message: "short",
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.message).toBe("Please review the highlighted fields.");
    expect(json.errors.email[0]).toBe("Use a valid email address");
    expect(json.errors.message[0]).toContain("at least 20 characters");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns a generic error when request parsing fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      new Request("http://localhost/api/consultations", {
        method: "POST",
        body: "{not-json",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.message).toBe("The request could not be submitted. Please try again.");
    expect(console.error).toHaveBeenCalledWith("consultation.failed", expect.any(SyntaxError));
  });
});
