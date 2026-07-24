@AGENTS.md

## Deployment Command

When the user explicitly requests a production deployment:

```bash
DEPLOY_URL=$(vercel --prod --yes 2>&1 | grep 'https://' | tail -1 | tr -d ' ')
vercel alias "$DEPLOY_URL" jamesroman.la
vercel alias "$DEPLOY_URL" www.jamesroman.la
```

Rules:

- Never deploy automatically without explicit user instruction.
- Verify build success before aliasing.
- Never deploy from experimental branches.
- Deploy only from approved production branches.
- Report deployment URL, alias status, build status, and rollback target.
- Always alias BOTH jamesroman.la AND www.jamesroman.la after every production deploy.

## Production Deployment Policy

Production deployment requires explicit user approval.

Valid deployment instructions include:
- deploy
- deploy to production
- ship it

Do not infer deployment intent.
Do not auto-deploy after completing development work.

---

# Claude-Specific Context

## Role Assignment

Claude owns: Auth layer, security posture, API route hardening, data access scoping.
Shared with user (product review): Ticket 2 (auth matrix), Ticket 5 (governance).

## Key Files — Read Before Touching

| File | Purpose |
|---|---|
| `src/proxy.ts` | Active middleware — NOT middleware.ts |
| `src/lib/auth.ts` | Server-side role + MFA guards |
| `src/lib/db.ts` | Full Neon schema — all table definitions |
| `src/lib/vault.ts` | Blob operations — read security model comment first |
| `docs/security/AUTH_ACCESS_REVIEW.md` | Audit findings + build list |

## Environment Variables

These exist in Vercel only. Never read from `.env.local` in production code without a fallback.

| Variable | Where |
|---|---|
| `CLERK_SECRET_KEY` | Vercel prod + staging |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Vercel prod + staging |
| `NEXT_PUBLIC_CLERK_FRONTEND_API_URL` | Vercel prod (override CSP Clerk host) |
| `NEON_DATABASE_URL` | Vercel prod + staging |
| `BLOB_READ_WRITE_TOKEN` | Vercel prod + staging |
| `RESEND_API_KEY` | Vercel prod only |
| `STRIPE_SECRET_KEY` | Vercel prod + staging |
| `STAGING_PASSWORD` | Vercel prod + staging |

## Resend — Lazy Init Required

Instantiate `new Resend(...)` inside the function body, not at module top level.
Next.js static page generation will throw if the key is absent at module load time.

## Auth Dual-Layer Pattern

Every protected resource must pass two checks:
1. **Middleware** (fast): JWT claims in `proxy.ts` — catches unauthenticated requests early
2. **Server** (authoritative): `currentUser()` in API routes — ground truth, always

Never rely on middleware alone for sensitive operations. Never skip the server check
because middleware "already handled it."
