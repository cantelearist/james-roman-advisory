import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsultationForm } from "./consultation-form";

async function fillForm() {
  const user = userEvent.setup();

  await user.type(screen.getByLabelText("Name"), "Private Client");
  await user.type(screen.getByLabelText("Email"), "client@example.com");
  await user.type(screen.getByLabelText("Primary market"), "Malibu");
  await user.type(screen.getByLabelText("Matter type"), "Remediation oversight");
  await user.type(
    screen.getByLabelText("Brief context"),
    "Please review a remediation protocol before any client acceptance.",
  );

  return user;
}

describe("ConsultationForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits consultation data and shows the private review confirmation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: "Request received. A private review record has been created for advisor screening.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ConsultationForm />);

    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/consultations",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.any(String),
        }),
      );
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      name: "Private Client",
      email: "client@example.com",
      market: "Malibu",
      matter: "Remediation oversight",
    });
    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent("Request Submitted");
  });

  it("shows the exact server field error as an alert", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          message: "Please review the highlighted fields.",
          errors: { email: ["Use a valid email address"] },
        }),
      }),
    );
    render(<ConsultationForm />);

    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Use a valid email address");
  });

  it("blocks invalid client input and explains the rejected field", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ConsultationForm />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Name"), "Private Client");
    await user.type(screen.getByLabelText("Email"), "client@example.com");
    await user.type(screen.getByLabelText("Primary market"), "Malibu");
    await user.type(screen.getByLabelText("Matter type"), "Review");
    await user.type(screen.getByLabelText("Brief context"), "Too short");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Brief context should be at least 20 characters",
    );
  });

  it("shows a recoverable error when the request cannot reach the server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<ConsultationForm />);

    const user = await fillForm();
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The request could not be submitted. Please try again.",
    );
  });
});
