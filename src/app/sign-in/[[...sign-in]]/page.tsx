import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeInternalPath } from "@/lib/safe-redirect";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function sendMagicLink(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const redirectUrl = safeInternalPath(String(formData.get("redirect_url") ?? "/office"));
  if (!email) redirect("/sign-in?error=missing_email");

  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? "https://www.jamesroman.la";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectUrl)}`,
      shouldCreateUser: false,
    },
  });

  if (error) redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  redirect(`/sign-in?sent=1&email=${encodeURIComponent(email)}`);
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = (await searchParams) ?? {};
  const redirectUrl = safeInternalPath(
    typeof params.redirect_url === "string" ? params.redirect_url : "/office",
  );
  const sent = params.sent === "1";
  const error = typeof params.error === "string" ? params.error : null;
  const configured = Boolean(getSupabasePublicConfig());

  return (
    <main className="min-h-screen bg-[#070809] px-6 py-10 text-[#ece6d6]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl flex-col justify-center">
        <div className="mb-12">
          <BrandLogo className="h-11" />
        </div>
        <p className="mb-5 text-[0.68rem] uppercase tracking-[0.34em] text-[#b2a898]/70">
          Secure Client Office
        </p>
        <h1 className="font-heading text-5xl font-light leading-none">
          Private access, by invitation.
        </h1>
        <p className="mt-6 max-w-lg text-base leading-8 text-[#b2a898]/78">
          Enter the email associated with your engagement. We will send a private sign-in link
          if the address has active access.
        </p>

        {!configured ? (
          <div className="mt-10 border border-[#c9b58a]/20 p-5 text-sm leading-7 text-[#c9b58a]">
            Supabase authentication is not configured for this environment.
          </div>
        ) : (
          <form action={sendMagicLink} className="mt-10 grid gap-5">
            <input type="hidden" name="redirect_url" value={redirectUrl} />
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-[0.72rem] uppercase tracking-[0.22em] text-[#b2a898]/80">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="h-12 rounded-none border-[#b2a898]/20 bg-transparent text-[#ece6d6]"
              />
            </div>
            <Button className="justify-self-start rounded-none bg-[#c9b58a] px-8 uppercase tracking-[0.18em] text-[#06111f]">
              Send secure link
            </Button>
          </form>
        )}

        {sent ? (
          <p className="mt-6 text-sm leading-7 text-[#b2a898]/75">
            If that address has active access, a sign-in link has been sent.
          </p>
        ) : null}
        {error ? (
          <p className="mt-6 text-sm leading-7 text-[#c9b58a]" role="alert">
            {error === "missing_email" ? "Enter an email address." : error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
