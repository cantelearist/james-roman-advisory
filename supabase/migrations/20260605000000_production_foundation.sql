-- James Roman Advisory production foundation
-- Single-tenant at launch, tenant-ready for future productization.

create extension if not exists pgcrypto;
create schema if not exists app;

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

insert into tenants (slug, name)
values ('james-roman-advisory', 'James Roman Advisory')
on conflict (slug) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-files',
  'case-files',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  create type user_role as enum ('owner', 'admin', 'advisor', 'client');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type matter_status as enum ('screening', 'active', 'paused', 'closed', 'archived');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type document_visibility as enum ('internal', 'client');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type document_status as enum (
    'pending_upload',
    'scan_pending',
    'quarantined',
    'scan_failed',
    'available',
    'archived',
    'deleted'
  );
exception when duplicate_object then null;
end $$;

alter type document_status add value if not exists 'scan_pending';
alter type document_status add value if not exists 'quarantined';
alter type document_status add value if not exists 'scan_failed';

do $$
begin
  create type message_visibility as enum ('client', 'internal');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type invoice_status as enum ('draft', 'sent', 'paid', 'void', 'overdue');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type data_sensitivity as enum ('standard', 'sensitive', 'restricted');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type document_classification as enum ('general', 'property', 'financial', 'legal', 'restricted');
exception when duplicate_object then null;
end $$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'client',
  mfa_required boolean not null default false,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  display_name text not null,
  primary_email text,
  primary_phone text,
  primary_market text,
  notes text,
  created_by uuid references profiles(id),
  deletion_requested_at timestamptz,
  deletion_requested_by uuid references profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  deletion_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clients add column if not exists deletion_requested_at timestamptz;
alter table clients add column if not exists deletion_requested_by uuid references profiles(id);
alter table clients add column if not exists deleted_at timestamptz;
alter table clients add column if not exists deleted_by uuid references profiles(id);
alter table clients add column if not exists deletion_reason text;

create table if not exists matters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  status matter_status not null default 'screening',
  market text,
  property_address text,
  matter_type text,
  sensitivity_level data_sensitivity not null default 'standard',
  legal_hold boolean not null default false,
  legal_hold_reason text,
  legal_hold_at timestamptz,
  legal_hold_by uuid references profiles(id),
  deletion_requested_at timestamptz,
  deletion_requested_by uuid references profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  deletion_reason text,
  primary_advisor_id uuid references profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table matters add column if not exists sensitivity_level data_sensitivity not null default 'standard';
alter table matters add column if not exists legal_hold boolean not null default false;
alter table matters add column if not exists legal_hold_reason text;
alter table matters add column if not exists legal_hold_at timestamptz;
alter table matters add column if not exists legal_hold_by uuid references profiles(id);
alter table matters add column if not exists deletion_requested_at timestamptz;
alter table matters add column if not exists deletion_requested_by uuid references profiles(id);
alter table matters add column if not exists deleted_at timestamptz;
alter table matters add column if not exists deleted_by uuid references profiles(id);
alter table matters add column if not exists deletion_reason text;

create table if not exists access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role user_role not null default 'client',
  can_view_documents boolean not null default true,
  can_upload_documents boolean not null default true,
  can_message boolean not null default true,
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (matter_id, user_id)
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade,
  uploaded_by uuid references profiles(id),
  title text not null,
  storage_bucket text not null default 'case-files',
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  visibility document_visibility not null default 'client',
  status document_status not null default 'pending_upload',
  classification document_classification not null default 'general',
  sensitivity_level data_sensitivity not null default 'standard',
  legal_hold boolean not null default false,
  legal_hold_reason text,
  legal_hold_at timestamptz,
  legal_hold_by uuid references profiles(id),
  retention_until timestamptz,
  deletion_requested_at timestamptz,
  deletion_requested_by uuid references profiles(id),
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  deletion_reason text,
  checksum_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

