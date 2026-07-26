"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Shield, UserCog, X } from "lucide-react";

import type { Capability } from "@/lib/data-model";

type Role = "super_admin" | "admin" | "contractor" | "client";
type ManagedRole = Exclude<Role, "super_admin">;

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "suspended";
  permissionProfileId: string | null;
  permissionProfileName: string | null;
  accessScope: "global" | "assigned" | null;
};

type Profile = {
  id: string;
  name: string;
  roleType: "admin" | "contractor";
  permissions: Capability[];
  isSystem: boolean;
};

type Membership = {
  userId: string;
  matterId: string;
  memberRole: ManagedRole;
  status: "active" | "revoked";
  expiresAt: string | null;
  matterTitle: string;
};

type Matter = {
  id: string;
  title: string;
  clientName: string;
};

type AccessData = {
  users: UserRow[];
  profiles: Profile[];
  memberships: Membership[];
  matters: Matter[];
  assignableCapabilities: {
    admin: Capability[];
    contractor: Capability[];
  };
};

const EMPTY_DATA: AccessData = {
  users: [],
  profiles: [],
  memberships: [],
  matters: [],
  assignableCapabilities: { admin: [], contractor: [] },
};

function capabilityLabel(capability: Capability) {
  return capability
    .split(".")
    .map((part) => part.replaceAll("_", " "))
    .join(" — ");
}

async function postAccess(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Access update failed");
  return data;
}

