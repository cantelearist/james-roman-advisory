# Email Deliverability

Login links and invite emails are effectively uptime. A client who cannot receive a magic link cannot access their matter. This document covers the sending infrastructure, DNS authentication records, and the operational response when delivery fails.

---

## Sending Infrastructure

Supabase Auth handles transactional email for:

- Magic link login
- Invite-only account creation
- Password recovery (if ever enabled)

**Default Supabase sending domain:** `mail.supabase.io`

This domain works out of the box for development and early staging, but it shares reputation with every other Supabase project. For production, you must configure a custom SMTP provider so emails arrive from `@jamesroman.la` (or a dedicated subdomain like `@mail.jamesroman.la`).

---

## Recommended SMTP Provider

**Resend** (`resend.com`) is the preferred choice:

- Built for transactional auth email.
- Native Supabase integration.
- Clean sender reputation.
- Detailed delivery logs.
- Simple pricing for low-volume use.

**Alternative:** Postmark. Avoid SendGrid and Mailgun for v1 — shared IP pools are harder to manage for a boutique client office where every login matters.

### Resend Setup (Staging)

1. Create a Resend account and add `jamesroman.la` as a verified domain.
2. Generate an API key with send-only scope.
3. In Supabase Dashboard → Project Settings → Auth → SMTP Settings:
   - Enable custom SMTP
   - Host: `smtp.resend.com`
   - Port: `465` (TLS) or `587` (STARTTLS)
   - Username: `resend`
   - Password: the Resend API key
   - Sender email: `no-reply@jamesroman.la` or `office@jamesroman.la`
   - Sender name: `James Roman Advisory`
4. Test by triggering a magic link from the staging invite flow.
5. Confirm the email arrives, passes spam filters, and renders cleanly.

---

## DNS Authentication Records

All three records are required before production go-live. Without them, emails land in spam or are rejected outright by corporate mail servers.

### SPF (Sender Policy Framework)

SPF authorizes which mail servers may send on behalf of `jamesroman.la`.

**Target record:**

```
Type:  TXT
Host:  @  (or jamesroman.la)
Value: v=spf1 include:_spf.resend.com ~all
```

If you add Supabase's default sender as a fallback for staging:

```
Value: v=spf1 include:_spf.resend.com include:amazonses.com ~all
```

**Notes:**
- `~all` (softfail) is acceptable for launch. Switch to `-all` (hard fail) once you have verified delivery on all major providers.
- SPF records have a 10-lookup limit. Keep the record tight.
- Do not use `+all` under any circumstances.

**Verification:**

```bash
dig TXT jamesroman.la
# Should return a record containing v=spf1
```

### DKIM (DomainKeys Identified Mail)

DKIM cryptographically signs outbound messages so receiving servers can verify they were not tampered with in transit.

Resend provides a DKIM CNAME record during domain verification. It looks like:

```
Type:  CNAME
Host:  resend._domainkey.jamesroman.la
Value: <provided by Resend during domain setup>
```

Add the exact CNAME Resend supplies. Do not create the TXT record manually — CNAME lets Resend rotate keys without you touching DNS.

**Verification:**

```bash
dig CNAME resend._domainkey.jamesroman.la
# Should return Resend's key endpoint
```

### DMARC (Domain-based Message Authentication, Reporting & Conformance)

DMARC tells receiving servers what to do when SPF or DKIM fails, and where to send failure reports.

**Staging record (monitoring mode, no enforcement):**

```
Type:  TXT
Host:  _dmarc.jamesroman.la
Value: v=DMARC1; p=none; rua=mailto:postmaster@jamesroman.la; ruf=mailto:postmaster@jamesroman.la; fo=1
```

**Production record (enforce after confirming clean delivery):**

```
Type:  TXT
Host:  _dmarc.jamesroman.la
Value: v=DMARC1; p=quarantine; pct=100; rua=mailto:postmaster@jamesroman.la; fo=1
```

Escalate to `p=reject` only after the DMARC reporting data shows consistent SPF and DKIM alignment with no false positives.

**Verification:**

```bash
dig TXT _dmarc.jamesroman.la
# Should return v=DMARC1; p=none (staging) or p=quarantine (production)
```

---

## Supabase Auth Email Templates

Before production, replace Supabase's default templates with branded versions:

**Location:** Supabase Dashboard → Auth → Email Templates

