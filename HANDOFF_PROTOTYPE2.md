# James Roman Advisory Prototype2 Handoff

Date: 2026-06-03
Worktree: `/Users/romancantelearist/.config/superpowers/worktrees/james-roman-advisory/prototype-liquid-glass`
Branch: `prototype/liquid-glass-home`

## Summary

Created a new `/prototype2` route using the approved new structure and old visual language. The page preserves the restrained dark editorial brand direction, removes the Operating Principles section, makes Private Office copy dark over the Malibu shoreline image, and keeps the consultation form on a separate route with a solid dark navy background.

## Pending Documentation

The following Tier 2 governance documents are referenced in `MULTI_AGENT_PROTOCOL.md` but are not yet complete. They exist as stubs only. No agent should make structural, security, or feature decisions that depend on their content until they are marked Active.

| Document | Path | Status |
|----------|------|--------|
| Architecture | `docs/ARCHITECTURE.md` | Stub — pending |
| Security Model | `docs/SECURITY_MODEL.md` | Stub — pending |
| Matter Lifecycle | `docs/MATTER_LIFECYCLE.md` | Stub — pending |

Until these are complete, agents must escalate decisions in those domains to Roman rather than proceeding on assumptions.

---

## Routes

- Local home: `http://localhost:3021/prototype2`
- Local contact form: `http://localhost:3021/prototype2/contact`
- Production target: `https://www.jamesroman.la/prototype2`
- Production contact target: `https://www.jamesroman.la/prototype2/contact`
- Verified production deployment URL: `https://jr-advisory-iag0jg57a-roman-2757s-projects.vercel.app`

## User-Facing Changes

- Removed `The operating principles` section entirely.
- Added `/prototype2` as the new shareable prototype environment.
- Added `/prototype2/contact` as the contact/form route.
- Kept `/prototype` and `/prototype/contact` available.
- Made Private Office copy dark:
  - Label: dark near-black
  - Heading: dark near-black with muted olive-gold accent
  - Body and button: dark near-black
- Kept Private Office dashboard as a dark restricted-client-portal panel with true `3:4` ratio.
- Contact page background changed from the hero estate image to solid dark navy: `#06111f`.
- Unified the prototype typography scale:
  - Hero H1: `clamp(2.9rem,4.7vw,5.35rem)`
  - Section H2: `clamp(2.18rem,3.55vw,4.5rem)`
  - Subsection H3: `clamp(1.25rem,1.8vw,2.05rem)`
  - Body copy: `1.05rem`
- Increased contrast for the two hero eyebrow lines above the H1.
- Added a hydration-safe reduced-motion guard for Motion animations.
- Enlarged the custom cursor point from `4px` to `12px`.
- Reworked The Practice into a quieter editorial matrix with aligned text, muted numbering, and restrained color use.
- Replaced the Concierge Experience background with a darker Point Dume / Malibu mountains and Pacific Ocean asset, graded warm/dark to read as sunset.
- Reduced the custom cursor glow radius by 50% while keeping the larger `12px` cursor point.
- Reworked the contact route so the form is integrated into the page layout instead of sitting inside a detached card.
- Added the integrated consultation form directly into the homepage `Get in touch` section and removed the old `Open consultation form` CTA from that section.

## Practice Section

Current order:

1. Mold and Water Damage
2. Fire and Smoke Residue
3. Asbestos and Legacy Materials
4. Indoor Air Quality and VOCs
5. Pre-Sale Diligence
6. Contractor Procurement

## Key Files

- `src/app/prototype/page.tsx`
  - Shared prototype page logic.
  - Uses `usePathname()` so links point to `/prototype/contact` or `/prototype2/contact` depending on active route.
- `src/app/prototype/contact/page.tsx`
  - Original prototype contact page.
- `src/app/prototype2/page.tsx`
  - Re-exports the shared prototype page.
- `src/app/prototype2/contact/page.tsx`
  - Prototype2-specific contact page with `/prototype2` back links.
- `src/components/ui/input.tsx`
  - Replaced Base UI input primitive with native `<input>` while preserving styling/API to remove hydration mismatch from client-only caret inline style.
- `public/images/malibu-shoreline.jpg`
  - Private Office background.
- `public/images/malibu-mountains-ocean-sunset.jpg`
  - Current Concierge Experience background.

## Image Attribution

- `public/images/malibu-shoreline.jpg`
  - Source: Wikimedia Commons, `Malibu_Coastline-15824952705.jpg`
  - License: CC BY 2.0
  - Use: Previous Private Office background.
