import { NextResponse } from "next/server";

import { getPortalAccessSummary } from "@/lib/access-control";
import { getAuthContext } from "@/lib/auth";

export async function GET() {
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = await getPortalAccessSummary(context);
  return NextResponse.json({ user: context.user, access });
}
