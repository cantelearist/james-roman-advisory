"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = await response.json();
    setMessage(result.message);
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0b0e] px-6 text-[#ece6d6]">
      <div className="w-full max-w-md border border-[#c9b58a]/15 bg-[#0d0f14] p-8">
        <p className="mb-3 text-[0.68rem] uppercase tracking-[0.28em] text-[#c9b58a]">Private Office</p>
        <h1 className="mb-2 font-heading text-3xl font-light">Recover access</h1>
        <p className="mb-8 text-sm leading-6 text-[#b2a898]/70">Enter your account email. Recovery instructions expire after 30 minutes.</p>
        {message ? (
          <div>
            <p role="status" className="border border-[#c9b58a]/20 p-4 text-sm leading-6 text-[#ece6d6]">{message}</p>
            <Link href="/sign-in" className="mt-6 block text-center text-sm text-[#c9b58a]">Return to sign in</Link>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={submit}>
            <label className="block text-xs uppercase tracking-[0.18em] text-[#b2a898]">
              Email
              <input className="mt-2 w-full border border-[#c9b58a]/20 bg-transparent px-3 py-3 text-sm normal-case tracking-normal outline-none focus:border-[#c9b58a]" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <button className="w-full border border-[#c9b58a] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[#c9b58a] disabled:opacity-50" disabled={busy}>
              {busy ? "Sending…" : "Send recovery instructions"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
