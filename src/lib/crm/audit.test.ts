import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createAuditHash, normalizeAuditCorrelationId } from "@/lib/crm/audit";

describe("audit logging helpers", () => {
  const secret = "staging-audit-hash-secret-with-enough-entropy";

  it("uses a keyed hash instead of plain SHA-256", () => {
    const value = "203.0.113.20";
    const plainSha256 = createHash("sha256").update(value).digest("hex");

    expect(createAuditHash(value, secret)).not.toBe(plainSha256);
  });

  it("depends on the server-side audit secret", () => {
    const value = "Mozilla/5.0";

    expect(createAuditHash(value, secret)).not.toBe(
      createAuditHash(value, "different-audit-hash-secret-with-enough-entropy"),
    );
  });

  it("rejects weak audit hash secrets", () => {
    expect(() => createAuditHash("value", "short")).toThrow(/at least 32 characters/);
  });

  it("keeps safe correlation ids and replaces unsafe values", () => {
    expect(normalizeAuditCorrelationId(" request-123:iad1 ")).toBe("request-123:iad1");
    expect(normalizeAuditCorrelationId("request id with spaces")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
