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

  it("shows server validation errors as alerts", async () => {
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

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please review the highlighted fields.",
    );
  });
});
