import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ADMIN_PROFILE_CAPABILITIES,
  CONTRACTOR_PROFILE_CAPABILITIES,
  accessAuditQuery,
  profileCapabilityCeiling,
} from "@/lib/access-control";
import { getAuthContext, isSuperAdmin } from "@/lib/auth";
import {
  CAPABILITIES,
  type Capability,
  type UserRole,
} from "@/lib/data-model";
import { getDb } from "@/lib/db";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

const capabilitySchema = z.enum(CAPABILITIES);
const roleSchema = z.enum(["admin", "contractor", "client"]);

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_profile"),
    name: z.string().trim().min(2).max(80),
    roleType: z.enum(["admin", "contractor"]),
    permissions: z.array(capabilitySchema).max(CAPABILITIES.length),
  }),
  z.object({
    action: z.literal("update_profile"),
    profileId: z.string().min(1),
    name: z.string().trim().min(2).max(80),
    permissions: z.array(capabilitySchema).max(CAPABILITIES.length),
  }),
  z.object({
    action: z.literal("archive_profile"),
    profileId: z.string().min(1),
  }),
  z.object({
    action: z.literal("configure_user"),
    userId: z.string().min(1),
    role: roleSchema,
    permissionProfileId: z.string().min(1).optional(),
    accessScope: z.enum(["global", "assigned"]).default("assigned"),
    status: z.enum(["active", "suspended"]).default("active"),
  }),
  z.object({
    action: z.literal("assign_engagement"),
    userId: z.string().min(1),
    matterId: z.string().min(1),
    expiresAt: z.string().datetime().nullable().optional(),
  }),
  z.object({
    action: z.literal("revoke_engagement"),
    userId: z.string().min(1),
    matterId: z.string().min(1),
  }),
]);

async function requireSuperAdminApi() {
  const context = await getAuthContext();
  if (!context) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }
  if (!isSuperAdmin(context.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  }
  return { ok: true, context } as const;
}

