"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { safeAuthRedirect } from "@/lib/redirect";

export default function SignInForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to sign in");
      const redirectUrl = safeAuthRedirect(searchParams.get("redirect_url"));
      if (result.mfaRequired) {
        window.location.assign(`/mfa?redirect_url=${encodeURIComponent(redirectUrl)}`);
        return;
      }
      window.location.assign(redirectUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0b0e] px-6 text-[#ece6d6]">
      <div className="w-full max-w-md border border-[#c9b58a]/15 bg-[#0d0f14] p-8 shadow-2xl">
        <p className="mb-3 text-[0.68rem] uppercase tracking-[0.28em] text-[#c9b58a]">Private Office</p>
        <h1 className="mb-2 font-heading text-3xl font-light">Sign in</h1>
        <p className="mb-8 text-sm leading-6 text-[#b2a898]/70">Use your James Roman Advisory email and password.</p>
        <form className="space-y-5" onSubmit={submit}>
          <label className="block text-xs uppercase tracking-[0.18em] text-[#b2a898]">
            Email
            <input className="mt-2 w-full border border-[#c9b58a]/20 bg-transparent px-3 py-3 text-sm normal-case tracking-normal text-[#ece6d6] outline-none focus:border-[#c9b58a]" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="block text-xs uppercase tracking-[0.18em] text-[#b2a898]">
            Password
            <input className="mt-2 w-full border border-[#c9b58a]/20 bg-transparent px-3 py-3 text-sm normal-case tracking-normal text-[#ece6d6] outline-none focus:border-[#c9b58a]" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <button className="w-full border border-[#c9b58a] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[#c9b58a] transition hover:bg-[#c9b58a] hover:text-[#0a0b0e] disabled:cursor-wait disabled:opacity-50" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-[#b2a898]/60">
          <Link className="text-[#c9b58a] underline-offset-4 hover:underline" href="/forgot-password">Forgot your password?</Link>
        </p>
        <p className="mt-7 text-center text-sm text-[#b2a898]/60">
          New to the office? <Link className="text-[#c9b58a] underline-offset-4 hover:underline" href="/sign-up">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
