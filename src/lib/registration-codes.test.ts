import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
it("registration codes are session-free, rate limited, single use, and limited to five guesses", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role; create table verification_codes(id uuid default gen_random_uuid(),user_id uuid,email text,type text,code_hash text,expires_at timestamptz,created_at timestamptz default now(),used boolean default false,attempts integer default 0);");
    await db.exec(readFileSync(new URL("../../drizzle/migrations/0021_atomic_registration_codes.sql", import.meta.url), "utf8"));
    const id = "00000000-0000-4000-8000-000000000001";
    const first = await db.query<{ id: string | null }>("select claim_registration_code($1,'test@example.com','hashed') id", [id]);
    expect(first.rows[0].id).toBeTruthy();
    const second = await db.query<{ id: string | null }>("select claim_registration_code($1,'test@example.com','other') id", [id]);
    expect(second.rows[0].id).toBeNull();
    expect((await db.query<{ valid: boolean }>("select consume_registration_code($1,'hashed') valid", [id])).rows[0].valid).toBe(true);
    expect((await db.query<{ valid: boolean }>("select consume_registration_code($1,'hashed') valid", [id])).rows[0].valid).toBe(false);
    await db.exec("update verification_codes set used=false,attempts=0;");
    for (let i=0; i<5; i++) expect((await db.query<{ valid: boolean }>("select consume_registration_code($1,'wrong') valid", [id])).rows[0].valid).toBe(false);
    expect((await db.query<{ valid: boolean }>("select consume_registration_code($1,'hashed') valid", [id])).rows[0].valid).toBe(false);
  } finally { await db.close(); }
});