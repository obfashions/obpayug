import { useEffect, useState } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { secondaryAdminCall } from "@/lib/secondary-services.functions";
import { getAccessToken } from "@/lib/session-token";

export default function AdminServicesPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) { setError("Please sign in again."); return; }
      const r = await secondaryAdminCall({ data: { accessToken } });
      if ("data" in r) { setData(r.data); setError(""); } else setError(r.error || "Connection unavailable.");
    } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  return <AdminLayout><div className="max-w-4xl space-y-6"><header className="flex justify-between gap-4"><div><h1 className="text-2xl font-semibold">Payment services</h1><p className="text-muted-foreground text-sm mt-2">Payza mobile money and hosted cards · Marz disabled for new operations.</p></div><Button variant="outline" size="icon" onClick={load} disabled={busy} aria-label="Check service connection" title="Check service connection"><RefreshCw size={16}/></Button></header>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {data && <><div className="divide-y divide-border">{data.services.map((s: any) => <div key={s.code} className="flex justify-between gap-3 py-4"><span>{s.name}</span><span className="text-muted-foreground text-sm">{s.status.replaceAll("_", " ")}</span></div>)}</div><p className="text-sm text-muted-foreground">{data.note}</p><p className="text-sm">Card collections retain existing fee rules and exemptions. Manage Payza credentials in Gateway API. Bank collection and disbursement await the next provider contract.</p></>}
  </div></AdminLayout>;
}