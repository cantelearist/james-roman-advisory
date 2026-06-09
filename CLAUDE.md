@AGENTS.md

## Deployment Command

When the user explicitly requests a production deployment:

```bash
DEPLOY_URL=$(vercel --prod --yes 2>&1 | grep 'https://' | tail -1 | tr -d ' ')
vercel alias "$DEPLOY_URL" jamesroman.la
```

Rules:

- Never deploy automatically without explicit user instruction.
- Verify build success before aliasing.
- Never deploy from experimental branches.
- Deploy only from approved production branches.
- Report deployment URL, alias status, build status, and rollback target.

## Production Deployment Policy

Production deployment requires explicit user approval.

Valid deployment instructions include:
- deploy
- deploy to production
- ship it

Do not infer deployment intent.
Do not auto-deploy after completing development work.
