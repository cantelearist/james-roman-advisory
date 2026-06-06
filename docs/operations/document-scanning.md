# Document Scanning And Quarantine

## Executive Summary

Client-uploaded files must not become downloadable immediately after upload completion.

Until a full malware scanning worker is selected and verified, v1 uses manual quarantine:

- Upload created: `pending_upload`
- Upload completed: `scan_pending`
- Advisor/scanner rejects file: `quarantined` or `scan_failed`
- Advisor/scanner clears file: `available`

Only `available` documents may receive signed download URLs.

## Current Implementation

`src/lib/documents/scanning.ts` defines the current v1 policy.

The upload completion route moves files to `scan_pending`, not `available`.

The download route creates signed URLs only when document status is `available`.

## Operating Rule

The system may preserve intended visibility, such as `client`, while the file is in `scan_pending`.

That does not make the file client-visible. Client access still requires:

- active matter access,
- document visibility `client`,
- document status `available`.

## Production Requirement

Before real client files are stored, choose one:

- Keep manual advisor review as the documented production process.
- Add a malware scanning worker and release files only after scanner success.

Do not silently convert `scan_pending` to `available` without an auditable advisor or scanner action.
