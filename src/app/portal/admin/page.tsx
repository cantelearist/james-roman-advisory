"use client";

import {
  Activity,
  Archive,
  Check,
  ChevronRight,
  Copy,
  History,
  KeyRound,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Zap,
  X,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { usePortalAccess } from "@/components/portal/access-provider";
import { EmptyState, PageHeader } from "@/components/portal/portal-ui";
import type { Capability } from "@/lib/data-model";

type Role = "super_admin" | "admin" | "contractor" | "client";
type ManagedRole = Exclude<Role, "super_admin">;
type AdminTab = "users" | "profiles" | "invitations" | "audit" | "automations" | "settings";

type UserRow = {
  id: string; name: string; email: string; role: Role; status: "active" | "suspended";
  lastActiveAt?: string | null; permissionProfileId: string | null;
  permissionProfileName: string | null; accessScope: "global" | "assigned" | null;
};
type Profile = {
  id: string; name: string; roleType: "admin" | "contractor"; permissions: Capability[];
  isSystem: boolean; status: "active" | "archived";
};
type Membership = {
  userId: string; matterId: string; memberRole: ManagedRole; status: "active" | "revoked";
  expiresAt: string | null; matterTitle: string;
};
type Matter = { id: string; title: string; clientName: string };
type AuditEvent = {
  id: string; actorId: string; actorName?: string | null; action: string;
  targetUserId?: string | null; targetUserName?: string | null; matterId?: string | null;
  matterTitle?: string | null; metadata?: Record<string, unknown>; createdAt: string;
};
type Invitation = {
  id: string; email: string; role: ManagedRole; permissionProfileId?: string | null;
  accessScope?: "global" | "assigned"; matterId?: string | null; createdAt: string;
  expiresAt: string; acceptedAt?: string | null; status: "pending" | "accepted" | "expired";
};
type AccessData = {
  users: UserRow[]; profiles: Profile[]; memberships: Membership[]; matters: Matter[];
  auditEvents: AuditEvent[];
  assignableCapabilities: { admin: Capability[]; contractor: Capability[] };
};
type WorkspaceSettings = {
  workspaceName: string; defaultDocumentVisibility: "internal" | "contractor" | "client";
  invitationExpiryDays: number; notifyOnMessage: boolean; notifyOnDocument: boolean;
  notifyOnInvoice: boolean; notifyOnTask: boolean; requireWorkflowGates: boolean;
};
type Automation = {
  id: string; recipe_key: string; name: string; description: string;
  trigger_type: string; action_type: string; enabled: boolean;
  owner_user_id?: string | null; owner_name?: string | null;
  configuration?: { dueInDays?: number }; failure_count: number;
  last_run_at?: string | null;
};
type AutomationRun = {
  id: string; automation_id: string; automation_name: string; matter_title?: string | null;
  status: "running" | "succeeded" | "failed" | "skipped";
  error_message?: string | null; started_at: string; completed_at?: string | null;
};

const EMPTY_ACCESS: AccessData = {
  users: [], profiles: [], memberships: [], matters: [], auditEvents: [],
  assignableCapabilities: { admin: [], contractor: [] },
};

const TAB_OPTIONS: Array<{ value: AdminTab; label: string; icon: typeof Users; superOnly?: boolean }> = [
  { value: "users", label: "Users", icon: Users, superOnly: true },
  { value: "profiles", label: "Permission profiles", icon: KeyRound, superOnly: true },
  { value: "invitations", label: "Invitations", icon: Mail },
  { value: "audit", label: "Audit log", icon: History, superOnly: true },
  { value: "automations", label: "Automations", icon: Zap, superOnly: true },
  { value: "settings", label: "Settings", icon: Settings, superOnly: true },
];

function formatDate(value?: string | null, time = false): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US", time
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" });
}

function capabilityLabel(capability: Capability): string {
  const [module, action] = capability.split(".");
  return `${module.replaceAll("_", " ")} · ${action.replaceAll("_", " ")}`;
}

async function postAccess(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Access update failed.");
  return data;
}

