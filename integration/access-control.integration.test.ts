import { beforeAll, describe, expect, it } from "vitest";

import type { DisposableRuntimeRoleConfig } from "@/lib/disposable-runtime-role";
import { assertDisposableRuntimeRoleEnvironment } from "@/lib/disposable-runtime-role";
import type { AuthContext } from "@/lib/auth";

let config: DisposableRuntimeRoleConfig;
let prefix: string;
let matterA: string;
let matterB: string;
let matterExpired: string;
let clientA: string;
let clientB: string;

const users = {
  superAdmin: "",
  globalAdmin: "",
  assignedAdmin: "",
  contractor: "",
  client: "",
  noProfile: "",
};

function context(
  userId: string,
  role: AuthContext["role"],
): AuthContext {
  return {
    userId,
    role,
    user: {
      id: userId,
      role,
      name: `Integration ${role}`,
      email: `${userId}@example.invalid`,
    },
  };
}

beforeAll(async () => {
  config = assertDisposableRuntimeRoleEnvironment(process.env);
  process.env.DATABASE_URL = config.runtimeDatabaseUrl;

  const { getDb } = await import("@/lib/db");
  const { assertRequiredSchemaVersions } = await import(
    "@/lib/schema-readiness"
  );
  const {
    ADMIN_PROFILE_CAPABILITIES,
  } = await import("@/lib/access-control");
  const { CAPABILITIES } = await import("@/lib/data-model");
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const adminCapabilities = JSON.stringify(ADMIN_PROFILE_CAPABILITIES);
  const allCapabilities = JSON.stringify(CAPABILITIES);

  prefix = `integration-${crypto.randomUUID()}`;
  for (const key of Object.keys(users) as Array<keyof typeof users>) {
    users[key] = `${prefix}-${key}`;
  }
  clientA = `${prefix}-client-a`;
  clientB = `${prefix}-client-b`;
  matterA = `${prefix}-matter-a`;
  matterB = `${prefix}-matter-b`;
  matterExpired = `${prefix}-matter-expired`;

  await sql.transaction((tx) => [
    tx`
      INSERT INTO users (id, name, email, role, status)
      VALUES
        (${users.superAdmin}, 'Integration Super Admin', ${`${users.superAdmin}@example.invalid`}, 'super_admin', 'active'),
        (${users.globalAdmin}, 'Integration Global Admin', ${`${users.globalAdmin}@example.invalid`}, 'admin', 'active'),
        (${users.assignedAdmin}, 'Integration Assigned Admin', ${`${users.assignedAdmin}@example.invalid`}, 'admin', 'active'),
        (${users.contractor}, 'Integration Contractor', ${`${users.contractor}@example.invalid`}, 'contractor', 'active'),
        (${users.client}, 'Integration Client', ${`${users.client}@example.invalid`}, 'client', 'active'),
        (${users.noProfile}, 'Integration No Profile', ${`${users.noProfile}@example.invalid`}, 'admin', 'active')
    `,
    tx`
      INSERT INTO clients (id, user_id, name, email)
      VALUES
        (${clientA}, ${users.client}, 'Integration Client A', ${`${users.client}@example.invalid`}),
        (${clientB}, NULL, 'Integration Client B', 'client-b@example.invalid')
    `,
    tx`
      INSERT INTO matters (id, client_id, title, type, status)
      VALUES
        (${matterA}, ${clientA}, 'Integration Matter A', 'other', 'active'),
        (${matterB}, ${clientB}, 'Integration Matter B', 'other', 'active'),
        (${matterExpired}, ${clientB}, 'Integration Expired Matter', 'other', 'active')
    `,
    tx`
      INSERT INTO permission_profiles (
        id, name, role_type, permissions, is_system
      )
      VALUES
        (
          ${`${prefix}-profile-global-admin`},
          'Integration Global Admin',
          'admin',
          CAST(${adminCapabilities} AS JSONB),
          FALSE
        ),
        (
          ${`${prefix}-profile-assigned-admin`},
          'Integration Assigned Admin',
          'admin',
          CAST(${adminCapabilities} AS JSONB),
          FALSE
        ),
        (
          ${`${prefix}-profile-contractor`},
          'Integration Contractor',
          'contractor',
          CAST(${allCapabilities} AS JSONB),
          FALSE
        )
    `,
    tx`
      INSERT INTO user_permission_assignments (
        user_id, permission_profile_id, access_scope, assigned_by
      )
      VALUES
        (
          ${users.globalAdmin},
          ${`${prefix}-profile-global-admin`},
          'global',
          ${users.superAdmin}
        ),
        (
          ${users.assignedAdmin},
          ${`${prefix}-profile-assigned-admin`},
          'assigned',
          ${users.superAdmin}
        ),
        (
          ${users.contractor},
          ${`${prefix}-profile-contractor`},
          'assigned',
          ${users.superAdmin}
        )
      ON CONFLICT (user_id) DO UPDATE SET
        permission_profile_id = EXCLUDED.permission_profile_id,
        access_scope = EXCLUDED.access_scope,
        assigned_by = EXCLUDED.assigned_by
    `,
    tx`
      INSERT INTO engagement_memberships (
        id, matter_id, user_id, member_role, status, expires_at, assigned_by
      )
      VALUES
        (
          ${`${prefix}-membership-admin`},
          ${matterA},
          ${users.assignedAdmin},
          'admin',
          'active',
          NULL,
          ${users.superAdmin}
        ),
        (
          ${`${prefix}-membership-contractor-active`},
          ${matterA},
          ${users.contractor},
          'contractor',
          'active',
          NULL,
          ${users.superAdmin}
        ),
        (
          ${`${prefix}-membership-contractor-revoked`},
          ${matterB},
          ${users.contractor},
          'contractor',
          'revoked',
          NULL,
          ${users.superAdmin}
        ),
        (
          ${`${prefix}-membership-client-active`},
          ${matterA},
          ${users.client},
          'client',
          'active',
          NULL,
          ${users.superAdmin}
        ),
        (
          ${`${prefix}-membership-client-expired`},
          ${matterExpired},
          ${users.client},
          'client',
          'active',
          NOW() - INTERVAL '1 minute',
          ${users.superAdmin}
        )
    `,
  ]);
});

