# Private Office

The Private Office is the confidential workspace through which authorized people participate in an owner-side advisory engagement.

## Language

**User**:
A person with a Private Office identity. A User receives authority through a system role, a Permission Profile, and one or more Engagement Memberships.
_Avoid_: Account, login

**Client**:
The person or organization represented by James Roman Advisory.
_Avoid_: Customer, account

**Engagement**:
A defined advisory mandate for a Client.
_Avoid_: Matter, project, case

**Engagement File**:
The complete record of one Engagement, including its published timeline, documents, correspondence, contracts, change orders, invoices, and payments.
_Avoid_: Vault, folder, matter file

**Engagement Membership**:
An explicit, time-bounded relationship granting a User access to one Engagement.
_Avoid_: Ownership, client link

**Super Admin**:
The fixed system authority responsible for all Private Office access, configuration, and audit oversight.
_Avoid_: Owner, root user

**Admin**:
An internal operator whose authority is defined by a Super Admin through a Permission Profile and access scope.
_Avoid_: Advisor, staff

**Contractor**:
An external collaborator whose authority is limited to assigned Engagements and a Super Admin-defined Permission Profile.
_Avoid_: Advisor, vendor user

**Permission Profile**:
A reusable set of Capabilities that a Super Admin assigns to an Admin or Contractor.
_Avoid_: Custom role, access level

**Capability**:
A named business action that a User may perform, subject to Engagement Membership and resource audience.
_Avoid_: Permission flag, role check

**Resource Audience**:
The group allowed to receive an Engagement File item: internal operators, assigned Contractors, or the Client.
_Avoid_: Visibility toggle, public

**Second Factor**:
A time-limited proof from an enrolled authenticator app, required after password verification for every Super Admin, Admin, and Contractor session.
_Avoid_: Security code, email code

**Recovery Token**:
A single-use, short-lived credential sent to a User's verified email address to replace a forgotten password. A successful reset revokes every existing session.
_Avoid_: Reset link, magic link

**Message**:
An immutable correspondence entry inside one Engagement File, addressed to a Resource Audience.
_Avoid_: Chat, comment

**Invoice**:
An issued request for payment tied to one Engagement. Its original line items and amount remain immutable after issue.
_Avoid_: Bill, estimate

**Payment**:
A recorded settlement attempt against an Invoice. Provider-confirmed status, not the browser redirect, is authoritative.
_Avoid_: Charge

**Change Order**:
A separately numbered amendment to an accepted contract or issued Invoice. Acceptance preserves the original record and may produce a supplemental Invoice.
_Avoid_: Invoice edit, revision

**Notification**:
An auditable delivery attempt informing an authorized User about an Engagement File event. A Notification does not grant access to the underlying record.
_Avoid_: Alert, blast