| Template           | Trigger                         | Key requirements                                            |
|--------------------|---------------------------------|-------------------------------------------------------------|
| Confirm signup     | New invite accepted             | James Roman letterhead tone, clear CTA, no expiry confusion |
| Magic link         | Login link request              | Short body, clear button, 60-minute expiry note             |
| Change email       | Email update flow               | Confirm both old and new address                            |
| Reset password     | Recovery flow (if ever enabled) | Not used if magic-link-only; keep disabled otherwise        |

**Template rules:**
- Subject lines must not contain `[Supabase]` or any platform branding.
- Use `{{ .ConfirmationURL }}` for the magic link — do not hardcode URLs.
- Keep copy minimal and reassuring. The client is logging into their legal matter office, not a SaaS product.
- Do not use `Click here`. Use a clearly labeled action button.

---

## Delivery Testing

Test delivery to each major provider before allowing real client invites:

| Provider       | Test address format        | Common failure mode              |
|----------------|----------------------------|----------------------------------|
| Gmail          | `+tag@gmail.com`           | Spam classification, DKIM miss   |
| Apple iCloud   | `@icloud.com`              | Hard SPF rejection               |
| Microsoft 365  | `@outlook.com` or corp M365| DMARC policy enforcement         |
| Custom domain  | Client-provided domain     | Strict DMARC or IP reputation    |

**Test procedure:**

1. Trigger a staging invite to each address type.
2. Confirm email arrives in inbox (not spam).
3. Confirm magic link works end to end — including the post-auth redirect to `/office`.
4. Confirm the email renders cleanly in both the email client and on mobile.
5. Use [mail-tester.com](https://www.mail-tester.com) or [mxtoolbox.com](https://mxtoolbox.com) to score the outbound message.

**Target score:** 9/10 or higher on mail-tester.com.

---

## Operational Response: Failed Login Delivery

If a client cannot receive a login link, the team must have a clear response path.

**Tier 1 — Self-service (first 5 minutes):**

1. Client tries the magic link form again.
2. Client checks spam/junk folder.
3. Client confirms the correct email address was used.

**Tier 2 — Advisor-assisted (5–30 minutes):**

1. Advisor confirms the client's profile email in admin.
2. Advisor triggers a new invite from the admin panel.
3. Advisor checks Resend delivery logs for bounce or spam classification.
4. If the client's domain has strict DMARC/filtering, note it and work with the client's IT contact.

**Tier 3 — Escalation (30 minutes+):**

1. Advisor can share a matter summary PDF as a temporary workaround for urgent situations.
2. Document the failure in the operations log.
3. If a systemic deliverability issue is found, open a Resend support ticket immediately.

**No fallback SMS or phone auth exists in v1.** If email is blocked, escalation to PDF delivery is the only option until the blocking issue is resolved.

---

## Monitoring

Resend provides a delivery dashboard with bounce, spam, and click tracking. Check it:

- After every new client invite.
- Weekly during active matter phases.
- Immediately if a client reports not receiving an email.

Critical alerts to watch:

| Signal                   | Action                                             |
|--------------------------|----------------------------------------------------|
| Bounce rate > 2%         | Audit the address list, check DNS records          |
| Spam complaint rate > 0.1% | Review template content and sending behavior     |
| DMARC failure reports    | Check SPF/DKIM alignment, look for spoofing        |
| Auth email queue stalled | Check Supabase SMTP config and Resend API key      |

---

## Checklist Before Production

```
[ ] Custom SMTP provider (Resend) configured in Supabase Dashboard
[ ] SPF TXT record live for jamesroman.la
[ ] DKIM CNAME record live for jamesroman.la
[ ] DMARC TXT record live for jamesroman.la (p=none minimum)
[ ] Supabase email templates replaced with branded versions
[ ] Magic link tested to: Gmail, iCloud, Outlook, custom domain
[ ] Magic link tested end-to-end: invite → sign-in → /office redirect
[ ] mail-tester.com score: 9/10 or higher
[ ] Resend delivery dashboard reviewed and bookmarked
[ ] Tier 2 advisor support process documented and tested
[ ] postmaster@jamesroman.la inbox monitored for DMARC reports
```

---

## DNS Verification Commands

```bash
# SPF
dig TXT jamesroman.la

# DKIM (replace 'resend' with actual selector from Resend)
dig CNAME resend._domainkey.jamesroman.la

# DMARC
dig TXT _dmarc.jamesroman.la

# MX (confirm mail routing is correct)
dig MX jamesroman.la

# Check full email score
# Visit: https://www.mail-tester.com
# Or use mxtoolbox.com for individual record checks
```
