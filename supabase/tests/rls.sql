begin;

create extension if not exists pgtap;

select plan(20);

set local role postgres;
select set_config('app.audit_maintenance', 'on', true);
select set_config('app.retention_maintenance', 'on', true);

delete from audit_logs where tenant_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from file_access_events where tenant_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from internal_notes where tenant_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from nda_records where tenant_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from invoices where tenant_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from timeline_events where tenant_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from messages where tenant_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from documents where tenant_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from access_grants where tenant_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from matters where tenant_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from clients where tenant_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from profiles where tenant_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
delete from auth.users where id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004'
);
delete from tenants where id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002'
);
select set_config('app.audit_maintenance', 'off', true);
select set_config('app.retention_maintenance', 'off', true);

insert into tenants (id, slug, name)
values
  ('10000000-0000-4000-8000-000000000001', 'rls-tenant-a', 'RLS Tenant A'),
  ('10000000-0000-4000-8000-000000000002', 'rls-tenant-b', 'RLS Tenant B');

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'team-a@example.com',
    'test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'client-a@example.com',
    'test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'revoked-client@example.com',
    'test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'team-b@example.com',
    'test',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into profiles (id, tenant_id, email, full_name, role)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'team-a@example.com',
    'Team A',
    'advisor'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'client-a@example.com',
    'Client A',
    'client'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'revoked-client@example.com',
    'Revoked Client',
    'client'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000002',
    'team-b@example.com',
    'Team B',
    'advisor'
  );

insert into clients (id, tenant_id, display_name)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Client A'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Client B');

insert into matters (id, tenant_id, client_id, title, status)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'Granted Matter',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'Revoked Matter',
    'active'
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    'Other Tenant Matter',
    'active'
  );

insert into access_grants (tenant_id, matter_id, user_id, revoked_at)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    null
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    now()
  );

insert into documents (id, tenant_id, matter_id, uploaded_by, title, storage_path, visibility, status)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Client Available',
    'tenant-a/granted/client-available.pdf',
    'client',
    'available'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Internal Only',
    'tenant-a/granted/internal.pdf',
    'internal',
    'available'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Pending Upload',
    'tenant-a/granted/pending.pdf',
    'client',
    'pending_upload'
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'Scan Pending',
    'tenant-a/granted/scan-pending.pdf',
    'client',
    'scan_pending'
  );

insert into internal_notes (tenant_id, matter_id, author_id, body)
values (
  '10000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Team-only context'
);

insert into audit_logs (tenant_id, actor_id, action, resource_type)
values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'test.audit',
  'matter'
);

insert into file_access_events (tenant_id, document_id, actor_id, action)
values (
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'test.access'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'tenants',
        'profiles',
        'clients',
        'matters',
        'access_grants',
        'documents',
        'messages',
        'timeline_events',
        'invoices',
        'nda_records',
        'internal_notes',
        'file_access_events',
        'audit_logs',
        'consultation_requests'
      )
      and c.relrowsecurity
  ),
  14,
  'RLS is enabled on all business tables'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*)::integer from clients), 1, 'team user sees only tenant clients');
select is((select count(*)::integer from matters), 2, 'team user sees tenant matters');
select is((select count(*)::integer from internal_notes), 1, 'team user sees internal notes');
select is((select count(*)::integer from audit_logs), 1, 'team user sees tenant audit logs');
select is((select count(*)::integer from file_access_events), 1, 'team user sees tenant file access events');
select isnt((select coalesce(correlation_id, '') from audit_logs where action = 'test.audit'), '', 'audit log receives correlation id');

reset role;
set local role postgres;

select throws_ok(
  $$ update audit_logs set metadata = '{"tampered":true}'::jsonb where action = 'test.audit' $$,
  'P0001',
  'audit_logs are append-only',
  'audit logs cannot be updated'
);

select throws_ok(
  $$ delete from audit_logs where action = 'test.audit' $$,
  'P0001',
  'audit_logs are append-only',
  'audit logs cannot be deleted'
);

select is(
  (select sensitivity_level::text from matters where id = '40000000-0000-4000-8000-000000000001'),
  'standard',
  'matters default to standard sensitivity'
);

select throws_ok(
  $$ update matters set legal_hold = true, deleted_at = now() where id = '40000000-0000-4000-8000-000000000001' $$,
  'P0001',
  'legal hold blocks deletion',
  'legal hold blocks matter soft deletion'
);

update documents
set legal_hold = true
where id = '50000000-0000-4000-8000-000000000001';

select throws_ok(
  $$ update documents set status = 'deleted' where id = '50000000-0000-4000-8000-000000000001' $$,
  'P0001',
  'legal hold blocks deletion',
  'legal hold blocks document status deletion'
);

select throws_ok(
  $$ delete from documents where id = '50000000-0000-4000-8000-000000000002' $$,
  'P0001',
  'retention records must be soft-deleted',
  'documents cannot be hard-deleted outside retention maintenance'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*)::integer from matters), 1, 'client sees only active granted matters');
select is((select count(*)::integer from documents), 1, 'client sees only available client-visible documents');
select isnt((select coalesce(max(title), '') from documents), 'Pending Upload', 'client cannot view pending-upload document');
select is((select count(*)::integer from documents where title = 'Scan Pending'), 0, 'client cannot view scan-pending document');
select is((select count(*)::integer from internal_notes), 0, 'client cannot view internal notes');
select is((select count(*)::integer from audit_logs), 0, 'client cannot view audit logs');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*)::integer from matters), 0, 'revoked grant denies matter access');

select * from finish();

rollback;
