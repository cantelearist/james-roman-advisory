# Sprint Plan — James Roman Advisory

Source: `2026-06-05-production-foundation-sprint-plan.md`
Updated: 2026-06-05

## Priority Groups

### P0 — Must Finish Before Any Sensitive Production Use
- Clean deployment discipline + rollback workflow
- Valid staging environment (separate Supabase + Stripe test mode)
- Browser visual/animation QA gate
- Supabase staging + production setup
- Auth, invite-only, internal MFA, session policy
- Reduce service-role usage + prove RLS boundaries
- Rate limiting (auth, intake, signed URLs, messages)
- CSRF/same-origin checks for state-changing routes
- Private document storage with signed URL expiry tests
- Upload validation + malware scanning or quarantine
- Tamper-resistant audit logging
- Backup and restore drill
- Dependency vulnerability triage
- Monitoring with PII scrubbing
- CPRA export/delete workflow with legal-hold exception
- Legal review (privacy, retention, NDA, document handling)
- Contractor-payment legal + operational review before any live money movement

### P1 — Needed For V1 Client Office Launch
- Internal CRM CRUD for clients + matters
- Matter timeline and status
- Client office dashboard
- Secure document upload/download UX
- Advisor-client messages
- Manual invoice visibility + invoice PDF association
- NDA/engagement record visibility
- Email deliverability (login/invite + notifications)
- Contractor payment request + payment-status visibility in staging
- Accessibility + performance QA

### P2 — After V1 Stabilizes
- `office.jamesroman.la` + `admin.jamesroman.la` subdomain split
- Background workers (PDF processing, retention jobs, exports)
- Application-level field encryption for high-sensitivity fields
- Tenant admin, export/import, productization tooling
- Online payment flow (if approved)
- Contractor/attorney/insurance guest roles (if real demand)

---

## Sprint 0: Stabilize The Baseline

### Ticket 0.0: Establish Valid Staging Boundary [P0]
Files: `docs/operations/staging-environment.md`, `docs/operations/environment-naming.md`, `docs/operations/release-workflow.md`, `docs/operations/production-readiness.md`
Status: ✅ Complete (staging branch created, branch-scoped Supabase + AUDIT_HASH_SECRET configured)

### Ticket 0.1: Freeze Production Baseline [P0]
Files: `docs/operations/deployment-baseline.md`, `docs/operations/backup-restore-runbook.md`
Status: ✅ Complete (deployment baseline documented)

### Ticket 0.2: Add Visual And Animation Deployment Gate [P0]
Files: `.qa/prototype-visual-regression.spec.ts`, `package.json`, `HANDOFF_PROTOTYPE2.md`
Verify: `npm run prototype:test:visual`

### Ticket 0.3: Create Clean Release Workflow [P0]
Files: `docs/operations/release-workflow.md`, `.gitignore`

### Ticket 0.4: Dependency Vulnerability Triage [P0]
Files: `docs/operations/dependency-risk-register.md`, `package.json`, `package-lock.json`
Note: 32 moderate findings as of 2026-06-05 (mostly Vercel CLI chain + PostCSS via Next). Do NOT run `npm audit fix --force` blindly.

---

## Sprint 1: Secure Foundation

### Ticket 1.1: Create Supabase Staging And Production Projects [P0]
Files: `docs/operations/production-readiness.md`, `docs/operations/backup-restore-runbook.md`
Verify: `supabase migration list`, `supabase db push --linked`

### Ticket 1.2: Auth, MFA, And Session Policy [P0]
Files: `src/lib/crm/auth.ts`, `src/proxy.ts`, `src/lib/crm/auth.test.ts`, `docs/operations/security-model.md`
Verify: `npm run test -- src/lib/crm/auth.test.ts`

### Ticket 1.3: Reduce Service-Role Usage [P0]
Files: `src/lib/crm/data.ts`, `src/app/api/messages/route.ts`, document download/complete routes, `src/lib/crm/access-control.test.ts`, `docs/operations/service-role-policy.md`
Verify: `rg -n "createSupabaseAdminClient" src`, `npm run test -- src/lib/crm/access-control.test.ts`

### Ticket 1.4: RLS Policy Test Harness [P0]
Files: `supabase/tests/rls.sql`, migration file, `docs/operations/security-model.md`
Verify: `supabase test db`
Status: ✅ 16 RLS tests passing locally

### Ticket 1.5: Rate Limiting [P0]
Files: `src/lib/rate-limit.ts`, consultation/signed-upload/download/messages routes, `src/lib/rate-limit.test.ts`

