export type UserRole = "owner" | "admin" | "advisor" | "client";
export type MatterStatus = "screening" | "active" | "paused" | "closed" | "archived";
export type DataSensitivity = "standard" | "sensitive" | "restricted";
export type DocumentVisibility = "internal" | "client";
export type DocumentStatus =
  | "pending_upload"
  | "scan_pending"
  | "quarantined"
  | "scan_failed"
  | "available"
  | "archived"
  | "deleted";
export type DocumentClassification = "general" | "property" | "financial" | "legal" | "restricted";
export type MessageVisibility = "client" | "internal";
export type InvoiceStatus = "draft" | "sent" | "paid" | "void" | "overdue";

export type Profile = {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  mfa_required: boolean;
  disabled_at: string | null;
};

export type ClientSummary = {
  id: string;
  tenant_id: string;
  display_name: string;
  primary_email: string | null;
  primary_market: string | null;
  deletion_requested_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type MatterSummary = {
  id: string;
  tenant_id: string;
  client_id: string;
  title: string;
  status: MatterStatus;
  market: string | null;
  sensitivity_level: DataSensitivity;
  legal_hold: boolean;
  legal_hold_reason: string | null;
  legal_hold_at: string | null;
  deletion_requested_at: string | null;
  deleted_at: string | null;
  deletion_reason: string | null;
  primary_advisor_id: string | null;
  opened_at: string;
  closed_at: string | null;
};

export type DocumentRecord = {
  id: string;
  tenant_id: string;
  matter_id: string;
  uploaded_by: string | null;
  title: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  classification: DocumentClassification;
  sensitivity_level: DataSensitivity;
  legal_hold: boolean;
  legal_hold_reason: string | null;
  legal_hold_at: string | null;
  retention_until: string | null;
  deletion_requested_at: string | null;
  deleted_at: string | null;
  deletion_reason: string | null;
  created_at: string;
};
