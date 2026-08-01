import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Portal inbox SQL authorization", () => {
  it("uses EXISTS instead of DISTINCT membership joins when selecting JSON attachments", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/portal/inbox/route.ts"),
      "utf8",
    );

    expect(source).toContain("OR EXISTS (");
    expect(source).toContain("FROM engagement_memberships em");
    expect(source).toContain("WITH visible_messages AS");
    expect(source).toContain("matching_threads AS");
    expect(source).toContain("COALESCE(msg.thread_id, msg.id) AS thread_key");
    expect(source).toContain("BOOL_OR(is_read = FALSE)");
    expect(source).not.toMatch(/SELECT\s+DISTINCT[\s\S]*AS attachments/);
    expect(source).not.toContain("LEFT JOIN engagement_memberships em");
  });
});
