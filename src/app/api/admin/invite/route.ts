import { createHash, randomBytes } from "node:crypto";
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

import { getAuthContext, isAdmin } from "@/lib/auth";
import { ensureAuthTables, getDb } from "@/lib/db";
import { ratelimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(context.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rl = await ratelimit("invite", context.userId);
  if (rl?.blocked) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });

  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  const assignedRole = (["admin", "advisor", "client"] as const).includes(body.role as never)
    ? (body.role as "admin" | "advisor" | "client")
    : "client";

  await ensureAuthTables();
  const sql = getDb();
  const existing = await sql`SELECT id FROM users WHERE LOWER(email) = ${email} LIMIT 1`;
  if (existing.length > 0) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

  const token = randomBytes(32).toString("base64url");
  const invitationId = crypto.randomUUID();
  await sql`DELETE FROM auth_invitations WHERE LOWER(email) = ${email} AND accepted_at IS NULL`;
  await sql`
    INSERT INTO auth_invitations (id, email, role, token_hash, expires_at)
    VALUES (${invitationId}, ${email}, ${assignedRole}, ${hashToken(token)}, NOW() + INTERVAL '7 days')
  `;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.jamesroman.la";
  const inviteUrl = `${baseUrl}/sign-up?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "James Roman Advisory <notifications@jamesroman.la>",
      to: [email],
      subject: "Your James Roman Advisory Private Office invitation",
      html: `<p>You have been invited to the James Roman Advisory Private Office.</p><p><a href="${inviteUrl}">Create your secure account</a></p><p>This invitation expires in seven days.</p>`,
    });
    if (error) console.error("invite.email.failed", { email, error });
  } else {
    console.warn("invite.email.skipped", "RESEND_API_KEY not set");
  }

  return NextResponse.json({ id: invitationId, email, role: assignedRole, status: "pending", createdAt: new Date().toISOString() }, { status: 201 });
}

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(context.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await ensureAuthTables();
  const sql = getDb();
  const invitations = await sql`
    SELECT id, email, role, created_at AS "createdAt"
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
  if (!isAdmin(context.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await ensureAuthTables();
  const sql = getDb();
  await sql`DELETE FROM auth_invitations WHERE id = ${id}`;
  return NextResponse.json({ revoked: true });
}
