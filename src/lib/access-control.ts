import type { AuthContext } from "@/lib/auth";
import {
  CAPABILITIES,
  type AccessScope,
  type Capability,
  type ResourceAudience,
  type UserRole,
} from "@/lib/data-model";
import { ensureAccessControlTables, getDb } from "@/lib/db";

const CLIENT_CAPABILITIES: readonly Capability[] = [
  "clients.view",
  "engagements.view",
  "documents.view",
  "documents.upload",
  "timeline.view",
  "messages.view",
  "messages.send",
  "contracts.view",
  "finance.view",
];

export const SUPER_ADMIN_ONLY_CAPABILITIES: readonly Capability[] = [
  "access.manage",
  "settings.manage",
];

export const ADMIN_PROFILE_CAPABILITIES: readonly Capability[] = CAPABILITIES.filter(
  (capability) => !SUPER_ADMIN_ONLY_CAPABILITIES.includes(capability),
);

export const CONTRACTOR_PROFILE_CAPABILITIES: readonly Capability[] = [
  "engagements.view",
  "engagements.update",
  "documents.view",
  "documents.upload",
  "documents.generate_pdf",
  "timeline.view",
  "timeline.manage",
  "messages.view",
  "messages.send",
  "contracts.view",
  "finance.view",
];

export function profileCapabilityCeiling(
  role: "admin" | "contractor",
): readonly Capability[] {
  return role === "admin" ? ADMIN_PROFILE_CAPABILITIES : CONTRACTOR_PROFILE_CAPABILITIES;
}

export type PortalAccessSummary = {
  role: UserRole;
  capabilities: Capability[];
  scope: AccessScope;
  permissionProfile: {
    id: string;
    name: string;
  } | null;
};

function validCapabilities(value: unknown): Capability[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(CAPABILITIES);
  return [...new Set(value.filter((item): item is Capability => typeof item === "string" && allowed.has(item)))];
}

export function hasCapability(summary: PortalAccessSummary, capability: Capability): boolean {
  return summary.role === "super_admin" || summary.capabilities.includes(capability);
}

export function canReceiveAudience(
  role: UserRole,
  audience: ResourceAudience,
  publicationStatus: "pending_review" | "published" = "published",
): boolean {
  if (role === "super_admin" || role === "admin") return true;
  if (role === "contractor") return audience === "contractor" || (audience === "client" && publicationStatus === "published");
  return audience === "client" && publicationStatus === "published";
}

export async function getPortalAccessSummary(context: AuthContext): Promise<PortalAccessSummary> {
  await ensureAccessControlTables();
  if (context.role === "super_admin") {
    return {
      role: context.role,
      capabilities: [...CAPABILITIES],
      scope: "global",
      permissionProfile: null,
    };
  }

  if (context.role === "client") {
    return {
      role: context.role,
      capabilities: [...CLIENT_CAPABILITIES],
      scope: "assigned",
      permissionProfile: null,
    };
  }

  const sql = getDb();
  const rows = await sql`
    SELECT
      p.id,
      p.name,
      p.permissions,
      a.access_scope
    FROM user_permission_assignments a
    JOIN permission_profiles p ON p.id = a.permission_profile_id
    WHERE a.user_id = ${context.userId}
      AND p.role_type = ${context.role}
    LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return {
      role: context.role,
      capabilities: [],
      scope: "assigned",
      permissionProfile: null,
    };
  }

  const ceiling = profileCapabilityCeiling(context.role);
  const capabilities = validCapabilities(row.permissions).filter((capability) =>
    ceiling.includes(capability),
  );
  return {
    role: context.role,
    capabilities,
    scope: row.access_scope === "global" ? "global" : "assigned",
    permissionProfile: {
      id: String(row.id),
      name: String(row.name),
    },
  };
}

export async function hasActiveEngagementMembership(
  userId: string,
  matterId: string,
): Promise<boolean> {
  await ensureAccessControlTables();
  const sql = getDb();
  const rows = await sql`
    SELECT 1
    FROM engagement_memberships
    WHERE user_id = ${userId}
      AND matter_id = ${matterId}
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function hasActiveClientMembership(
  userId: string,
  clientId: string,
): Promise<boolean> {
  await ensureAccessControlTables();
  const sql = getDb();
  const rows = await sql`
    SELECT 1
    FROM engagement_memberships em
    JOIN matters m ON m.id = em.matter_id
    WHERE em.user_id = ${userId}
      AND m.client_id = ${clientId}
      AND em.status = 'active'
      AND (em.expires_at IS NULL OR em.expires_at > NOW())
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function authorizeCapability(
  context: AuthContext,
  summary: PortalAccessSummary,
  capability: Capability,
  resource?: { matterId?: string; clientId?: string },
): Promise<boolean> {
  if (!hasCapability(summary, capability)) return false;
  if (context.role === "super_admin") return true;
  if (summary.scope === "global" && context.role === "admin") return true;

  if (resource?.matterId) {
    return hasActiveEngagementMembership(context.userId, resource.matterId);
  }
  if (resource?.clientId) {
    return hasActiveClientMembership(context.userId, resource.clientId);
  }

  // List endpoints must still apply membership joins when scope is assigned.
  return true;
}

export async function logAccessAudit(options: {
  actorId: string;
  action: string;
  targetUserId?: string;
  matterId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await ensureAccessControlTables();
  const sql = getDb();
  await sql`
    INSERT INTO access_audit_events (
      actor_id,
      action,
      target_user_id,
      matter_id,
      metadata
    )
    VALUES (
      ${options.actorId},
      ${options.action},
      ${options.targetUserId ?? null},
      ${options.matterId ?? null},
      ${options.metadata ? JSON.stringify(options.metadata) : null}
    )
  `;
}
