# Production Alignment Report

Updated 2026-07-24 after removing the hosted authentication provider.

## Verified stack

| Layer | Current implementation |
|---|---|
| Authentication | First-party email/password sessions in Neon |
| Database | Neon PostgreSQL |
| Storage | Vercel Blob through authenticated server proxies |
| Email | Resend |
| Hosting | Vercel |
| Framework | Next.js App Router |

## Auth controls

- Passwords use `scrypt` with per-password random salts.
- Sessions are opaque random tokens; only SHA-256 token hashes are stored.
- Session cookies are HttpOnly and Secure in production.
- Role checks remain in server route handlers and server page guards.
- Invitation tokens are hashed, one-time, and seven days in duration.

## Deployment checks

- `npm test -- --reporter=dot`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

The private office must not be considered fully ready for production client data
until password reset, second-factor verification, and vault storage credentials
have been verified in the production environment.