describe("database-backed role, capability, and scope policy", () => {
  it("gives Super Admin every declared capability on every scope", async () => {
    const { authorizeCapability, getPortalAccessSummary } = await import(
      "@/lib/access-control"
    );
    const { CAPABILITIES } = await import("@/lib/data-model");
    const auth = context(users.superAdmin, "super_admin");
    const access = await getPortalAccessSummary(auth);

    expect(access.scope).toBe("global");
    for (const capability of CAPABILITIES) {
      expect(access.capabilities, capability).toContain(capability);
      await expect(
        authorizeCapability(auth, access, capability, { matterId: matterB }),
        capability,
      ).resolves.toBe(true);
    }
  });

  it("enforces the full Admin ceiling while preserving global scope", async () => {
    const {
      ADMIN_PROFILE_CAPABILITIES,
      authorizeCapability,
      getPortalAccessSummary,
    } = await import("@/lib/access-control");
    const { CAPABILITIES } = await import("@/lib/data-model");
    const auth = context(users.globalAdmin, "admin");
    const access = await getPortalAccessSummary(auth);

    expect(access.scope).toBe("global");
    for (const capability of CAPABILITIES) {
      const expected = ADMIN_PROFILE_CAPABILITIES.includes(capability);
      expect(access.capabilities.includes(capability), capability).toBe(expected);
      await expect(
        authorizeCapability(auth, access, capability, { matterId: matterB }),
        capability,
      ).resolves.toBe(expected);
    }
  });

  it("applies every Admin capability only inside active assigned scope", async () => {
    const {
      ADMIN_PROFILE_CAPABILITIES,
      authorizeCapability,
      getPortalAccessSummary,
    } = await import("@/lib/access-control");
    const { CAPABILITIES } = await import("@/lib/data-model");
    const auth = context(users.assignedAdmin, "admin");
    const access = await getPortalAccessSummary(auth);

    for (const capability of CAPABILITIES) {
      const expected = ADMIN_PROFILE_CAPABILITIES.includes(capability);
      await expect(
        authorizeCapability(auth, access, capability, { matterId: matterA }),
        `${capability}: active membership`,
      ).resolves.toBe(expected);
      await expect(
        authorizeCapability(auth, access, capability, { matterId: matterB }),
        `${capability}: absent membership`,
      ).resolves.toBe(false);
    }
  });

  it("applies the full Contractor ceiling and rejects revoked scope", async () => {
    const {
      CONTRACTOR_PROFILE_CAPABILITIES,
      authorizeCapability,
      getPortalAccessSummary,
    } = await import("@/lib/access-control");
    const { CAPABILITIES } = await import("@/lib/data-model");
    const auth = context(users.contractor, "contractor");
    const access = await getPortalAccessSummary(auth);

    for (const capability of CAPABILITIES) {
      const expected = CONTRACTOR_PROFILE_CAPABILITIES.includes(capability);
      expect(access.capabilities.includes(capability), capability).toBe(expected);
      await expect(
        authorizeCapability(auth, access, capability, { matterId: matterA }),
        `${capability}: active membership`,
      ).resolves.toBe(expected);
      await expect(
        authorizeCapability(auth, access, capability, { matterId: matterB }),
        `${capability}: revoked membership`,
      ).resolves.toBe(false);
    }
  });

  it("applies every Client capability only to active memberships", async () => {
    const {
      authorizeCapability,
      getPortalAccessSummary,
      hasActiveClientMembership,
    } = await import("@/lib/access-control");
    const { CAPABILITIES } = await import("@/lib/data-model");
    const auth = context(users.client, "client");
    const access = await getPortalAccessSummary(auth);

    for (const capability of CAPABILITIES) {
      const expected = access.capabilities.includes(capability);
      await expect(
        authorizeCapability(auth, access, capability, { matterId: matterA }),
        `${capability}: active membership`,
      ).resolves.toBe(expected);
      await expect(
        authorizeCapability(auth, access, capability, {
          matterId: matterExpired,
        }),
        `${capability}: expired membership`,
      ).resolves.toBe(false);
      await expect(
        authorizeCapability(auth, access, capability, { matterId: matterB }),
        `${capability}: absent membership`,
      ).resolves.toBe(false);
    }
    await expect(hasActiveClientMembership(users.client, clientA)).resolves.toBe(
      true,
    );
    await expect(hasActiveClientMembership(users.client, clientB)).resolves.toBe(
      false,
    );
  });

  it("defaults staff without a Permission Profile to no capabilities", async () => {
    const { authorizeCapability, getPortalAccessSummary } = await import(
      "@/lib/access-control"
    );
    const auth = context(users.noProfile, "admin");
    const access = await getPortalAccessSummary(auth);

    expect(access.capabilities).toEqual([]);
    await expect(
      authorizeCapability(auth, access, "engagements.view", {
        matterId: matterA,
      }),
    ).resolves.toBe(false);
  });
});
