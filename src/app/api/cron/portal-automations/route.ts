import { NextResponse } from "next/server";

import { runScheduledPortalAutomations } from "@/lib/automations";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Scheduled automations are not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runScheduledPortalAutomations();
  return NextResponse.json({ ok: true, ...result });
}
