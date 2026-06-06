import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentAuthContext, isTeamRole } from "@/lib/crm/auth";
import { userCanMessageMatter } from "@/lib/crm/data";
import { writeAuditEvent } from "@/lib/crm/audit";
import { captureApiError } from "@/lib/monitoring";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOriginRequest } from "@/lib/request-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const messageRequestSchema = z.object({
  matterId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
  visibility: z.enum(["client", "internal"]).optional(),
});

function matterIdFromRequest(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("matterId");
}

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext();
    if (!context) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const matterId = matterIdFromRequest(request);
    if (!matterId) {
      return NextResponse.json({ message: "A matter id is required." }, { status: 400 });
    }

    const limitResponse = enforceRateLimit({
      namespace: "messages-list",
      limit: 60,
      windowMs: 60_000,
      keyParts: [context.userId, matterId],
    });
    if (limitResponse) return limitResponse;

    const canAccess = await userCanMessageMatter(context, matterId);
    if (!canAccess) {
      return NextResponse.json({ message: "Matter access denied." }, { status: 403 });
    }

    // Use the user-scoped client so RLS enforces tenant isolation as an
    // additional boundary. Application-level access is already checked above.
    const supabase = await createSupabaseServerClient();
    const query = supabase
      .from("messages")
      .select("id, matter_id, sender_id, body, visibility, created_at")
      .eq("tenant_id", context.profile.tenant_id)
      .eq("matter_id", matterId)
      .order("created_at", { ascending: true });

    if (!isTeamRole(context.profile.role)) {
      query.eq("visibility", "client");
    }

    const { data, error } = await query;
    if (error) throw error;

    await writeAuditEvent({
      actorId: context.userId,
      tenantId: context.profile.tenant_id,
      action: "messages.listed",
      resourceType: "matter",
      resourceId: matterId,
    });

    return NextResponse.json({ messages: data ?? [] });
  } catch (error) {
    console.error("messages.list_failed", error);
    captureApiError("/api/messages", 500, error, { operation: "messages.list" });
    return NextResponse.json({ message: "Messages could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const guardResponse = enforceSameOriginRequest(request);
    if (guardResponse) return guardResponse;

    const context = await getCurrentAuthContext();
    if (!context) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const input = messageRequestSchema.parse(await request.json());
    const limitResponse = enforceRateLimit({
      namespace: "message-create",
      limit: 20,
      windowMs: 60_000,
      keyParts: [context.userId, input.matterId],
    });
    if (limitResponse) return limitResponse;

    const canAccess = await userCanMessageMatter(context, input.matterId);
    if (!canAccess) {
      return NextResponse.json({ message: "Matter access denied." }, { status: 403 });
    }

    const visibility = isTeamRole(context.profile.role) ? input.visibility ?? "client" : "client";
    // Use the user-scoped client so RLS enforces tenant isolation as an
    // additional boundary. Application-level access is already checked above.
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({
        tenant_id: context.profile.tenant_id,
        matter_id: input.matterId,
        sender_id: context.userId,
        body: input.body,
        visibility,
      })
      .select("id, matter_id, sender_id, body, visibility, created_at")
      .single();

    if (error) throw error;

    await writeAuditEvent({
      actorId: context.userId,
      tenantId: context.profile.tenant_id,
      action: "message.created",
      resourceType: "message",
      resourceId: data.id,
      metadata: { matterId: input.matterId, visibility },
    });

    return NextResponse.json({ message: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Please review the message.", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    console.error("message.create_failed", error);
    captureApiError("/api/messages", 500, error, { operation: "message.create" });
    return NextResponse.json({ message: "The message could not be sent." }, { status: 500 });
  }
}
