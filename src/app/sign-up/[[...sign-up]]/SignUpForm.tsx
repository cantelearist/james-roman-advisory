"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SignUpForm() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";
  const invitedEmail = searchParams.get("email") ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, inviteToken: inviteToken || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to create account");
      window.location.assign("/portal");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0b0e] px-6 text-[#ece6d6]">
      <div className="w-full max-w-md border border-[#c9b58a]/15 bg-[#0d0f14] p-8 shadow-2xl">
        <p className="mb-3 text-[0.68rem] uppercase tracking-[0.28em] text-[#c9b58a]">Private Office</p>
        <h1 className="mb-2 font-heading text-3xl font-light">Create your account</h1>
        <p className="mb-8 text-sm leading-6 text-[#b2a898]/70">Use an invitation from the advisory team, or create a client account.</p>
        <form className="space-y-5" onSubmit={submit}>
          <label className="block text-xs uppercase tracking-[0.18em] text-[#b2a898]">Name<input className="mt-2 w-full border border-[#c9b58a]/20 bg-transparent px-3 py-3 text-sm normal-case tracking-normal text-[#ece6d6] outline-none focus:border-[#c9b58a]" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="block text-xs uppercase tracking-[0.18em] text-[#b2a898]">Email<input className="mt-2 w-full border border-[#c9b58a]/20 bg-transparent px-3 py-3 text-sm normal-case tracking-normal text-[#ece6d6] outline-none focus:border-[#c9b58a]" type="email" autoComplete="email" required readOnly={Boolean(invitedEmail)} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="block text-xs uppercase tracking-[0.18em] text-[#b2a898]">Password<input className="mt-2 w-full border border-[#c9b58a]/20 bg-transparent px-3 py-3 text-sm normal-case tracking-normal text-[#ece6d6] outline-none focus:border-[#c9b58a]" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /><span className="mt-2 block text-[0.7rem] normal-case tracking-normal text-[#b2a898]/50">At least 12 characters.</span></label>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button className="w-full border border-[#c9b58a] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[#c9b58a] transition hover:bg-[#c9b58a] hover:text-[#0a0b0e] disabled:cursor-wait disabled:opacity-50" type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        </form>
      </div>
    </main>
  );
}
