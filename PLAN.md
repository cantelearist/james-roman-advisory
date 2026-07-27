# James Roman Advisory — Implementation Plan

_Last updated: 2026-05-11_

## 1. Positioning & Voice

**What the firm is.** A confidential advisory practice that represents the **owner** (not the contractor) on luxury residential projects in Malibu, Pacific Palisades, Brentwood, Santa Monica, Bel Air, and Beverly Hills. Mandate: oversee and endorse hazardous-materials remediation protocols and structural inspections.

**Tonal reference points.** White-shoe law firm + concierge medicine + private banking. Quiet authority. No marketing-speak. No stock photos of hard hats. Restrained typography, generous whitespace, off-white/stone palette with a single accent. Mobile-first but desktop-correct.

**Trust signals (not testimonials).** Credentials, jurisdictional coverage map, sample (redacted) engagement letter, principles document, press mentions if any. **No client names, no addresses, no project photos** unless explicitly cleared in writing.

---

## 2. Sitemap

### Public site (marketing)
- `/` — Home: one-line value prop, three pillars, "Request a consultation" CTA
- `/practice` — What we do (remediation oversight, structural inspection endorsement, owner's representation)
- `/principles` — Core principles (independence, confidentiality, owner-only representation, written record)
- `/engagements` — Past engagements (anonymized case studies — square footage, scope, jurisdiction, outcome, no addresses)
- `/people` — James Roman + senior advisors (bio, credentials, jurisdictions)
- `/jurisdictions` — Coverage areas with notes on local code/permit nuances
- `/insights` — Long-form writing (optional, phase 2)
- `/consultation` — Scheduling intake form → calendar
- `/contact` — Encrypted contact, mailing address, no public phone
- `/legal/privacy`, `/legal/terms`, `/legal/accessibility`

### Client portal (gated, `/portal/*`)
- `/portal` — Dashboard: active engagements, recent activity, unread items
- `/portal/engagements/[id]` — Single engagement: timeline, scope, principals, status
- `/portal/engagements/[id]/documents` — Reports, endorsements, inspection records (signed-URL viewer)
- `/portal/engagements/[id]/invoices` — Invoice list, statements, payment status
- `/portal/engagements/[id]/messages` — Threaded comments to/from advisor
- `/portal/engagements/[id]/requests` — Submit a request (site visit, document, second opinion)
- `/portal/account` — Profile, MFA, notification preferences, signed-device list
- `/portal/audit` — Personal access log (visible to client, full audit trail server-side)

---

## 3. Architecture

### Stack
- **Framework:** Next.js 15 (App Router) + TypeScript, React Server Components
- **Styling:** Tailwind CSS + shadcn/ui (matches Magic MCP output)
- **Forms/validation:** React Hook Form + Zod
- **Auth:** First-party email/password sessions with a planned second-factor upgrade
- **DB:** Postgres on Neon (branchable) or Supabase (built-in RLS + storage)
- **ORM:** Drizzle (preferred for strict types and migrations)
- **Storage:** S3-compatible (Supabase Storage or Cloudflare R2) with server-side encryption, signed URLs only, no public buckets
- **Email (transactional):** Resend or AWS SES with DKIM/DMARC enforced
- **Scheduling:** Cal.com self-hosted or embedded with private event types (no public booking pages)
- **AI:** Anthropic Claude API (Sonnet 4.6 for chat/summaries; Haiku 4.5 for cheap classifiers); all prompts cached; PII redaction at boundary
- **Hosting:** Vercel (Pro, with WAF rules, log scrubbing) — fallback AWS if data residency tightens
- **Observability:** Sentry (with PII scrubbing on), Vercel Analytics (no third-party trackers on portal routes)

### Repo layout
```
JR Design/
├── apps/web/                 # Next.js app
│   ├── app/
│   │   ├── (marketing)/      # public routes
│   │   ├── (portal)/portal/  # gated routes, layout enforces auth + MFA
│   │   └── api/              # route handlers
│   ├── components/ui/        # shadcn primitives
│   ├── components/marketing/ # public-site sections
│   ├── components/portal/    # portal sections
│   ├── lib/                  # db, auth, ai, audit, redact
│   └── styles/
├── packages/db/              # drizzle schema + migrations
├── packages/ai/              # claude clients, prompts, redaction
├── packages/config/          # eslint, tsconfig, tailwind preset
└── PLAN.md (this file)
```

### Data model (initial)
- `users` — first-party identity, password hash, status, and role family (`super_admin`, `admin`, `contractor`, `client`)
- `permission_profiles` — reusable Super Admin-defined capabilities for Admin and Contractor users
- `user_permission_assignments` — Permission Profile plus global or assigned engagement scope
- `clients` — household/entity record, billing entity, primary contact
- `engagements` — belongs to client, status, scope, jurisdiction, principals (advisor IDs)
- `engagement_memberships` — canonical, revocable, optionally expiring access to one Engagement
- `documents` — engagement-scoped, storage key, classification, audience, publication status, retention class
- `invoices` — engagement-scoped, line items, status, Stripe invoice ID
- `messages` — threaded per engagement, author, body, attachments, read receipts
- `requests` — client-initiated, type, status, SLA target, assignee
- `consultations` — pre-client intake, status (`new`, `screening`, `scheduled`, `declined`, `converted`)
- `audit_log` — append-only, every read/write of sensitive data (user_id, action, resource, ip_hash, ua_hash, timestamp)
- `consents` — record of accepted policies/versions per user

Current application policy: every protected route enforces a named capability and active Engagement Membership. Database RLS remains required before any secondary application or reporting tool receives direct database access.

---

## 4. AI Integration (where, how, with guardrails)

AI is integrated **from intake forward**, but never speaks on the firm's behalf without an advisor in the loop.

| Surface | Model | Purpose | Guardrails |
|---|---|---|---|
| Intake screener (`/consultation`) | Sonnet | Classify inquiry, draft internal summary for advisor review, suggest jurisdiction/scope tags | No client-facing reply; advisor approves before any outbound email |
| Document summarizer (portal) | Sonnet | Generate plain-English summary of inspection reports and endorsements for clients | Summary is labeled "AI-generated, advisor-reviewed"; advisor must sign off before publishing |
| Search/Q&A over engagement (portal) | Sonnet + RAG | Client asks "what's the status of the asbestos report?"; AI answers from that engagement's docs only | Retrieval scoped by RLS; no cross-engagement leakage; refuses if confidence low |
| Request triage | Haiku | Classify incoming requests by urgency/type, route to advisor | Deterministic fallback if model declines |
| Drafting assistant (advisor side only) | Sonnet | Help advisors draft endorsements, correspondence | Never auto-sent; redline workflow |

**Hard rules:**
- No third-party AI vendors in the data path. Anthropic only.
- Prompt caching enabled for system prompts and engagement context (5-minute TTL is fine; we re-pull on each session).
- PII redaction layer (`packages/ai/redact.ts`) strips SSNs, full addresses, phone numbers before any model call where they're not needed.
- All AI requests logged to `audit_log` with prompt hash + response hash.
- "Reset / forget" surface: client can request deletion of their AI interaction history (separate from engagement docs).

---

## 5. Compliance & Privacy Posture

### Regulatory
- **CCPA / CPRA** (California consumer privacy): Notice at collection, Do Not Sell/Share link (we don't sell, but the link is required), 12-month data inventory, deletion + access rights workflow in `/portal/account`.
- **ADA / WCAG 2.2 AA**: Color contrast ≥ 4.5:1 (we'll exceed), keyboard nav, focus rings visible, semantic landmarks, alt text, captioned video, axe-core in CI.
- **SOC 2 readiness** (not certified day one, but built so we can): Access controls, change management, audit logging, encryption, vendor list, incident-response runbook.
- **California Civil Code §1798.81.5** (reasonable security for personal info): Encryption at rest + in transit, least-privilege access, MFA on admin.
- **Records retention**: 7 years default for engagement records (consult counsel before launch — placeholder, see §10).

### Technical controls
- **Encryption:** TLS 1.3 only; AES-256 at rest; per-document envelope encryption for sensitive classes (endorsements, inspection reports).
- **Auth:** MFA required for all portal users (TOTP + passkey preferred). Session timeout 30 min idle / 12 hr absolute. Device list visible to user.
- **Access control:** fixed Super Admin authority, Super Admin-defined Admin/Contractor Permission Profiles, engagement-scoped memberships, and explicit resource audiences. Add Postgres RLS before direct database access is expanded.
- **Logging:** Append-only audit log; logs scrubbed of secrets; 1-year retention hot, longer cold storage.
- **Backups:** Daily snapshot, 30-day retention, restore drill quarterly.
- **No third-party trackers on `/portal/*`.** Marketing routes get a single privacy-respecting analytics tool (Vercel Analytics or Plausible) with cookie banner where required.
- **Secrets:** Vercel env + 1Password / Doppler; no secrets in repo; rotation calendar.
- **Vendor list (DPA on file before launch):** Vercel, Neon/Supabase, Resend, Anthropic, Sentry, Stripe.

### Confidentiality (firm-specific)
- Engagement records keyed by internal ID, never by address.
- Public engagement page is **anonymized** — no addresses, no client names, no images that could identify a property.
- Staff access logged and reviewable by the client on their own audit page.

---

## 6. UX Principles (for the design pass)

1. **Quiet, not loud.** Editorial typography (one serif display, one humanist sans). No gradients on marketing pages. One restrained accent color.
2. **Mobile-first, thumb-zone primary actions.** Bottom-aligned CTAs on portal mobile views.
3. **Reading > scanning.** Long-form authority pages, not bullet-soup. Generous measure (~65ch).
4. **Document-grade portal.** Portal looks like Stripe Dashboard meets a private bank — dense where helpful, never cluttered.
5. **Discretion in copy.** No "trust us!" Show the work: principles, jurisdictions, sample documents.
6. **Accessibility as a feature, not a checkbox.** Visible focus states, real semantic structure, reduced-motion respected, prefers-color-scheme honored.

---

## 7. Build Phases

### Phase 0 — Foundation (this session, ~1 day)
- Initialize Next.js + TS + Tailwind + shadcn in `/Users/romancantelearist/JR Design`
- Wire Drizzle + Neon/Supabase, schema migration #1
- Wire first-party sessions, password hashing, and route protection for `/portal/*`
- ESLint, Prettier, Husky, axe-core CI, basic Sentry
- Deploy preview on Vercel

### Phase 1 — Marketing site (~2–3 days)
- Home, Practice, Principles, People, Jurisdictions, Engagements (anonymized cards), Contact, Legal pages
- Consultation intake form → DB + advisor email + AI intake summary (internal)
- Cookie banner, privacy notice, accessibility statement
- Lighthouse ≥ 95 across the board, axe-clean

### Phase 2 — Client portal MVP (~1 week)
- Auth + MFA enforcement
- Engagement list, single-engagement view
- Documents (upload-by-advisor only at first; signed-URL viewer)
- Messages (threaded)
- Invoices (read-only; Stripe-hosted payment)
- Requests
- Account page + personal audit log

### Phase 3 — AI surfaces (~1 week)
- Intake screener (advisor-facing summary)
- Document summarizer (advisor-approved publishing)
- Engagement Q&A (RAG over that engagement's documents only)
- Request triage (advisor side)

### Phase 4 — Hardening & launch (~3–5 days)
- Penetration test (third party)
- Accessibility audit (third party or in-depth axe + manual)
- DPA paperwork with each vendor
- Incident-response runbook + on-call rotation
- Restore-from-backup drill
- DNS, WAF, security headers (CSP strict, HSTS, COOP/COEP), rate limiting

---

## 8. Open Questions for You

1. **Brand assets.** Do you have a logotype, or do we commission one? (Strong recommendation: commission a single wordmark from a serious typographer; no DIY.)
2. **Accent color.** Bias toward a deep oxblood, ink navy, or forest? Or stay strictly monochrome?
3. **Domain.** What domain? Preferred TLD (.com)?
4. **Entity & insurance.** Firm entity type (LLC/PC), E&O carrier? Affects footer disclosures.
5. **Counsel.** Which attorney drafts your privacy policy, ToS, and engagement letter template? I'll wire the doc surfaces to whatever they produce; I won't draft legal copy.
6. **Stripe vs. invoicing-only.** Do clients pay through the portal, or do you invoice out-of-band and just reflect status in the portal?
7. **Spouse / attorney access.** Should a client be able to grant scoped access to a spouse or attorney on a single engagement? (Default yes, scoped to that engagement only.)
8. **AI disclosure copy.** Comfortable with explicit "AI-assisted, advisor-reviewed" labels on summarized content?
9. **Press / engagements.** Any existing case studies or press to seed `/engagements` and `/insights`, or do we launch with the structure and fill over time?
10. **MFA strictness.** Require passkey + TOTP, or allow TOTP only? (My recommendation: require passkey, allow TOTP as fallback.)

---

## 9. Tool Connection Status

- **Magic MCP (`21st-dev/magic-mcp`)**: Pending — `mcp__magic__*` tools not yet visible in this session. After you've run `npx @21st-dev/cli@latest install claude --api-key <KEY>`, a new Claude Code session is needed for tools to surface. We can build without it (shadcn directly) and adopt Magic once it's live.
- **UI UX Pro Max skill**: Pending — not in loaded skills list. After `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` + `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill`, the skill will auto-activate on design prompts.
- **Anthropic API key**: Needed for AI surfaces in Phase 3 (env var `ANTHROPIC_API_KEY`).

---

## 10. Disclaimers

- I'm not your lawyer. The privacy, ToS, retention, and engagement-letter copy must be drafted or reviewed by California counsel before launch. I'll build the surfaces and the data-handling controls; the legal text is yours.
- "SOC 2 readiness" is an architecture posture, not a certification. Certification requires an audit firm and ~6–12 months of evidence collection.
- Final compliance posture depends on the data classes you actually store (e.g., if you handle health-adjacent info from a client, HIPAA-adjacent rules may attach — flag at intake).
