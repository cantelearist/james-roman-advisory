"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Challenge =
  | { mode: "verify" }
  | { mode: "enroll"; secret: string; uri: string };

export default function MfaForm() {
  const searchParams = useSearchParams();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/auth/mfa/status")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Challenge expired");
        setChallenge(result);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Challenge expired"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Verification failed.");
      setBusy(false);
      return;
    }
    if (result.recoveryCodes?.length) {
      setRecoveryCodes(result.recoveryCodes);
      setBusy(false);
      return;
    }
    const redirectUrl = searchParams.get("redirect_url") || "/portal";
    window.location.assign(redirectUrl.startsWith("/") ? redirectUrl : "/portal");
  }

  function continueToPortal() {
    const redirectUrl = searchParams.get("redirect_url") || "/portal";
    window.location.assign(redirectUrl.startsWith("/") ? redirectUrl : "/portal");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0b0e] px-6 py-12 text-[#ece6d6]">
      <div className="w-full max-w-lg border border-[#c9b58a]/15 bg-[#0d0f14] p-8">
        <p className="mb-3 text-[0.68rem] uppercase tracking-[0.28em] text-[#c9b58a]">Private Office · Protected access</p>
        {recoveryCodes ? (
          <>
            <h1 className="mb-3 font-heading text-3xl font-light">Save your recovery codes</h1>
            <p className="mb-6 text-sm leading-6 text-[#b2a898]">Each code works once. Store them offline; they will not be shown again.</p>
            <div className="grid grid-cols-2 gap-2 border border-[#c9b58a]/20 p-5 font-mono text-sm">
              {recoveryCodes.map((item) => <span key={item}>{item}</span>)}
            </div>
            <button onClick={continueToPortal} className="mt-7 w-full border border-[#c9b58a] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[#c9b58a]">I saved these codes</button>
          </>
        ) : (
          <>
            <h1 className="mb-3 font-heading text-3xl font-light">
              {challenge?.mode === "enroll" ? "Protect this account" : "Verify your identity"}
            </h1>
            {challenge?.mode === "enroll" ? (
              <div className="mb-7 text-sm leading-6 text-[#b2a898]">
                <p className="mb-4">Add a new time-based account in your authenticator app, then enter its six-digit code.</p>
                <a href={challenge.uri} className="mb-4 inline-block border border-[#c9b58a]/30 px-4 py-2 text-xs uppercase tracking-[0.16em] text-[#c9b58a]">Open authenticator app</a>
                <p className="mb-1 text-xs uppercase tracking-[0.16em]">Manual setup key</p>
                <code className="block break-all border border-[#c9b58a]/15 bg-black/20 p-3 text-[#ece6d6]">{challenge.secret}</code>
              </div>
            ) : (
              <p className="mb-7 text-sm leading-6 text-[#b2a898]">Enter the six-digit code from your authenticator app. You may also use one unused recovery code.</p>
            )}
            <form className="space-y-5" onSubmit={submit}>
              <label className="block text-xs uppercase tracking-[0.18em] text-[#b2a898]">
                Verification code
                <input className="mt-2 w-full border border-[#c9b58a]/20 bg-transparent px-3 py-3 font-mono text-lg tracking-[0.18em] outline-none focus:border-[#c9b58a]" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} />
              </label>
              {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
              <button className="w-full border border-[#c9b58a] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[#c9b58a] disabled:opacity-50" disabled={busy || !challenge}>{busy ? "Verifying…" : "Continue"}</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
