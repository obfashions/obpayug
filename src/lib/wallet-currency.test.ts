import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("rejects relabeling existing UGX funds as RWF", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create table profiles(id uuid primary key, default_currency text, enabled_currencies text[]);
      create table merchant_wallets(user_id uuid,available_balance numeric);
      insert into profiles values('00000000-0000-4000-8000-000000000001','UGX',array['UGX']);
      insert into merchant_wallets values('00000000-0000-4000-8000-000000000001',90480);`);
    await db.exec(readFileSync(new URL("../../drizzle/migrations/0028_protect_main_wallet_currency.sql", import.meta.url), "utf8"));
    await expect(db.exec("update profiles set default_currency='RWF'")).rejects.toThrow("cannot relabel existing funds");
    await db.exec("update profiles set enabled_currencies=array['UGX','RWF']");
    const result = await db.query("select p.default_currency,w.available_balance from profiles p join merchant_wallets w on w.user_id=p.id");
    expect(result.rows[0]).toEqual({default_currency: "UGX", available_balance: "90480"});
  } finally { await db.close(); }
});