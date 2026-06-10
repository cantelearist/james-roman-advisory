/**
 * Server-side auth helpers for James Roman Advisory.
 *
 * These run in server components and API routes — never in client components.
 * All role checks use currentUser() which fetches from Clerk's backend API
 * and is always authoritative regardless of JWT template configuration.
 *
 * MFA RULE (applies in both middleware and server):
 *   A staff session is considered MFA-verified when fva[1] is not null.
 *   fva = [primaryFactorAge, secondFactorAge] from Clerk session claims.
 *   secondFactorAge is null when no second factor has been verified in this
 *   session — regardless of whether the user has MFA enrolled.
 *
 *   Phone verification alone does NOT satisfy MFA. Staff must complete a
 *   TOTP or hardware key second factor (Clerk authenticator app or passkey).
 *   This matches the middleware check in proxy.ts.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export type Role = "admin" | "advisor" | "client" | undefined;

/** Extract the role from Clerk publicMetadata. */
export function getRole(
  user: Awaited<ReturnType<typeof currentUser>>,
): Role {
  return (user?.publicMetadata?.role as Role) ?? undefined;
}

/** True for admin and advisor. */
export function isStaff(role: Role): boolean {
  return role === "admin" || role === "advisor";
}

/** True for admin only. */
export function isAdmin(role: Role): boolean {
  return role === "admin";
}

/**
 * Server component guard: redirects to /sign-in if unauthenticated,
 * otherwise returns the userId.
 */
export async function requireAuth(): Promise<string> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return userId;
}

/**
 * Server component guard: redirects non-staff to /portal.
 * Returns { userId, user, role } for use in the page.
 */
export async function requireStaff() {
  const [{ userId }, user] = await Promise.all([auth(), currentUser()]);
  if (!userId) redirect("/sign-in");

  const role = getRole(user);
  if (!isStaff(role)) redirect("/portal");

  return { userId, user: user!, role };
}

/**
 * Server component guard: redirects non-admins to /portal.
 * Returns { userId, user, role } for use in the page.
 */
export async function requireAdmin() {
  const [{ userId }, user] = await Promise.all([auth(), currentUser()]);
  if (!userId) redirect("/sign-in");

  const role = getRole(user);
  if (!isAdmin(role)) redirect("/portal");

  return { userId, user: user!, role };
}

/**
 * Server component guard: verifies the current session has completed a second
 * factor (MFA) — not just that the user has MFA enrolled.
 *
 * Uses fva (factor verification ages) from session claims, which is the same
 * criterion as the middleware in proxy.ts. fva[1] is null when the second
 * factor has not been verified in this session.
 *
 * Call this at the top of staff-facing pages that handle sensitive data, in
 * addition to requireStaff(). Both checks are needed: requireStaff() enforces
 * role, requireMFA() enforces that this particular session is second-factor
 * verified.
 */
export async function requireMFA(): Promise<string> {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const fva = (sessionClaims as Record<string, unknown>)?.fva as
    | [number | null, number | null]
    | undefined;

  // fva absent → MFA not configured for this user's Clerk instance, or no
  // second factor enrolled. Either way, redirect to setup prompt.
  // fva[1] === null → second factor not yet verified in this session.
  if (!fva || fva[1] === null) {
    redirect("/mfa-required");
  }

  return userId;
}

/**
 * Returns the authenticated userId from an API route context.
 * Returns null if unauthenticated (caller handles the 401).
 */
export async function getAuthUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}
