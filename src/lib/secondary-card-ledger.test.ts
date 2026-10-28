import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("restricted card settlement", () => {
  it("credits exactly once, covers partner fees and grants no merchant write access", async () => {
    const db = new PGlite();
    try {
      await db.exec(`create role authenticated; create role anon; create role service_role;
        create schema auth; create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
        create table payment_records(id uuid primary key, merchant_id text, amount numeric, currency text, type text,status text,metadata jsonb,fee_amount numeric,net_amount numeric,settled_at timestamptz,balance_applied_at timestamptz,updated_at timestamptz);
        insert into payment_records values('00000000-0000-4000-8000-000000000001','merchant',5000,'UGX','collection','pending','{"provider":"marz","service":"card_payments"}',0,null,null,null,null);`);
      await db.exec(readFileSync(new URL("../../drizzle/migrations/0035_secondary_card_wallet.sql", import.meta.url), "utf8"));
      await expect(db.query("select settle_secondary_card('00000000-0000-4000-8000-000000000001','success',100,200)")).rejects.toThrow("Invalid confirmed card fee");
      await db.query("select settle_secondary_card('00000000-0000-4000-8000-000000000001','success',250,200)");
      await db.query("select settle_secondary_card('00000000-0000-4000-8000-000000000001','success',250,200)");
      const result = await db.query<{ available_balance: string }>("select available_balance from merchant_card_balances");
      expect(Number(result.rows[0].available_balance)).toBe(4750);
      const grants = await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated','settle_secondary_card(uuid,text,numeric,numeric)','execute') allowed");
      expect(grants.rows[0].allowed).toBe(false);
    } finally { await db.close(); }
  });
});