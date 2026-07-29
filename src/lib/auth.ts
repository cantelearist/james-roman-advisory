import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import type { UserRole } from "@/lib/data-model";
import { assertRequiredSchemaVersions } from "@/lib/schema-readiness";

export type Role = UserRole;
export type AuthUser = { id: string; name: string; email: string; role: Role };
export type AuthContext = { userId: string; user: AuthUser; role: Role };

export const SESSION_COOKIE = "jra_session";
export const MFA_CHALLENGE_COOKIE = "jra_mfa_challenge";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function setMfaChallengeCookie(
  response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } },
  token: string,
  expiresAt: Date,
) {
  response.cookies.set(MFA_CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export function clearMfaChallengeCookie(
  response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } },
) {
  response.cookies.set(MFA_CHALLENGE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

function toAuthUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as Role,
  };
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  await assertRequiredSchemaVersions();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const sql = getDb();
  await sql`
    INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
    VALUES (${crypto.randomUUID()}, ${userId}, ${hashSessionToken(token)}, ${expiresAt.toISOString()})
  `;
  return { token, expiresAt };
}

export function setSessionCookie(response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }, token: string, expiresAt: Date) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  await assertRequiredSchemaVersions();
  const sql = getDb();
  const rows = await sql`
    SELECT u.id, u.name, u.email, u.role
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashSessionToken(token)}
      AND s.expires_at > NOW()
      AND u.status = 'active'
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const user = toAuthUser(rows[0] as Record<string, unknown>);
  return { userId: user.id, user, role: user.role };
}

export async function revokeCurrentSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return;
  await assertRequiredSchemaVersions();
  const sql = getDb();
  await sql`DELETE FROM auth_sessions WHERE token_hash = ${hashSessionToken(token)}`;
}

export function isSuperAdmin(role?: Role): boolean {
  return role === "super_admin";
}

export async function requireAuth(): Promise<string> {
  const context = await getAuthContext();
  if (!context) redirect("/sign-in");
  return context.userId;
}

export async function requireAuthContext(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect("/sign-in");
  return context;
}

export async function requireSuperAdmin(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect("/sign-in");
  if (!isSuperAdmin(context.role)) redirect("/portal");
  return context;
}

export async function getAuthUserId(): Promise<string | null> {
  return (await getAuthContext())?.userId ?? null;
}

export function getSessionTtlSeconds(): number {
  return SESSION_TTL_SECONDS;
}