export default function AdminPage() {
  const { access } = usePortalAccess();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isSuperAdmin = access.role === "super_admin";
  const requested = searchParams.get("tab") as AdminTab | null;
  const [tab, setTab] = useState<AdminTab>(
    pathname.endsWith("/access") ? "users"
      : requested && TAB_OPTIONS.some((option) => option.value === requested) ? requested
      : isSuperAdmin ? "users" : "invitations",
  );
  const [data, setData] = useState<AccessData>(EMPTY_ACCESS);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [automationRuns, setAutomationRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileRole, setProfileRole] = useState<"admin" | "contractor">("admin");
  const [confirmAction, setConfirmAction] = useState<{ title: string; consequence: string; run: () => Promise<void>; destructive?: boolean } | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all([
        fetch("/api/admin/invite", { cache: "no-store" }),
        isSuperAdmin ? fetch("/api/admin/access", { cache: "no-store" }) : Promise.resolve(null),
        isSuperAdmin ? fetch("/api/admin/settings", { cache: "no-store" }) : Promise.resolve(null),
        fetch("/api/matters?limit=250", { cache: "no-store" }),
        isSuperAdmin ? fetch("/api/admin/automations", { cache: "no-store" }) : Promise.resolve(null),
      ]);
      const invitationData = await responses[0].json();
      if (!responses[0].ok) throw new Error(invitationData.error ?? "Admin records could not be loaded.");
      setInvitations(invitationData.invitations ?? []);
      if (responses[1]) {
        const accessData = await responses[1].json();
        if (responses[1].ok) setData(accessData);
      }
      if (responses[3]?.ok) {
        const matterData = await responses[3].json();
        setData((current) => ({
          ...current,
          matters: (matterData.matters ?? []).map((matter: Record<string, unknown>) => ({
            id: String(matter.id),
            title: String(matter.title),
            clientName: String(matter.client_name ?? ""),
          })),
        }));
      }
      if (responses[2]) {
        const settingsData = await responses[2].json();
        if (responses[2].ok) setSettings(settingsData.settings);
      }
      if (responses[4]) {
        const automationData = await responses[4].json();
        if (responses[4].ok) {
          setAutomations(automationData.automations ?? []);
          setAutomationRuns(automationData.runs ?? []);
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Admin records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const visibleUsers = useMemo(() => data.users.filter((user) => {
    if (query && !`${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (roleFilter && user.role !== roleFilter) return false;
    if (statusFilter && user.status !== statusFilter) return false;
    return true;
  }), [data.users, query, roleFilter, statusFilter]);

  const visibleAudit = useMemo(() => data.auditEvents.filter((event) =>
    !query || `${event.actorName} ${event.action} ${event.targetUserName} ${event.matterTitle}`.toLowerCase().includes(query.toLowerCase()),
  ), [data.auditEvents, query]);

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("invite");
    setError("");
    const response = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"), role: form.get("role"),
        permissionProfileId: form.get("permissionProfileId") || undefined,
        accessScope: form.get("accessScope") || "assigned",
        matterId: form.get("matterId") || undefined,
      }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Invitation could not be sent.");
    else {
      setShowInvite(false);
      setSuccess(result.delivery?.sent === false
        ? "Invitation created, but email delivery is not configured."
        : `Invitation sent to ${result.email}.`);
      await load();
    }
    setBusy("");
  }

  async function resendInvitation(invitation: Invitation) {
    setBusy(invitation.id);
    const response = await fetch("/api/admin/invite", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: invitation.id, action: "resend" }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Invitation could not be resent.");
    else {
      setSuccess(result.delivery?.sent === false ? "Invitation renewed, but email delivery failed." : "Invitation renewed and resent.");
      await load();
    }
    setBusy("");
  }

  async function revokeInvitation(invitation: Invitation) {
    const response = await fetch(`/api/admin/invite?id=${invitation.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Invitation could not be revoked.");
    setSuccess("Invitation revoked.");
    await load();
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;
    const form = new FormData(event.currentTarget);
    const role = form.get("role") as ManagedRole;
    const status = form.get("status") as "active" | "suspended";
    const profileId = String(form.get("permissionProfileId") ?? "");
    const scope = form.get("accessScope") as "global" | "assigned";
    const changes = [
      role !== editingUser.role && `Role: ${editingUser.role} → ${role}`,
      status !== editingUser.status && `Status: ${editingUser.status} → ${status}`,
      profileId !== (editingUser.permissionProfileId ?? "") && "Permission profile will change",
      scope !== (editingUser.accessScope ?? "assigned") && `Scope: ${editingUser.accessScope ?? "assigned"} → ${scope}`,
    ].filter(Boolean);
    if (changes.length === 0) {
      setEditingUser(null);
      return;
    }
    setConfirmAction({
      title: `Update access for ${editingUser.name}?`,
      consequence: `${changes.join(". ")}. Existing sessions will be revoked and the user must sign in again.`,
      destructive: status === "suspended" || scope === "global",
      run: async () => {
        await postAccess({
          action: "configure_user", userId: editingUser.id, role,
          permissionProfileId: role === "admin" || role === "contractor" ? profileId || undefined : undefined,
          accessScope: role === "admin" ? scope : "assigned", status,
        });
        setEditingUser(null);
        setSuccess("User authority updated. Existing sessions were revoked.");
        await load();
      },
    });
  }

  async function assignMembership(event: FormEvent<HTMLFormElement>, user: UserRow) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("membership");
    try {
      await postAccess({
        action: "assign_engagement", userId: user.id, matterId: form.get("matterId"),
        expiresAt: form.get("expiresAt") ? new Date(`${form.get("expiresAt")}T23:59:59`).toISOString() : null,
      });
      setSuccess("Engagement access assigned.");
      await load();
    } catch (assignmentError) {
      setError(assignmentError instanceof Error ? assignmentError.message : "Assignment failed.");
    }
    setBusy("");
  }

  async function revokeMembership(membership: Membership) {
    await postAccess({ action: "revoke_engagement", userId: membership.userId, matterId: membership.matterId });
    setSuccess("Engagement access revoked. Existing sessions were revoked.");
    await load();
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const roleType = form.get("roleType") as "admin" | "contractor";
    const permissions = form.getAll("permissions") as Capability[];
    setBusy("profile");
    try {
      await postAccess(editingProfile
        ? { action: "update_profile", profileId: editingProfile.id, name: form.get("name"), permissions }
        : { action: "create_profile", name: form.get("name"), roleType, permissions });
      setEditingProfile(null);
      setShowProfile(false);
      setSuccess(editingProfile ? "Permission profile updated." : "Permission profile created.");
      await load();
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Profile could not be saved.");
    }
    setBusy("");
  }

  async function archiveProfile(profile: Profile) {
    await postAccess({ action: "archive_profile", profileId: profile.id });
    setSuccess("Permission profile archived.");
    await load();
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("settings");
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceName: form.get("workspaceName"),
        defaultDocumentVisibility: form.get("defaultDocumentVisibility"),
        invitationExpiryDays: Number(form.get("invitationExpiryDays")),
        notifyOnMessage: form.get("notifyOnMessage") === "on",
        notifyOnDocument: form.get("notifyOnDocument") === "on",
        notifyOnInvoice: form.get("notifyOnInvoice") === "on",
        notifyOnTask: form.get("notifyOnTask") === "on",
        requireWorkflowGates: form.get("requireWorkflowGates") === "on",
      }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Settings could not be saved.");
    else {
      setSettings(result.settings);
      setSuccess("Workspace settings updated and audited.");
    }
    setBusy("");
  }

  async function saveAutomation(automation: Automation) {
    setBusy(automation.id);
    setError("");
    const response = await fetch("/api/admin/automations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: automation.id,
        enabled: automation.enabled,
        ownerUserId: automation.owner_user_id || null,
        dueInDays: automation.configuration?.dueInDays,
      }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Automation could not be updated.");
    else {
      setSuccess(`${automation.name} updated and audited.`);
      await load();
    }
    setBusy("");
  }

  const availableTabs = TAB_OPTIONS.filter((option) => !option.superOnly || isSuperAdmin);

  return (
    <div className="portal-page portal-admin-page">
      <PageHeader
        eyebrow={isSuperAdmin ? "Super Admin" : "Administration"}
        title="People and access"
        description={isSuperAdmin
          ? "Authority, engagement scope, invitations and audited workspace controls."
          : "Invite and provision permitted users for your assigned engagements."}
        actions={
          <>
            <button className="portal-secondary-button" onClick={load}><RefreshCw size={14} />Refresh</button>
            <button className="portal-primary-button" onClick={() => setShowInvite(true)}><UserPlus size={15} />Invite user</button>
          </>
        }
      />

      <nav className="portal-admin-tabs" aria-label="Administration sections">
        {availableTabs.map((option) => {
          const Icon = option.icon;
          return <button key={option.value} className={tab === option.value ? "is-active" : undefined} onClick={() => { setTab(option.value); setQuery(""); }}><Icon size={14} />{option.label}{option.value === "invitations" && invitations.filter((invite) => invite.status === "pending").length > 0 && <span>{invitations.filter((invite) => invite.status === "pending").length}</span>}</button>;
        })}
      </nav>

      {error && <div className="portal-inline-error" role="alert"><span>{error}</span><button onClick={() => setError("")}><X size={14} /></button></div>}
      {success && <div className="portal-inline-success" role="status"><span>{success}</span><button onClick={() => setSuccess("")}><X size={14} /></button></div>}

      {tab !== "settings" && (
        <div className="portal-board-toolbar">
          <label className="portal-board-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${tab.replace("_", " ")}`} /></label>
          {tab === "users" && <>
            <select className="portal-toolbar-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">All roles</option><option value="super_admin">Super Admin</option><option value="admin">Admin</option><option value="contractor">Contractor</option><option value="client">Client</option></select>
            <select className="portal-toolbar-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
          </>}
          {tab === "profiles" && <button className="portal-primary-button" onClick={() => { setEditingProfile(null); setProfileRole("admin"); setShowProfile(true); }}><Plus size={14} />New profile</button>}
        </div>
      )}

      {loading ? (
        <div className="portal-board-loading">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div>
      ) : tab === "users" ? (
        <section className="portal-card portal-admin-table-wrap">
          {visibleUsers.length === 0 ? <EmptyState icon={Users} title="No users match this view" description="Adjust the current search or filters." /> : (
            <div className="portal-admin-table">
              <div className="portal-admin-row portal-admin-header"><span>User</span><span>Role</span><span>Permission profile</span><span>Scope</span><span>Status</span><span>Last active</span><span /></div>
              {visibleUsers.map((managedUser) => (
                <button className="portal-admin-row" key={managedUser.id} onClick={() => setEditingUser(managedUser)}>
                  <span className="portal-admin-user"><span className="portal-avatar">{managedUser.name.slice(0, 1)}</span><div><strong>{managedUser.name}</strong><small>{managedUser.email}</small></div></span>
                  <span className={`portal-role portal-role-${managedUser.role}`}>{managedUser.role.replace("_", " ")}</span>
                  <span>{managedUser.role === "super_admin" ? "All capabilities" : managedUser.permissionProfileName || "Fixed client authority"}</span>
                  <span>{managedUser.role === "super_admin" ? "Global" : managedUser.accessScope || "Assigned"}</span>
                  <span className={`portal-user-status portal-user-status-${managedUser.status}`}>{managedUser.status}</span>
                  <time>{formatDate(managedUser.lastActiveAt)}</time>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          )}
        </section>
      ) : tab === "profiles" ? (
        <div className="portal-profile-grid">
          {data.profiles.filter((profile) => profile.status === "active").map((profile) => {
            const assigned = data.users.filter((managedUser) => managedUser.permissionProfileId === profile.id).length;
            return (
              <section className="portal-card portal-profile-card" key={profile.id}>
                <header><span className="portal-profile-icon"><KeyRound size={16} /></span><div><strong>{profile.name}</strong><span>{profile.roleType} profile · {assigned} assigned</span></div>{profile.isSystem && <em>System</em>}</header>
                <div className="portal-capability-summary">{profile.permissions.slice(0, 8).map((capability) => <span key={capability}>{capabilityLabel(capability)}</span>)}{profile.permissions.length > 8 && <small>+{profile.permissions.length - 8} more</small>}</div>
                <footer><button className="portal-secondary-button" onClick={() => { setEditingProfile(profile); setProfileRole(profile.roleType); setShowProfile(true); }}>Review profile</button>{!profile.isSystem && <button className="portal-icon-button portal-danger-icon" onClick={() => setConfirmAction({ title: `Archive ${profile.name}?`, consequence: assigned ? `${assigned} users remain assigned. Reassign them before this profile can be archived.` : "The profile will no longer be available for assignments.", destructive: true, run: () => archiveProfile(profile) })} aria-label={`Archive ${profile.name}`}><Archive size={14} /></button>}</footer>
              </section>
            );
          })}
        </div>
      ) : tab === "invitations" ? (
        <section className="portal-card portal-admin-table-wrap">
          {invitations.length === 0 ? <EmptyState icon={Mail} title="No invitation history" description="Sent, accepted and expired invitations will appear here." /> : (
            <div className="portal-invitation-table">
              <div className="portal-invitation-row portal-admin-header"><span>Recipient</span><span>Role and scope</span><span>Engagement</span><span>Sent</span><span>Expires</span><span>Status</span><span /></div>
              {invitations.filter((invitation) => !query || invitation.email.toLowerCase().includes(query.toLowerCase())).map((invitation) => (
                <div className="portal-invitation-row" key={invitation.id}>
                  <span><strong>{invitation.email}</strong></span>
                  <span>{invitation.role} · {invitation.accessScope || "assigned"}</span>
                  <span>{data.matters.find((matter) => matter.id === invitation.matterId)?.title || "—"}</span>
                  <time>{formatDate(invitation.createdAt)}</time><time>{formatDate(invitation.expiresAt)}</time>
                  <span className={`portal-invite-status portal-invite-${invitation.status}`}>{invitation.status}</span>
                  <span className="portal-invite-actions">{invitation.status !== "accepted" && <button className="portal-icon-button" onClick={() => resendInvitation(invitation)} disabled={busy === invitation.id} aria-label={`Resend invitation to ${invitation.email}`}><Send size={14} /></button>}{invitation.status === "pending" && <button className="portal-icon-button portal-danger-icon" onClick={() => setConfirmAction({ title: `Revoke invitation to ${invitation.email}?`, consequence: "The existing invitation link will stop working immediately.", destructive: true, run: () => revokeInvitation(invitation) })} aria-label={`Revoke invitation to ${invitation.email}`}><Trash2 size={14} /></button>}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : tab === "audit" ? (
        <section className="portal-card portal-audit-table">
          {visibleAudit.length === 0 ? <EmptyState icon={History} title="No audit events match this view" description="Access and administration changes are recorded here." /> : visibleAudit.map((event) => (
            <article key={event.id}><span className="portal-audit-icon"><History size={13} /></span><div><strong>{event.action.replaceAll(".", " · ").replaceAll("_", " ")}</strong><p>{event.actorName || event.actorId}{event.targetUserName ? ` changed ${event.targetUserName}` : ""}{event.matterTitle ? ` · ${event.matterTitle}` : ""}</p></div><time>{formatDate(event.createdAt, true)}</time><button className="portal-icon-button" aria-label={`Details for ${event.action}`}><Copy size={13} /></button></article>
          ))}
        </section>
      ) : tab === "automations" ? (
        <div className="portal-automation-layout">
          <section className="portal-automation-grid">
            {automations.map((automation) => (
              <article className={`portal-card portal-automation-card ${automation.enabled ? "is-enabled" : ""}`} key={automation.id}>
                <header>
                  <span className="portal-profile-icon"><Zap size={16} /></span>
                  <div><strong>{automation.name}</strong><span>{automation.trigger_type.replaceAll("_", " ")} → {automation.action_type.replaceAll("_", " ")}</span></div>
                  <label className="portal-automation-switch"><input type="checkbox" checked={automation.enabled} onChange={(event) => setAutomations((rows) => rows.map((row) => row.id === automation.id ? { ...row, enabled: event.target.checked } : row))} /><span /></label>
                </header>
                <p>{automation.description}</p>
                <div className="portal-automation-controls">
                  <label className="portal-field"><span>Accountable owner</span><select value={automation.owner_user_id || ""} onChange={(event) => setAutomations((rows) => rows.map((row) => row.id === automation.id ? { ...row, owner_user_id: event.target.value || null } : row))}><option value="">Unassigned</option>{data.users.filter((managedUser) => managedUser.status === "active" && (managedUser.role === "super_admin" || (managedUser.role === "admin" && managedUser.accessScope === "global"))).map((managedUser) => <option key={managedUser.id} value={managedUser.id}>{managedUser.name}</option>)}</select></label>
                  {automation.action_type === "create_task" && <label className="portal-field"><span>Task due after</span><select value={automation.configuration?.dueInDays ?? 1} onChange={(event) => setAutomations((rows) => rows.map((row) => row.id === automation.id ? { ...row, configuration: { ...row.configuration, dueInDays: Number(event.target.value) } } : row))}><option value="0">Same day</option><option value="1">1 day</option><option value="2">2 days</option><option value="3">3 days</option><option value="7">7 days</option></select></label>}
                </div>
                <footer><span>{automation.last_run_at ? `Last run ${formatDate(automation.last_run_at, true)}` : "Not run yet"}{Number(automation.failure_count) > 0 ? ` · ${automation.failure_count} failures` : ""}</span><button className="portal-secondary-button" onClick={() => saveAutomation(automation)} disabled={busy === automation.id}>{busy === automation.id ? "Saving…" : "Save recipe"}</button></footer>
              </article>
            ))}
          </section>
          <section className="portal-card portal-automation-history">
            <header><div><p className="portal-eyebrow">Execution record</p><h2>Run history</h2></div><Activity size={16} /></header>
            {automationRuns.length === 0 ? <EmptyState icon={Activity} title="No automation runs" description="Enabled recipes will record successes, skips and failures here." /> : automationRuns.slice(0, 30).map((run) => <div key={run.id}><span className={`portal-run-status portal-run-${run.status}`}>{run.status}</span><div><strong>{run.automation_name}</strong><small>{run.matter_title || "Workspace task"}{run.error_message ? ` · ${run.error_message}` : ""}</small></div><time>{formatDate(run.started_at, true)}</time></div>)}
          </section>
        </div>
      ) : settings ? (
        <form className="portal-settings-layout" onSubmit={saveSettings}>
          <section className="portal-card portal-settings-card">
            <header><p className="portal-eyebrow">Workspace</p><h2>General</h2><span>Visible operating defaults. Secrets remain in deployment environment variables.</span></header>
            <div>
              <label className="portal-field"><span>Workspace name</span><input name="workspaceName" defaultValue={settings.workspaceName} required /></label>
              <label className="portal-field"><span>Default document audience</span><select name="defaultDocumentVisibility" defaultValue={settings.defaultDocumentVisibility}><option value="internal">Internal</option><option value="contractor">Contractor</option><option value="client">Client</option></select></label>
              <label className="portal-field"><span>Invitation expiry</span><select name="invitationExpiryDays" defaultValue={settings.invitationExpiryDays}><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></label>
            </div>
          </section>
          <section className="portal-card portal-settings-card">
            <header><p className="portal-eyebrow">Notifications</p><h2>Email and in-app activity</h2><span>Choose the operating events that create alerts.</span></header>
            <div className="portal-settings-checks">
              {[["notifyOnMessage", "New messages", settings.notifyOnMessage], ["notifyOnDocument", "Document uploads", settings.notifyOnDocument], ["notifyOnInvoice", "Invoices and reminders", settings.notifyOnInvoice], ["notifyOnTask", "Task assignments", settings.notifyOnTask]].map(([name, label, checked]) => <label key={String(name)}><span><strong>{label}</strong><small>Email and notification center</small></span><input type="checkbox" name={String(name)} defaultChecked={Boolean(checked)} /></label>)}
            </div>
          </section>
          <section className="portal-card portal-settings-card">
            <header><p className="portal-eyebrow">Control</p><h2>Workflow integrity</h2><span>Prevent engagements from presenting incomplete work as resolved.</span></header>
            <div className="portal-settings-checks"><label><span><strong>Require workflow gates</strong><small>Required items must be completed or explicitly waived before stage advancement.</small></span><input type="checkbox" name="requireWorkflowGates" defaultChecked={settings.requireWorkflowGates} /></label></div>
          </section>
          <footer><button className="portal-primary-button" disabled={busy === "settings"}><ShieldCheck size={14} />{busy === "settings" ? "Saving…" : "Save audited settings"}</button></footer>
        </form>
      ) : null}

      {showInvite && (
        <div className="portal-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="invite-user-title">
          <button className="portal-command-scrim" onClick={() => setShowInvite(false)} aria-label="Close invitation" />
          <section className="portal-dialog portal-save-dialog">
            <header><div><p className="portal-eyebrow">Secure access</p><h2 id="invite-user-title">Invite user</h2></div><button className="portal-icon-button" onClick={() => setShowInvite(false)}><X size={18} /></button></header>
            <form onSubmit={sendInvitation}>
              <label className="portal-field"><span>Email</span><input type="email" name="email" required autoFocus /></label>
              <label className="portal-field"><span>Role</span><select name="role" defaultValue="client"><option value="client">Client</option>{isSuperAdmin && <><option value="contractor">Contractor</option><option value="admin">Admin</option></>}</select></label>
              {isSuperAdmin && <label className="portal-field"><span>Permission profile</span><select name="permissionProfileId" defaultValue=""><option value="">Standard profile</option>{data.profiles.filter((profile) => profile.status === "active").map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.roleType}</option>)}</select></label>}
              {isSuperAdmin && <label className="portal-field"><span>Admin scope</span><select name="accessScope" defaultValue="assigned"><option value="assigned">Assigned portfolio</option><option value="global">Global portfolio</option></select><small>Scope limits which existing records are visible. The selected profile still controls creation, issue, reminder and void authority.</small></label>}
              <label className="portal-field"><span>Initial engagement</span><select name="matterId" defaultValue=""><option value="">Select engagement</option>{data.matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.clientName} · {matter.title}</option>)}</select></label>
              <p className="portal-dialog-copy">The invitation link is single-use and expires according to workspace settings.</p>
              <footer><button type="button" className="portal-secondary-button" onClick={() => setShowInvite(false)}>Cancel</button><button className="portal-primary-button" disabled={busy === "invite"}><Send size={14} />{busy === "invite" ? "Sending…" : "Send invitation"}</button></footer>
            </form>
          </section>
        </div>
      )}

      {editingUser && editingUser.role !== "super_admin" && (
        <div className="portal-drawer-overlay" role="dialog" aria-modal="true" aria-labelledby="user-access-title">
          <button className="portal-command-scrim" onClick={() => setEditingUser(null)} aria-label="Close user details" />
          <aside className="portal-drawer portal-access-drawer">
            <header><div><p className="portal-eyebrow">User authority</p><h2 id="user-access-title">{editingUser.name}</h2></div><button className="portal-icon-button" onClick={() => setEditingUser(null)}><X size={18} /></button></header>
            <div className="portal-access-identity"><span className="portal-avatar">{editingUser.name.slice(0, 1)}</span><div><strong>{editingUser.email}</strong><span>Last active {formatDate(editingUser.lastActiveAt)}</span></div></div>
            <form onSubmit={saveUser}>
              <label className="portal-field"><span>Role</span><select name="role" defaultValue={editingUser.role}><option value="admin">Admin</option><option value="contractor">Contractor</option><option value="client">Client</option></select></label>
              <label className="portal-field"><span>Permission profile</span><select name="permissionProfileId" defaultValue={editingUser.permissionProfileId || ""}><option value="">Standard profile / fixed client authority</option>{data.profiles.filter((profile) => profile.status === "active").map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.roleType}</option>)}</select></label>
              <div className="portal-form-grid">
                <label className="portal-field"><span>Access scope</span><select name="accessScope" defaultValue={editingUser.accessScope || "assigned"}><option value="assigned">Assigned portfolio</option><option value="global">Global portfolio</option></select></label>
                <label className="portal-field"><span>Account status</span><select name="status" defaultValue={editingUser.status}><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
              </div>
              <div className="portal-access-warning"><ShieldAlert size={15} /><span>Saving authority changes revokes existing sessions. Scope limits record visibility; the permission profile independently controls creation, financial actions and other mutations.</span></div>
              <footer><button type="button" className="portal-secondary-button" onClick={() => setEditingUser(null)}>Cancel</button><button className="portal-primary-button">Review changes</button></footer>
            </form>
            <section className="portal-user-memberships">
              <header><div><p className="portal-eyebrow">Scope</p><h3>Engagement access</h3></div></header>
              {data.memberships.filter((membership) => membership.userId === editingUser.id && membership.status === "active").map((membership) => <div key={membership.matterId}><span><strong>{membership.matterTitle}</strong><small>{membership.expiresAt ? `Expires ${formatDate(membership.expiresAt)}` : "No expiration"}</small></span><button className="portal-icon-button portal-danger-icon" onClick={() => setConfirmAction({ title: `Revoke access to ${membership.matterTitle}?`, consequence: "The membership is revoked and the user's existing sessions are invalidated.", destructive: true, run: () => revokeMembership(membership) })}><Trash2 size={14} /></button></div>)}
              <form onSubmit={(event) => assignMembership(event, editingUser)}><label className="portal-field"><span>Engagement</span><select name="matterId" required defaultValue=""><option value="" disabled>Select engagement</option>{data.matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.title}</option>)}</select></label><label className="portal-field"><span>Expires</span><input name="expiresAt" type="date" /></label><button className="portal-secondary-button" disabled={busy === "membership"}><Plus size={13} />Assign</button></form>
            </section>
          </aside>
        </div>
      )}

      {showProfile && (
        <div className="portal-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-title">
          <button className="portal-command-scrim" onClick={() => setShowProfile(false)} aria-label="Close profile editor" />
          <section className="portal-dialog portal-profile-dialog">
            <header><div><p className="portal-eyebrow">Capability profile</p><h2 id="profile-title">{editingProfile ? `Review ${editingProfile.name}` : "Create permission profile"}</h2></div><button className="portal-icon-button" onClick={() => setShowProfile(false)}><X size={18} /></button></header>
            <form onSubmit={saveProfile}>
              <div className="portal-form-grid">
                <label className="portal-field"><span>Name</span><input name="name" defaultValue={editingProfile?.name || ""} required /></label>
                <label className="portal-field"><span>Role family</span><select name="roleType" value={profileRole} onChange={(event) => setProfileRole(event.target.value as "admin" | "contractor")} disabled={Boolean(editingProfile)}><option value="admin">Admin</option><option value="contractor">Contractor</option></select></label>
              </div>
              <div className="portal-profile-permissions">
                {(data.assignableCapabilities[profileRole] ?? []).map((capability) => <label key={`${profileRole}-${capability}`}><input type="checkbox" name="permissions" value={capability} defaultChecked={editingProfile?.permissions.includes(capability)} /><span><Check size={11} /></span><strong>{capabilityLabel(capability)}</strong></label>)}
              </div>
              <footer><button type="button" className="portal-secondary-button" onClick={() => setShowProfile(false)}>Cancel</button><button className="portal-primary-button" disabled={busy === "profile"}>{busy === "profile" ? "Saving…" : "Save profile"}</button></footer>
            </form>
          </section>
        </div>
      )}

      {confirmAction && (
        <div className="portal-dialog-overlay" role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title">
          <button className="portal-command-scrim" onClick={() => setConfirmAction(null)} aria-label="Close confirmation" />
          <section className="portal-dialog portal-save-dialog">
            <header><div><p className="portal-eyebrow">Impact review</p><h2 id="admin-confirm-title">{confirmAction.title}</h2></div><button className="portal-icon-button" onClick={() => setConfirmAction(null)}><X size={18} /></button></header>
            <form onSubmit={async (event) => {
              event.preventDefault();
              setBusy("confirm");
              try {
                await confirmAction.run();
                setConfirmAction(null);
              } catch (actionError) {
                setError(actionError instanceof Error ? actionError.message : "The action could not be completed.");
              }
              setBusy("");
            }}><div className="portal-impact-preview"><ShieldAlert size={18} /><p>{confirmAction.consequence}</p></div><footer><button type="button" className="portal-secondary-button" onClick={() => setConfirmAction(null)}>Cancel</button><button className={confirmAction.destructive ? "portal-danger-button" : "portal-primary-button"} disabled={busy === "confirm"}>Confirm change</button></footer></form>
          </section>
        </div>
      )}
    </div>
  );
}
