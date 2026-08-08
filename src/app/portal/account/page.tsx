"use client";

import {
  CheckCircle2,
  Copy,
  KeyRound,
  Laptop,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/portal/portal-ui";

type Account = {
  name: string;
  email: string;
  role: string;
  lastActiveAt: string | null;
};

type Session = {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

type NotificationPreferences = {
  email: {
    messages: boolean;
    documents: boolean;
    finance: boolean;
    tasks: boolean;
  };
};

type MfaStatus = {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  email: { messages: true, documents: true, finance: true, tasks: true },
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function messageFromResponse(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") return data.error;
  return fallback;
}

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newName, setNewName] = useState("");
  const [mfaStep, setMfaStep] = useState<"idle" | "begin" | "confirm">("idle");
  const [setupKey, setSetupKey] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [accountResponse, mfaResponse, preferencesResponse] = await Promise.all([
        fetch("/api/portal/account", { cache: "no-store" }),
        fetch("/api/portal/account/mfa", { cache: "no-store" }),
        fetch("/api/portal/notification-preferences", { cache: "no-store" }),
      ]);
      const [accountData, mfaData, preferencesData] = await Promise.all([
        accountResponse.json(), mfaResponse.json(), preferencesResponse.json(),
      ]);
      if (!accountResponse.ok) throw new Error(messageFromResponse(accountData, "Your account could not be loaded."));
      if (!mfaResponse.ok) throw new Error(messageFromResponse(mfaData, "Your security status could not be loaded."));
      if (!preferencesResponse.ok) throw new Error(messageFromResponse(preferencesData, "Your preferences could not be loaded."));
      setAccount(accountData.profile);
      setNewName(accountData.profile.name);
      setSessions(accountData.sessions ?? []);
      setMfa(mfaData);
      setPreferences(preferencesData.preferences ?? DEFAULT_PREFERENCES);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Your account could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("profile");
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/portal/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(messageFromResponse(data, "Your profile could not be saved."));
      setAccount((current) => current ? { ...current, ...data.profile } : current);
      setSuccess("Your name was updated.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Your profile could not be saved.");
    } finally {
      setSaving("");
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = String(new FormData(form).get("currentPassword") ?? "");
    const newPassword = String(new FormData(form).get("newPassword") ?? "");
    const confirmation = String(new FormData(form).get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      setError("New password and confirmation must match.");
      return;
    }
    setSaving("password");
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/portal/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_password", currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(messageFromResponse(data, "Your password could not be changed."));
      form.reset();
      await load();
      setSuccess("Password changed. Other active sessions were signed out.");
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "Your password could not be changed.");
    } finally {
      setSaving("");
    }
  }

  async function revokeOtherSessions() {
    if (!window.confirm("Sign out every other active session? This browser will stay signed in.")) return;
    setSaving("sessions");
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/portal/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_other_sessions" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(messageFromResponse(data, "Other sessions could not be signed out."));
      await load();
      setSuccess("Other active sessions were signed out.");
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Other sessions could not be signed out.");
    } finally {
      setSaving("");
    }
  }

  async function beginMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentPassword = String(new FormData(event.currentTarget).get("currentPassword") ?? "");
    setSaving("mfa-begin");
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/portal/account/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "begin_enrollment", currentPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(messageFromResponse(data, "Two-step verification could not be started."));
      setSetupKey(data.secret);
      setMfaStep("confirm");
    } catch (mfaError) {
      setError(mfaError instanceof Error ? mfaError.message : "Two-step verification could not be started.");
    } finally {
      setSaving("");
    }
  }

  async function confirmMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    setSaving("mfa-confirm");
    setError("");
    try {
      const response = await fetch("/api/portal/account/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm_enrollment", code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(messageFromResponse(data, "The code could not be confirmed."));
      setRecoveryCodes(data.recoveryCodes ?? []);
      setSetupKey("");
      setMfaStep("idle");
      await load();
      setSuccess("Two-step verification is active. Save the recovery codes below before leaving this page.");
    } catch (mfaError) {
      setError(mfaError instanceof Error ? mfaError.message : "The code could not be confirmed.");
    } finally {
      setSaving("");
    }
  }

  async function regenerateRecoveryCodes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentPassword = String(new FormData(event.currentTarget).get("currentPassword") ?? "");
    setSaving("recovery");
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/portal/account/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate_recovery_codes", currentPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(messageFromResponse(data, "Recovery codes could not be regenerated."));
      setRecoveryCodes(data.recoveryCodes ?? []);
      await load();
      setSuccess("New recovery codes are ready. Previous codes no longer work.");
    } catch (mfaError) {
      setError(mfaError instanceof Error ? mfaError.message : "Recovery codes could not be regenerated.");
    } finally {
      setSaving("");
    }
  }

  async function disableMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("Turn off two-step verification for this account?")) return;
    const form = event.currentTarget;
    const currentPassword = String(new FormData(form).get("currentPassword") ?? "");
    const code = String(new FormData(form).get("code") ?? "");
    setSaving("mfa-disable");
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/portal/account/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", currentPassword, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(messageFromResponse(data, "Two-step verification could not be turned off."));
      form.reset();
      setRecoveryCodes([]);
      await load();
      setSuccess("Two-step verification is turned off.");
    } catch (mfaError) {
      setError(mfaError instanceof Error ? mfaError.message : "Two-step verification could not be turned off.");
    } finally {
      setSaving("");
    }
  }

  async function copyRecoveryCodes() {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setSuccess("Recovery codes copied. Store them in a secure password manager.");
    } catch {
      setError("Copy was not available. Select and save the recovery codes manually.");
    }
  }

  async function updatePreference(key: keyof NotificationPreferences["email"], enabled: boolean) {
    const next = { ...preferences, email: { ...preferences.email, [key]: enabled } };
    setPreferences(next);
    setSaving(`preference-${key}`);
    setError("");
    try {
      const response = await fetch("/api/portal/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(messageFromResponse(data, "Your preference could not be saved."));
    } catch (preferenceError) {
      setPreferences(preferences);
      setError(preferenceError instanceof Error ? preferenceError.message : "Your preference could not be saved.");
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="portal-page portal-account-page">
      <PageHeader
        eyebrow="Private Office"
        title="Account"
        description="Your identity, active sessions, security controls and email preferences."
        actions={<button className="portal-secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} />Refresh</button>}
      />

      {error && <div className="portal-inline-error" role="alert">{error}</div>}
      {success && <div className="portal-inline-success" role="status"><CheckCircle2 size={16} />{success}</div>}

      {loading || !account || !mfa ? (
        <section className="portal-card portal-account-loading" aria-busy="true"><LoaderCircle size={20} />Loading account controls…</section>
      ) : (
        <div className="portal-account-grid">
          <section className="portal-card portal-account-card portal-account-profile">
            <header><span className="portal-account-icon"><UserRound size={17} /></span><div><p className="portal-eyebrow">Identity</p><h2>Your profile</h2></div></header>
            <form onSubmit={updateProfile} className="portal-account-form">
              <label className="portal-field"><span>Name</span><input value={newName} onChange={(event) => setNewName(event.target.value)} minLength={2} maxLength={120} required /></label>
              <label className="portal-field"><span>Email</span><input value={account.email} disabled aria-describedby="account-email-note" /></label>
              <p id="account-email-note" className="portal-form-note">Your email is managed by the office so engagement access remains traceable.</p>
              <div className="portal-account-meta"><span>Role <strong>{account.role.replace("_", " ")}</strong></span><span>Last sign-in <strong>{formatDate(account.lastActiveAt)}</strong></span></div>
              <footer><button className="portal-primary-button" disabled={saving === "profile"}>{saving === "profile" ? <LoaderCircle size={14} className="is-spinning" /> : <Save size={14} />}{saving === "profile" ? "Saving…" : "Save profile"}</button></footer>
            </form>
          </section>

          <section className="portal-card portal-account-card portal-account-password">
            <header><span className="portal-account-icon"><KeyRound size={17} /></span><div><p className="portal-eyebrow">Security</p><h2>Password</h2></div></header>
            <form onSubmit={changePassword} className="portal-account-form">
              <label className="portal-field"><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
              <label className="portal-field"><span>New password</span><input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
              <label className="portal-field"><span>Confirm new password</span><input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
              <p className="portal-form-note">Use at least 12 characters. Changing your password signs out every other session.</p>
              <footer><button className="portal-primary-button" disabled={saving === "password"}>{saving === "password" ? <LoaderCircle size={14} className="is-spinning" /> : <LockKeyhole size={14} />}{saving === "password" ? "Updating…" : "Change password"}</button></footer>
            </form>
          </section>

          <section className="portal-card portal-account-card portal-account-sessions">
            <header><span className="portal-account-icon"><Laptop size={17} /></span><div><p className="portal-eyebrow">Security</p><h2>Active sessions</h2></div></header>
            <p className="portal-account-intro">Only the current browser is identified; the system does not fabricate device or location details it does not collect.</p>
            <div className="portal-session-list">
              {sessions.map((session) => <article key={session.id}><Laptop size={15} /><div><strong>{session.isCurrent ? "This browser" : "Active session"}</strong><span>Started {formatDate(session.createdAt)} · expires {formatDate(session.expiresAt)}</span></div>{session.isCurrent && <em>Current</em>}</article>)}
            </div>
            <footer><button className="portal-secondary-button" onClick={() => void revokeOtherSessions()} disabled={saving === "sessions" || sessions.filter((session) => !session.isCurrent).length === 0}>{saving === "sessions" ? <LoaderCircle size={14} className="is-spinning" /> : <ShieldAlert size={14} />}{saving === "sessions" ? "Signing out…" : "Sign out other sessions"}</button></footer>
          </section>

          <section className="portal-card portal-account-card portal-account-mfa">
            <header><span className="portal-account-icon"><Smartphone size={17} /></span><div><p className="portal-eyebrow">Security</p><h2>Two-step verification</h2></div></header>
            <div className={`portal-mfa-status ${mfa.enabled ? "is-enabled" : ""}`}><ShieldCheck size={16} /><span><strong>{mfa.enabled ? "Active" : "Not active"}</strong>{mfa.enabled ? ` · ${mfa.recoveryCodesRemaining} recovery codes remaining` : " · Use an authenticator app to protect this account."}</span></div>
            {!mfa.enabled && mfaStep === "idle" && <button className="portal-secondary-button" onClick={() => setMfaStep("begin")}><Smartphone size={14} />Set up two-step verification</button>}
            {!mfa.enabled && mfaStep === "begin" && <form onSubmit={beginMfa} className="portal-account-form portal-account-compact-form"><label className="portal-field"><span>Confirm current password</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label><footer><button className="portal-primary-button" disabled={saving === "mfa-begin"}>{saving === "mfa-begin" ? "Preparing…" : "Continue"}</button><button type="button" className="portal-secondary-button" onClick={() => setMfaStep("idle")}>Cancel</button></footer></form>}
            {!mfa.enabled && mfaStep === "confirm" && <form onSubmit={confirmMfa} className="portal-account-form portal-account-compact-form"><p className="portal-form-note">Add this setup key to your authenticator app, then enter its six-digit code.</p><code className="portal-secret-key">{setupKey}</code><label className="portal-field"><span>Authenticator code</span><input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required /></label><footer><button className="portal-primary-button" disabled={saving === "mfa-confirm"}>{saving === "mfa-confirm" ? "Confirming…" : "Activate two-step verification"}</button><button type="button" className="portal-secondary-button" onClick={() => { setSetupKey(""); setMfaStep("idle"); }}>Cancel</button></footer></form>}
            {mfa.enabled && <div className="portal-mfa-actions"><form onSubmit={regenerateRecoveryCodes} className="portal-account-inline-form"><label className="portal-field"><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label><button className="portal-secondary-button" disabled={saving === "recovery"}>{saving === "recovery" ? "Generating…" : "Generate new recovery codes"}</button></form><form onSubmit={disableMfa} className="portal-account-inline-form portal-account-danger"><label className="portal-field"><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label><label className="portal-field"><span>Authenticator code</span><input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required /></label><button className="portal-danger-button" disabled={saving === "mfa-disable"}>{saving === "mfa-disable" ? "Turning off…" : "Turn off two-step verification"}</button></form></div>}
          </section>

          <section className="portal-card portal-account-card portal-account-notifications">
            <header><span className="portal-account-icon"><ShieldCheck size={17} /></span><div><p className="portal-eyebrow">Preferences</p><h2>Email notifications</h2></div></header>
            <p className="portal-account-intro">Private Office activity is always available in the portal. Choose which events also reach your email.</p>
            <div className="portal-account-preferences">
              {([
                ["messages", "Messages", "New correspondence and replies"],
                ["documents", "Documents", "Uploads and new versions"],
                ["finance", "Finance", "Contracts, invoices and reminders"],
                ["tasks", "Work", "Assignments and workflow blockers"],
              ] as const).map(([key, title, detail]) => <label key={key}><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" checked={preferences.email[key]} disabled={saving.startsWith("preference-")} onChange={(event) => void updatePreference(key, event.target.checked)} /></label>)}
            </div>
          </section>

          {recoveryCodes.length > 0 && <section className="portal-card portal-account-card portal-account-recovery"><header><span className="portal-account-icon"><LockKeyhole size={17} /></span><div><p className="portal-eyebrow">Save now</p><h2>Recovery codes</h2></div></header><p className="portal-account-intro">These codes are shown once. Store them in a secure password manager. Generating a new set invalidates this set.</p><div className="portal-recovery-codes">{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div><footer><button className="portal-secondary-button" onClick={() => void copyRecoveryCodes()}><Copy size={14} />Copy codes</button><button className="portal-primary-button" onClick={() => setRecoveryCodes([])}>I saved these codes</button></footer></section>}
        </div>
      )}
    </div>
  );
}
