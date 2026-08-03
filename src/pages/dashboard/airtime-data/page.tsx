import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { invokeObpay } from "@/lib/edge-function";

interface Bundle {
  product_id: string;
  name: string;
  price: number;
  validity?: string;
}

export default function AirtimeDataPage() {
  const [catalog, setCatalog] = useState<any>(null);
  const [mode, setMode] = useState<"airtime" | "bundle">("airtime");
  const [msisdn, setMsisdn] = useState("");
  const [amount, setAmount] = useState("");
  const [network, setNetwork] = useState<string>("");
  const [bundleId, setBundleId] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const load = useCallback(async () => {
    const [cat, list] = await Promise.all([
      invokeObpay({ action: "airtime-catalog" }),
      invokeObpay({ action: "airtime-list" }),
    ]);
    if (cat?.success) setCatalog(cat.data);
    if (list?.success) setHistory(list.data?.purchases || list.data?.data || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function detect() {
    if (!msisdn) return;
    setDetecting(true);
    const res = await invokeObpay({ action: "airtime-detect", msisdn });
    setDetecting(false);
    if (res?.success) setNetwork(String(res.data?.network || res.data?.detected_network || "").toUpperCase());
  }

  const key = network.toLowerCase();
  const groups: { label: string; items: Bundle[] }[] =
    catalog && key && catalog[key]?.bundles
      ? Object.values(catalog[key].bundles).map((g: any) => ({ label: g.label, items: g.items || [] }))
      : [];
  const allBundles = groups.flatMap((g) => g.items);
  const selected = allBundles.find((x) => x.product_id === bundleId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const res = await invokeObpay({
      action: "airtime-purchase",
      purchaseType: mode,
      msisdn,
      amount: Number(amount || 0),
      bundleId,
      bundlePrice: selected?.price || 0,
    });
    setSubmitting(false);
    if (res?.success) {
      setResult({ ok: true, message: `Purchase submitted. Reference ${res.data.reference}.` });
      setAmount("");
      setBundleId("");
      load();
    } else {
      setResult({ ok: false, message: res?.error || "The purchase failed." });
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Airtime &amp; Data</h1>
          <p className="text-sm text-muted-foreground">Buy MTN, Airtel and Lyca airtime or data bundles straight from your wallet.</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex gap-2">
            {(["airtime", "bundle"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === m ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
              >
                {m === "airtime" ? "Airtime" : "Data bundle"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 text-foreground">Phone number</label>
              <div className="flex gap-2">
                <input
                  required
                  value={msisdn}
                  onChange={(e) => setMsisdn(e.target.value)}
                  onBlur={detect}
                  placeholder="0771234567"
                  className="flex-1 min-w-0 rounded-lg border border-border bg-background p-2.5 text-sm"
                />
                <button type="button" onClick={detect} className="shrink-0 rounded-lg bg-secondary px-3 text-sm text-secondary-foreground">
                  {detecting ? "…" : "Detect"}
                </button>
              </div>
              {network && <p className="mt-1 text-xs text-emerald-600">Network: {network}</p>}
            </div>

            {mode === "airtime" ? (
              <div>
                <label className="block text-sm mb-1 text-foreground">Amount (UGX)</label>
                <input
                  required
                  type="number"
                  min={500}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">Minimum 500 UGX.</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm mb-1 text-foreground">Bundle</label>
                <select
                  required
                  value={bundleId}
                  onChange={(e) => setBundleId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
                >
                  <option value="">{network ? "Select bundle" : "Detect the network first"}</option>
                  {groups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.items.map((it) => (
                        <option key={it.product_id} value={it.product_id}>
                          {it.name} — {Number(it.price).toLocaleString()} UGX
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {selected && <p className="mt-1 text-xs text-muted-foreground">Wallet charge: {Number(selected.price).toLocaleString()} UGX</p>}
              </div>
            )}
          </div>

          {result && (
            <div className={`rounded-lg p-3 text-sm ${result.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
              {result.message}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Processing…" : mode === "airtime" ? "Buy airtime" : "Buy bundle"}
          </button>
        </form>

        {history.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold text-foreground">Recent purchases</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2">Reference</th>
                    <th className="py-2">Number</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 10).map((h: any, i: number) => (
                    <tr key={h.reference || i} className="border-t border-border">
                      <td className="py-2 font-mono text-xs">{String(h.reference || "").slice(0, 12)}</td>
                      <td className="py-2">{h.msisdn}</td>
                      <td className="py-2">{Number(h.amount?.raw ?? h.amount ?? 0).toLocaleString()}</td>
                      <td className="py-2">{h.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
