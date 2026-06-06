import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "./auth";
import { isTeamRole } from "./auth";

export async function listAdminDashboard(context: AuthContext) {
  const supabase = await createSupabaseServerClient();
  const tenantId = context.profile.tenant_id;

  const [clients, matters, documents, messages, invoices, auditLogs] = await Promise.all([
    supabase
      .from("clients")
      .select("id, display_name, primary_email, primary_market, deletion_requested_at, deleted_at, created_at")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("matters")
      .select(
        "id, client_id, title, status, market, sensitivity_level, legal_hold, legal_hold_reason, legal_hold_at, deletion_requested_at, deleted_at, deletion_reason, opened_at",
      )
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .order("opened_at", { ascending: false })
      .limit(12),
    supabase
      .from("documents")
      .select(
        "id, matter_id, title, visibility, status, classification, sensitivity_level, legal_hold, legal_hold_reason, legal_hold_at, retention_until, deletion_requested_at, deleted_at, deletion_reason, created_at",
      )
      .eq("tenant_id", tenantId)
      .neq("status", "deleted")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("messages")
      .select("id, matter_id, body, visibility, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("invoices")
      .select("id, matter_id, invoice_number, status, amount_cents, currency, issued_at")
      .eq("tenant_id", tenantId)
      .order("issued_at", { ascending: false })
      .limit(8),
    supabase
      .from("audit_logs")
      .select("id, action, resource_type, resource_id, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return {
    clients: clients.data ?? [],
    matters: matters.data ?? [],
    documents: documents.data ?? [],
    messages: messages.data ?? [],
    invoices: invoices.data ?? [],
    auditLogs: auditLogs.data ?? [],
  };
}

export async function listOfficeDashboard(context: AuthContext) {
  const supabase = await createSupabaseServerClient();
  const tenantId = context.profile.tenant_id;

  const mattersQuery = supabase
    .from("matters")
    .select(
      "id, client_id, title, status, market, sensitivity_level, legal_hold, legal_hold_reason, legal_hold_at, deletion_requested_at, deleted_at, deletion_reason, opened_at, closed_at",
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("opened_at", { ascending: false });

  const documentsQuery = supabase
    .from("documents")
    .select(
      "id, matter_id, title, visibility, status, classification, sensitivity_level, legal_hold, legal_hold_reason, legal_hold_at, retention_until, deletion_requested_at, deleted_at, deletion_reason, created_at",
    )
    .eq("tenant_id", tenantId)
    .eq("visibility", "client")
    .eq("status", "available")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(12);

  const messagesQuery = supabase
    .from("messages")
    .select("id, matter_id, body, visibility, created_at")
    .eq("tenant_id", tenantId)
    .eq("visibility", "client")
    .order("created_at", { ascending: false })
    .limit(12);

  const timelineQuery = supabase
    .from("timeline_events")
    .select("id, matter_id, title, body, event_date, visible_to_client")
    .eq("tenant_id", tenantId)
    .eq("visible_to_client", true)
    .order("event_date", { ascending: false })
    .limit(12);

  const invoicesQuery = supabase
    .from("invoices")
    .select("id, matter_id, invoice_number, status, amount_cents, currency, issued_at")
    .eq("tenant_id", tenantId)
    .eq("visible_to_client", true)
    .order("issued_at", { ascending: false })
    .limit(12);

  const [matters, documents, messages, timeline, invoices] = await Promise.all([
    mattersQuery,
    documentsQuery,
    messagesQuery,
    timelineQuery,
    invoicesQuery,
  ]);

  return {
    matters: matters.data ?? [],
    documents: documents.data ?? [],
    messages: messages.data ?? [],
    timeline: timeline.data ?? [],
    invoices: invoices.data ?? [],
  };
}

export async function userCanAccessMatter(context: AuthContext, matterId: string) {
  const supabase = await createSupabaseServerClient();

  if (isTeamRole(context.profile.role)) {
    return matterBelongsToTenant(context, matterId);
  }

  const { data } = await supabase
    .from("access_grants")
    .select("id")
    .eq("tenant_id", context.profile.tenant_id)
    .eq("matter_id", matterId)
    .eq("user_id", context.userId)
    .is("revoked_at", null)
    .maybeSingle();

  return Boolean(data);
}

export async function userCanViewMatterDocuments(context: AuthContext, matterId: string) {
  if (isTeamRole(context.profile.role)) return matterBelongsToTenant(context, matterId);
  const grant = await getActiveMatterGrant(context, matterId);
  return Boolean(grant?.can_view_documents);
}

export async function userCanUploadToMatter(context: AuthContext, matterId: string) {
  if (isTeamRole(context.profile.role)) return matterBelongsToTenant(context, matterId);
  const grant = await getActiveMatterGrant(context, matterId);
  return Boolean(grant?.can_upload_documents);
}

export async function userCanMessageMatter(context: AuthContext, matterId: string) {
  if (isTeamRole(context.profile.role)) return matterBelongsToTenant(context, matterId);
  const grant = await getActiveMatterGrant(context, matterId);
  return Boolean(grant?.can_message);
}

async function matterBelongsToTenant(context: AuthContext, matterId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("matters")
    .select("id")
    .eq("tenant_id", context.profile.tenant_id)
    .eq("id", matterId)
    .is("deleted_at", null)
    .maybeSingle();

  return Boolean(data);
}

async function getActiveMatterGrant(context: AuthContext, matterId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("access_grants")
    .select("id, can_view_documents, can_upload_documents, can_message")
    .eq("tenant_id", context.profile.tenant_id)
    .eq("matter_id", matterId)
    .eq("user_id", context.userId)
    .is("revoked_at", null)
    .maybeSingle();

  return data;
}
