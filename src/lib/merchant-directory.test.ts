import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
it("pages merchant accounts, includes business verification and denies merchant execution", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table profiles(id uuid primary key,full_name text,email text,phone_number text,role text,status text,created_at timestamptz);
      create table merchant_profiles(user_id uuid,company_name text,country text,verification_status text,business_address text,merchant_slug text,merchant_id text);
      create table kyc_submissions(merchant_id text,account_type text,status text,business_name text,created_at timestamptz);
      insert into profiles select gen_random_uuid(),'Merchant '||n,'test'||n||'@example.com','','merchant','active',now()-n*interval '1 minute' from generate_series(1,65) n;`);
    await db.exec(readFileSync(new URL("../../drizzle/migrations/0036_bounded_merchant_directory.sql", import.meta.url), "utf8"));
    const first = (await db.query<{ result: any }>("select admin_merchant_directory() result")).rows[0].result;
    const next = (await db.query<{ result: any }>("select admin_merchant_directory('','all','all','all',1) result")).rows[0].result;
    expect(first.total).toBe(65); expect(first.rows).toHaveLength(50); expect(next.rows).toHaveLength(15);
    expect(new Set([...first.rows,...next.rows].map((r: any) => r.id)).size).toBe(65);
    await db.exec(`insert into kyc_submissions select id::text,'business','approved','Verified Shop',now() from profiles limit 1;`);
    const business = (await db.query<{ result: any }>("select admin_merchant_directory('Verified Shop','all','approved','business',0) result")).rows[0].result;
    expect(business.total).toBe(1); expect(business.rows[0].account_type).toBe("business");
    const allowed = (await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated','admin_merchant_directory(text,text,text,text,integer)','execute') allowed")).rows[0].allowed;
    expect(allowed).toBe(false);
  } finally { await db.close(); }
});