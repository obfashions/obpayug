import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import { supabase } from "@/lib/supabase";

interface Props {
  userId: string;
}

interface MerchantProfileRow {
  company_name?: string | null;
  country?: string | null;
  business_address?: string | null;
  national_id?: string | null;
  id_front_url?: string | null;
  id_back_url?: string | null;
  verification_status?: string | null;
  rejection_reason?: string | null;
  verified_at?: string | null;
  merchant_id?: string | null;
  merchant_slug?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface ApiKeyRow {
  public_key?: string | null;
  environment?: string | null;
  status?: string | null;
  created_at?: string | null;
}

interface TxRow {
  id: string;
  amount: number | null;
  currency?: string | null;
  status?: string | null;
  type?: string | null;
  created_at: string;
  customer_phone?: string | null;
  reference?: string | null;
}

interface PayoutRow {
  id: string;
  amount: number | null;
  status?: string | null;
  requested_at?: string | null;
  created_at?: string | null;
}

function money(amount: number | null | undefined, currency = "UGX") {
  return `${currency} ${(amount || 0).toLocaleString("en-UG")}`;
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function DocCard({ label, url }: { label: string; url?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-foreground-500 mb-1.5">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block group">
          <img
            src={url}
            alt={label}
            loading="lazy"
            decoding="async"
            className="w-full h-40 object-cover rounded-lg border border-background-200/70 bg-background-200"
          />
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 group-hover:text-primary-700">
            <i className="ri-external-link-line" /> Open full size
          </span>
        </a>
      ) : (
        <div className="w-full h-40 rounded-lg border border-dashed border-background-300/70 bg-background-100 flex flex-col items-center justify-center gap-1 text-foreground-400">
          <i className="ri-image-off-line text-xl" />
          <span className="text-[11px]">Not uploaded</span>
        </div>
      )}
    </div>
  );
}

export default function MerchantAccountPanel({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [mp, setMp] = useState<MerchantProfileRow | null>(null);
  const [apiKey, setApiKey] = useState<ApiKeyRow | null>(null);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [linkCount, setLinkCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [mpRes, keyRes, txRes, poRes, plRes] = await Promise.all([
        supabase.from("merchant_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("api_keys").select("public_key, environment, status, created_at").eq("user_id", userId).maybeSingle(),
        supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
        supabase.from("payout_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
        supabase.from("payment_links").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      if (cancelled) return;
      setMp((mpRes.data as MerchantProfileRow) || null);
      setApiKey((keyRes.data as ApiKeyRow) || null);
      setTxs((txRes.data as TxRow[]) || []);
      setPayouts((poRes.data as PayoutRow[]) || []);
      setLinkCount(plRes.count || 0);
      setLoading(false);
    };
    load().then(undefined, () => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-background-100 rounded-lg p-6 text-center text-sm text-foreground-500">
        <i className="ri-loader-4-line animate-spin mr-2" /> Loading full account record…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Verification documents */}
      <div className="bg-background-100 rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h4 className="text-sm font-semibold text-foreground-900">
            <i className="ri-shield-user-line mr-1.5 text-foreground-500" />
            Verification Documents
          </h4>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                mp?.verification_status === "approved"
                  ? "bg-primary-100 text-primary-700"
                  : mp?.verification_status === "rejected"
                    ? "bg-accent-100 text-accent-700"
                    : "bg-secondary-100 text-secondary-700"
              }`}
            >
              {mp?.verification_status || "not submitted"}
            </span>
            <Link
              to="/admin/kyc-review"
              className="text-[11px] font-medium text-primary-600 hover:text-primary-700 whitespace-nowrap"
            >
              Review KYC →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <DocCard label="ID / Passport — Front" url={mp?.id_front_url} />
          <DocCard label="ID / Passport — Back" url={mp?.id_back_url} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-foreground-500 mb-1">National ID No.</p>
            <p className="font-medium text-foreground-900 text-xs break-all">{mp?.national_id || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-foreground-500 mb-1">Submitted</p>
            <p className="font-medium text-foreground-900 text-xs">{fmtDate(mp?.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-foreground-500 mb-1">Verified At</p>
            <p className="font-medium text-foreground-900 text-xs">{fmtDate(mp?.verified_at)}</p>
          </div>
          <div>
            <p className="text-xs text-foreground-500 mb-1">Rejection Reason</p>
            <p className="font-medium text-foreground-900 text-xs">{mp?.rejection_reason || "—"}</p>
          </div>
        </div>
      </div>

      {/* Account & integration info */}
      <div className="bg-background-100 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-foreground-900 mb-3">
          <i className="ri-key-2-line mr-1.5 text-foreground-500" />
          Account & Integration
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="min-w-0">
            <p className="text-xs text-foreground-500 mb-1">User ID</p>
            <code className="text-[10px] font-mono text-foreground-700 break-all">{userId}</code>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-foreground-500 mb-1">Public API Key</p>
            <code className="text-[10px] font-mono text-foreground-700 break-all">{apiKey?.public_key || "Not generated"}</code>
          </div>
          <div>
            <p className="text-xs text-foreground-500 mb-1">API Environment</p>
            <p className="font-medium text-foreground-900 text-xs">
              {apiKey ? `${apiKey.environment || "live"} · ${apiKey.status || "active"}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-foreground-500 mb-1">Payment Links</p>
            <p className="font-medium text-foreground-900 text-xs">{linkCount}</p>
          </div>
        </div>
        {mp?.merchant_slug && (
          <a
            href={`/pay/${mp.merchant_slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:text-primary-700"
          >
            <i className="ri-external-link-line" /> View their public payment page
          </a>
        )}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-background-100 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-foreground-900 mb-3">
            <i className="ri-exchange-dollar-line mr-1.5 text-foreground-500" />
            Recent Transactions
          </h4>
          {txs.length === 0 ? (
            <p className="text-xs text-foreground-500">No transactions yet.</p>
          ) : (
            <ul className="space-y-2">
              {txs.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground-900 truncate">
                      {t.type || "payment"} · {t.customer_phone || t.reference || t.id.slice(0, 8)}
                    </p>
                    <p className="text-[11px] text-foreground-500">{fmtDate(t.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-foreground-900">{money(t.amount, t.currency || "UGX")}</p>
                    <span
                      className={`text-[10px] font-medium ${
                        t.status === "successful" || t.status === "completed"
                          ? "text-primary-600"
                          : t.status === "failed"
                            ? "text-accent-600"
                            : "text-foreground-500"
                      }`}
                    >
                      {t.status || "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-background-100 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-foreground-900 mb-3">
            <i className="ri-bank-card-line mr-1.5 text-foreground-500" />
            Recent Payout Requests
          </h4>
          {payouts.length === 0 ? (
            <p className="text-xs text-foreground-500">No payout requests yet.</p>
          ) : (
            <ul className="space-y-2">
              {payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground-900">{money(p.amount)}</p>
                    <p className="text-[11px] text-foreground-500">{fmtDate(p.requested_at || p.created_at)}</p>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      p.status === "completed" || p.status === "approved"
                        ? "bg-primary-100 text-primary-700"
                        : p.status === "rejected"
                          ? "bg-accent-100 text-accent-700"
                          : "bg-secondary-100 text-secondary-700"
                    }`}
                  >
                    {p.status || "pending"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
