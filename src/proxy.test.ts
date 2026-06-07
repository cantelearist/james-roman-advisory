// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Supabase env vars — must be set before module import so proxy() doesn't
// short-circuit with a 503 "not configured" response.
// ---------------------------------------------------------------------------

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");

// ---------------------------------------------------------------------------
// Supabase SSR mock — hoisted so vi.mock factory can reference the helpers.
// ---------------------------------------------------------------------------

const { mockGetUser, mockGetAAL } = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockGetAAL = vi.fn();

  const supabaseMock = {
    auth: {
      getUser: mockGetUser,
      mfa: { getAuthenticatorAssuranceLevel: mockGetAAL },
    },
  };

  (globalThis as Record<string, unknown>).__supabaseMock__ = supabaseMock;

  return { mockGetUser, mockGetAAL };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(
    () => (globalThis as Record<string, unknown>).__supabaseMock__,
  ),
}));

import { proxy } from "./proxy";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(pathname: string): NextRequest {
  return {
    nextUrl: { pathname },
    url: `https://www.jamesroman.la${pathname}`,
    cookies: { getAll: () => [], set: vi.fn() },
    headers: new Headers(),
  } as unknown as NextRequest;
}

function authenticatedUser() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-1", email: "roman@example.com" } },
  });
}

function noUser() {
  mockGetUser.mockResolvedValue({ data: { user: null } });
}

function aal(current: string, next: string) {
  mockGetAAL.mockResolvedValue({ data: { currentLevel: current, nextLevel: next } });
}

// ---------------------------------------------------------------------------
// Public routes — no auth check
// ---------------------------------------------------------------------------

describe("proxy — public routes", () => {
  it("passes through the home page without checking auth", async () => {
    const response = await proxy(makeRequest("/"));
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("passes through /prototype2 without checking auth", async () => {
    const response = await proxy(makeRequest("/prototype2"));
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("passes through /sign-in without checking auth", async () => {
    const response = await proxy(makeRequest("/sign-in"));
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Protected routes — unauthenticated
// ---------------------------------------------------------------------------

describe("proxy — protected routes, no session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["/portal", "/office", "/admin", "/portal/dashboard"])(
    "redirects unauthenticated user from %s to /sign-in",
    async (path) => {
      noUser();
      const response = await proxy(makeRequest(path));
      expect(response.status).toBe(307);
      const location = response.headers.get("location")!;
      expect(location).toMatch(/\/sign-in/);
      expect(new URL(location).searchParams.get("redirect_url")).toBe(path);
    },
  );
});

// ---------------------------------------------------------------------------
// Protected routes — authenticated, MFA not enrolled (aal1/aal1)
// ---------------------------------------------------------------------------

describe("proxy — authenticated, MFA not enrolled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows access when session is aal1 and no aal2 required", async () => {
    authenticatedUser();
    aal("aal1", "aal1");
    const response = await proxy(makeRequest("/portal"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Protected routes — authenticated, MFA enrolled but NOT completed
// ---------------------------------------------------------------------------

describe("proxy — MFA enrolled but challenge not completed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["/portal", "/office", "/admin"])(
    "redirects from %s to /auth/mfa when nextLevel=aal2 but currentLevel=aal1",
    async (path) => {
      authenticatedUser();
      aal("aal1", "aal2");
      const response = await proxy(makeRequest(path));
      expect(response.status).toBe(307);
      const location = response.headers.get("location")!;
      expect(location).toMatch(/\/auth\/mfa/);
      expect(new URL(location).searchParams.get("redirect_url")).toBe(path);
    },
  );
});

// ---------------------------------------------------------------------------
// Protected routes — authenticated, MFA completed (aal2/aal2)
// ---------------------------------------------------------------------------

describe("proxy — MFA fully satisfied", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows access when currentLevel and nextLevel are both aal2", async () => {
    authenticatedUser();
    aal("aal2", "aal2");
    const response = await proxy(makeRequest("/portal"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
