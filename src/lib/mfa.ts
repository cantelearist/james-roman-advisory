import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

function encryptionKey(): Buffer {
  const value = process.env.MFA_ENCRYPTION_KEY;
  if (!value) throw new Error("MFA_ENCRYPTION_KEY is not set");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new Error("MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of input.toUpperCase().replace(/=|\s|-/g, "")) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Invalid base32 value");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpAt(secret: string, timeMs = Date.now()): { code: string; step: number } {
  const step = Math.floor(timeMs / 1000 / STEP_SECONDS);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return { code: String(binary % 1_000_000).padStart(6, "0"), step };
}

export function verifyTotp(
  secret: string,
  code: string,
  options: { timeMs?: number; lastUsedStep?: number | null } = {},
): number | null {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const now = options.timeMs ?? Date.now();
  for (const offset of [-1, 0, 1]) {
    const result = totpAt(secret, now + offset * STEP_SECONDS * 1000);
    const actual = Buffer.from(result.code);
    const supplied = Buffer.from(normalized);
    if (
      actual.length === supplied.length &&
      timingSafeEqual(actual, supplied) &&
      (options.lastUsedStep == null || result.step > options.lastUsedStep)
    ) {
      return result.step;
    }
  }
  return null;
}

export function encryptMfaSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptMfaSecret(value: string): string {
  const [ivText, tagText, ciphertextText] = value.split(".");
  if (!ivText || !tagText || !ciphertextText) throw new Error("Invalid encrypted MFA secret");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createOtpAuthUri(secret: string, email: string): string {
  const issuer = "James Roman Advisory";
  const label = `${issuer}:${email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

export function hashAuthToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const text = randomBytes(8).toString("hex").toUpperCase();
    return `${text.slice(0, 4)}-${text.slice(4, 8)}-${text.slice(8, 12)}-${text.slice(12)}`;
  });
}

export function normalizeRecoveryCode(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
