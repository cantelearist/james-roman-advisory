# Deployment Baseline

## Current Production Baseline

Checked June 5, 2026.

- Domain: `https://www.jamesroman.la`
- Current approved production deployment: `dpl_6t7vzRxwcaEysXg1bVP9o3kqZpLi`
- Deployment URL: `https://jr-advisory-n0pqlh56f-roman-2757s-projects.vercel.app`
- Bad image-swap deployment: `dpl_44EVkKaQFs4buprP8dF3nXMC34SC`
- Bad image-swap URL: `https://jr-advisory-ox3nv2ps3-roman-2757s-projects.vercel.app`

Do not promote `dpl_44EVkKaQFs4buprP8dF3nXMC34SC`.

## Emergency Rollback Command

```bash
npx vercel rollback https://jr-advisory-n0pqlh56f-roman-2757s-projects.vercel.app --yes --timeout 3m
```

Use rollback only for emergency recovery. Do not use rollback as a normal release tool.

## Founder Image Baseline

The live founder image and the local worktree asset should match:

```bash
curl -L --fail --silent https://www.jamesroman.la/images/founders/founders-malibu-beach.png | shasum -a 256
```

Expected:

```text
2e7fa3fcd62cce3e100b7a1697121eddb36472f6d98bbe3b922d17d340f4d9ac
```

Do not replace public images without running visual and animation QA against Preview first.

