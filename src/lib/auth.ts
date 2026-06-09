/**
 * Server-side auth helpers for James Roman Advisory.
 *
 * These run in server components and API routes — never in client components.
 * All role and MFA checks here use currentUser() which fetches from Clerk's
 * backend API, so they are always authoritative regardless of JWT template
 * configuration.
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
 * Server component guard: ensures MFA is enrolled for the current user.
 * Call this at the top of staff-facing pages that handle sensitive data.
 * Redirects to /mfa-required if the user has no MFA method enrolled.
 */
export async function requireMFA() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const hasMFA =
    user.twoFactorEnabled === true ||
    (user.phoneNumbers?.some((p) => p.verification?.status === "verified") ??
      false);

  if (!hasMFA) redirect("/mfa-required");

  return user;
}

/**
 * Returns the authenticated userId from an API route context.
 * Returns null if unauthenticated (caller handles the 401).
 */
export async function getAuthUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}