export async function GET(): Promise<NextResponse> {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const [users, profiles, memberships, matters, auditEvents] = await Promise.all([
    sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.last_active_at AS "lastActiveAt",
        p.id AS "permissionProfileId",
        p.name AS "permissionProfileName",
        a.access_scope AS "accessScope"
      FROM users u
      LEFT JOIN user_permission_assignments a ON a.user_id = u.id
      LEFT JOIN permission_profiles p ON p.id = a.permission_profile_id
      ORDER BY
        CASE u.role
          WHEN 'super_admin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'contractor' THEN 3
          ELSE 4
        END,
        u.name
    `,
    sql`
      SELECT id, name, role_type AS "roleType", permissions, is_system AS "isSystem", status
      FROM permission_profiles
      ORDER BY status, role_type, is_system DESC, name
    `,
    sql`
      SELECT
        em.user_id AS "userId",
        em.matter_id AS "matterId",
        em.member_role AS "memberRole",
        em.status,
        em.expires_at AS "expiresAt",
        m.title AS "matterTitle"
      FROM engagement_memberships em
      JOIN matters m ON m.id = em.matter_id
      ORDER BY m.updated_at DESC
    `,
    sql`
      SELECT m.id, m.title, c.name AS "clientName"
      FROM matters m
      JOIN clients c ON c.id = m.client_id
      ORDER BY m.updated_at DESC
    `,
    sql`
      SELECT
        audit.id,
        audit.actor_id AS "actorId",
        actor.name AS "actorName",
        audit.action,
        audit.target_user_id AS "targetUserId",
        target.name AS "targetUserName",
        audit.matter_id AS "matterId",
        matter.title AS "matterTitle",
        audit.metadata,
        audit.created_at AS "createdAt"
      FROM access_audit_events audit
      LEFT JOIN users actor ON actor.id = audit.actor_id
      LEFT JOIN users target ON target.id = audit.target_user_id
      LEFT JOIN matters matter ON matter.id = audit.matter_id
      ORDER BY audit.created_at DESC
      LIMIT 250
    `,
  ]);

  return NextResponse.json({
    users,
    profiles,
    memberships,
    matters,
    auditEvents,
    assignableCapabilities: {
      admin: ADMIN_PROFILE_CAPABILITIES,
      contractor: CONTRACTOR_PROFILE_CAPABILITIES,
    },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid access-control request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const input = parsed.data;

  if (input.action === "create_profile") {
    const ceiling = profileCapabilityCeiling(input.roleType);
    const permissions = [...new Set(input.permissions)].filter(
      (capability): capability is Capability => ceiling.includes(capability),
    );
    const id = `profile_${crypto.randomUUID()}`;
    const [profileRows] = await sql.transaction((tx) => [
      tx`
        INSERT INTO permission_profiles (
          id,
          name,
          role_type,
          permissions,
          created_by
        )
        VALUES (
          ${id},
          ${input.name},
          ${input.roleType},
          CAST(${JSON.stringify(permissions)} AS JSONB),
          ${auth.context.userId}
        )
        RETURNING
          id,
          name,
          role_type AS "roleType",
          permissions,
          is_system AS "isSystem"
      `,
      accessAuditQuery(tx, {
        actorId: auth.context.userId,
        action: "permission_profile.created",
        metadata: { profileId: id, roleType: input.roleType, permissions },
      }),
    ]);
    const profile = profileRows[0];
    return NextResponse.json({ profile }, { status: 201 });
  }

  if (input.action === "update_profile") {
    const profiles = await sql`
      SELECT id, role_type, is_system, status
      FROM permission_profiles
      WHERE id = ${input.profileId}
      LIMIT 1
    `;
    const profile = profiles[0] as Record<string, unknown> | undefined;
    if (!profile || profile.status === "archived") {
      return NextResponse.json({ error: "Permission profile not found" }, { status: 404 });
    }
    const roleType = profile.role_type === "contractor" ? "contractor" : "admin";
    const ceiling = profileCapabilityCeiling(roleType);
    const permissions = [...new Set(input.permissions)].filter(
      (capability): capability is Capability => ceiling.includes(capability),
    );
    const [rows] = await sql.transaction((tx) => [
      tx`
        UPDATE permission_profiles
        SET name = ${input.name},
            permissions = CAST(${JSON.stringify(permissions)} AS JSONB),
            updated_at = NOW()
        WHERE id = ${input.profileId}
        RETURNING id, name, role_type AS "roleType", permissions, is_system AS "isSystem", status
      `,
      accessAuditQuery(tx, {
        actorId: auth.context.userId,
        action: "permission_profile.updated",
        metadata: { profileId: input.profileId, permissions },
      }),
    ]);
    return NextResponse.json({ profile: rows[0] });
  }

  if (input.action === "archive_profile") {
    const profiles = await sql`
      SELECT id, is_system
      FROM permission_profiles
      WHERE id = ${input.profileId}
      LIMIT 1
    `;
    const profile = profiles[0] as Record<string, unknown> | undefined;
    if (!profile) return NextResponse.json({ error: "Permission profile not found" }, { status: 404 });
    if (profile.is_system) {
      return NextResponse.json({ error: "System permission profiles cannot be archived" }, { status: 409 });
    }
    const assignments = await sql`
      SELECT COUNT(*)::int AS count
      FROM user_permission_assignments
      WHERE permission_profile_id = ${input.profileId}
    `;
    if (Number(assignments[0]?.count ?? 0) > 0) {
      return NextResponse.json({
        error: "Reassign users from this profile before archiving it",
        assignedUsers: Number(assignments[0]?.count ?? 0),
      }, { status: 409 });
    }
    await sql.transaction((tx) => [
      tx`
        UPDATE permission_profiles
        SET status = 'archived', updated_at = NOW()
        WHERE id = ${input.profileId}
      `,
      accessAuditQuery(tx, {
        actorId: auth.context.userId,
        action: "permission_profile.archived",
        metadata: { profileId: input.profileId },
      }),
    ]);
    return NextResponse.json({ archived: true });
  }

  if (input.action === "configure_user") {
    const rows = await sql`SELECT id, role FROM users WHERE id = ${input.userId} LIMIT 1`;
    const target = rows[0] as Record<string, unknown> | undefined;
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (target.role === "super_admin") {
      return NextResponse.json(
        { error: "Super Admin authority cannot be changed through a permission profile" },
        { status: 409 },
      );
    }

    let profileId: string | null = null;
    const effectiveScope = input.role === "admin" ? input.accessScope : "assigned";
    if (input.role === "admin" || input.role === "contractor") {
      profileId = input.permissionProfileId
        ?? (input.role === "admin"
          ? "profile_admin_operations"
          : "profile_contractor_standard");
      const profiles = await sql`
        SELECT id
        FROM permission_profiles
        WHERE id = ${profileId}
          AND role_type = ${input.role}
          AND status = 'active'
        LIMIT 1
      `;
      if (profiles.length === 0) {
        return NextResponse.json({ error: "Permission profile does not match the selected role" }, { status: 400 });
      }
    }

    await sql.transaction((tx) => {
      const assignmentQuery = profileId
        ? tx`
            INSERT INTO user_permission_assignments (
              user_id,
              permission_profile_id,
              access_scope,
              assigned_by
            )
            VALUES (
              ${input.userId},
              ${profileId},
              ${effectiveScope},
              ${auth.context.userId}
            )
            ON CONFLICT (user_id) DO UPDATE
            SET permission_profile_id = EXCLUDED.permission_profile_id,
                access_scope = EXCLUDED.access_scope,
                assigned_by = EXCLUDED.assigned_by,
                assigned_at = NOW()
          `
        : tx`DELETE FROM user_permission_assignments WHERE user_id = ${input.userId}`;
      return [
        tx`
          UPDATE users
          SET role = ${input.role}, status = ${input.status}
          WHERE id = ${input.userId}
        `,
        assignmentQuery,
        tx`
          UPDATE engagement_memberships
          SET member_role = ${input.role}, updated_at = NOW()
          WHERE user_id = ${input.userId}
        `,
        tx`DELETE FROM auth_sessions WHERE user_id = ${input.userId}`,
        accessAuditQuery(tx, {
          actorId: auth.context.userId,
          action: "user.access_configured",
          targetUserId: input.userId,
          metadata: {
            role: input.role,
            status: input.status,
            permissionProfileId: profileId,
            accessScope: effectiveScope,
          },
        }),
      ];
    });
    return NextResponse.json({ configured: true });
  }

  const users = await sql`SELECT id, role FROM users WHERE id = ${input.userId} LIMIT 1`;
  const target = users[0] as Record<string, unknown> | undefined;
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const targetRole = String(target.role) as UserRole;
  if (targetRole === "super_admin") {
    return NextResponse.json(
      { error: "Super Admin does not require an engagement membership" },
      { status: 409 },
    );
  }
  const matters = await sql`SELECT id FROM matters WHERE id = ${input.matterId} LIMIT 1`;
  if (matters.length === 0) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });

  if (input.action === "assign_engagement") {
    await sql.transaction((tx) => [
      tx`
        INSERT INTO engagement_memberships (
          matter_id,
          user_id,
          member_role,
          expires_at,
          assigned_by
        )
        VALUES (
          ${input.matterId},
          ${input.userId},
          ${targetRole},
          ${input.expiresAt ?? null},
          ${auth.context.userId}
        )
        ON CONFLICT (matter_id, user_id) DO UPDATE
        SET member_role = EXCLUDED.member_role,
            status = 'active',
            expires_at = EXCLUDED.expires_at,
            assigned_by = EXCLUDED.assigned_by,
            updated_at = NOW()
      `,
      accessAuditQuery(tx, {
        actorId: auth.context.userId,
        action: "engagement_membership.assigned",
        targetUserId: input.userId,
        matterId: input.matterId,
        metadata: { expiresAt: input.expiresAt ?? null, memberRole: targetRole },
      }),
    ]);
    return NextResponse.json({ assigned: true });
  }

  await sql.transaction((tx) => [
    tx`
      UPDATE engagement_memberships
      SET status = 'revoked', updated_at = NOW()
      WHERE user_id = ${input.userId}
        AND matter_id = ${input.matterId}
    `,
    tx`DELETE FROM auth_sessions WHERE user_id = ${input.userId}`,
    accessAuditQuery(tx, {
      actorId: auth.context.userId,
      action: "engagement_membership.revoked",
      targetUserId: input.userId,
      matterId: input.matterId,
    }),
  ]);
  return NextResponse.json({ revoked: true });
}
