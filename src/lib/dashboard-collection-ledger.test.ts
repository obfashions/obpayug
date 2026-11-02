import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, afterEach, it, expect } from "vitest";
import { WALLET_CURRENCIES } from "./countries";

const merchant = "00000000-0000-4000-8000-000000000001";
const transaction = "00000000-0000-4000-8000-000000000002";
let db: PGlite;
beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table profiles(id uuid primary key, default_currency text);
    create table merchant_wallets(user_id uuid primary key,currency text,available_balance numeric default 0,total_collections numeric default 0,balances_by_currency jsonb,updated_at timestamptz);
    create table transactions(id uuid primary key,user_id uuid,reference text,type text,currency text,amount numeric,status text,fee_amount numeric,net_amount numeric,completed_at timestamptz,updated_at timestamptz,provider_reference text,metadata jsonb);
    create table payment_records(reference text,merchant_id text,type text,currency text,amount numeric,status text,settled_at timestamptz,balance_applied_at timestamptz,updated_at timestamptz);
    insert into profiles values('${merchant}','UGX');
    insert into transactions(id,user_id,reference,type,currency,amount,status) values('${transaction}','${merchant}','CMVZ4MG9X','collection','UGX',2000,'pending');
  `);
  await db.exec(readFileSync(new URL("../../drizzle/migrations/0037_atomic_dashboard_collection_credit.sql", import.meta.url), "utf8"));
});
afterEach(async () => { await db.close(); });
const settle = (fee = 155, status = "success") => db.query("select settle_dashboard_collection($1,$2,$3,'verified')", [transaction,status,fee]);
const wallet = async () => (await db.query<{ available_balance: string; currency: string; balances_by_currency: Record<string, number> }>("select * from merchant_wallets")).rows[0];

it("creates Gaston's missing wallet and credits 1845 UGX plus 461 UGX exactly once", async () => {
  await settle(); await settle();
  await db.exec(`update transactions set id='00000000-0000-4000-8000-000000000003',reference='CMVZ4SALF',amount=500,status='pending',metadata='{}'`);
  await db.query("select settle_dashboard_collection(id,'success',39,'verified') from transactions");
  expect(Number((await wallet()).available_balance)).toBe(2306);
});
it.each(WALLET_CURRENCIES)("credits %s without relabeling the main wallet", async (currency) => {
  await db.query("update transactions set currency=$1", [currency]);
  await settle();
  const w = await wallet();
  expect(w.currency).toBe("UGX");
  expect(Number(w.available_balance)).toBe(currency === "UGX" ? 1845 : 0);
  expect(w.balances_by_currency[currency]).toBe(1845);
});
it("rolls back success when the wallet write fails and can retry", async () => {
  await db.exec("alter table merchant_wallets add constraint reject_credit check(available_balance=0)");
  await expect(settle()).rejects.toThrow();
  expect((await db.query<{status:string}>("select status from transactions")).rows[0].status).toBe("pending");
  await db.exec("alter table merchant_wallets drop constraint reject_credit");
  await settle();
  expect(Number((await wallet()).available_balance)).toBe(1845);
});
it("never credits failed collections", async () => {
  await settle(0,"failed");
  expect((await db.query("select * from merchant_wallets")).rows).toHaveLength(0);
});
it("refuses a mirror that already received a managed credit", async () => {
  await db.exec(`insert into payment_records values('CMVZ4MG9X','${merchant}','collection','UGX',2000,'success',now(),now(),now())`);
  await expect(settle()).rejects.toThrow("requires review");
  expect((await db.query("select * from merchant_wallets")).rows).toHaveLength(0);
});
it("does not permit merchants to call privileged collection settlement", async () => {
  const rows = await db.query<{allowed:boolean}>("select has_function_privilege('authenticated','settle_dashboard_collection(uuid,text,numeric,text)','EXECUTE') allowed");
  expect(rows.rows[0].allowed).toBe(false);
});