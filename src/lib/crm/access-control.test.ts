import { beforeEach, describe, expect, it, vi } from "vitest";

const { adminClientMock, serverFromMock, serverClientMock, tables } = vi.hoisted(() => {
  const tables: string[] = [];

  function createQuery(table: string) {
    const query = {
      table,
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      neq: vi.fn(() => query),
      is: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      in: vi.fn(() => query),
      single: vi.fn(async () => ({ data: { id: "row-1" }, error: null })),
      maybeSingle: vi.fn(async () => ({ data: { id: "row-1" }, error: null })),
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: [], error: null }),
    };

    return query;
  }

  const serverFromMock = vi.fn((table: string) => {
    tables.push(table);
    return createQuery(table);
  });

  return {
    adminClientMock: { from: vi.fn() },
    serverClientMock: { from: serverFromMock },
    serverFromMock,
    tables,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminClientMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => serverClientMock,
}));

import type { AuthContext } from "./auth";
import {
  listAdminDashboard,
  listOfficeDashboard,
  userCanAccessMatter,
  userCanMessageMatter,
  userCanUploadToMatter,
  userCanViewMatterDocuments,
} from "./data";

const clientContext: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "client@example.com",
  profile: {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "22222222-2222-4222-8222-222222222222",
    email: "client@example.com",
    full_name: "Private Client",
    role: "client",
    mfa_required: false,
    disabled_at: null,
  },
};

const adminContext: AuthContext = {
  ...clientContext,
  userId: "33333333-3333-4333-8333-333333333333",
  email: "advisor@example.com",
  profile: {
    ...clientContext.profile,
    id: "33333333-3333-4333-8333-333333333333",
    email: "advisor@example.com",
    role: "advisor",
  },
};

describe("CRM access-control data helpers", () => {
  beforeEach(() => {
    tables.length = 0;
    vi.clearAllMocks();
  });

  it("uses the user-scoped server client for admin dashboard reads", async () => {
    await listAdminDashboard(adminContext);

    expect(serverFromMock).toHaveBeenCalled();
    expect(adminClientMock.from).not.toHaveBeenCalled();
    expect(tables).toEqual([
      "clients",
      "matters",
      "documents",
      "messages",
      "invoices",
      "audit_logs",
    ]);
  });

  it("uses RLS-backed user reads for the client office dashboard", async () => {
    await listOfficeDashboard(clientContext);

    expect(adminClientMock.from).not.toHaveBeenCalled();
    expect(tables).toEqual(["matters", "documents", "messages", "timeline_events", "invoices"]);
  });

  it("uses user-scoped checks for matter and grant access", async () => {
    await userCanAccessMatter(clientContext, "44444444-4444-4444-8444-444444444444");
    await userCanViewMatterDocuments(clientContext, "44444444-4444-4444-8444-444444444444");
    await userCanUploadToMatter(clientContext, "44444444-4444-4444-8444-444444444444");
    await userCanMessageMatter(clientContext, "44444444-4444-4444-8444-444444444444");

    expect(adminClientMock.from).not.toHaveBeenCalled();
    expect(tables).toEqual(["access_grants", "access_grants", "access_grants", "access_grants"]);
  });
});
