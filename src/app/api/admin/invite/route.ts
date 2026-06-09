import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getRole, isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/admin/invite — send a Clerk invitation with a pre-assigned role */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = getRole(user);
  if (!isAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, role: invitedRole } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const emailTrimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTrimmed)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const allowedRoles = ["admin", "advisor", "client"];
  const assignedRole = allowedRoles.includes(invitedRole ?? "")
    ? invitedRole
    : "client";

  try {
    const clerk = await clerkClient();
    const invitation = await clerk.invitations.createInvitation({
      emailAddress: emailTrimmed,
      publicMetadata: { role: assignedRole },
      redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://jamesroman.la"}/sign-up`,
      ignoreExisting: true,
    });

    return NextResponse.json({
      id: invitation.id,
      email: invitation.emailAddress,
      role: assignedRole,
      status: invitation.status,
      createdAt: invitation.createdAt,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create invitation";
    console.error("invite.create.failed", { email: emailTrimmed, err });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET /api/admin/invite — list pending invitations */
export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = getRole(user);
  if (!isAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const clerk = await clerkClient();
    const result = await clerk.invitations.getInvitationList({
      status: "pending",
      limit: 100,
    });

    const invitations = result.data.map((inv) => ({
      id: inv.id,
      email: inv.emailAddress,
      role: (inv.publicMetadata as Record<string, string>)?.role ?? "client",
      createdAt: inv.createdAt,
    }));

    return NextResponse.json({ invitations });
  } catch (err) {
    console.error("invite.list.failed", err);
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 });
  }
}

/** DELETE /api/admin/invite?id=... — revoke a pending invitation */
export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = getRole(user);
  if (!isAdmin(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const clerk = await clerkClient();
    await clerk.invitations.revokeInvitation(id);
    return NextResponse.json({ revoked: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to revoke invitation";
    console.error("invite.revoke.failed", { id, err });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
