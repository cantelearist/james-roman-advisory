# Require TOTP for staff sessions

The Private Office requires RFC 6238 authenticator-app verification after password verification for Super Admin, Admin, and Contractor sessions. Client enrollment remains optional. A short-lived pre-authentication challenge is kept separate from the full portal session, TOTP secrets are encrypted at rest with a dedicated application key, recovery codes are stored only as hashes, and losing a factor requires Super Admin recovery rather than bypassing verification.

This was chosen over email one-time codes and hosted authentication because staff access includes confidential engagement and financial records, email is already the password-recovery channel, and the product requires first-party authentication.
