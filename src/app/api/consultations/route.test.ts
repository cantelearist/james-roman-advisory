import { afterEach, describe, expect, it, vi } from "vitest";

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
