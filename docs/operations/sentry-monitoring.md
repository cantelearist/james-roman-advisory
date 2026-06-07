# Sentry Monitoring

## Executive Summary

Sentry is wired into the application, but runtime reporting only activates when a Sentry DSN is present in the environment.

Staging should be activated first. Production should wait until staging proves clean and Roman approves promotion.

## Current Scope

Enabled in code:

- `@sentry/nextjs`
- server initialization
- edge initialization
- client initialization
- Next request-error capture
- explicit monitoring events for sensitive API failures
- `beforeSend` scrubbing before events leave the app

Disabled intentionally:

- Session Replay
- performance tracing
- profiling
- default PII collection

## Scrubbing Rules

The monitoring layer removes or redacts:

- emails
- bearer/basic auth tokens
- JWT-shaped strings
- Supabase service-role key patterns
- signed URL tokens
- upload tokens
- AWS/S3 presigned parameters
- filenames
- request headers, cookies, and request bodies in Sentry events

Source:

- Sentry recommends using SDK hooks such as `beforeSend` to scrub sensitive data before it leaves the local environment.

## Required Staging Variables

At minimum:

```text
NEXT_PUBLIC_SENTRY_DSN
SENTRY_DSN
```

The DSN is a public ingest endpoint. It is not the same category of secret as a service-role key, but it should still be managed deliberately.

For source maps:

```text
SENTRY_ORG
SENTRY_PROJECT
SENTRY_AUTH_TOKEN
```

`SENTRY_AUTH_TOKEN` is sensitive.

## Activation Steps

1. Create a Sentry project for the staging web app.
2. Add staging DSN values to Vercel Preview scoped to `staging-secure-office-foundation`.
3. Optional: add org/project/auth token for source-map uploads.
4. Run:

```bash
npm run staging:check
npm run prototype:test
npm run prototype:build
```

5. Deploy staging preview only.
6. Trigger a controlled staging test error and verify:

- event appears in Sentry
- email is redacted
- signed URL token is redacted
- filename is redacted
- no request headers/cookies/body are present

## Production Rule

Do not add production Sentry DSN or source-map upload until:

- staging reports are verified
- PII scrubbing is manually checked in Sentry
- Roman approves production monitoring activation

## Current Help Needed

Provide the staging Sentry DSN.

Optional, but useful:

- Sentry org slug
- Sentry project slug
- Sentry auth token for source-map upload
