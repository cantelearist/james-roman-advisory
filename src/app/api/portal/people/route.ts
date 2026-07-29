import { NextResponse } from "next/server";

import {
  getPortalAccessSummary,
  hasCapability,
} from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export const runtime = "nodejs";

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  if (
    context.role !== "super_admin"
    && !(context.role === "admin" && (
      hasCapability(access, "engagements.assign")
      || hasCapability(access, "timeline.manage")
    ))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await assertRequiredSchemaVersions();
  const sql = getDb();
  const people = await sql`
    SELECT u.id, u.name, u.email, u.role,
      p.name AS permission_profile_name,
      assignment.access_scope
    FROM users u
    LEFT JOIN user_permission_assignments assignment ON assignment.user_id = u.id
    LEFT JOIN permission_profiles p ON p.id = assignment.permission_profile_id
    WHERE u.status = 'active'
      AND u.role IN ('super_admin', 'admin', 'contractor')
    ORDER BY
      CASE u.role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
      u.name
  `;
  return NextResponse.json({ people });
}
