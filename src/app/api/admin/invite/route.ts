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
      NOW() + INTERVAL '7 days'
    )
  `;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.jamesroman.la";
  const inviteUrl = `${baseUrl}/sign-up?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "James Roman Advisory <roman@jamesroman.la>",
      to: [email],
      subject: "Your James Roman Advisory Private Office invitation",
      html: `<p>You have been invited to the James Roman Advisory Private Office.</p><p><a href="${inviteUrl}">Create your secure account</a></p><p>This invitation expires in seven days.</p>`,
    });
    if (error) console.error("invite.email.failed", { email, error });
  } else {
    console.warn("invite.email.skipped", "RESEND_API_KEY not set");
  }

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
  const invitations = await sql`
    SELECT
      id,
      email,
      role,
      permission_profile_id AS "permissionProfileId",
      access_scope AS "accessScope",
      matter_id AS "matterId",
      created_at AS "createdAt"
    FROM auth_invitations
    WHERE accepted_at IS NULL AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 100
  `;
  return NextResponse.json({ invitations });
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
  await sql`DELETE FROM auth_invitations WHERE id = ${id}`;
  await logAccessAudit({
    actorId: context.userId,
    action: "invitation.revoked",
    metadata: { invitationId: id },
  });
  return NextResponse.json({ revoked: true });
}