- `public/images/malibu-mountains-ocean-sunset.jpg`
  - Source: Wikimedia Commons, `Point Dume, Malibu (Unsplash).jpg`
  - Author: Austin Neill
  - License: CC0 1.0
  - Use: Current Concierge Experience background.

## Cross-Test Results

Local cross-test was run against `http://localhost:3021/prototype2` and `http://localhost:3021/prototype2/contact`.

Passed:

- `/prototype2` renders.
- `/prototype2/contact` renders.
- Operating Principles section removed.
- Section order is now:
  - Hero
  - The Practice
  - The Origin
  - The Cornerstone
  - Private Office
  - Get in touch
- Six practice services render in requested order.
- Private Office text color is dark: `rgb(10, 11, 14)`.
- Private Office portal panel ratio verified at `0.75`.
- Homepage has no embedded consultation form.
- `/prototype2/contact` has the form.
- Contact page uses solid dark navy background: `rgb(6, 17, 31)`.
- Home typography hierarchy verified:
  - Desktop H1 `67.68px` > H2 `51.12px` > H3 `25.92px`
  - Mobile H1 `46.4px` > H2 `34.88px` > H3 `20px`
- Hero eyebrow text verified at higher contrast:
  - Primary eyebrow: `rgb(236, 230, 214)`, opacity `0.88`
  - Secondary eyebrow: `rgb(201, 181, 138)`, opacity about `0.84`
- Reduced-motion pass verified:
  - No hydration mismatch.
  - H1 remains visible.
  - No horizontal overflow.
  - Expected Motion informational warning only when reduced motion is explicitly enabled.
- Refinement pass verified:
  - Cursor point computed at `12px`.
  - Concierge image source is `/images/malibu-mountains-ocean-sunset.jpg`.
  - Concierge image filter is `brightness(0.46) contrast(1.08) saturate(0.58) sepia(0.12)`.
  - Cursor glow computed at `210px`, reduced from the prior `420px`.
  - Contact form card radius is `0px` with transparent background.
  - Homepage `#consultation` section contains the actual form.
  - Homepage `#consultation` no longer contains the old `Open consultation form` CTA.
  - Desktop and mobile horizontal overflow: none.
- Desktop horizontal overflow: none.
- Mobile horizontal overflow at `390px`: none.
- Console/page errors after fixes: none.

Commands run:

```bash
npm run lint
npm run build
npm run test -- src/components/consultation-form.test.tsx --testTimeout=20000
```

Results:

- `npm run build`: passed.
- Targeted consultation form tests: passed.
- `npm run lint`: passed with one pre-existing unrelated warning in `src/app/page.tsx` for unused `Card`.

## Screenshots

Generated local QA screenshots:

- `/tmp/jra-prototype2-home.png`
- `/tmp/jra-prototype2-private-office.png`
- `/tmp/jra-prototype2-contact.png`

## Deployment

Final Vercel project for custom domain:

- `roman-2757s-projects/jr-advisory`
- Latest deployment ID: `dpl_EqkGUGKYfmLt6JLMrQ2FXbuNjR4J`
- Latest deployment URL: `https://jr-advisory-4xu3ffsmr-roman-2757s-projects.vercel.app`
- Previous verified deployment ID: `dpl_yqN5rr3hU84JCpSS2LNFWqvTze7M`
- Aliased custom domain: `https://www.jamesroman.la`

Deployment verification:

- `https://www.jamesroman.la/prototype2`: HTTP `200`
- `https://www.jamesroman.la/prototype2/contact`: HTTP `200`
- Vercel error logs after corrected deploy: none found
- Latest live Playwright smoke test on `www.jamesroman.la`:
  - Operating Principles removed
  - Home typography hierarchy verified on mobile: H1 `46.4px` > H2 `34.88px` > H3 `20px`
  - Hero eyebrow contrast verified
  - Contact route has the form
  - Contact route uses solid dark navy background: `rgb(6, 17, 31)`
  - Contact route no longer contains the old Adamson House background image
  - No horizontal overflow
  - No console warnings/errors

Deployment note:

