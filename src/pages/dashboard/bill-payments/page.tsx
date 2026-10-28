import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { invokeObpay } from "@/lib/edge-function";
import { Button } from "@/components/ui/button";

interface Utility {
  code: string;
  name: string;
  description?: string;
  required_fields?: string[];
}

export default function BillPaymentsPage({ initialUtility = "" }: { initialUtility?: string }) {
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [charge, setCharge] = useState(0);
  const [areas, setAreas] = useState<string[]>([]);
  const [bouquets, setBouquets] = useState<string[]>([]);
  const [form, setForm] = useState({
    utilityCode: initialUtility,
    meterNumber: "",
    area: "",
    bouquetCode: "",
    phoneNumber: "",
    amount: "",
    customerName: "",
    email: "",
  });
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [reference, setReference] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [packageDetails, setPackageDetails] = useState<any[]>([]);

  const load = useCallback(async () => {
    const res = await invokeObpay({ action: "bill-services" });
    if (res?.success) {
      setUtilities(res.data?.available_utilities || []);
      setCharge(Number(res.data?.bill_payment_settings?.charge_amount?.raw || 0));
      setLoaded(true);
    }
    else setResult({ ok: false, message: res?.error || "Bill service unavailable." });
  }, []);

  useEffect(() => {
    setReference(crypto.randomUUID());
    load();
  }, [load]);

  useEffect(() => {
    const code = form.utilityCode.toUpperCase();
    setVerified(null);
    if (code === "NWSC") {
      invokeObpay({ action: "bill-areas" }).then((r) => setAreas(r?.success ? r.data?.areas || [] : []));
    }
    if (code === "DSTV" || code === "GOTV") {
      invokeObpay({ action: "bill-bouquets", utilityCode: code }).then((r) =>
        { setBouquets(r?.success ? r.data?.bouquet_codes || [] : []); setPackageDetails(r?.success ? r.data?.bouquet_details || [] : []); },
      );
    }
  }, [form.utilityCode]);

  async function verify() {
    setVerifying(true);
    setVerified(null);
    const res = await invokeObpay({
      action: "bill-verify",
      utilityCode: form.utilityCode,
      meterNumber: form.meterNumber,
      ...(form.area ? { area: form.area } : {}),
    });
    setVerifying(false);
    if (res?.success) setVerified(res.data);
    else setResult({ ok: false, message: res?.error || "Verification failed." });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const res = await invokeObpay({ action: "bill-pay", ...form, reference, expectedFee: charge, amount: Number(form.amount || 0) });
    setSubmitting(false);
    if (res?.success) {
      setResult({ ok: true, message: `${res.data.status === "success" ? "Bill paid" : res.data.status === "failed" ? "Payment failed and refunded" : "Awaiting confirmation"}. Reference ${res.data.reference}.` });
      setReference(crypto.randomUUID());
      setForm({ ...form, meterNumber: "", amount: "", bouquetCode: "" });
      setVerified(null);
    } else {
      setResult({ ok: false, message: res?.error || "The bill payment failed." });
    }
  }

  const code = form.utilityCode.toUpperCase();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bill Payments</h1>
          <p className="text-sm text-muted-foreground">
            Pay electricity (LIGHT/UMEME), water (NWSC) and TV (DSTV, GOTV) bills from your wallet.
            {charge > 0 && ` A ${charge.toLocaleString()} UGX service charge applies.`}
          </p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 text-foreground">Utility</label>
              <select
                required
                value={form.utilityCode}
                onChange={(e) => setForm({ ...form, utilityCode: e.target.value, area: "", bouquetCode: "" })}
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
              >
                <option value="">Select utility</option>
                {utilities.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 text-foreground">{code === "DSTV" || code === "GOTV" ? "Smartcard number" : "Meter number"}</label>
              <div className="flex gap-2">
                <input
                  required
                  value={form.meterNumber}
                  onChange={(e) => setForm({ ...form, meterNumber: e.target.value })}
                  className="flex-1 min-w-0 rounded-lg border border-border bg-background p-2.5 text-sm"
                />
                <Button
                  type="button"
                  onClick={verify}
                  disabled={!form.utilityCode || !form.meterNumber || verifying}
                  className="shrink-0 rounded-lg bg-secondary px-3 text-sm text-secondary-foreground disabled:opacity-50"
                >
                  {verifying ? "…" : "Verify"}
                </Button>
              </div>
            </div>

            {code === "NWSC" && (
              <div>
                <label className="block text-sm mb-1 text-foreground">Area</label>
                <select
                  required
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
                >
                  <option value="">Select area</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(code === "DSTV" || code === "GOTV") && (
              <div>
                <label className="block text-sm mb-1 text-foreground">Bouquet code</label>
                <select
                  required
                  value={form.bouquetCode}
                  onChange={(e) => { const p = packageDetails.find(p => p.code === e.target.value); setForm({ ...form, bouquetCode: e.target.value, amount: p ? String(p.price) : "" }); }}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
                >
                  <option value="">Select bouquet</option>
                  {bouquets.map((c) => (
                    <option key={c} value={c}>
                      {packageDetails.find(p => p.code === c)?.name || c} {packageDetails.find(p => p.code === c)?.price ? `— ${Number(packageDetails.find(p => p.code === c)?.price).toLocaleString()} UGX` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">The amount must match the bouquet price exactly.</p>
              </div>
            )}

            <div>
              <label className="block text-sm mb-1 text-foreground">Phone number</label>
              <input
                required
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                placeholder="0771234567"
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-foreground">Amount (UGX)</label>
              <input
                required
                type="number"
                min={1000}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-foreground">Customer name (optional)</label>
              <input
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-foreground">Email (optional)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
              />
            </div>
          </div>

          {verified && (
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs text-foreground">{JSON.stringify(verified, null, 2)}</pre>
          )}

          {result && (
            <div className={`rounded-lg p-3 text-sm ${result.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
              {result.message}
            </div>
          )}

          <p className="text-sm text-muted-foreground">Total wallet debit: {(Number(form.amount || 0) + charge).toLocaleString()} UGX · Service fee: {charge.toLocaleString()} UGX</p>
          <Button
            type="submit"
            disabled={submitting || !loaded || !reference}
            className="w-full sm:w-auto rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Paying…" : "Pay bill"}
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
