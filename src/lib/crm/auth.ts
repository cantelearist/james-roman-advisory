import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "./types";

export type AuthContext = {
  userId: string;
  email: string | null;
  profile: Profile;
};

const TEAM_ROLES = new Set<UserRole>(["owner", "admin", "advisor"]);

export async function getCurrentAuthContext(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, tenant_id, email, full_name, role, mfa_required, disabled_at")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.disabled_at) return null;

  // Enforce MFA for users with mfa_required set on their profile.
  // Internal team users must complete a TOTP/WebAuthn challenge (AAL2)
  // before any authenticated surface is accessible.
  if ((profile as Profile).mfa_required) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!aal || aal.currentLevel !== "aal2") return null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile as Profile,
  };
}

export async function requireAuthContext() {
  const context = await getCurrentAuthContext();
  if (!context) redirect("/sign-in");
  return context;
}

export async function requireTeamContext() {
  const context = await requireAuthContext();
  if (!TEAM_ROLES.has(context.profile.role)) redirect("/office");
  return context;
}

export function isTeamRole(role: UserRole) {
  return TEAM_ROLES.has(role);
}
