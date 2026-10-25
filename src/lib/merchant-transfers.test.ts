import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, afterEach, describe, expect, it } from "vitest";

const sender = "00000000-0000-4000-8000-000000000001";
const recipient = "00000000-0000-4000-8000-000000000002";
const request = "00000000-0000-4000-8000-000000000003";
let db: PGlite;
beforeEach(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$;
    create function public.has_permission(uuid,text) returns boolean language sql as $$ select false $$;
    create table profiles(id uuid primary key,email text,full_name text,status text,default_currency text,enabled_currencies text[]);
    create table merchant_profiles(user_id uuid,company_name text,merchant_slug text,merchant_id text);
    create table merchant_wallets(id uuid primary key default gen_random_uuid(),user_id uuid unique,available_balance numeric default 0,balances_by_currency jsonb,currency text,withdrawals_enabled boolean default true,daily_withdrawal_limit numeric default 0,last_24h_withdrawal_total numeric default 0,last_withdrawal_reset_at timestamptz,updated_at timestamptz);
    create table merchant_balances(id uuid primary key default gen_random_uuid(),merchant_id text,currency text,available_balance numeric default 0,updated_at timestamptz,unique(merchant_id,currency));
    create table platform_settings(maintenance_mode boolean);
    create table transactions(id uuid primary key default gen_random_uuid(),user_id uuid,reference text,amount numeric,currency text,status text,type text,payment_method text,customer_name text,description text,fee_amount numeric,net_amount numeric,completed_at timestamptz,metadata jsonb);
    insert into profiles values('${sender}','sender@example.test','Sender','active','UGX',array['UGX','KES','USD']),('${recipient}','recipient@example.test','Recipient','active','UGX',array['UGX','KES','USD']);
    insert into merchant_profiles values('${recipient}','Recipient shop','recipient-shop','OB_RECIPIENT');
    insert into merchant_wallets(user_id,available_balance,balances_by_currency,currency) values('${sender}',20000,'{"UGX":999999,"KES":5000}','UGX'),('${recipient}',10000,'{"UGX":10000,"KES":2000}','UGX');
    insert into merchant_balances(merchant_id,currency,available_balance) values('${sender}','UGX',20000),('${recipient}','UGX',1000);
    select set_config('app.user_id','${sender}',false);
  `);
  await db.exec(readFileSync(new URL('../../drizzle/migrations/0030_atomic_merchant_transfers.sql',import.meta.url),'utf8'));
});
afterEach(async () => { await db.close(); });
async function transfer(amount=30000,currency='UGX',key=request,to=recipient) {
  const result = await db.query<{ result: { duplicate: boolean; sender_balance_before: number; sender_balance_after: number; recipient_balance_after: number } }>('select transfer_between_merchants($1,$2,$3,$4,$5) result',[to,currency,amount,'Supplier payment',key]);
  return result.rows[0].result;
}
async function money() {
  const result = await db.query<{ id: string; amount: string }>(`select p.id,(w.available_balance + coalesce(b.available_balance,0))::text amount from profiles p join merchant_wallets w on w.user_id=p.id left join merchant_balances b on b.merchant_id=p.id::text and b.currency='UGX' order by p.id`);
  return result.rows.map(r => Number(r.amount));
}
describe('real merchant transfer SQL', () => {
  it('moves 30000 from combined sender funds to recipient without minting money',async () => {
    const result = await transfer();
    expect(await money()).toEqual([10000,41000]);
    expect(result.sender_balance_before).toBe(40000);
    expect(result.sender_balance_after).toBe(10000);
    expect(result.recipient_balance_after).toBe(41000);
  });
  it('writes truthful paired histories including the reason and zero external fee',async () => {
    await transfer();
    const rows = (await db.query<{ type: string; amount: string; fee_amount: string; description: string }>('select type,amount,fee_amount,description from transactions order by type')).rows;
    expect(rows.map(r => r.type)).toEqual(['transfer_in','transfer_out']);
    expect(rows.map(r => Number(r.amount))).toEqual([30000,30000]);
    expect(rows.map(r => Number(r.fee_amount))).toEqual([0,0]);
    expect(rows[0].description).toContain('Supplier payment');
  });
  it('retries the same request without sending or deducting twice',async () => {
    await transfer(); expect((await transfer()).duplicate).toBe(true);
    expect(await money()).toEqual([10000,41000]);
    expect((await db.query('select * from transactions')).rows).toHaveLength(2);
  });
  it('blocks changing the amount on a used request',async () => {
    await transfer(); await expect(transfer(1000)).rejects.toThrow('different details');
    expect(await money()).toEqual([10000,41000]);
  });
  it('blocks overspending without changing either wallet',async () => {
    await expect(transfer(40001)).rejects.toThrow('Insufficient');
    expect(await money()).toEqual([40000,11000]);
    expect((await db.query('select * from merchant_transfers')).rows).toHaveLength(0);
  });
  it('a second distinct request cannot spend already transferred money',async () => {
    await transfer(); await expect(transfer(30000,'UGX','00000000-0000-4000-8000-000000000004')).rejects.toThrow('Insufficient');
    expect(await money()).toEqual([10000,41000]);
  });
  it('keeps KES transfers separate from UGX and ignores stale main mirrors',async () => {
    await transfer(1000,'KES'); expect(await money()).toEqual([40000,11000]);
    const rows = (await db.query<{ amount: string }>(`select (coalesce((w.balances_by_currency->>'KES')::numeric,0)+coalesce(b.available_balance,0))::text amount from merchant_wallets w left join merchant_balances b on b.merchant_id=w.user_id::text and b.currency='KES' order by w.user_id`)).rows;
    expect(rows.map(r=>Number(r.amount))).toEqual([4000,3000]);
  });
  it('requires enabled recipient currency',async () => {
    await db.exec(`update profiles set enabled_currencies=array['UGX'] where id='${recipient}'`);
    await expect(transfer(1000,'KES')).rejects.toThrow('enable the same currency');
  });
  it('rejects inactive accounts',async () => {
    await db.exec(`update profiles set status='deactivated' where id='${sender}'`);
    await expect(transfer()).rejects.toThrow('must be active');
  });
  it('honors disabled withdrawals and daily limits',async () => {
    await db.exec(`update merchant_wallets set withdrawals_enabled=false where user_id='${sender}'`);
    await expect(transfer()).rejects.toThrow('disabled');
    await db.exec(`update merchant_wallets set withdrawals_enabled=true,daily_withdrawal_limit=1000 where user_id='${sender}'`);
    await expect(transfer()).rejects.toThrow('Daily withdrawal limit');
  });
  it('rejects self transfers and unauthenticated callers',async () => {
    await expect(transfer(1000,'UGX',request,sender)).rejects.toThrow('another merchant');
    await db.exec(`select set_config('app.user_id','',false)`);
    await expect(transfer()).rejects.toThrow('sign in');
  });
  it('enforces precision and rejects invalid amounts',async () => {
    await expect(transfer(1.5)).rejects.toThrow('decimal places');
    await expect(transfer(-1)).rejects.toThrow('valid transfer');
    await expect(transfer(1,'EUR')).rejects.toThrow('valid transfer');
  });
  it('rolls back both balances if either history write fails',async () => {
    await db.exec(`alter table transactions add constraint deliberate_history_failure check(type<>'transfer_in')`);
    await expect(transfer()).rejects.toThrow();
    expect(await money()).toEqual([40000,11000]);
    expect((await db.query('select * from merchant_transfers')).rows).toHaveLength(0);
  });
  it('finds recipient by exact username rather than ambiguous display name',async () => {
    const row = await db.query<{ result: { name: string; id: string } }>(`select find_transfer_recipient('recipient-shop') result`);
    expect(row.rows[0].result.id).toBe(recipient);
    expect(row.rows[0].result.name).toBe('Recipient shop');
    await expect(db.query(`select find_transfer_recipient('Recipient')`)).rejects.toThrow('No unique');
  });
});