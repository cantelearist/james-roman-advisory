export const SCHEMA_MIGRATION_VERSIONS = {
  users: "2026-07-26-users-v1",
  auth: "2026-07-26-auth-v1",
  consultations: "2026-07-26-consultations-v1",
  vault: "2026-07-26-vault-v1",
  access: "2026-07-26-access-v1",
  operations: "2026-07-26-operations-v1",
} as const;

export const SCHEMA_MIGRATION_MANIFEST = [
  {
    domain: "users",
    version: SCHEMA_MIGRATION_VERSIONS.users,
    tables: ["users"],
  },
  {
    domain: "auth",
    version: SCHEMA_MIGRATION_VERSIONS.auth,
    tables: [
      "auth_sessions",
      "auth_login_challenges",
      "auth_mfa_methods",
      "auth_mfa_recovery_codes",
      "password_reset_tokens",
      "auth_invitations",
    ],
  },
  {
    domain: "consultations",
    version: SCHEMA_MIGRATION_VERSIONS.consultations,
    tables: ["consultations"],
  },
  {
    domain: "vault",
    version: SCHEMA_MIGRATION_VERSIONS.vault,
    tables: [
      "clients",
      "properties",
      "matters",
      "matter_events",
      "documents",
      "file_access_events",
    ],
  },
  {
    domain: "access",
    version: SCHEMA_MIGRATION_VERSIONS.access,
    tables: [
      "permission_profiles",
      "user_permission_assignments",
      "engagement_memberships",
      "access_audit_events",
      "portal_settings",
    ],
  },
  {
    domain: "operations",
    version: SCHEMA_MIGRATION_VERSIONS.operations,
    tables: [
      "workflow_templates",
      "workflow_template_items",
      "engagement_workflow_items",
      "engagement_tasks",
      "saved_views",
      "engagement_messages",
      "message_read_receipts",
      "notification_deliveries",
      "portal_notifications",
      "document_versions",
      "portal_automations",
      "automation_runs",
      "engagement_contracts",
      "invoices",
      "invoice_line_items",
      "payments",
      "change_orders",
      "stripe_webhook_events",
    ],
  },
] as const;

export type SchemaMigrationDomain =
  (typeof SCHEMA_MIGRATION_MANIFEST)[number]["domain"];

export const REQUIRED_SCHEMA_VERSIONS = SCHEMA_MIGRATION_MANIFEST.map(
  ({ version }) => version,
);
