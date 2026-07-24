import { describe, expect, it } from "vitest";

import { buildSecurityHeaders, securityHeaders } from "./security";

describe("securityHeaders", () => {
  it("sets the expected baseline browser protections", () => {
    const headers = new Map(securityHeaders.map((header) => [header.key, header.value]));

    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("keeps content sources constrained to self by default", () => {
    const csp = securityHeaders.find((header) => header.key === "Content-Security-Policy")?.value;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it("does not allow unsafe eval in production CSP", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const csp = buildSecurityHeaders().find((header) => header.key === "Content-Security-Policy")
      ?.value;
    process.env.NODE_ENV = originalNodeEnv;

    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
});
