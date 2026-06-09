import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// ─── Route matchers ───────────────────────────────────────────────────────────

const isPublicRoute = createRouteMatcher([
  "/",
  "/prototype(.*)",
  "/prototype2(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/mfa-required(.*)",
  "/api/consultations(.*)",
  "/api/seed(.*)",
]);

// Routes restricted to admin + advisor roles
const isStaffRoute = createRouteMatcher([
  "/portal/matters(.*)",
  "/portal/vault(.*)",
  "/portal/admin(.*)",
]);

// Routes restricted to admin role only
const isAdminRoute = createRouteMatcher(["/portal/admin(.*)"]);

// ─── Middleware (Turbopack proxy export) ──────────────────────────────────────

export const proxy = clerkMiddleware(async (auth, req) => {
  // Public routes pass through immediately
  if (isPublicRoute(req)) return NextResponse.next();

  const { userId, sessionClaims } = await auth();

  // Not authenticated → sign-in with return URL
  if (!userId) {
    const signIn = new URL("/sign-in", req.url);
    signIn.searchParams.set("redirect_url", req.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }

  // Role from session claims.
  // Requires Clerk Dashboard → Configure → Sessions → Customize session token:
  //   { "role": "{{user.public_metadata.role}}" }
  // Without this template, `role` is undefined and role checks are deferred
  // to server components (which always call currentUser() for ground truth).
  const role = (sessionClaims as Record<string, unknown>)?.role as
    | string
    | undefined;

  const isStaff = role === "admin" || role === "advisor";
  const isAdmin = role === "admin";

  // Staff-only area: non-staff clients bounce back to portal home
  if (isStaffRoute(req) && role !== undefined && !isStaff) {
    return NextResponse.redirect(new URL("/portal", req.url));
  }

  // Admin-only area: advisors and clients bounce back to portal home
  if (isAdminRoute(req) && role !== undefined && !isAdmin) {
    return NextResponse.redirect(new URL("/portal", req.url));
  }

  // MFA enforcement for staff.
  // Clerk embeds factor verification age in sessionClaims.fva when MFA is used.
  // fva = [primaryFactorAge, secondFactorAge] — secondFactorAge is null if not done.
  if (isStaff && req.nextUrl.pathname !== "/mfa-required") {
    const fva = (sessionClaims as Record<string, unknown>)?.fva as
      | [number | null, number | null]
      | undefined;

    // fva is present → user has MFA enrolled → enforce second factor
    if (fva !== undefined && fva[1] === null) {
      return NextResponse.redirect(new URL("/mfa-required", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Clerk internal proxy path (required for Next.js 15+)
    "/__clerk/:path*",
  ],
};
