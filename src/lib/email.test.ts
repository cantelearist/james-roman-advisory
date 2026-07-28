import { afterEach, describe, expect, it, vi } from "vitest";

const resendSend = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: resendSend };
  },
}));

import { sendConsultationNotification } from "./email";

const data = {
  referenceId: "JRA-2026-EMAILTEST",
  name: "Private Client",
  email: "client@example.com",
  market: "Malibu",
  matter: "Email verification",
  message: "Confirm that the notification path accepts and logs delivery.",
};

describe("sendConsultationNotification", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resendSend.mockReset();
  });

  it("logs a successful delivery", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    resendSend.mockResolvedValue({ error: null });
    vi.spyOn(console, "info").mockImplementation(() => {});

    await expect(sendConsultationNotification(data)).resolves.toEqual({
      status: "sent",
    });

    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["roman@jamesroman.la"],
        subject: expect.stringContaining(data.referenceId),
      }),
    );
    expect(console.info).toHaveBeenCalledWith("email.sent", {
      referenceId: data.referenceId,
      to: "roman@jamesroman.la",
    });
  });

  it("contains provider exceptions and logs a delivery failure", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    resendSend.mockRejectedValue(new Error("provider unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendConsultationNotification(data)).resolves.toEqual({
      status: "failed",
      error: "Error",
    });
    expect(console.error).toHaveBeenCalledWith(
      "email.failed",
      expect.objectContaining({ referenceId: data.referenceId }),
    );
  });

  it("reports a skipped delivery when email is not configured", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(sendConsultationNotification(data)).resolves.toEqual({
      status: "skipped",
      error: "email_not_configured",
    });
  });
});