- An initial deploy was made to `roman-2757s-projects/james-roman-advisory`, which produced a working Vercel URL but was not attached to `www.jamesroman.la`.
- Domain inspection showed `www.jamesroman.la` belongs to `roman-2757s-projects/jr-advisory`.
- First `jr-advisory` deploy returned `500` because that project lacked `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; `src/proxy.ts` was updated to no-op when Clerk is not configured, matching the existing defensive layout behavior.
- Corrected `jr-advisory` deploy is live and verified.

## Staging And Visual Gate Update

Updated June 5, 2026:

- production is frozen unless Roman explicitly approves deployment in the current thread.
- Environment naming now uses `prototype`, `staging`, and `production` as the first word of operational commands and lanes.
- Visual Constitution added: no future CRM, Office Portal, or Admin feature may reduce visual calmness, perceived discretion, perceived competence, or speed. See `docs/operations/visual-constitution.md`.
- Vercel `Preview` exists, but in James Roman naming it is the `staging` lane. It is not valid full staging until it uses a separate Supabase staging project.
- `npm run staging:check` now blocks staging deploys when staging and production share Supabase credentials.
- Current `npm run staging:check` result intentionally fails because staging and production share:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- staging Stripe test-mode env vars are not configured yet.
- `npm run production:deploy` is guarded and exits unless `JRA_APPROVE_PRODUCTION_DEPLOY=roman-approved-production` is set after explicit approval.
- `npm run prototype:test:visual` runs a dedicated Playwright visual gate on port `3031`, Chromium-only, and captures desktop/mobile screenshots to `/tmp/jra-visual-qa`.

Latest visual gate result:

```bash
npm run prototype:test:visual
# 9 passed
```

Visual gate coverage:

- `/`
- `/prototype`
- `/prototype2`
- `/prototype2/contact`
- Desktop `1440x1000`
- Mobile `390x844`
- Reduced-motion mode
- Founder-image visibility and stable rendered dimensions
- Horizontal overflow

## Secure Office Foundation Update

Updated June 5, 2026:

- Upload completion now moves case documents to `scan_pending`, not `available`.
- Signed download URLs are only created for documents with status `available`.
- Client RLS now explicitly verifies that `scan_pending` documents are hidden.
- Manual quarantine is documented in `docs/operations/document-scanning.md`; before real client files are stored, production must either keep manual advisor review as the explicit process or add a malware-scanning worker.
- Audit logs now use HMAC-based IP/user-agent hashes, event correlation ids, and a database append-only trigger. See `docs/operations/audit-logging.md`.
- Matters/documents now support sensitivity, classification, legal hold, deletion request, retention, and soft-deletion metadata. Legal hold blocks soft deletion, and matters/documents cannot be hard-deleted through normal database operations. See `docs/operations/data-retention-policy-draft.md`.
- Sentry is installed and wired through `@sentry/nextjs`, but runtime reporting is DSN-gated. Session Replay, tracing, profiling, and default PII collection are disabled. Events are scrubbed in `beforeSend`. See `docs/operations/sentry-monitoring.md`.

Latest secure-foundation verification:

```bash
npm run test -- src/lib/documents/scanning.test.ts
# 1 file passed, 2 tests passed

npm run test -- src/lib/crm/audit.test.ts
# 1 file passed, 4 tests passed

npm run prototype:test
# 18 files passed, 58 tests passed

npm run prototype:build
# passed

npx supabase db reset
# passed from clean local migration

npx supabase test db
# 1 file, 20 tests, PASS

npm run staging:check
# passed with Stripe and Sentry DSN/source-map warnings only
```

Current blocker:

- Staging secure-foundation preview is deployed at `https://jr-advisory-lxme9mhnb-roman-2757s-projects.vercel.app`.
- Deployment ID: `dpl_4d2CVJSmag8q6Z9PZcz5gFb4dnHU`.
- Preview is protected by Vercel Authentication. Use authorized Vercel access or `vercel curl` for verification.
- `npm run staging:check` now passes.
- Stripe test-mode keys are still missing and remain warnings only until payment work begins.
- Sentry DSN is still missing. Provide staging `NEXT_PUBLIC_SENTRY_DSN` and/or `SENTRY_DSN` to activate runtime reporting.
- Optional Sentry source-map vars are missing: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.
- Do not promote this deployment to production.
- Retention periods and CPRA/legal-hold conflict language still need counsel approval before real client data is stored.
- Console/page errors

## Known Notes

- `npm run lint` still reports the old unrelated warning:
  - `src/app/page.tsx:16:10 warning 'Card' is defined but never used`
- The in-app browser timed out navigating to the new route after App Router files were added, while `curl` and Playwright both verified the route. Cross-test therefore used local Playwright for final route checks and screenshots.
- No Git push was performed as part of this handoff.
