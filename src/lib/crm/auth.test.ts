import { beforeEach, describe, expect, it, vi } from "vitest";

// redirect throws so tests can assert it was called without Next.js internals.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const { mockGetUser, mockGetProfile, mockGetAAL } = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockGetAAL = vi.fn();
  const mockGetProfile = vi.fn();

  const profileQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: mockGetProfile,
  };

  const serverClientMock = {
    auth: {
      getUser: mockGetUser,
      mfa: {
        getAuthenticatorAssuranceLevel: mockGetAAL,
      },
    },
    from: vi.fn(() => profileQuery),
  };

  // Expose via module factory return so vi.mock closures can reference them.
  (globalThis as Record<string, unknown>).__serverClientMock__ = serverClientMock;

  return { mockGetUser, mockGetProfile, mockGetAAL };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () =>
    (globalThis as Record<string, unknown>).__serverClientMock__,
}));

import { redirect } from "next/navigation";
import {
  getCurrentAuthContext,
  isTeamRole,
  requireAuthContext,
  requireTeamContext,
} from "./auth";

const baseProfile = {
  id: "user-1",
  tenant_id: "tenant-1",
  email: "advisor@example.com",
  full_name: "James Advisor",
  role: "advisor" as const,
  mfa_required: false,
  disabled_at: null,
};

describe("getCurrentAuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no session user exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect(await getCurrentAuthContext()).toBeNull();
  });

  it("returns null when profile fetch errors", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });
    mockGetProfile.mockResolvedValue({ data: null, error: new Error("not found") });
    expect(await getCurrentAuthContext()).toBeNull();
  });

  it("returns null when profile is missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });
    mockGetProfile.mockResolvedValue({ data: null, error: null });
    expect(await getCurrentAuthContext()).toBeNull();
  });

  it("returns null for a disabled user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@b.com" } },
    });
    mockGetProfile.mockResolvedValue({
      data: { ...baseProfile, disabled_at: "2026-01-01T00:00:00Z" },
      error: null,
    });
    expect(await getCurrentAuthContext()).toBeNull();
  });

  it("returns auth context when user is authenticated and MFA not required", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "advisor@example.com" } },
    });
    mockGetProfile.mockResolvedValue({ data: baseProfile, error: null });

    const context = await getCurrentAuthContext();
    expect(context).not.toBeNull();
    expect(context?.userId).toBe("user-1");
    expect(context?.email).toBe("advisor@example.com");
    expect(context?.profile.role).toBe("advisor");
    // MFA check must not be called when mfa_required is false.
    expect(mockGetAAL).not.toHaveBeenCalled();
  });

  it("returns null when MFA is required but session is only AAL1", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "advisor@example.com" } },
    });
    mockGetProfile.mockResolvedValue({
      data: { ...baseProfile, mfa_required: true },
      error: null,
    });
    mockGetAAL.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" } });

    expect(await getCurrentAuthContext()).toBeNull();
  });

  it("returns null when MFA is required and AAL data is unavailable", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "advisor@example.com" } },
    });
    mockGetProfile.mockResolvedValue({
      data: { ...baseProfile, mfa_required: true },
      error: null,
    });
    mockGetAAL.mockResolvedValue({ data: null });

    expect(await getCurrentAuthContext()).toBeNull();
  });

  it("returns auth context when MFA is required and session is at AAL2", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "advisor@example.com" } },
    });
    mockGetProfile.mockResolvedValue({
      data: { ...baseProfile, mfa_required: true },
      error: null,
    });
    mockGetAAL.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" } });

    const context = await getCurrentAuthContext();
    expect(context).not.toBeNull();
    expect(context?.profile.mfa_required).toBe(true);
  });
});

describe("requireAuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns context for an authenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "advisor@example.com" } },
    });
    mockGetProfile.mockResolvedValue({ data: baseProfile, error: null });

    const context = await requireAuthContext();
    expect(context.userId).toBe("user-1");
  });

  it("redirects to /sign-in when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(requireAuthContext()).rejects.toThrow("REDIRECT:/sign-in");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("redirects to /sign-in when MFA is required but not completed", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "advisor@example.com" } },
    });
    mockGetProfile.mockResolvedValue({
      data: { ...baseProfile, mfa_required: true },
      error: null,
    });
    mockGetAAL.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" } });

    await expect(requireAuthContext()).rejects.toThrow("REDIRECT:/sign-in");
  });
});

describe("requireTeamContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["owner", "admin", "advisor"] as const)(
    "returns context for team role: %s",
    async (role) => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "t@example.com" } },
      });
      mockGetProfile.mockResolvedValue({ data: { ...baseProfile, role }, error: null });

      const context = await requireTeamContext();
      expect(context.profile.role).toBe(role);
    },
  );

  it("redirects clients away from admin routes", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "c@example.com" } },
    });
    mockGetProfile.mockResolvedValue({
      data: { ...baseProfile, role: "client" },
      error: null,
    });

    await expect(requireTeamContext()).rejects.toThrow("REDIRECT:/office");
    expect(redirect).toHaveBeenCalledWith("/office");
  });
});

describe("isTeamRole", () => {
  it.each(["owner", "admin", "advisor"] as const)("returns true for team role: %s", (role) => {
    expect(isTeamRole(role)).toBe(true);
  });

  it("returns false for client role", () => {
    expect(isTeamRole("client")).toBe(false);
  });
});
