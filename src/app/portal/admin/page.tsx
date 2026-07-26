"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Mail,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { usePortalAccess } from "@/components/portal/access-provider";

const GOLD = "#c9b58a";
const CREAM = "#ece6d6";
const TITAN = "#b2a898";
const BG = "#0a0b0e";
const CARD = "#0d0f14";

type Role = "admin" | "contractor" | "client";
type Invitation = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
};

type PermissionProfile = {
  id: string;
  name: string;
  roleType: "admin" | "contractor";
};

type EngagementOption = {
  id: string;
  title: string;
  clientName: string;
};

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  contractor: "Contractor",
  client: "Client",
};

const ROLE_COLORS: Record<Role, string> = {
  admin: "rgba(239,68,68,0.65)",
  contractor: "rgba(201,181,138,0.75)",
  client: "rgba(178,168,152,0.5)",
};

export default function AdminPage() {
  const { access } = usePortalAccess();
  const isSuperAdmin = access.role === "super_admin";
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
  const [engagements, setEngagements] = useState<EngagementOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("client");
  const [permissionProfileId, setPermissionProfileId] = useState("");
  const [accessScope, setAccessScope] = useState<"global" | "assigned">("assigned");
  const [matterId, setMatterId] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Revoke state
  const [revoking, setRevoking] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);

  async function loadInvitations() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/invite");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to load invitations");
      }
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const loadAccessOptions = useCallback(async () => {
    const matterResponse = await fetch("/api/matters");
    if (matterResponse.ok) {
      const matterData = await matterResponse.json();
      setEngagements(
        (matterData.matters ?? []).map((matter: {
          id: string;
          title: string;
          client_name?: string;
        }) => ({
          id: matter.id,
          title: matter.title,
          clientName: matter.client_name ?? "Client",
        })),
      );
    }
    if (isSuperAdmin) {
      const response = await fetch("/api/admin/access");
      if (!response.ok) return;
      const data = await response.json();
      setProfiles(data.profiles ?? []);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInvitations();
      void loadAccessOptions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAccessOptions]);

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          role,
          permissionProfileId:
            role === "admin" || role === "contractor"
              ? permissionProfileId || undefined
              : undefined,
          accessScope: role === "admin" ? accessScope : "assigned",
          matterId: matterId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send invitation");

      setSendResult({ ok: true, message: `Invitation sent to ${data.email}` });
      setEmail("");
      setRole("client");
      setPermissionProfileId("");
      setAccessScope("assigned");
      setMatterId("");
      await loadInvitations();
    } catch (e) {
      setSendResult({
        ok: false,
        message: e instanceof Error ? e.message : "Failed to send invitation",
      });
    } finally {
      setSending(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      const res = await fetch(`/api/admin/invite?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to revoke");
      }
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke invitation");
    } finally {
      setRevoking(null);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(201,181,138,0.18)",
    color: CREAM,
    padding: "0.75rem 1rem",
    fontSize: "0.85rem",
    outline: "none",
    transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.6rem",
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    color: TITAN,
    marginBottom: "0.5rem",
  };

  return (
    <main style={{ minHeight: "100vh", background: BG, color: CREAM }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid rgba(201,181,138,0.1)",
          background: "rgba(10,11,14,0.95)",
          backdropFilter: "blur(10px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 1.5rem",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <Link
              href="/portal/matters"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                fontSize: "0.7rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: TITAN,
                textDecoration: "none",
                transition: "color 0.2s",
              }}
            >
              <ArrowLeft size={13} />
              Engagements
            </Link>
            <div
              style={{
                width: 1,
                height: 18,
                background: "rgba(201,181,138,0.15)",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Shield size={14} color={GOLD} />
              <span
                style={{
                  fontSize: "0.7rem",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: GOLD,
                }}
              >
                Admin console
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {isSuperAdmin && (
            <Link
              href="/portal/admin/access"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                border: "1px solid rgba(201,181,138,0.25)",
                color: GOLD,
                padding: "0.375rem 0.875rem",
                fontSize: "0.65rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              <Users size={11} />
              Users & access
            </Link>
          )}
          <button
            onClick={loadInvitations}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              background: "transparent",
              border: "1px solid rgba(201,181,138,0.2)",
              color: TITAN,
              padding: "0.375rem 0.875rem",
              fontSize: "0.65rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: loading ? "wait" : "pointer",
              transition: "border-color 0.2s, color 0.2s",
            }}
          >
            <RefreshCw
              size={11}
              style={{
                animation: loading ? "spin 1s linear infinite" : "none",
              }}
            />
            Refresh
          </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "3rem 1.5rem",
          display: "grid",
          gap: "2.5rem",
          gridTemplateColumns: "1fr 1.6fr",
          alignItems: "flex-start",
        }}
      >
        {/* Left: Invite form */}
        <div
          style={{
            background: CARD,
            border: "1px solid rgba(201,181,138,0.12)",
            padding: "2rem",
          }}
        >
          <div style={{ marginBottom: "1.75rem" }}>
            <p style={{ ...labelStyle, marginBottom: "0.5rem" }}>
              Invite management
            </p>
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.75rem",
                fontWeight: 600,
                lineHeight: 1.2,
                color: CREAM,
              }}
            >
              Send invitation
            </h1>
            <p
              style={{
                marginTop: "0.75rem",
                fontSize: "0.8rem",
                color: TITAN,
                lineHeight: 1.6,
              }}
            >
              New accounts are created by invitation only. The recipient will
              receive an email with a secure sign-up link and their role will be
              assigned automatically.
            </p>
          </div>

          <form onSubmit={handleSendInvite} style={{ display: "grid", gap: "1.25rem" }}>
            <div>
              <label style={labelStyle} htmlFor="invite-email">
                Email address
              </label>
              <input
                id="invite-email"
                ref={emailRef}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                style={inputStyle}
                disabled={sending}
              />
            </div>

            <div>
              <label style={labelStyle} htmlFor="invite-role">
                Role
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                {(["client", "contractor", "admin"] as Role[])
                  .filter((candidate) => isSuperAdmin || candidate === "client")
                  .map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{
                      padding: "0.625rem",
                      fontSize: "0.7rem",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      border:
                        role === r
                          ? `1px solid ${GOLD}`
                          : "1px solid rgba(201,181,138,0.18)",
                      background:
                        role === r ? "rgba(201,181,138,0.08)" : "transparent",
                      color: role === r ? GOLD : TITAN,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
              {role === "admin" && (
                <p
                  style={{
                    marginTop: "0.5rem",
                    fontSize: "0.7rem",
                    color: "rgba(239,68,68,0.75)",
                    lineHeight: 1.4,
                  }}
                >
                  Admin authority is defined by the selected permission profile
                  and access scope.
                </p>
              )}
            </div>

            {(role === "client" || role === "contractor" || accessScope === "assigned") && (
              <div>
                <label style={labelStyle} htmlFor="invite-engagement">
                  Engagement
                </label>
                <select
                  id="invite-engagement"
                  required
                  value={matterId}
                  onChange={(event) => setMatterId(event.target.value)}
                  style={inputStyle}
                  disabled={sending}
                >
                  <option value="">Select an engagement</option>
                  {engagements.map((engagement) => (
                    <option key={engagement.id} value={engagement.id}>
                      {engagement.clientName} — {engagement.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isSuperAdmin && (role === "admin" || role === "contractor") && (
              <>
                <div>
                  <label style={labelStyle} htmlFor="invite-profile">
                    Permission profile
                  </label>
                  <select
                    id="invite-profile"
                    value={permissionProfileId}
                    onChange={(event) => setPermissionProfileId(event.target.value)}
                    style={inputStyle}
                    disabled={sending}
                  >
                    <option value="">Use standard profile</option>
                    {profiles
                      .filter((profile) => profile.roleType === role)
                      .map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                  </select>
                </div>
                {role === "admin" && (
                  <div>
                    <label style={labelStyle} htmlFor="invite-scope">
                      Access scope
                    </label>
                    <select
                      id="invite-scope"
                      value={accessScope}
                      onChange={(event) => {
                        const scope = event.target.value === "global" ? "global" : "assigned";
                        setAccessScope(scope);
                        if (scope === "global") setMatterId("");
                      }}
                      style={inputStyle}
                      disabled={sending}
                    >
                      <option value="assigned">Assigned engagements only</option>
                      <option value="global">All engagements</option>
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Result message */}
            {sendResult && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1rem",
                  background: sendResult.ok
                    ? "rgba(74,222,128,0.06)"
                    : "rgba(239,68,68,0.06)",
                  border: `1px solid ${sendResult.ok ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}`,
                  fontSize: "0.78rem",
                  color: sendResult.ok ? "#4ade80" : "#f87171",
                }}
              >
                {sendResult.ok ? (
                  <Check size={13} />
                ) : (
                  <X size={13} />
                )}
                {sendResult.message}
              </div>
            )}

            <button
              type="submit"
              disabled={sending || !email.trim()}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                background:
                  sending || !email.trim()
                    ? "rgba(201,181,138,0.3)"
                    : GOLD,
                color: "#070809",
                padding: "0.875rem",
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                border: "none",
                cursor: sending || !email.trim() ? "not-allowed" : "pointer",
                transition: "opacity 0.2s",
              }}
            >
              <UserPlus size={13} />
              {sending ? "Sending…" : "Send invitation"}
            </button>
          </form>
        </div>

        {/* Right: Pending invitations */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.25rem",
              paddingBottom: "1rem",
              borderBottom: "1px solid rgba(201,181,138,0.1)",
            }}
          >
            <div>
              <p style={{ ...labelStyle, marginBottom: "0.25rem" }}>
                Pending invitations
              </p>
              <p style={{ fontSize: "1.25rem", fontFamily: "var(--font-serif)", color: CREAM }}>
                {loading ? "—" : `${invitations.length} outstanding`}
              </p>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "0.875rem 1rem",
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171",
                fontSize: "0.8rem",
                marginBottom: "1rem",
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div
              style={{
                padding: "3rem",
                textAlign: "center",
                color: TITAN,
                fontSize: "0.8rem",
                letterSpacing: "0.1em",
              }}
            >
              Loading…
            </div>
          ) : invitations.length === 0 ? (
            <div
              style={{
                padding: "3rem",
                textAlign: "center",
                border: "1px solid rgba(201,181,138,0.08)",
                background: CARD,
              }}
            >
              <Mail size={28} color="rgba(178,168,152,0.3)" style={{ margin: "0 auto 1rem" }} />
              <p style={{ fontSize: "0.8rem", color: TITAN }}>
                No pending invitations
              </p>
            </div>
          ) : (
            <div
              style={{
                border: "1px solid rgba(201,181,138,0.12)",
                background: CARD,
              }}
            >
              {/* Table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  padding: "0.625rem 1.25rem",
                  borderBottom: "1px solid rgba(201,181,138,0.08)",
                  gap: "1rem",
                }}
              >
                {["Email", "Role", ""].map((h) => (
                  <span
                    key={h}
                    style={{
                      fontSize: "0.6rem",
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: TITAN,
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {invitations.map((inv, i) => (
                <div
                  key={inv.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    alignItems: "center",
                    padding: "1rem 1.25rem",
                    borderBottom:
                      i < invitations.length - 1
                        ? "1px solid rgba(201,181,138,0.07)"
                        : "none",
                    gap: "1rem",
                    transition: "background 0.15s",
                  }}
                >
                  {/* Email */}
                  <div>
                    <p style={{ fontSize: "0.85rem", color: CREAM, marginBottom: "0.2rem" }}>
                      {inv.email}
                    </p>
                    <p style={{ fontSize: "0.65rem", color: TITAN }}>
                      Sent {new Date(inv.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Role badge */}
                  <span
                    style={{
                      fontSize: "0.62rem",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      padding: "0.25rem 0.625rem",
                      background: ROLE_COLORS[inv.role],
                      color: CREAM,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ROLE_LABELS[inv.role]}
                  </span>

                  {/* Revoke */}
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    disabled={revoking === inv.id}
                    title="Revoke invitation"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 30,
                      height: 30,
                      background: "transparent",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "rgba(239,68,68,0.5)",
                      cursor: revoking === inv.id ? "wait" : "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = "rgba(239,68,68,0.6)";
                      e.currentTarget.style.color = "#f87171";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
                      e.currentTarget.style.color = "rgba(239,68,68,0.5)";
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Note */}
          <p
            style={{
              marginTop: "1.25rem",
              fontSize: "0.72rem",
              color: "rgba(178,168,152,0.45)",
              lineHeight: 1.6,
            }}
          >
            Invitations expire after 7 days. Revoking removes the link immediately —
            the recipient cannot create an account with it after revocation.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}