### Ticket 1.6: CSRF And Same-Origin Guard [P0]
Files: `src/lib/request-guard.ts`, consultation/signed-upload/upload-complete/messages routes, `src/lib/request-guard.test.ts`
Status: ✅ Same-origin guard implemented (`enforceSameOriginRequest()`)

---

## Sprint 2: Data Protection And Operations

### Ticket 2.1: Data Classification And Legal Hold [P0]
Files: migration file, `docs/operations/security-model.md`, `docs/operations/data-retention-policy-draft.md`

### Ticket 2.2: Audit Log Hardening [P0]
Files: `src/lib/crm/audit.ts`, migration file, `src/lib/crm/audit.test.ts`
Status: ✅ HMAC-based IP/UA hashes, correlation id, append-only trigger — 4 tests passing

### Ticket 2.3: Backup And Restore Drill [P0]
Files: `docs/operations/backup-restore-runbook.md`, `docs/operations/restore-drill-log.md`

### Ticket 2.4: Monitoring And PII Scrubbing [P0]
Files: `src/lib/monitoring.ts`, `next.config.ts`, `docs/operations/production-readiness.md`

---

## Sprint 3: Secure Document Exchange

### Ticket 3.1: Signed Upload And Download Tests [P0]
Files: `src/app/api/documents/document-routes.test.ts`, signed-upload route, download route

### Ticket 3.2: Malware Scan Or Quarantine [P0]
Files: migration file, upload complete route, `src/lib/documents/scanning.ts`, `docs/operations/document-scanning.md`
Status: ✅ Quarantine implemented — 2 tests passing

### Ticket 3.3: Document UX [P1]
Files: `src/app/office/page.tsx`, `src/app/admin/page.tsx`, document-list + upload-panel components

---

## Sprint 4: Internal CRM V1

### Ticket 4.1: Clients And Matters CRUD [P1]
Files: admin clients/matters pages, client-form + matter-form components, `src/app/admin/admin-routes.test.tsx`

### Ticket 4.2: Timeline, Notes, NDA, And Invoice Visibility [P1]
Files: timeline-editor, internal-notes, invoice-panel, nda-panel components

### Ticket 4.3: Audit Viewer And Access Grants [P1]
Files: `src/app/admin/audit/page.tsx`, access-grants component, admin page

---

## Sprint 5: Client Office V1

### Ticket 5.1: Client Dashboard [P1]
Files: office page, matter-dashboard + status-timeline components

### Ticket 5.2: Secure Messaging [P1]
Files: message-thread component, messages route, `src/app/api/messages/route.test.ts`

### Ticket 5.3: Client Office Invite Flow [P1]
Files: sign-in page, auth callback route, `docs/operations/client-invite-flow.md`

---

## Sprint 6: Release Hardening

### Ticket 6.1: Email Deliverability [P0]
Files: `docs/operations/email-deliverability.md`
Verify: `dig TXT jamesroman.la`, `dig TXT _dmarc.jamesroman.la`

### Ticket 6.2: Legal And Privacy Review Packet [P0]
Files: `docs/legal/privacy-review-packet.md`, retention-review-packet, nda-workflow-review-packet

### Ticket 6.3: Staging UAT And Production Cutover [P0]
Files: `docs/operations/staging-uat-checklist.md`, `docs/operations/go-live-checklist.md`

---

## Sprint 7: Product-Ready Foundation

### Ticket 7.1: Tenant Export And Portability [P2]
Files: `src/lib/export/tenant-export.ts`, `docs/operations/data-export-format.md`

### Ticket 7.2: Subdomain Split Decision [P2]
Files: `docs/architecture/subdomain-split-decision.md`

---

## Local Test Results (2026-06-05)
- `npm run test -- src/lib/documents/scanning.test.ts`: 1 file, 2 tests ✅
- `npm run test -- src/lib/crm/audit.test.ts`: 1 file, 4 tests ✅
- `npm run prototype:test`: 18 files, 58 tests ✅
- `npm run prototype:build`: passed ✅
- `npx supabase db reset`: passed ✅
- `npx supabase test db`: 1 file, 16 tests ✅

## Instant Takeover (new agent start)
```bash
cd /Users/romancantelearist/.config/superpowers/worktrees/james-roman-advisory/prototype-liquid-glass
git status --short
git branch --show-current
npx vercel inspect https://www.jamesroman.la
npm run build
npm run test
npm audit --audit-level=moderate
```
Then read: CLAUDE.md → memory/architecture.md → memory/security.md → memory/operations.md → memory/payments.md
