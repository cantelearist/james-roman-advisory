import { afterEach, describe, expect, it, vi } from "vitest";

import { enforceSameOriginRequest, isAllowedStateChangingRequest } from "./request-guard";

function guardedRequest(headers: HeadersInit = {}, url = "https://www.jamesroman.la/api/messages") {
  return new Request(url, {
    method: "POST",
    headers,
  });
}

describe("state-changing request guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows exact same-origin browser requests", () => {
    expect(
      isAllowedStateChangingRequest(
        guardedRequest({
          origin: "https://www.jamesroman.la",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toBe(true);
  });

  it("rejects cross-site browser requests before route work begins", async () => {
    const response = enforceSameOriginRequest(
      guardedRequest({
        origin: "https://example.com",
        "sec-fetch-site": "cross-site",
      }),
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ message: "Request rejected." });
  });

  it("rejects malformed origins", () => {
    expect(isAllowedStateChangingRequest(guardedRequest({ origin: "not a url" }))).toBe(false);
  });

  it("allows same-site requests when browsers omit origin", () => {
    expect(isAllowedStateChangingRequest(guardedRequest({ "sec-fetch-site": "same-site" }))).toBe(
      true,
    );
  });

  it("allows server-to-server or test requests without browser metadata", () => {
    expect(isAllowedStateChangingRequest(guardedRequest())).toBe(true);
  });

  it("allows localhost dev across ports", () => {
    expect(
      isAllowedStateChangingRequest(
        guardedRequest(
          {
            origin: "http://localhost:3021",
            "sec-fetch-site": "same-site",
          },
          "http://localhost:3000/api/messages",
        ),
      ),
    ).toBe(true);
  });

  it("allows explicitly configured preview origins", () => {
    vi.stubEnv("JRA_ALLOWED_ORIGINS", "https://preview-jr-advisory.vercel.app");

    expect(
      isAllowedStateChangingRequest(
        guardedRequest({
          origin: "https://preview-jr-advisory.vercel.app",
          "sec-fetch-site": "same-site",
        }),
      ),
    ).toBe(true);
  });
});
