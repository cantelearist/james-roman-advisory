# Dependency Risk Register

Last updated: 2026-06-05
Audited with: `npm audit --json`
Total packages: 1,157 (404 prod, 717 dev, 162 optional)

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Moderate | 2 |
| Low | 0 |

Both moderate findings share the same root: a bundled copy of `postcss` inside Next.js.

---

## Active Findings

### DEP-001 — PostCSS XSS via Unescaped `</style>` in CSS Stringify

| Field | Value |
|-------|-------|
| Severity | Moderate |
| CVSS Score | 6.1 (CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N) |
| CWE | CWE-79 (Improper Neutralization of Input During Web Page Generation) |
| Advisory | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) |
| Affected package | `postcss <8.5.10` |
| Location | `node_modules/next/node_modules/postcss` (bundled within Next.js, not a direct dependency) |
| Affected range | `next` versions `9.3.4-canary.0` through `16.3.0-canary.5` |
| Current version | `next` 16.2.6 |

**Nature of exposure:** PostCSS is a CSS build tool. The XSS vulnerability exists in its CSS-to-string serializer: if an adversary controls CSS input during the build step, the serialized output could contain an unescaped `</style>` tag. This is a **build-time concern only**. PostCSS is not included in the production JavaScript bundle served to clients. No user-submitted input reaches PostCSS at runtime.

**Risk to this project:** Low. The attack surface requires control over CSS source files checked into the repository or injected during the build process — which requires repository write access. There is no user-facing runtime exposure through this path.

**npm audit suggested fix:** Downgrade `next` to `9.3.3` (flagged as a major version change). This suggestion is incorrect — 9.3.3 predates all current architecture and would break the application entirely. Do not apply it.

**Actual remediation path:**
- Monitor the Next.js release for a stable version that ships `postcss ≥8.5.10` internally.
- When such a release is available, test the upgrade in a branch before applying.
- Do not run `npm audit fix --force` — it will attempt the destructive downgrade.

**Status:** Accepted risk (build-time only). Monitor Next.js releases.

---

### DEP-002 — Next.js flagged via PostCSS (same root as DEP-001)

| Field | Value |
|-------|-------|
| Severity | Moderate |
| Affected package | `next` (flagged as dependent on vulnerable postcss) |
| Notes | This is the same issue as DEP-001. npm audit surfaces both the direct-within-next `postcss` and `next` itself as separate entries. They share one advisory and one remediation path. |

**Status:** Same as DEP-001. Not a distinct vulnerability.

---

## Cleared / Resolved Findings

None at this time.

---

## Triage Rules

1. **Do not run `npm audit fix --force`** without reviewing the dependency change and testing on a branch. The `--force` flag will blindly apply breaking changes.
2. **Do not apply a major version downgrade** based on npm audit output without explicit approval from Roman.
3. For any high or critical finding, create an incident response item in the release log and address before next staging deployment.
4. For moderate findings, assess build-time vs. runtime exposure. Document the decision here.
5. Re-run `npm audit` on every dependency update PR and before each staging deployment.

---

## Next Audit

Run:

```bash
npm audit --json > docs/operations/npm-audit-$(date +%Y-%m-%d).json
npm audit
```

Update this register with any new findings or status changes.
