import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "@/lib/router-compat";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase } from "@/lib/supabase";

interface TxnFull {
  id: string;
  user_id: string;
  reference: string;
  provider_reference: string;
  merchant_reference: string;
  amount: number;
  fee_amount: number;
  net_amount: number;
  currency: string;
  status: string;
  type: string;
  payment_method: string;
  customer_phone: string;
  customer_name: string;
  description: string;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  completed_at: string;
  profiles: { full_name: string; email: string } | null;
}

interface JulyPayRaw {
  internal_id: number;
  event_id: string;
  event_type: string;
  event_created: number;
  event_data: Record<string, any> | null;
  raw_payload: Record<string, any> | null;
  processed: boolean;
  created_at: string;
}

interface PayoutRequest {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  recipient_phone: string;
  provider_reference: string;
  created_at: string;
  completed_at: string;
}

function formatCurrency(amount: number | null | undefined, currency: string): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" });
}

function formatUnix(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" });
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: "bg-primary-100 text-primary-700",
    completed: "bg-primary-100 text-primary-700",
    failed: "bg-accent-100 text-accent-700",
    pending: "bg-secondary-100 text-secondary-700",
    processing: "bg-secondary-100 text-secondary-700",
    pending_admin_review: "bg-accent-100 text-accent-700",
  };
  return (
    <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${colors[status] || "bg-background-200 text-foreground-600"}`}>
      {status}
    </span>
  );
}

function JsonBlock({ data, label }: { data: Record<string, any> | null; label: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-medium text-foreground-600 hover:text-foreground-900 transition-colors cursor-pointer"
      >
        <div className="w-4 h-4 flex items-center justify-center">
          <i className={expanded ? "ri-arrow-down-s-line text-sm" : "ri-arrow-right-s-line text-sm"} />
        </div>
        {label} ({Object.keys(data).length} fields)
      </button>
      {expanded && (
        <div className="mt-2 bg-background-100 rounded-lg border border-background-200/70 p-3 overflow-x-auto">
          <pre className="text-xs text-foreground-700 font-mono whitespace-pre-wrap break-all">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default function AdminTransactionLookup() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState<TxnFull[]>([]);
  const [selectedTxn, setSelectedTxn] = useState<TxnFull | null>(null);
  const [julypayEntries, setJulypayEntries] = useState<JulyPayRaw[]>([]);
  const [payoutInfo, setPayoutInfo] = useState<PayoutRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError("");
    setSearched(true);
    setSelectedTxn(null);
    setJulypayEntries([]);
    setPayoutInfo(null);

    try {
      const { data, error: fetchErr } = await supabase
        .from("transactions")
        .select("*, profiles!transactions_user_id_fkey(full_name, email)")
        .or(
          `reference.ilike.%${searchQuery}%,provider_reference.ilike.%${searchQuery}%,merchant_reference.ilike.%${searchQuery}%`
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (fetchErr) throw fetchErr;

      const direct = (data as TxnFull[]) || [];

      // Also search in metadata.external_reference
      const { data: metaData, error: metaErr } = await supabase
        .from("transactions")
        .select("*, profiles!transactions_user_id_fkey(full_name, email)")
        .filter("metadata->>external_reference", "ilike", `%${searchQuery}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (metaErr) throw metaErr;

      const meta = (metaData as TxnFull[]) || [];

      // Merge and deduplicate by id
      const seen = new Set<string>();
      const merged: TxnFull[] = [];
      for (const t of [...direct, ...meta]) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          merged.push(t);
        }
      }

      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setResults(merged);
    } catch (err: any) {
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialQ = searchParams.get("q");
    if (initialQ) {
      setQuery(initialQ);
      performSearch(initialQ);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(query ? { q: query } : {});
    performSearch(query);
  };

  const openDetail = async (txn: TxnFull) => {
    setSelectedTxn(txn);
    setDetailLoading(true);
    setJulypayEntries([]);
    setPayoutInfo(null);

    try {
      // Fetch related julypay_raw entries
      const jpRefs: string[] = [];
      if (txn.provider_reference) jpRefs.push(txn.provider_reference);
      if (txn.metadata?.external_reference) jpRefs.push(txn.metadata.external_reference);
      if (txn.reference) jpRefs.push(txn.reference);

      if (jpRefs.length > 0) {
        const jpFilters = jpRefs.map((_, i) => `event_data->>'reference'.ilike.%${jpRefs[i]}%`).join(",");
        const { data: jpData } = await supabase
          .from("julypay_raw")
          .select("*")
          .or(jpFilters)
          .order("created_at", { ascending: false })
          .limit(10);

        setJulypayEntries((jpData as JulyPayRaw[]) || []);
      }

      // Fetch related payout request
      if (txn.type === "payout" || txn.metadata?.payout_request_id) {
        const payoutId = txn.metadata?.payout_request_id;
        const lookupRef = payoutId || txn.provider_reference || txn.reference;

        const { data: prData } = await supabase
          .from("payout_requests")
          .select("*")
          .or(`id.eq.${lookupRef},provider_reference.ilike.%${txn.provider_reference || ""}%`)
          .limit(1)
          .maybeSingle();

        setPayoutInfo((prData as PayoutRequest) || null);
      }
    } catch {
      // silently fail for related data
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-900">Transaction Lookup</h1>
          <p className="text-sm text-foreground-600 mt-1">Search by any reference ID — gateway reference, payout reference, or internal ObPay reference</p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex items-center bg-background-50 rounded-lg px-4 py-3 border border-background-200/70 flex-1 max-w-2xl">
            <i className="ri-search-line text-foreground-400 text-base mr-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Paste any reference ID — e.g. INV_123, a gateway platform reference, or our COL/PAY reference..."
              className="bg-transparent text-sm text-foreground-700 placeholder-foreground-400 focus:outline-none w-full"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setResults([]); setSearched(false); setSearchParams({}); }}
                className="ml-2 text-foreground-400 hover:text-foreground-700 cursor-pointer"
              >
                <i className="ri-close-line" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-background-50 font-medium px-6 py-3 rounded-lg text-sm cursor-pointer whitespace-nowrap transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <i className="ri-loader-4-line animate-spin" /> Searching...
              </span>
            ) : (
              "Search"
            )}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-accent-100 border border-accent-200 rounded-lg px-4 py-3 flex items-start gap-3">
            <i className="ri-error-warning-line text-accent-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-accent-800">Search failed</p>
              <p className="text-xs text-accent-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {searched && !loading && (
          <div>
            <p className="text-sm text-foreground-600 mb-4">
              {results.length === 0 ? "No transactions found" : `Found ${results.length} transaction${results.length > 1 ? "s" : ""}`}
            </p>

            {results.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Results List */}
                <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
                  {results.map((txn) => (
                    <button
                      key={txn.id}
                      onClick={() => openDetail(txn)}
                      className={`w-full text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                        selectedTxn?.id === txn.id
                          ? "border-accent-300 bg-accent-50"
                          : "border-background-200/70 bg-background-50 hover:bg-background-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <StatusBadge status={txn.status} />
                        <span className="text-[11px] text-foreground-500 capitalize">{txn.type}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground-900 truncate">
                        {formatCurrency(txn.amount, txn.currency)}
                      </p>
                      <code className="text-[11px] text-foreground-500 mt-1 block truncate">
                        {txn.provider_reference || txn.reference}
                      </code>
                      <p className="text-[11px] text-foreground-400 mt-1">
                        {txn.profiles?.full_name || "Unknown"} · {new Date(txn.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Detail Panel */}
                <div className="lg:col-span-2">
                  {!selectedTxn ? (
                    <div className="bg-background-50 rounded-xl border border-background-200/70 text-center py-20">
                      <div className="w-16 h-16 rounded-full bg-background-200/70 flex items-center justify-center mx-auto mb-4">
                        <i className="ri-search-line text-foreground-400 text-2xl" />
                      </div>
                      <p className="text-sm text-foreground-600">Select a transaction to view full details</p>
                    </div>
                  ) : detailLoading ? (
                    <div className="bg-background-50 rounded-xl border border-background-200/70 text-center py-20">
                      <i className="ri-loader-4-line animate-spin text-2xl text-accent-500" />
                      <p className="text-sm text-foreground-500 mt-3">Loading details...</p>
                    </div>
                  ) : (
                    <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
                      {/* Header */}
                      <div className="p-5 border-b border-background-200/70 flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <StatusBadge status={selectedTxn.status} />
                            <span className="text-xs text-foreground-500 capitalize bg-background-100 px-2 py-0.5 rounded">{selectedTxn.type}</span>
                            <span className="text-xs text-foreground-500">{selectedTxn.payment_method || ""}</span>
                          </div>
                          <p className="font-heading font-bold text-xl text-foreground-900 mt-1">
                            {formatCurrency(selectedTxn.amount, selectedTxn.currency)}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedTxn(null)}
                          className="text-foreground-400 hover:text-foreground-700 cursor-pointer"
                        >
                          <i className="ri-close-line text-lg" />
                        </button>
                      </div>

                      {/* Detail Grid */}
                      <div className="p-5 space-y-5">
                        {/* Identifiers */}
                        <div>
                          <p className="text-xs font-medium text-foreground-500 uppercase mb-3">Identifiers</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <DetailField label="Database ID" value={selectedTxn.id} mono />
                            <DetailField label="Internal Reference" value={selectedTxn.reference} mono />
                            <DetailField label="Gateway Reference" value={selectedTxn.provider_reference || selectedTxn.merchant_reference || "—"} mono />
                            <DetailField label="LP Internal Ref" value={(selectedTxn.metadata as any)?.lp_internal_ref || selectedTxn.merchant_reference || "—"} mono />
                          </div>
                        </div>

                        {/* Amounts */}
                        <div>
                          <p className="text-xs font-medium text-foreground-500 uppercase mb-3">Amounts</p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <DetailField label="Amount" value={formatCurrency(selectedTxn.amount, selectedTxn.currency)} />
                            <DetailField label="Fee" value={formatCurrency(selectedTxn.fee_amount, selectedTxn.currency)} />
                            <DetailField label="Net Amount" value={formatCurrency(selectedTxn.net_amount, selectedTxn.currency)} />
                          </div>
                        </div>

                        {/* Customer */}
                        {(selectedTxn.customer_name || selectedTxn.customer_phone) && (
                          <div>
                            <p className="text-xs font-medium text-foreground-500 uppercase mb-3">Customer</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <DetailField label="Name" value={selectedTxn.customer_name || "—"} />
                              <DetailField label="Phone" value={selectedTxn.customer_phone || "—"} mono />
                            </div>
                          </div>
                        )}

                        {/* Merchant */}
                        <div>
                          <p className="text-xs font-medium text-foreground-500 uppercase mb-3">Merchant</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <DetailField label="Name" value={selectedTxn.profiles?.full_name || "Unknown"} />
                            <DetailField label="Email" value={selectedTxn.profiles?.email || "—"} />
                            <DetailField label="User ID" value={selectedTxn.user_id || "—"} mono />
                          </div>
                        </div>

                        {/* Description */}
                        {selectedTxn.description && (
                          <div>
                            <p className="text-xs font-medium text-foreground-500 uppercase mb-3">Description</p>
                            <p className="text-sm text-foreground-700">{selectedTxn.description}</p>
                          </div>
                        )}

                        {/* Timing */}
                        <div>
                          <p className="text-xs font-medium text-foreground-500 uppercase mb-3">Timing</p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <DetailField label="Created" value={formatDate(selectedTxn.created_at)} />
                            <DetailField label="Updated" value={formatDate(selectedTxn.updated_at)} />
                            <DetailField label="Completed" value={formatDate(selectedTxn.completed_at)} />
                          </div>
                        </div>

                        {/* Metadata */}
                        <JsonBlock data={selectedTxn.metadata} label="Metadata" />

                        {/* Payout Info */}
                        {payoutInfo && (
                          <div>
                            <p className="text-xs font-medium text-foreground-500 uppercase mb-3">Related Payout Request</p>
                            <div className="bg-background-100 rounded-lg border border-background-200/70 p-3 space-y-2">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <DetailField label="Payout ID" value={payoutInfo.id} mono />
                                <DetailField label="Amount" value={formatCurrency(payoutInfo.amount, payoutInfo.currency || "UGX")} />
                                <DetailField label="Status" value={payoutInfo.status} />
                                <DetailField label="Recipient" value={payoutInfo.recipient_phone || "—"} mono />
                                <DetailField label="Provider Ref" value={payoutInfo.provider_reference || "—"} mono />
                                <DetailField label="Created" value={formatDate(payoutInfo.created_at)} />
                                <DetailField label="Completed" value={formatDate(payoutInfo.completed_at)} />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Webhook Events */}
                        {julypayEntries.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-foreground-500 uppercase mb-3">Gateway Notifications ({julypayEntries.length})</p>
                            <div className="space-y-3">
                              {julypayEntries.map((entry) => (
                                <div key={entry.internal_id} className="bg-background-100 rounded-lg border border-background-200/70 p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full ${entry.processed ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-700"}`}>
                                      {entry.processed ? "Processed" : "Unprocessed"}
                                    </span>
                                    <span className="text-[11px] font-medium text-foreground-600">{entry.event_type}</span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                                    <DetailField label="Event ID" value={entry.event_id || "—"} mono />
                                    <DetailField label="Event Time" value={formatUnix(entry.event_created)} />
                                    <DetailField label="Captured" value={formatDate(entry.created_at)} />
                                  </div>
                                  {entry.event_data && (
                                    <div className="mt-2">
                                      <button
                                        onClick={() => {
                                          const el = document.getElementById(`jp-raw-${entry.internal_id}`);
                                          if (el) el.classList.toggle("hidden");
                                        }}
                                        className="text-[11px] text-accent-600 hover:text-accent-700 cursor-pointer"
                                      >
                                        Toggle event data
                                      </button>
                                      <pre id={`jp-raw-${entry.internal_id}`} className="hidden mt-2 text-[11px] text-foreground-600 font-mono whitespace-pre-wrap break-all bg-background-200/70 p-2 rounded">
                                        {JSON.stringify(entry.event_data, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No search yet */}
        {!searched && !loading && (
          <div className="bg-background-50 rounded-xl border border-background-200/70 text-center py-16">
            <div className="w-20 h-20 rounded-full bg-background-200/70 flex items-center justify-center mx-auto mb-5">
              <i className="ri-search-line text-foreground-400 text-3xl" />
            </div>
            <h3 className="font-heading font-semibold text-lg text-foreground-900 mb-2">Transaction Lookup</h3>
            <p className="text-sm text-foreground-600 max-w-md mx-auto">
              Paste any reference ID — gateway reference, payout reference, or our internal COL/PAY reference — to find all matching transactions and view full details including gateway notifications.
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-foreground-500 mb-0.5">{label}</p>
      <p className={`text-xs text-foreground-800 truncate ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </p>
    </div>
  );
}