import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { WALLET_CURRENCIES } from "./countries";
import { exchangeReceive } from "./exchange-math";

const merchant = "00000000-0000-4000-8000-000000000001";
let db: PGlite;
beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table profiles(id uuid primary key,default_currency text);
    create table merchant_wallets(id uuid primary key default gen_random_uuid(),user_id uuid unique,available_balance numeric,balances_by_currency jsonb,currency text,updated_at timestamptz);
    create table merchant_balances(id uuid primary key default gen_random_uuid(),merchant_id text,currency text,available_balance numeric default 0,updated_at timestamptz,unique(merchant_id,currency));
    create table currency_exchanges(id uuid default gen_random_uuid(),merchant_id text,from_currency text,to_currency text,from_amount numeric,to_amount numeric,rate numeric,fee_percent numeric);
    insert into profiles values('${merchant}','UGX');
    insert into merchant_wallets(user_id,available_balance,balances_by_currency,currency) values('${merchant}',10000,'{"UGX":999999,"KES":2500}','UGX');
    insert into merchant_balances(merchant_id,currency,available_balance) values('${merchant}','UGX',5000);
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0031_exchange_all_supported_wallet_currencies.sql", import.meta.url), "utf8"));
});
afterEach(async () => { await db.close(); });
async function exchange(from: string, to: string, amount = 5000, rate = 0.007) {
  const receive = exchangeReceive(amount, rate, 1.5, to);
  return db.query("select exchange_wallet_balance($1,$2,$3,$4,$5,$6,$7) result", [merchant, from, to, amount, receive, rate, 1.5]);
}
async function balance(currency: string) {
  const { rows } = await db.query<{ balance: string }>(`select ((case when $1='UGX' then w.available_balance else coalesce((w.balances_by_currency->>$1)::numeric,0) end) + coalesce(b.available_balance,0))::text balance from merchant_wallets w left join merchant_balances b on b.merchant_id=w.user_id::text and b.currency=$1`, [currency]);
  return Number(rows[0].balance);
}
describe("supported wallet exchanges", () => {
  it("exchanges UGX to ZMW with a 1.5% fee and leaves unrelated wallets untouched", async () => {
    await exchange("UGX", "ZMW");
    expect(await balance("UGX")).toBe(10000);
    expect(await balance("ZMW")).toBe(34);
    expect(await balance("KES")).toBe(2500);
    const { rows } = await db.query<{ fee: string }>("select fee_percent::text fee from currency_exchanges");
    expect(Number(rows[0].fee)).toBe(1.5);
  });
  it.each(WALLET_CURRENCIES.filter(c => c !== "UGX"))("supports UGX to %s and back", async currency => {
    await exchange("UGX", currency, 1000, 1);
    expect(await balance(currency)).toBe(currency === "KES" ? 3485 : 985);
    await exchange(currency, "UGX", 100, 1);
    expect(await balance("UGX")).toBe(14098);
  });
  it("accepts lowercase currency codes", async () => {
    await db.query("select exchange_wallet_balance($1,'ugx','zmw',5000,34,0.007,1.5)", [merchant]);
    expect(await balance("ZMW")).toBe(34);
  });
  it("rejects unsupported and identical currencies without changing funds", async () => {
    await expect(exchange("UGX", "EUR")).rejects.toThrow("supported currencies");
    await expect(exchange("UGX", "UGX")).rejects.toThrow("supported currencies");
    expect(await balance("UGX")).toBe(15000);
  });
  it("cannot overspend or reuse the stale main-currency mirror", async () => {
    await exchange("UGX", "ZMW", 14000);
    await expect(exchange("UGX", "ZMW", 2000)).rejects.toThrow("Insufficient");
    expect(await balance("UGX")).toBe(1000);
  });
  it("rolls back both balances if the exchange history write fails", async () => {
    await db.exec("alter table currency_exchanges add constraint test_failure check(to_currency <> 'ZMW')");
    await expect(exchange("UGX", "ZMW")).rejects.toThrow();
    expect(await balance("UGX")).toBe(15000);
    expect(await balance("ZMW")).toBe(0);
  });
});