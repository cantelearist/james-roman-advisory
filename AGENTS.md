# James Roman Advisory Agent Rules

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Rules

Production is frozen unless Roman explicitly approves a production action in the current thread.

Prototype2 is sacred. Do not change public visuals, media, typography, layout, animations, founder images, or copy unless explicitly approved.

No future CRM, Office Portal, or Admin feature may reduce:

- visual calmness
- perceived discretion
- perceived competence
- speed

This is a production constraint, not a style preference.

## Environment Rules

All work must stay in one of these lanes:

- prototype
- staging
- production

Secure office, CRM, Supabase, auth, document exchange, payments, and infrastructure work happens in staging first.

Do not deploy production.
Do not run `vercel deploy --prod`.
Do not run `vercel promote`.
Do not alter production Supabase.
Do not alter production Stripe.
Do not print secrets.

## Supabase Rules

Use Supabase Auth, Postgres, RLS, and private Storage.

Public signup is not used.

Service-role key must never be used in client/browser code.

Do not use the service-role key as the default application data path.

Service-role usage is allowed only for narrow server-only operations such as:

- consultation intake insert
- signed upload/download operations after explicit access checks
- audit inserts if needed
- operational admin jobs

Every remaining service-role call must be justified in code comments.

## Verification

Before finishing any task, run the relevant checks:

```bash
npm run build
npm run test
```

For schema/RLS work, also run:

```bash
supabase test db
```

If Supabase CLI is unavailable, document that clearly and provide the exact next command required.
