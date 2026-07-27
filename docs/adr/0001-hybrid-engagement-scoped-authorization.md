# Use hybrid capability and engagement-scoped authorization

The Private Office uses fixed role families for Super Admin, Admin, Contractor, and Client, reusable Permission Profiles for Admins and Contractors, and explicit Engagement Memberships for record scope. This was chosen over global RBAC and per-user checkbox authorization because the portal needs configurable authority without allowing an outside collaborator or limited administrator to inherit access to every client engagement.
