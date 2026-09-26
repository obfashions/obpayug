// Server-only: one-time move of merchant accounts from the old outside account
// system into this project. The old system is only ever READ, using its public
// key plus the account owner's own sign-in, so no private key is needed.

const OLD_URL = () => ((import.meta.env["VITE_PUBLIC_SUPABASE_URL"] as string) || "").replace(/\/+$/, "");
const OLD_KEY = () => ((import.meta.env["VITE_PUBLIC_SUPABASE_ANON_KEY"] as string) || "").trim();

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function oldSignIn(email: string, password: string): Promise<{ token: string; userId: string; email: string } | null> {
  if (!OLD_URL() || !OLD_KEY()) return null;
  try {
    const r = await fetch(`${OLD_URL()}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: OLD_KEY(), "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    if (!j?.access_token || !j?.user?.id) return null;
    return { token: j.access_token, userId: j.user.id, email: j.user.email || email };
  } catch {
    return null;
  }
}

async function oldRows(token: string, path: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const r = await fetch(`${OLD_URL()}/rest/v1${path}`, {
      headers: { apikey: OLD_KEY(), Authorization: `Bearer ${token}`, Range: `${from}-${from + 999}` },
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);
    if (!r || !r.ok) break;
    const rows = (await r.json().catch(() => [])) as any[];
    if (!Array.isArray(rows)) break;
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

const PROFILE_COLS = ["id", "email", "full_name", "phone_number", "role", "status", "created_at", "default_currency", "role_tag", "support_agent"];
const pick = (row: any, cols: string[]) => Object.fromEntries(cols.filter((c) => c in row).map((c) => [c, row[c]]));
const WALLET_COLS = ["id", "user_id", "available_balance", "pending_balance", "total_collections", "total_payouts", "currency", "created_at", "updated_at", "welcome_bonus_credited", "invested_balance", "daily_withdrawal_limit", "last_24h_withdrawal_total", "last_withdrawal_reset_at", "withdrawals_enabled", "payout_mode", "balances_by_currency"];
const TX_COLS = ["id", "user_id", "reference", "amount", "currency", "status", "type", "payment_method", "customer_phone", "customer_name", "provider_reference", "metadata", "created_at", "updated_at", "fee_amount", "net_amount", "merchant_reference", "completed_at", "description"];
const PAYOUT_COLS = ["id", "user_id", "amount", "currency", "phone_number", "network", "description", "status", "provider_reference", "rejection_reason", "requested_at", "processed_at", "completed_at", "fee_amount"];
const NOTIF_COLS = ["id", "user_id", "type", "title", "message", "is_read", "created_at"];
const MP_COLS = ["id", "user_id", "company_name", "country", "business_address", "national_id", "id_front_url", "id_back_url", "verification_status", "rejection_reason", "verified_at", "verified_by", "created_at", "updated_at", "merchant_id", "merchant_slug", "credentials_generated"];

/** Copies rows into this project; existing rows are never overwritten (no double balances). */
async function copy(table: string, rows: any[], cols: string[], conflict = "id") {
  if (!rows.length) return;
  const db: any = await admin();
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => pick(r, cols));
    const { error } = await db.from(table).upsert(chunk, { onConflict: conflict, ignoreDuplicates: true });
    if (error) console.error(`[legacy-migrate] ${table}`, error.message);
  }
}

async function copyData(token: string, filter: string) {
  const f = (col: string) => (filter ? `&${col}=${filter}` : "");
  const [profiles, wallets, txs, payouts, notifs, mps] = await Promise.all([
    oldRows(token, `/profiles?select=*${f("id")}`),
    oldRows(token, `/merchant_wallets?select=*${f("user_id")}`),
    oldRows(token, `/transactions?select=*${f("user_id")}&order=created_at.asc`),
    oldRows(token, `/payout_requests?select=*${f("user_id")}`),
    oldRows(token, `/notifications?select=*${f("user_id")}`),
    oldRows(token, `/merchant_profiles?select=*${f("user_id")}`),
  ]);
  const now = new Date().toISOString();
  await copy("profiles", profiles.map((p) => ({ ...p, email: String(p.email || "").toLowerCase() })), PROFILE_COLS);
  await copy("merchant_wallets", wallets, WALLET_COLS, "user_id");
  await copy("transactions", txs, TX_COLS);
  await copy("payout_requests", payouts, PAYOUT_COLS);
  await copy("notifications", notifs, NOTIF_COLS);
  await copy("merchant_profiles", mps, MP_COLS);
  return { profiles: profiles.length, transactions: txs.length, now };
}

/**
 * Called when sign-in here fails. If the same email + password works on the
 * old system, the account (same ID, same password) and its data move here.
 */
export async function migrateOnLogin(emailRaw: string, password: string): Promise<{ moved: boolean }> {
  const email = String(emailRaw || "").trim().toLowerCase();
  if (!email || !password) return { moved: false };
  const old = await oldSignIn(email, password);
  if (!old) return { moved: false };

  const db: any = await admin();
  const { data: existing } = await db.auth.admin.getUserById(old.userId);
  if (existing?.user) {
    await db.auth.admin.updateUserById(old.userId, { password, email_confirm: true });
  } else {
    const { error } = await db.auth.admin.createUser({ id: old.userId, email: old.email.toLowerCase(), password, email_confirm: true } as any);
    if (error) {
      console.error("[legacy-migrate] createUser", error.message);
      return { moved: false };
    }
  }

  const { data: prof } = await db.from("profiles").select("id, role, migrated_from_legacy_at").eq("id", old.userId).maybeSingle();
  if (!prof?.migrated_from_legacy_at) {
    // Own rows first; an admin's first sign-in also brings over every merchant.
    await copyData(old.token, `eq.${old.userId}`);
    const { data: me } = await db.from("profiles").select("role").eq("id", old.userId).maybeSingle();
    if (me?.role === "admin") await copyData(old.token, "");
    await db.from("profiles").update({ migrated_from_legacy_at: new Date().toISOString() }).eq("id", old.userId);
  }
  return { moved: true };
}

/** Makes sure a sign-in exists here for a profile copied over by the admin import. */
export async function ensureAuthUser(userId: string, email: string) {
  const db: any = await admin();
  const { data } = await db.auth.admin.getUserById(userId);
  if (data?.user) return true;
  const pw = crypto.randomUUID() + crypto.randomUUID();
  const { error } = await db.auth.admin.createUser({ id: userId, email: email.toLowerCase(), password: pw, email_confirm: true } as any);
  if (error) console.error("[legacy-migrate] ensureAuthUser", error.message);
  return !error;
}