function UserAccessRow({
  user,
  profiles,
  onSaved,
}: {
  user: UserRow;
  profiles: Profile[];
  onSaved: () => Promise<void>;
}) {
  const [role, setRole] = useState<ManagedRole>(
    user.role === "super_admin" ? "admin" : user.role,
  );
  const [profileId, setProfileId] = useState(user.permissionProfileId ?? "");
  const [scope, setScope] = useState<"global" | "assigned">(user.accessScope ?? "assigned");
  const [status, setStatus] = useState<"active" | "suspended">(user.status);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const availableProfiles = profiles.filter((profile) => profile.roleType === role);

  if (user.role === "super_admin") {
    return (
      <div className="grid gap-4 border-b border-[#c9b58a]/10 px-5 py-4 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="text-sm text-[#ece6d6]">{user.name}</p>
          <p className="mt-1 text-xs text-[#b2a898]/55">{user.email}</p>
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-[#c9b58a]">Super Admin</p>
        <p className="text-xs text-[#b2a898]/60">All capabilities</p>
        <p className="text-xs text-[#b2a898]/60">Protected authority</p>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    setFeedback(null);
    try {
      await postAccess({
        action: "configure_user",
        userId: user.id,
        role,
        permissionProfileId:
          role === "admin" || role === "contractor"
            ? profileId || undefined
            : undefined,
        accessScope: role === "client" ? "assigned" : scope,
        status,
      });
      setFeedback("Saved");
      await onSaved();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 border-b border-[#c9b58a]/10 px-5 py-4 md:grid-cols-[1.4fr_0.8fr_1.1fr_0.9fr_auto]">
      <div>
        <p className="text-sm text-[#ece6d6]">{user.name}</p>
        <p className="mt-1 text-xs text-[#b2a898]/55">{user.email}</p>
        {feedback && <p className="mt-2 text-xs text-[#c9b58a]">{feedback}</p>}
      </div>
      <select
        value={role}
        onChange={(event) => {
          const nextRole = event.target.value as ManagedRole;
          setRole(nextRole);
          setProfileId("");
          if (nextRole !== "admin") setScope("assigned");
        }}
        className="h-10 border border-[#c9b58a]/20 bg-[#0a0b0e] px-3 text-xs text-[#ece6d6]"
      >
        <option value="admin">Admin</option>
        <option value="contractor">Contractor</option>
        <option value="client">Client</option>
      </select>
      {role === "admin" || role === "contractor" ? (
        <select
          value={profileId}
          onChange={(event) => setProfileId(event.target.value)}
          className="h-10 border border-[#c9b58a]/20 bg-[#0a0b0e] px-3 text-xs text-[#ece6d6]"
        >
          <option value="">Standard profile</option>
          {availableProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>{profile.name}</option>
          ))}
        </select>
      ) : (
        <p className="py-3 text-xs text-[#b2a898]/50">Fixed client authority</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={role === "client" ? "assigned" : scope}
          onChange={(event) => setScope(event.target.value === "global" ? "global" : "assigned")}
          disabled={role !== "admin"}
          className="h-10 border border-[#c9b58a]/20 bg-[#0a0b0e] px-2 text-xs text-[#ece6d6] disabled:opacity-45"
        >
          <option value="assigned">Assigned</option>
          <option value="global">Global</option>
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value === "suspended" ? "suspended" : "active")}
          className="h-10 border border-[#c9b58a]/20 bg-[#0a0b0e] px-2 text-xs text-[#ece6d6]"
        >
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="h-10 border border-[#c9b58a]/35 px-4 text-xs uppercase tracking-[0.14em] text-[#c9b58a] disabled:opacity-40"
      >
        {saving ? "Saving" : "Save"}
      </button>
    </div>
  );
}

export default function AccessManagementPage() {
  const [data, setData] = useState<AccessData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileRole, setProfileRole] = useState<"admin" | "contractor">("admin");
  const [profilePermissions, setProfilePermissions] = useState<Capability[]>([]);
  const [membershipUserId, setMembershipUserId] = useState("");
  const [membershipMatterId, setMembershipMatterId] = useState("");
  const [membershipExpiresAt, setMembershipExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/access");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load access management");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load access management");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const assignableUsers = useMemo(
    () => data.users.filter((user) => user.role !== "super_admin" && user.status === "active"),
    [data.users],
  );

  async function createProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await postAccess({
        action: "create_profile",
        name: profileName,
        roleType: profileRole,
        permissions: profilePermissions,
      });
      setProfileName("");
      setProfilePermissions([]);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Profile creation failed");
    } finally {
      setSaving(false);
    }
  }

  async function assignMembership(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await postAccess({
        action: "assign_engagement",
        userId: membershipUserId,
        matterId: membershipMatterId,
        expiresAt: membershipExpiresAt
          ? new Date(`${membershipExpiresAt}T23:59:59`).toISOString()
          : null,
      });
      setMembershipMatterId("");
      setMembershipExpiresAt("");
      await load();
    } catch (assignmentError) {
      setError(assignmentError instanceof Error ? assignmentError.message : "Assignment failed");
    } finally {
      setSaving(false);
    }
  }

  async function revokeMembership(userId: string, matterId: string) {
    setSaving(true);
    setError(null);
    try {
      await postAccess({ action: "revoke_engagement", userId, matterId });
      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Revocation failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0b0e] text-[#ece6d6]">
      <header className="border-b border-[#c9b58a]/10 bg-[#0a0b0e]/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/portal/admin"
            className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#b2a898]"
          >
            <ArrowLeft size={13} />
            Admin console
          </Link>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[#c9b58a]">
            <Shield size={14} />
            Super Admin · Users & Access
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-10 px-6 py-10">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#c9b58a]/65">Private Office authority</p>
          <h1 className="mt-3 font-heading text-4xl font-light">Users and access</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#b2a898]/70">
            Permission profiles define what an Admin or Contractor may do. Engagement memberships
            define where they may do it. Client authority is fixed and always engagement-scoped.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 border border-red-400/25 bg-red-400/5 px-4 py-3 text-sm text-red-300">
            <X size={14} /> {error}
          </div>
        )}

        <section className="border border-[#c9b58a]/12 bg-[#0d0f14]">
          <div className="flex items-center gap-2 border-b border-[#c9b58a]/10 px-5 py-4">
            <UserCog size={15} className="text-[#c9b58a]" />
            <h2 className="text-xs uppercase tracking-[0.22em] text-[#c9b58a]">User authority</h2>
          </div>
          {loading ? (
            <p className="px-5 py-10 text-sm text-[#b2a898]/55">Loading access records…</p>
          ) : (
            data.users.map((user) => (
              <UserAccessRow
                key={user.id}
                user={user}
                profiles={data.profiles}
                onSaved={load}
              />
            ))
          )}
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <form onSubmit={createProfile} className="border border-[#c9b58a]/12 bg-[#0d0f14] p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-[#c9b58a]">Create permission profile</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder="Profile name"
                required
                className="h-11 border border-[#c9b58a]/20 bg-[#0a0b0e] px-3 text-sm outline-none"
              />
              <select
                value={profileRole}
                onChange={(event) => {
                  setProfileRole(event.target.value === "contractor" ? "contractor" : "admin");
                  setProfilePermissions([]);
                }}
                className="h-11 border border-[#c9b58a]/20 bg-[#0a0b0e] px-3 text-sm"
              >
                <option value="admin">Admin profile</option>
                <option value="contractor">Contractor profile</option>
              </select>
            </div>
            <div className="mt-5 grid max-h-72 gap-2 overflow-y-auto pr-2 sm:grid-cols-2">
              {data.assignableCapabilities[profileRole].map((capability) => {
                const checked = profilePermissions.includes(capability);
                return (
                  <label
                    key={capability}
                    className="flex cursor-pointer items-center gap-2 border border-[#c9b58a]/10 px-3 py-2 text-xs text-[#b2a898]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setProfilePermissions((current) =>
                          checked
                            ? current.filter((item) => item !== capability)
                            : [...current, capability],
                        )
                      }
                    />
                    {capabilityLabel(capability)}
                  </label>
                );
              })}
            </div>
            <button
              disabled={saving}
              className="mt-5 flex items-center gap-2 border border-[#c9b58a]/35 px-5 py-3 text-xs uppercase tracking-[0.18em] text-[#c9b58a] disabled:opacity-40"
            >
              <Check size={13} />
              Create profile
            </button>
          </form>

          <form onSubmit={assignMembership} className="border border-[#c9b58a]/12 bg-[#0d0f14] p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-[#c9b58a]">Assign engagement</p>
            <div className="mt-6 space-y-4">
              <select
                required
                value={membershipUserId}
                onChange={(event) => setMembershipUserId(event.target.value)}
                className="h-11 w-full border border-[#c9b58a]/20 bg-[#0a0b0e] px-3 text-sm"
              >
                <option value="">Select user</option>
                {assignableUsers.map((user) => (
                  <option key={user.id} value={user.id}>{user.name} — {user.role}</option>
                ))}
              </select>
              <select
                required
                value={membershipMatterId}
                onChange={(event) => setMembershipMatterId(event.target.value)}
                className="h-11 w-full border border-[#c9b58a]/20 bg-[#0a0b0e] px-3 text-sm"
              >
                <option value="">Select engagement</option>
                {data.matters.map((matter) => (
                  <option key={matter.id} value={matter.id}>
                    {matter.clientName} — {matter.title}
                  </option>
                ))}
              </select>
              <label className="block text-xs text-[#b2a898]/70">
                Access expires (optional)
                <input
                  type="date"
                  value={membershipExpiresAt}
                  onChange={(event) => setMembershipExpiresAt(event.target.value)}
                  className="mt-2 h-11 w-full border border-[#c9b58a]/20 bg-[#0a0b0e] px-3 text-sm text-[#ece6d6]"
                />
              </label>
            </div>
            <button
              disabled={saving}
              className="mt-5 flex items-center gap-2 border border-[#c9b58a]/35 px-5 py-3 text-xs uppercase tracking-[0.18em] text-[#c9b58a] disabled:opacity-40"
            >
              <Check size={13} />
              Assign engagement
            </button>
          </form>
        </div>

        <section className="border border-[#c9b58a]/12 bg-[#0d0f14]">
          <div className="border-b border-[#c9b58a]/10 px-5 py-4">
            <h2 className="text-xs uppercase tracking-[0.22em] text-[#c9b58a]">Engagement memberships</h2>
          </div>
          {data.memberships.length === 0 ? (
            <p className="px-5 py-10 text-sm text-[#b2a898]/55">No engagement memberships recorded.</p>
          ) : (
            data.memberships.map((membership) => {
              const user = data.users.find((candidate) => candidate.id === membership.userId);
              return (
                <div
                  key={`${membership.userId}:${membership.matterId}`}
                  className="grid items-center gap-3 border-b border-[#c9b58a]/10 px-5 py-4 md:grid-cols-[1fr_1.5fr_0.7fr_auto]"
                >
                  <div>
                    <p className="text-sm">{user?.name ?? membership.userId}</p>
                    <p className="mt-1 text-xs text-[#b2a898]/50">{membership.memberRole}</p>
                  </div>
                  <p className="text-sm text-[#b2a898]">{membership.matterTitle}</p>
                  <p className="text-xs text-[#b2a898]/55">
                    {membership.status === "revoked"
                      ? "Revoked"
                      : membership.expiresAt
                        ? `Expires ${new Date(membership.expiresAt).toLocaleDateString()}`
                        : "Active"}
                  </p>
                  {membership.status === "active" && (
                    <button
                      type="button"
                      onClick={() => revokeMembership(membership.userId, membership.matterId)}
                      disabled={saving}
                      className="border border-red-400/20 px-3 py-2 text-xs uppercase tracking-[0.14em] text-red-300 disabled:opacity-40"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
