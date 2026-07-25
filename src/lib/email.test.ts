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

    await sendConsultationNotification(data);

    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["advisory@jamesroman.la"],
        subject: expect.stringContaining(data.referenceId),
      }),
    );
    expect(console.info).toHaveBeenCalledWith("email.sent", {
      referenceId: data.referenceId,
      to: "advisory@jamesroman.la",
    });
  });

  it("contains provider exceptions and logs a delivery failure", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    resendSend.mockRejectedValue(new Error("provider unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendConsultationNotification(data)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "email.failed",
      expect.objectContaining({ referenceId: data.referenceId }),
    );
  });
});
