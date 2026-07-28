/**
 * Complete classification of the application-owned tables in the public
 * schema. This is a readiness invariant, not an active RLS policy.
 *
 * Any new table must be classified here before the schema bootstrap can pass
 * CI. The policy families describe the authorization root that a future
 * database policy must use; they do not grant access.
 */
export const RLS_TABLE_CLASSIFICATION = [
  { table: "app_schema_versions", family: "migration_only", root: "none" },
  { table: "users", family: "identity_private", root: "user_id" },
  { table: "auth_sessions", family: "identity_private", root: "user_id" },
  {
    table: "auth_login_challenges",
    family: "identity_private",
    root: "user_id",
  },
  { table: "auth_mfa_methods", family: "identity_private", root: "user_id" },
  {
    table: "auth_mfa_recovery_codes",
    family: "identity_private",
    root: "user_id",
  },
  {
    table: "password_reset_tokens",
    family: "identity_private",
    root: "user_id",
  },
  { table: "auth_invitations", family: "access_control", root: "invitee" },
  { table: "consultations", family: "public_intake", root: "none" },
  { table: "clients", family: "client_rooted", root: "client_id" },
  { table: "properties", family: "client_rooted", root: "client_id" },
  { table: "matters", family: "matter_rooted", root: "matter_id" },
  { table: "matter_events", family: "matter_child", root: "matter_id" },
  {
    table: "documents",
    family: "matter_or_client_child",
    root: "matter_id_or_client_id",
  },
  {
    table: "file_access_events",
    family: "audit_append_only",
    root: "document_id",
  },
  {
    table: "permission_profiles",
    family: "access_control",
    root: "staff_admin",
  },
  {
    table: "user_permission_assignments",
    family: "access_control",
    root: "user_id",
  },
  {
    table: "engagement_memberships",
    family: "access_control",
    root: "matter_id_and_user_id",
  },
  {
    table: "access_audit_events",
    family: "audit_append_only",
    root: "actor_and_target",
  },
  {
    table: "portal_settings",
    family: "global_configuration",
    root: "staff_admin",
  },
  {
    table: "workflow_templates",
    family: "global_configuration",
    root: "staff_admin",
  },
  {
    table: "workflow_template_items",
    family: "global_configuration",
    root: "template_id",
  },
  {
    table: "engagement_workflow_items",
    family: "matter_child",
    root: "matter_id",
  },
  { table: "engagement_tasks", family: "matter_child", root: "matter_id" },
  { table: "saved_views", family: "identity_private", root: "owner_user_id" },
  {
    table: "engagement_messages",
    family: "matter_child",
    root: "matter_id",
  },
  {
    table: "message_read_receipts",
    family: "matter_child",
    root: "message_id_and_user_id",
  },
  {
    table: "notification_deliveries",
    family: "system_delivery",
    root: "user_id_and_matter_id",
  },
  {
    table: "portal_notifications",
    family: "identity_private",
    root: "user_id_and_matter_id",
  },
  {
    table: "document_versions",
    family: "matter_child",
    root: "document_id",
  },
  {
    table: "portal_automations",
    family: "global_configuration",
    root: "staff_admin",
  },
  {
    table: "automation_runs",
    family: "system_delivery",
    root: "automation_id_and_matter_id",
  },
  {
    table: "engagement_contracts",
    family: "matter_child",
    root: "matter_id",
  },
  { table: "invoices", family: "matter_child", root: "matter_id" },
  {
    table: "invoice_line_items",
    family: "matter_child",
    root: "invoice_id",
  },
  { table: "payments", family: "matter_child", root: "invoice_id" },
  { table: "change_orders", family: "matter_child", root: "matter_id" },
  {
    table: "stripe_webhook_events",
    family: "integration_internal",
    root: "stripe_event_id",
  },
] as const;

export type RlsTableName = (typeof RLS_TABLE_CLASSIFICATION)[number]["table"];

export const RLS_TABLE_NAMES = RLS_TABLE_CLASSIFICATION.map(
  ({ table }) => table,
) as RlsTableName[];
