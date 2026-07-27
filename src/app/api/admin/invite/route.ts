import { createHash, randomBytes } from "node:crypto";
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

import {
  authorizeCapability,
  getPortalAccessSummary,
  logAccessAudit,
} from "@/lib/access-control";
import { getAuthContext, isSuperAdmin } from "@/lib/auth";
import type { AccessScope, UserRole } from "@/lib/data-model";
import { ensureAccessControlTables, getDb } from "@/lib/db";
import { ratelimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function sendInvitationEmail(email: string, token: string, expiresInDays: number) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.jamesroman.la";
  const inviteUrl = `${baseUrl}/sign-up?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  if (!process.env.RESEND_API_KEY) {
    console.warn("invite.email.skipped", "RESEND_API_KEY not set");
    return { sent: false, error: "email_not_configured" };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "James Roman Advisory <roman@jamesroman.la>",
    to: [email],
    subject: "Your James Roman Advisory Private Office invitation",
    html: `<p>You have been invited to the James Roman Advisory Private Office.</p><p><a href="${inviteUrl}">Create your secure account</a></p><p>This invitation expires in ${expiresInDays} day${expiresInDays === 1 ? "" : "s"}.</p>`,
  });
  if (error) {
    console.error("invite.email.failed", { email, error });
    return { sent: false, error: error.name };
  }
  return { sent: true, providerId: data?.id ?? null };
}

export async function POST(req: NextRequest) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "users.invite"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = await ratelimit("invite", context.userId);
  if (rl?.blocked) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });

  let body: {
    email?: string;
    role?: string;
    permissionProfileId?: string;
    accessScope?: string;
    matterId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  const assignedRole = (["admin", "contractor", "client"] as const).includes(body.role as never)
    ? (body.role as Exclude<UserRole, "super_admin">)
    : "client";
  if ((assignedRole === "admin" || assignedRole === "contractor") && !isSuperAdmin(context.role)) {
    return NextResponse.json(
      { error: "Only a Super Admin can invite internal or contractor users" },
      { status: 403 },
    );
  }
  const accessScope: AccessScope =
    assignedRole === "admin" && body.accessScope === "global"
      ? "global"
      : "assigned";
  const matterId = body.matterId?.trim() || null;
  if ((assignedRole === "client" || assignedRole === "contractor" || accessScope === "assigned") && !matterId) {
    return NextResponse.json(
      { error: "An engagement is required for this role and access scope" },
      { status: 400 },
    );
  }

  await ensureAccessControlTables();
  const sql = getDb();
  const existing = await sql`SELECT id FROM users WHERE LOWER(email) = ${email} LIMIT 1`;
  if (existing.length > 0) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

  let permissionProfileId: string | null = null;
  if (assignedRole === "admin" || assignedRole === "contractor") {
    permissionProfileId = body.permissionProfileId?.trim()
      || (assignedRole === "admin" ? "profile_admin_operations" : "profile_contractor_standard");
    const profiles = await sql`
      SELECT id
      FROM permission_profiles
      WHERE id = ${permissionProfileId}
        AND role_type = ${assignedRole}
        AND status = 'active'
      LIMIT 1
    `;
    if (profiles.length === 0) {
      return NextResponse.json({ error: "Permission profile is invalid for this role" }, { status: 400 });
    }
  }
  if (matterId) {
    const matters = await sql`SELECT id FROM matters WHERE id = ${matterId} LIMIT 1`;
    if (matters.length === 0) {
      return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
    }
    if (!(await authorizeCapability(context, access, "users.invite", { matterId }))) {
      return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
    }
  }

  const token = randomBytes(32).toString("base64url");
  const invitationId = crypto.randomUUID();
  const settingsRows = await sql`SELECT value FROM portal_settings WHERE key = 'workspace' LIMIT 1`;
  const settings = settingsRows[0]?.value as Record<string, unknown> | undefined;
  const configuredExpiry = Number(settings?.invitationExpiryDays ?? 7);
  const expiryDays = Number.isInteger(configuredExpiry) && configuredExpiry >= 1 && configuredExpiry <= 30
    ? configuredExpiry
    : 7;
  await sql`DELETE FROM auth_invitations WHERE LOWER(email) = ${email} AND accepted_at IS NULL`;
  await sql`
    INSERT INTO auth_invitations (
      id,
      email,
      role,
      token_hash,
      permission_profile_id,
      access_scope,
      matter_id,
      expires_at
    )
    VALUES (
      ${invitationId},
      ${email},
      ${assignedRole},
      ${hashToken(token)},
      ${permissionProfileId},
      ${accessScope},
      ${matterId},
      NOW() + (${expiryDays} * INTERVAL '1 day')
    )
  `;

  const delivery = await sendInvitationEmail(email, token, expiryDays);

  await logAccessAudit({
    actorId: context.userId,
    action: "invitation.created",
    matterId: matterId ?? undefined,
    metadata: { email, role: assignedRole, permissionProfileId, accessScope },
  });

  return NextResponse.json({
    id: invitationId,
    email,
    role: assignedRole,
    permissionProfileId,
    accessScope,
    matterId,
    status: "pending",
    expiresAt: new Date(Date.now() + expiryDays * 86_400_000).toISOString(),
    delivery,
    createdAt: new Date().toISOString(),
  }, { status: 201 });
}

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "users.invite"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await ensureAccessControlTables();
  const sql = getDb();
  const global = context.role === "super_admin"
    || (context.role === "admin" && access.scope === "global");
  const invitations = await sql`
    SELECT DISTINCT
      invitation.id,
      invitation.email,
      invitation.role,
      invitation.permission_profile_id AS "permissionProfileId",
      invitation.access_scope AS "accessScope",
      invitation.matter_id AS "matterId",
      invitation.created_at AS "createdAt",
      invitation.expires_at AS "expiresAt",
      invitation.accepted_at AS "acceptedAt",
      CASE
        WHEN invitation.accepted_at IS NOT NULL THEN 'accepted'
        WHEN invitation.expires_at <= NOW() THEN 'expired'
        ELSE 'pending'
      END AS status
    FROM auth_invitations invitation
    LEFT JOIN engagement_memberships membership
      ON membership.matter_id = invitation.matter_id
      AND membership.user_id = ${context.userId}
      AND membership.status = 'active'
      AND (membership.expires_at IS NULL OR membership.expires_at > NOW())
    WHERE ${global} OR (
      invitation.role = 'client'
      AND invitation.matter_id IS NOT NULL
      AND membership.id IS NOT NULL
    )
    ORDER BY invitation.created_at DESC
    LIMIT 250
  `;
  return NextResponse.json({ invitations });
}

export async function PATCH(req: NextRequest) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "users.invite"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as { id?: string; action?: string } | null;
  if (!body?.id || body.action !== "resend") {
    return NextResponse.json({ error: "Invalid invitation action" }, { status: 400 });
  }
  await ensureAccessControlTables();
  const sql = getDb();
  const invitations = await sql`
    SELECT id, email, role, matter_id, accepted_at
    FROM auth_invitations
    WHERE id = ${body.id}
    LIMIT 1
  `;
  const invitation = invitations[0];
  if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  if (invitation.accepted_at) return NextResponse.json({ error: "An accepted invitation cannot be resent" }, { status: 409 });
  if (invitation.role !== "client" && !isSuperAdmin(context.role)) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (invitation.matter_id && !(await authorizeCapability(context, access, "users.invite", { matterId: String(invitation.matter_id) }))) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  const settingsRows = await sql`SELECT value FROM portal_settings WHERE key = 'workspace' LIMIT 1`;
  const settings = settingsRows[0]?.value as Record<string, unknown> | undefined;
  const configuredExpiry = Number(settings?.invitationExpiryDays ?? 7);
  const expiryDays = Number.isInteger(configuredExpiry) && configuredExpiry >= 1 && configuredExpiry <= 30 ? configuredExpiry : 7;
  const token = randomBytes(32).toString("base64url");
  await sql`
    UPDATE auth_invitations
    SET token_hash = ${hashToken(token)},
        expires_at = NOW() + (${expiryDays} * INTERVAL '1 day')
    WHERE id = ${body.id}
  `;
  const delivery = await sendInvitationEmail(String(invitation.email), token, expiryDays);
  await logAccessAudit({
    actorId: context.userId,
    action: "invitation.resent",
    metadata: { invitationId: body.id, email: invitation.email },
  });
  return NextResponse.json({ resent: true, delivery });
}

export async function DELETE(req: NextRequest) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  if (!(await authorizeCapability(context, access, "users.invite"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await ensureAccessControlTables();
  const sql = getDb();
  const invitations = await sql`
    SELECT id, role, matter_id, accepted_at
    FROM auth_invitations
    WHERE id = ${id}
    LIMIT 1
  `;
  const invitation = invitations[0];
  if (!invitation || invitation.accepted_at) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (invitation.role !== "client" && !isSuperAdmin(context.role)) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (invitation.matter_id && !(await authorizeCapability(context, access, "users.invite", { matterId: String(invitation.matter_id) }))) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  await sql`DELETE FROM auth_invitations WHERE id = ${id}`;
  await logAccessAudit({
    actorId: context.userId,
    action: "invitation.revoked",
    metadata: { invitationId: id },
  });
  return NextResponse.json({ revoked: true });
}
