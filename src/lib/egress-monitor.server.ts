// Server-only monitor for the outbound network address ObPay uses when it talks
// to the banking partner.
//
// The partner only accepts requests from an approved address. The hosting
// platform's address is usually stable but is not guaranteed forever, so we:
//   1. remember the address that was approved by the partner
//   2. compare it with the live address on every health check / partner refusal
//   3. email the ObPay admin the moment it changes (once per new address)
//
// State is kept in a single `platform_credentials` row whose id is prefixed
// `egress` so it never shows up beside the gateway credential sets:
//   label      → last address we observed
//   api_key    → address approved by the partner
//   api_secret → address we already sent an alert about (de-duplicates mail)

const ROW_ID = "egress:ip-monitor";

export interface EgressState {
  approved: string | null;
  current: string | null;
  lastSeen: string | null;
  matches: boolean;
  staticRelay: boolean;
  checkedAt: string;
}

const db = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
};

async function readRow(): Promise<{ approved: string | null; lastSeen: string | null; alerted: string | null }> {
  try {
    const client = await db();
    const { data } = await client
      .from("platform_credentials")
      .select("label, api_key, api_secret")
      .eq("id", ROW_ID)
      .maybeSingle();
    return {
      approved: data?.api_key || null,
      lastSeen: data?.label || null,
      alerted: data?.api_secret || null,
    };
  } catch {
    return { approved: null, lastSeen: null, alerted: null };
  }
}

async function writeRow(patch: { approved?: string | null; lastSeen?: string | null; alerted?: string | null; by?: string }) {
  try {
    const client = await db();
    const current = await readRow();
    await client.from("platform_credentials").upsert(
      {
        id: ROW_ID,
        label: patch.lastSeen ?? current.lastSeen ?? "",
        api_key: patch.approved ?? current.approved ?? "",
        api_secret: patch.alerted ?? current.alerted ?? "",
        enabled: false,
        updated_by: patch.by || "system",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  } catch {
    /* monitoring must never break a transaction */
  }
}

function alertHtml(previous: string | null, current: string, reason: string): string {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;">
    <h2 style="font-size:18px;margin:0 0 8px;">ObPay server address changed</h2>
    <p style="font-size:14px;color:#374151;line-height:1.5;">
      Transactions are sent to the banking partner from a network address they have to approve.
      That address has just changed, so payouts and collections can start failing until the new
      address is approved.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;">
      <tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">Approved address</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:600;">${previous || "not set"}</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">New address now in use</td><td style="padding:6px 0;font-size:13px;text-align:right;font-weight:600;">${current}</td></tr>
      <tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">Detected by</td><td style="padding:6px 0;font-size:13px;text-align:right;">${reason}</td></tr>
    </table>
    <p style="font-size:14px;color:#374151;line-height:1.5;">
      Send <strong>${current}</strong> to the banking partner for approval, then open
      Admin → Gateway API and press “Mark current address as approved”.
    </p>
  </div>`;
}

/**
 * Probes the live outbound address, records it and alerts the admin when it no
 * longer matches the approved one. Safe to call often — it only mails once per
 * newly seen address.
 */
export async function checkEgressIp(reason = "routine check"): Promise<EgressState> {
  const { probeEgressIp, proxyConfig } = await import("./gateway.server");
  const staticRelay = !!proxyConfig();
  const current = await probeEgressIp(staticRelay);
  const row = await readRow();

  const state: EgressState = {
    approved: row.approved || null,
    current,
    lastSeen: row.lastSeen || null,
    matches: !!current && !!row.approved && current === row.approved,
    staticRelay,
    checkedAt: new Date().toISOString(),
  };

  if (!current) return state;

  const drifted = !!row.approved && current !== row.approved;
  const needsAlert = drifted && row.alerted !== current;

  if (needsAlert) {
    const { sendAdminAlert } = await import("./notify.server");
    await sendAdminAlert(
      `[ObPay] Server address changed — approve ${current}`,
      alertHtml(row.approved, current, reason),
    );
  }

  if (current !== row.lastSeen || needsAlert) {
    await writeRow({ lastSeen: current, ...(needsAlert ? { alerted: current } : {}) });
  }

  return state;
}

/** Called when the partner refuses a request because of its IP allow-list. */
export async function noteIpBlocked(): Promise<void> {
  try {
    await checkEgressIp("banking partner refused a request from this address");
  } catch {
    /* ignore */
  }
}

/** Admin action: remember the address the partner has approved. */
export async function approveEgressIp(ip: string | null, by: string): Promise<EgressState> {
  const { probeEgressIp, proxyConfig } = await import("./gateway.server");
  const value = (ip || "").trim() || (await probeEgressIp(!!proxyConfig())) || "";
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    throw new Error("Enter a valid IPv4 address, or wait until the live address can be read.");
  }
  await writeRow({ approved: value, lastSeen: value, alerted: "", by });
  return await checkEgressIp("approval updated by admin");
}

export async function egressState(): Promise<EgressState> {
  return await checkEgressIp("admin screen");
}
