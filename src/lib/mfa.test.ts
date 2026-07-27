import { beforeEach, describe, expect, it } from "vitest";

import {
  base32Decode,
  base32Encode,
  decryptMfaSecret,
  encryptMfaSecret,
  totpAt,
  verifyTotp,
} from "@/lib/mfa";

describe("TOTP", () => {
  beforeEach(() => {
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("matches the RFC 6238 SHA-1 test vector after truncating to six digits", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(totpAt(secret, 59_000).code).toBe("287082");
  });

  it("accepts adjacent time steps but prevents replay", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    const { code, step } = totpAt(secret, 60_000);
    expect(verifyTotp(secret, code, { timeMs: 60_000 })).toBe(step);
    expect(verifyTotp(secret, code, { timeMs: 60_000, lastUsedStep: step })).toBeNull();
  });

  it("round-trips base32 and encrypted secrets", () => {
    const value = Buffer.from("private-office-mfa");
    expect(base32Decode(base32Encode(value))).toEqual(value);
    const encrypted = encryptMfaSecret("ABCDEF234567");
    expect(encrypted).not.toContain("ABCDEF234567");
    expect(decryptMfaSecret(encrypted)).toBe("ABCDEF234567");
  });
});
