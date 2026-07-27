"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const result = await response.json();
    if (response.ok) setMessage(result.message);
    else setError(result.error ?? "Password could not be changed.");
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0b0e] px-6 text-[#ece6d6]">
      <div className="w-full max-w-md border border-[#c9b58a]/15 bg-[#0d0f14] p-8">
        <p className="mb-3 text-[0.68rem] uppercase tracking-[0.28em] text-[#c9b58a]">Private Office</p>
        <h1 className="mb-2 font-heading text-3xl font-light">Choose a new password</h1>
        {message ? (
          <div className="mt-7">
            <p role="status" className="border border-[#c9b58a]/20 p-4 text-sm">{message}</p>
            <Link href="/sign-in" className="mt-6 block text-center text-sm text-[#c9b58a]">Sign in</Link>
          </div>
        ) : (
          <form className="mt-7 space-y-5" onSubmit={submit}>
            <label className="block text-xs uppercase tracking-[0.18em] text-[#b2a898]">New password
              <input className="mt-2 w-full border border-[#c9b58a]/20 bg-transparent px-3 py-3 text-sm normal-case tracking-normal outline-none focus:border-[#c9b58a]" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label className="block text-xs uppercase tracking-[0.18em] text-[#b2a898]">Confirm password
              <input className="mt-2 w-full border border-[#c9b58a]/20 bg-transparent px-3 py-3 text-sm normal-case tracking-normal outline-none focus:border-[#c9b58a]" type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            </label>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <button className="w-full border border-[#c9b58a] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[#c9b58a] disabled:opacity-50" disabled={busy || !token}>{busy ? "Updating…" : "Update password"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
