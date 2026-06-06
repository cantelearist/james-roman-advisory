import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSentryInitOptions,
  captureAuditWriteFailure,
  captureAuthFailure,
  captureMonitoringEvent,
  captureSignedUrlFailure,
  captureUploadCompletionFailure,
  isSentryConfigured,
  scrubSentryEvent,
  scrubObject,
  scrubPii,
  scrubUrl,
} from "./monitoring";

// ---------------------------------------------------------------------------
// scrubPii
// ---------------------------------------------------------------------------

describe("scrubPii", () => {
  it("redacts signed URL token query parameter", () => {
    const url = "https://xyz.supabase.co/storage/v1/object/sign/case-files/path?token=eyJhbGciOiJIUzI1NiJ9.abc.xyz";
    expect(scrubPii(url)).toContain("token=[REDACTED]");
    expect(scrubPii(url)).not.toContain("eyJhbGciOiJIUzI1NiJ9");
  });

  it("redacts upload_token query parameter", () => {
    const url = "https://xyz.supabase.co/storage/v1/upload/sign/case-files/path?upload_token=secrettoken123";
    expect(scrubPii(url)).toContain("upload_token=[REDACTED]");
    expect(scrubPii(url)).not.toContain("secrettoken123");
  });

  it("redacts JWT-shaped strings", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEifQ.signature123";
    expect(scrubPii(jwt)).toBe("[JWT_REDACTED]");
  });

  it("redacts Bearer token in Authorization-style strings", () => {
    const header = "Authorization: Bearer super-secret-access-token-12345";
    const scrubbed = scrubPii(header);
    expect(scrubbed).toContain("Bearer [REDACTED]");
    expect(scrubbed).not.toContain("super-secret-access-token-12345");
  });

  it("redacts Basic auth credentials", () => {
    const header = "Authorization: Basic dXNlcjpwYXNzd29yZA==";
    const scrubbed = scrubPii(header);
    expect(scrubbed).toContain("Basic [REDACTED]");
  });

  it("redacts email addresses", () => {
    const text = "Client email: client.name+tag@example.com was logged";
    const scrubbed = scrubPii(text);
    expect(scrubbed).toContain("[EMAIL_REDACTED]");
    expect(scrubbed).not.toContain("client.name+tag@example.com");
  });

  it("redacts filenames in Supabase storage paths while preserving UUID structure", () => {
    const path =
      "tenant-uuid-here/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/contract-draft-confidential.pdf";
    const scrubbed = scrubPii(path);
    expect(scrubbed).toContain("[FILENAME_REDACTED]");
    expect(scrubbed).not.toContain("contract-draft-confidential.pdf");
    // UUIDs preserved for debugging
    expect(scrubbed).toContain("00000000-0000-4000-8000-000000000001");
  });

  it("redacts Supabase service-role key patterns", () => {
    const text = "key: service_role_some_jwt_value_here";
    expect(scrubPii(text)).not.toContain("service_role_some_jwt_value_here");
  });

  it("redacts sbp_ prefixed Supabase keys", () => {
    const key = "sbp_" + "a".repeat(40);
    expect(scrubPii(key)).toContain("[SUPABASE_KEY_REDACTED]");
  });

  it("redacts AWS presigned URL parameters", () => {
    const url = "https://bucket.s3.amazonaws.com/file?X-Amz-Signature=abc123&X-Amz-Security-Token=tok456";
    const scrubbed = scrubPii(url);
    expect(scrubbed).toContain("X-Amz-Signature=[REDACTED]");
    expect(scrubbed).toContain("X-Amz-Security-Token=[REDACTED]");
    expect(scrubbed).not.toContain("abc123");
    expect(scrubbed).not.toContain("tok456");
  });

  it("does not modify clean strings without PII", () => {
    const clean = "Document ID: doc-uuid-1234, matter: matter-uuid-5678, status: available";
    expect(scrubPii(clean)).toBe(clean);
  });

  it("handles empty string", () => {
    expect(scrubPii("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// scrubUrl
// ---------------------------------------------------------------------------

describe("scrubUrl", () => {
  it("redacts token from Supabase signed URL while preserving path", () => {
    const url =
      "https://project.supabase.co/storage/v1/object/sign/case-files/path/to/file.pdf?token=supersecrettoken";
    const scrubbed = scrubUrl(url);
    expect(scrubbed).toContain("token=[REDACTED]");
    expect(scrubbed).not.toContain("supersecrettoken");
    expect(scrubbed).toContain("/storage/v1/object/sign/case-files/");
  });

  it("preserves non-sensitive query params", () => {
    const url = "https://project.supabase.co/storage/v1/object/sign/bucket/path?download=true&token=secret";
    const scrubbed = scrubUrl(url);
    expect(scrubbed).toContain("download=true");
    expect(scrubbed).toContain("token=[REDACTED]");
  });

  it("redacts X-Amz-Signature", () => {
    const url = "https://s3.amazonaws.com/bucket/file?X-Amz-Signature=abcdef&X-Amz-Expires=120";
    const scrubbed = scrubUrl(url);
    expect(scrubbed).toContain("X-Amz-Signature=[REDACTED]");
    expect(scrubbed).toContain("X-Amz-Expires=120");
  });

  it("falls back to scrubPii for malformed URLs", () => {
    // A malformed URL that still contains a token should still be scrubbed
    const malformed = "not-a-url?token=shouldbegone&other=keep";
    const scrubbed = scrubUrl(malformed);
    expect(scrubbed).toContain("token=[REDACTED]");
    expect(scrubbed).not.toContain("shouldbegone");
  });
});

// ---------------------------------------------------------------------------
// scrubObject
// ---------------------------------------------------------------------------

describe("scrubObject", () => {
  it("scrubs nested object properties", () => {
    const obj = {
      userId: "user-uuid",
      action: "download",
      signedUrl: "https://storage.supabase.co/sign?token=secretvalue",
    };
    const scrubbed = scrubObject(obj) as typeof obj;
    expect(JSON.stringify(scrubbed)).not.toContain("secretvalue");
    expect(JSON.stringify(scrubbed)).toContain("user-uuid");
  });

  it("scrubs email in nested context", () => {
    const obj = { meta: { clientEmail: "client@example.com", action: "view" } };
    const scrubbed = scrubObject(obj);
    expect(JSON.stringify(scrubbed)).toContain("[EMAIL_REDACTED]");
    expect(JSON.stringify(scrubbed)).not.toContain("client@example.com");
  });

  it("returns error sentinel for non-serializable values", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = scrubObject(circular) as { error: string };
    expect(result.error).toBe("scrub_failed");
  });
});

// ---------------------------------------------------------------------------
// Sentry payload scrubbing
// ---------------------------------------------------------------------------

describe("scrubSentryEvent", () => {
  it("scrubs PII from Sentry event messages and request data before send", () => {
    const event = scrubSentryEvent({
      message: "Failed for client@example.com",
      user: { id: "user-1", email: "client@example.com" },
      request: {
        url: "https://www.jamesroman.la/api/documents/download?token=super-secret-token",
        headers: {
          authorization: "Bearer secret-token",
          cookie: "session=secret",
        },
      },
      extra: {
        signedUrl: "https://storage.supabase.co/object/sign/case-files/path?token=abc123",
        filename: "private-report.pdf",
      },
    });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("client@example.com");
    expect(serialized).not.toContain("super-secret-token");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("private-report.pdf");
    expect(serialized).toContain("[EMAIL_REDACTED]");
    expect(event?.user).toEqual({ id: "user-1" });
    expect(event?.request?.headers).toBeUndefined();
  });

  it("builds conservative Sentry init options with replay and tracing disabled", () => {
    const options = buildSentryInitOptions({
      dsn: "https://public@example.ingest.sentry.io/1",
      environment: "staging",
    });

    expect(options.dsn).toBe("https://public@example.ingest.sentry.io/1");
    expect(options.environment).toBe("staging");
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.replaysSessionSampleRate).toBe(0);
    expect(options.replaysOnErrorSampleRate).toBe(0);
    expect(options.beforeSend).toBe(scrubSentryEvent);
  });

  it("only considers Sentry configured when a DSN is present", () => {
    expect(isSentryConfigured({ dsn: "https://public@example.ingest.sentry.io/1" })).toBe(true);
    expect(isSentryConfigured({ dsn: "" })).toBe(false);
    expect(isSentryConfigured({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// captureMonitoringEvent — structured log output
// ---------------------------------------------------------------------------

describe("captureMonitoringEvent", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits console.error for severity=error", () => {
    captureMonitoringEvent({ category: "api.error_5xx", severity: "error", message: "test error" });
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("emits console.warn for severity=warning", () => {
    captureMonitoringEvent({ category: "auth.failure", severity: "warning", message: "auth warn" });
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("emits console.log for severity=info", () => {
    captureMonitoringEvent({ category: "api.error_5xx", severity: "info", message: "info msg" });
    expect(logSpy).toHaveBeenCalledOnce();
  });

  it("structured log output is valid JSON", () => {
    captureMonitoringEvent({ category: "api.error_5xx", severity: "error", message: "test" });
    const rawArg = errorSpy.mock.calls[0][0] as string;
    expect(() => JSON.parse(rawArg)).not.toThrow();
  });

  it("scrubs email addresses in context before logging", () => {
    captureMonitoringEvent({
      category: "auth.failure",
      severity: "warning",
      message: "login attempt",
      context: { email: "secret@client.com" },
    });
    const rawArg = warnSpy.mock.calls[0][0] as string;
    expect(rawArg).not.toContain("secret@client.com");
    expect(rawArg).toContain("[EMAIL_REDACTED]");
  });

  it("scrubs error message containing a JWT", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEifQ.sig";
    captureMonitoringEvent({ category: "api.error_5xx", severity: "error", message: "token debug" }, new Error(jwt));
    const rawArg = errorSpy.mock.calls[0][0] as string;
    expect(rawArg).not.toContain(jwt);
    expect(rawArg).toContain("[JWT_REDACTED]");
  });

  it("includes category, severity, userId, tenantId, route in output", () => {
    captureMonitoringEvent({
      category: "document.signed_url_failure",
      severity: "error",
      message: "URL creation failed",
      userId: "user-123",
      tenantId: "tenant-456",
      route: "/api/documents/[documentId]/download",
    });
    const rawArg = errorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(rawArg);
    expect(parsed.category).toBe("document.signed_url_failure");
    expect(parsed.userId).toBe("user-123");
    expect(parsed.tenantId).toBe("tenant-456");
    expect(parsed.route).toBe("/api/documents/[documentId]/download");
  });
});

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

describe("captureAuthFailure", () => {
  it("emits a warning with category auth.failure", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    captureAuthFailure("no_profile", { route: "/admin", userId: "u-1" });
    const parsed = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(parsed.category).toBe("auth.failure");
    expect(parsed.severity).toBe("warning");
    vi.restoreAllMocks();
  });
});

describe("captureSignedUrlFailure", () => {
  it("emits an error with category document.signed_url_failure for upload", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    captureSignedUrlFailure("upload", { documentId: "doc-1", userId: "u-1" });
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.category).toBe("document.signed_url_failure");
    expect(JSON.stringify(parsed.context)).toContain("upload");
    vi.restoreAllMocks();
  });
});

describe("captureAuditWriteFailure", () => {
  it("emits an error with category audit.write_failure", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    captureAuditWriteFailure("document.download", new Error("db write error"));
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.category).toBe("audit.write_failure");
    expect(parsed.error.message).toContain("db write error");
    vi.restoreAllMocks();
  });
});

describe("captureUploadCompletionFailure", () => {
  it("emits an error with category document.upload_completion_failure", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    captureUploadCompletionFailure("doc-99", new Error("storage timeout"), { userId: "u-1", matterId: "m-1" });
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.category).toBe("document.upload_completion_failure");
    expect(parsed.context.documentId).toBe("doc-99");
    vi.restoreAllMocks();
  });
});
