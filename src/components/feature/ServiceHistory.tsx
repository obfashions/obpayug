import { useCallback, useEffect, useState } from "react";
import { invokeObpay } from "@/lib/edge-function";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function ServiceHistory() {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    const r = await invokeObpay({ action: "service-history" });
    if (r.success) { setRows(r.data.purchases); setError(""); } else setError(r.error);
    setBusy(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Service history</h2><Button variant="outline" size="icon" disabled={busy} onClick={load} aria-label="Refresh service history" title="Refresh service history"><RefreshCw className={busy ? "animate-spin" : ""} size={16}/></Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!busy && !rows.length && !error && <p className="text-muted-foreground text-sm">No service payments yet.</p>}
    <div className="space-y-3">{rows.map((r) => <article key={r.reference} className="border border-border rounded-lg p-4 space-y-2">
      <div className="flex justify-between gap-3"><h3 className="font-medium">{r.description}</h3><span className="text-sm text-muted-foreground">{r.status === "success" ? "Completed" : r.status === "pending" ? "Awaiting confirmation" : "Failed · refunded"}</span></div>
      <p className="text-sm">{r.amount.toLocaleString()} UGX · Fee {r.fee.toLocaleString()} UGX</p>
      <p className="break-all font-mono text-xs text-muted-foreground">{r.reference}</p>
      {r.balance_before != null && <p className="text-xs text-muted-foreground">Balance {Number(r.balance_before).toLocaleString()} → {Number(r.balance_after).toLocaleString()} UGX</p>}
    </article>)}</div>
  </section>;
}