alter table documents add column if not exists classification document_classification not null default 'general';
alter table documents add column if not exists sensitivity_level data_sensitivity not null default 'standard';
alter table documents add column if not exists legal_hold boolean not null default false;
alter table documents add column if not exists legal_hold_reason text;
alter table documents add column if not exists legal_hold_at timestamptz;
alter table documents add column if not exists legal_hold_by uuid references profiles(id);
alter table documents add column if not exists retention_until timestamptz;
alter table documents add column if not exists deletion_requested_at timestamptz;
alter table documents add column if not exists deletion_requested_by uuid references profiles(id);
alter table documents add column if not exists deleted_at timestamptz;
alter table documents add column if not exists deleted_by uuid references profiles(id);
alter table documents add column if not exists deletion_reason text;

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade,
  sender_id uuid references profiles(id),
  body text not null,
  visibility message_visibility not null default 'client',
  created_at timestamptz not null default now()
);

create table if not exists timeline_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade,
  title text not null,
  body text,
  event_date timestamptz not null default now(),
  visible_to_client boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade,
  invoice_number text not null,
  status invoice_status not null default 'draft',
  amount_cents integer not null default 0,
  currency text not null default 'USD',
  visible_to_client boolean not null default true,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, invoice_number)
);

create table if not exists nda_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade,
  client_id uuid references clients(id),
  version text not null,
  signed_at timestamptz,
  storage_bucket text,
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists internal_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  matter_id uuid not null references matters(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists file_access_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  correlation_id text not null default gen_random_uuid()::text,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table audit_logs add column if not exists correlation_id text;
update audit_logs
set correlation_id = gen_random_uuid()::text
where correlation_id is null;
alter table audit_logs alter column correlation_id set default gen_random_uuid()::text;
alter table audit_logs alter column correlation_id set not null;

create table if not exists consultation_requests (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  name text not null,
  email text not null,
  market text not null,
  matter text not null,
  message text not null,
  summary_draft jsonb,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists profiles_tenant_role_idx on profiles (tenant_id, role);
create index if not exists matters_tenant_status_idx on matters (tenant_id, status);
create index if not exists matters_tenant_sensitivity_idx on matters (tenant_id, sensitivity_level);
create index if not exists matters_tenant_deleted_idx on matters (tenant_id, deleted_at) where deleted_at is not null;
create index if not exists access_grants_user_idx on access_grants (tenant_id, user_id) where revoked_at is null;
create index if not exists documents_matter_idx on documents (tenant_id, matter_id, status);
create index if not exists documents_tenant_classification_idx on documents (tenant_id, classification, sensitivity_level);
create index if not exists documents_tenant_deleted_idx on documents (tenant_id, deleted_at) where deleted_at is not null;
create index if not exists messages_matter_idx on messages (tenant_id, matter_id, created_at desc);
create index if not exists audit_logs_tenant_created_idx on audit_logs (tenant_id, created_at desc);
create index if not exists audit_logs_tenant_correlation_idx on audit_logs (tenant_id, correlation_id);

alter table tenants enable row level security;
alter table profiles enable row level security;
alter table clients enable row level security;
alter table matters enable row level security;
alter table access_grants enable row level security;
alter table documents enable row level security;
alter table messages enable row level security;
alter table timeline_events enable row level security;
alter table invoices enable row level security;
alter table nda_records enable row level security;
alter table internal_notes enable row level security;
alter table file_access_events enable row level security;
alter table audit_logs enable row level security;
alter table consultation_requests enable row level security;

create or replace function app.current_profile()
returns profiles
language sql
security definer
set search_path = public
as $$
  select *
  from profiles
  where id = auth.uid()
    and disabled_at is null
  limit 1
$$;

create or replace function app.current_role()
returns user_role
language sql
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid() and disabled_at is null limit 1
$$;

create or replace function app.current_tenant_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select tenant_id from profiles where id = auth.uid() and disabled_at is null limit 1
$$;

create or replace function app.is_team()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(app.current_role() in ('owner', 'admin', 'advisor'), false)
$$;

create or replace function app.can_access_matter(target_matter_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select app.is_team()
    or exists (
      select 1
      from access_grants
      where matter_id = target_matter_id
        and user_id = auth.uid()
        and revoked_at is null
    )
$$;

create or replace function app.can_view_matter_documents(target_matter_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select app.is_team()
    or exists (
      select 1
      from access_grants
      where matter_id = target_matter_id
        and user_id = auth.uid()
        and revoked_at is null
        and can_view_documents
    )
$$;

create or replace function app.can_message_matter(target_matter_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select app.is_team()
    or exists (
      select 1
      from access_grants
      where matter_id = target_matter_id
        and user_id = auth.uid()
        and revoked_at is null
        and can_message
    )
$$;

create or replace function app.prevent_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.audit_maintenance', true) = 'on' then
    if TG_OP = 'DELETE' then
      return OLD;
    end if;

    return NEW;
  end if;

  raise exception 'audit_logs are append-only';
end;
$$;

drop trigger if exists audit_logs_append_only on audit_logs;
create trigger audit_logs_append_only
  before update or delete on audit_logs
  for each row execute function app.prevent_audit_log_mutation();

create or replace function app.enforce_retention_deletion_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.retention_maintenance', true) = 'on' then
    if TG_OP = 'DELETE' then
      return OLD;
    end if;

    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    raise exception 'retention records must be soft-deleted';
  end if;

  if coalesce(NEW.legal_hold, OLD.legal_hold)
    and OLD.deleted_at is null
    and NEW.deleted_at is not null then
    raise exception 'legal hold blocks deletion';
  end if;

  if TG_TABLE_NAME = 'documents'
    and coalesce(NEW.legal_hold, OLD.legal_hold)
    and to_jsonb(OLD)->>'status' <> 'deleted'
    and to_jsonb(NEW)->>'status' = 'deleted' then
    raise exception 'legal hold blocks deletion';
  end if;

  return NEW;
end;
$$;

drop trigger if exists matters_retention_deletion_rules on matters;
create trigger matters_retention_deletion_rules
  before update or delete on matters
  for each row execute function app.enforce_retention_deletion_rules();

drop trigger if exists documents_retention_deletion_rules on documents;
create trigger documents_retention_deletion_rules
  before update or delete on documents
  for each row execute function app.enforce_retention_deletion_rules();

drop policy if exists "profiles self or team" on profiles;
create policy "profiles self or team" on profiles
  for select to authenticated
  using (id = auth.uid() or (tenant_id = app.current_tenant_id() and app.is_team()));

drop policy if exists "tenant self read" on tenants;
create policy "tenant self read" on tenants
  for select to authenticated
  using (id = app.current_tenant_id());

drop policy if exists "team tenant clients" on clients;
create policy "team tenant clients" on clients
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_team())
  with check (tenant_id = app.current_tenant_id() and app.is_team());

drop policy if exists "matter access" on matters;
create policy "matter access" on matters
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and deleted_at is null and app.can_access_matter(id));

drop policy if exists "team matter write" on matters;
create policy "team matter write" on matters
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_team())
  with check (tenant_id = app.current_tenant_id() and app.is_team());

drop policy if exists "access grants team or self" on access_grants;
create policy "access grants team or self" on access_grants
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and (app.is_team() or user_id = auth.uid()));

drop policy if exists "documents matter access" on documents;
create policy "documents matter access" on documents
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and deleted_at is null
    and status <> 'deleted'
    and app.can_view_matter_documents(matter_id)
    and (app.is_team() or (visibility = 'client' and status = 'available'))
  );

