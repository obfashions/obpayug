import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, afterEach, describe, expect, it } from "vitest";

const merchant = "00000000-0000-4000-8000-000000000001";
let db: PGlite;
const migration = readFileSync(new URL("../../drizzle/migrations/0019_atomic_payout_reservation.sql", import.meta.url), "utf8");
async function reserve(reference: string, amount = 30000, currency = "UGX") {
  const result = await db.query<{ record: { id: string; metadata: Record<string, number> } }>("select public.reserve_payout_and_balance($1,$2,$3,$4,'0700000000','api',null) record", [merchant, reference, amount, currency]);
  return result.rows[0].record;
}
async function settle(id: string, status: string) {
  return db.query("select public.settle_payment_record_and_balance($1,$2,1000,'provider-test')", [id, status]);
}
async function balances() {
  const result = await db.query<{ wallet: string; managed: string }>("select w.available_balance wallet,b.available_balance managed from merchant_wallets w join merchant_balances b on b.merchant_id=w.user_id::text where b.currency='UGX'");
  return { wallet: Number(result.rows[0].wallet), managed: Number(result.rows[0].managed) };
}
beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table profiles(id uuid primary key,default_currency text);
    create table merchant_wallets(user_id uuid primary key,available_balance numeric default 0,balances_by_currency jsonb, currency text default 'UGX',withdrawals_enabled boolean default true,total_payouts numeric default 0,updated_at timestamptz);
    create table merchant_balances(id uuid default gen_random_uuid() primary key,merchant_id text,currency text,available_balance numeric default 0,total_collections numeric default 0,total_payouts numeric default 0,updated_at timestamptz,unique(merchant_id,currency));
    create table transactions(reference text,user_id uuid);
    create table payment_records(id uuid default gen_random_uuid() primary key,merchant_id text,reference text unique,type text,source text,amount numeric,currency text,status text,phone_number text,description text,metadata jsonb,fee_amount numeric default 0,net_amount numeric,provider_reference text,balance_applied_at timestamptz,settled_at timestamptz,updated_at timestamptz);
    create function public.apply_merchant_balance_change(p_merchant_id text,p_currency text,p_available_delta numeric,p_collections_delta numeric default 0,p_payouts_delta numeric default 0) returns merchant_balances language plpgsql as $$ declare r merchant_balances; begin
      insert into merchant_balances(merchant_id,currency,available_balance,total_collections,total_payouts) values(p_merchant_id,p_currency,p_available_delta,p_collections_delta,p_payouts_delta)
      on conflict(merchant_id,currency) do update set available_balance=merchant_balances.available_balance+excluded.available_balance,total_collections=merchant_balances.total_collections+excluded.total_collections,total_payouts=merchant_balances.total_payouts+excluded.total_payouts returning * into r; return r; end; $$;
    insert into profiles values('${merchant}','UGX');
    insert into merchant_wallets(user_id,available_balance,balances_by_currency) values('${merchant}',20000,'{"UGX":20000,"KES":5000}');
    insert into merchant_balances(merchant_id,currency,available_balance) values('${merchant}','UGX',20000);
  `);
  await db.exec(migration);
});
afterEach(async () => { await db.close(); });

describe("actual payout database functions", () => {
  it("deducts 30000 immediately from 40000 across both stores", async () => {
    const record = await reserve("immediate");
    expect(await balances()).toEqual({ wallet: 0, managed: 10000 });
    expect(record.metadata.balance_before).toBe(40000);
    expect(record.metadata.balance_after).toBe(10000);
  });
  it("blocks a second distinct 30000 payout from the same 40000", async () => {
    await reserve("first");
    await expect(reserve("second")).rejects.toThrow("Insufficient balance");
    expect(await balances()).toEqual({ wallet: 0, managed: 10000 });
  });
  it("never deducts a duplicate reference twice", async () => {
    await reserve("duplicate", 10000);
    await expect(reserve("duplicate", 10000)).rejects.toThrow("Reference already reserved");
    expect(await balances()).toEqual({ wallet: 10000, managed: 20000 });
  });
  it("success and repeated callbacks cannot deduct again", async () => {
    const record = await reserve("success");
    await settle(record.id, "success");
    await settle(record.id, "success");
    expect(await balances()).toEqual({ wallet: 0, managed: 10000 });
  });
  it("refunds a rejected payout exactly once to the original stores", async () => {
    const record = await reserve("failed");
    await settle(record.id, "failed");
    await settle(record.id, "failed");
    expect(await balances()).toEqual({ wallet: 20000, managed: 20000 });
  });
  it("keeps a KES payout separate from UGX", async () => {
    await reserve("kes", 1000, "KES");
    expect(await balances()).toEqual({ wallet: 20000, managed: 20000 });
    const result = await db.query<{ balance: string }>("select balances_by_currency->>'KES' balance from merchant_wallets");
    expect(Number(result.rows[0].balance)).toBe(4000);
  });
  it("prevents withdrawals when disabled", async () => {
    await db.exec("update merchant_wallets set withdrawals_enabled=false");
    await expect(reserve("disabled")).rejects.toThrow("Withdrawals are disabled");
    expect(await balances()).toEqual({ wallet: 20000, managed: 20000 });
  });
  it("does not double credit a collection mirrored from legacy history", async () => {
    await db.exec(`insert into transactions values('mirror','${merchant}'); insert into payment_records(merchant_id,reference,type,amount,currency,status,source) values('${merchant}','mirror','collection',40000,'UGX','pending','dashboard');`);
    const result = await db.query<{ id: string }>("select id from payment_records where reference='mirror'");
    await settle(result.rows[0].id, "success");
    expect(await balances()).toEqual({ wallet: 20000, managed: 20000 });
  });
});