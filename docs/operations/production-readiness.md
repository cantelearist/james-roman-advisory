# Production Readiness Checklist

Use this checklist before any production deployment — hotfix, release, or promotion.

A deployment that skips this checklist is not production-ready.

---

## 1. Build

- [ ] `npm run build` passes with zero errors
- [ ] No TypeScript errors
- [ ] No unresolved imports

## 2. Tests

- [ ] `npm run test` passes
- [ ] All failures are documented and understood (pre-existing vs. regression)
- [ ] No new test failures introduced by this change

## 3. Visual QA

- [ ] Homepage (`/`) renders correctly — dark editorial, JR monogram, correct nav, hero image
- [ ] `/prototype` (Prototype2) is visually unchanged
- [ ] Sign-in page renders on-brand
- [ ] No layout regressions on key public routes

## 4. Route Smoke Test

- [ ] `/` → 200
- [ ] `/sign-in` → 200 (no crash, no blank page)
- [ ] `/sign-up` → 307 redirect to sign-in
- [ ] `/portal` → 503 (Supabase not configured locally) or 302 to sign-in (with vars set)
- [ ] `/prototype` → 200
- [ ] `/robots.txt` → 200
- [ ] `/sitemap.xml` → 200

## 5. Diff Review

- [ ] Diff reviewed against [production-hotfix-policy.md](./production-hotfix-policy.md)
- [ ] Step 5 test applied: "If this bug did not exist, would this code still have been changed?"
- [ ] No out-of-scope changes present

## 6. Environment

- [ ] All required env vars confirmed present in Vercel production project
- [ ] No secrets committed to the branch
- [ ] `/.clerk/` excluded via `.gitignore`
- [ ] No `console.log` of sensitive values

## 7. Rollback

- [ ] Rollback target identified (commit SHA or Vercel deployment ID)
- [ ] Rollback target is a known-good production state
- [ ] Rollback procedure is clear

## 8. Security

- [ ] No MFA bypass introduced
- [ ] No RLS bypass introduced
- [ ] No service-role key exposed to client
- [ ] No access control weakened
- [ ] Audit logging intact

## 9. Visual Constitution

- [ ] Prototype2 visuals unchanged
- [ ] Founder images unchanged
- [ ] Typography unchanged
- [ ] Layout unchanged
- [ ] Brand presentation unchanged

## 10. Approval

- [ ] Explicit "approved — deploy" received from Roman in the current thread
- [ ] Approval is in this session (not a prior session or inferred)

---

## Deployment Record

After deployment, update [release-log.md](./release-log.md) with:

- Deployment ID
- Deployment URL
- Timestamp (UTC)
- Rollback target

---

## Related Documents

- [release-log.md](./release-log.md)
- [production-hotfix-policy.md](./production-hotfix-policy.md)
- [production-readiness.md](./production-readiness.md)
