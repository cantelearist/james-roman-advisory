import { NextRequest, NextResponse } from "next/server";
import { ensureUsersTable, getDb } from "@/lib/db";
import type { UserRole } from "@/lib/data-model";
import { ratelimit, getClientIp } from "@/lib/ratelimit";

// SECURITY: No fallback. If SEED_KEY is not set, the route is permanently locked.
// Never add a default value here — this endpoint must fail loudly in any environment
// where the key is absent, not silently degrade to a predictable string.
const SEED_KEY = process.env.SEED_KEY;

type SeedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

const SEED_USERS: SeedUser[] = [
  { id: "usr_admin_01",    name: "System Admin", email: "admin@jamesroman.la",   role: "admin"   },
  { id: "usr_adv_stephen", name: "Stephen",      email: "stephen@jamesroman.la", role: "advisor" },
  { id: "usr_adv_roman",   name: "Roman",        email: "roman@jamesroman.la",   role: "advisor" },
  { id: "usr_client_demo", name: "Demo Client",  email: "demo@client.test",      role: "client"  },
];

export async function POST(req: NextRequest) {
  // Fail loudly if key is not configured — never silently allow access
  if (!SEED_KEY) {
    return NextResponse.json(
      { error: "Seed endpoint is not configured in this environment" },
      { status: 503 }
    );
  }

  // Rate limit: 10 attempts per hour per IP (defense-in-depth; SEED_KEY is the primary gate)
  const ip = getClientIp(req);
  const rl = await ratelimit("seed", ip);
  if (rl?.blocked) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const key = req.nextUrl.searchParams.get("key");

  if (key !== SEED_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUsersTable();
    const sql = getDb();

    const users = await Promise.all(
      SEED_USERS.map((u) =>
        sql`
          INSERT INTO users (id, name, email, role)
          VALUES (${u.id}, ${u.name}, ${u.email}, ${u.role})
          ON CONFLICT (id) DO UPDATE
            SET name  = EXCLUDED.name,
                email = EXCLUDED.email,
                role  = EXCLUDED.role
          RETURNING id, name, email, role, created_at
        `.then((rows) => rows[0])
      )
    );

    return NextResponse.json({ ok: true, seeded: users.length, users }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