drop policy if exists "messages matter access" on messages;
create policy "messages matter access" on messages
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and app.can_message_matter(matter_id)
    and (app.is_team() or visibility = 'client')
  );

drop policy if exists "timeline matter access" on timeline_events;
create policy "timeline matter access" on timeline_events
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and app.can_access_matter(matter_id)
    and (app.is_team() or visible_to_client)
  );

drop policy if exists "invoices matter access" on invoices;
create policy "invoices matter access" on invoices
  for select to authenticated
  using (
    tenant_id = app.current_tenant_id()
    and app.can_access_matter(matter_id)
    and (app.is_team() or visible_to_client)
  );

drop policy if exists "team nda access" on nda_records;
create policy "team nda access" on nda_records
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.can_access_matter(matter_id));

drop policy if exists "team internal notes" on internal_notes;
create policy "team internal notes" on internal_notes
  for all to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_team())
  with check (tenant_id = app.current_tenant_id() and app.is_team());

drop policy if exists "team audit read" on audit_logs;
create policy "team audit read" on audit_logs
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_team());

drop policy if exists "team file access read" on file_access_events;
create policy "team file access read" on file_access_events
  for select to authenticated
  using (tenant_id = app.current_tenant_id() and app.is_team());

drop policy if exists "service only consultation" on consultation_requests;
create policy "service only consultation" on consultation_requests
  for all to service_role
  using (true)
  with check (true);
