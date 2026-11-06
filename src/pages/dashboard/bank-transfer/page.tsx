import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { invokeObpay } from "@/lib/edge-function";
import { Button } from "@/components/ui/button";
import { bankFee } from "@/lib/secondary-service-rules";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@/lib/router-compat";

interface Bank {
  code: string;
  name: string;
}

export default function BankTransferPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ bankName: "", accountNumber: "", accountName: "", customerEmail: "", customerPhone: "", amount: "", description: "" });
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [reference, setReference] = useState("");
  const [available, setAvailable] = useState(false);
  const [lookupRef, setLookupRef] = useState("");
  const [lookup, setLookup] = useState<any>(null);
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, s] = await Promise.all([
      invokeObpay({ action: "bank-banks" }),
      invokeObpay({ action: "bank-services" }),
    ]);
    if (b?.success) setBanks(b.data?.banks || []);
    if (s?.success) { setSettings(s.data?.bank_transfer_settings || null); setAvailable(s.data?.bank_transfer_available === true); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    void supabase.from("merchant_bank_accounts").select("id,bank_name,account_number,account_name").then(({ data }) => setSavedAccounts(data || []));
  }, [load]);

  const amount = Number(form.amount || 0);
  const charge = bankFee(settings, amount);

  async function validate() {
    setValidating(true);
    setValidated(null);
    const res = await invokeObpay({ action: "bank-validate", bankCode: form.bankName, accountNumber: form.accountNumber });
    setValidating(false);
    if (res?.success && res.data?.valid === true) {
      const name = res.data?.account_name || res.data?.account?.account_name || res.data?.name || "";
      setValidated(name || "Account verified");
      if (name) setForm((f) => ({ ...f, accountName: name }));
    } else {
      setResult({ ok: false, message: res?.error || "Account validation failed." });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validated || charge == null) return;
    const requestReference = reference || crypto.randomUUID();
    setReference(requestReference);
    setSubmitting(true);
    setResult(null);
    const res = await invokeObpay({ action: "bank-transfer", ...form, reference: requestReference, confirmedName: validated, expectedFee: charge, amount });
    setSubmitting(false);
    if (res?.success) {
      setResult({ ok: true, message: `Transfer submitted. Reference ${res.data.reference}. Charge ${res.data.fee?.toLocaleString()} UGX.` });
      setForm({ bankName: "", accountNumber: "", accountName: "", customerEmail: "", customerPhone: "", amount: "", description: "" });
      setValidated(null);
      setReference("");
    } else {
      setResult({ ok: false, message: res?.error || "The transfer failed." });
    }
  }

  async function checkStatus() {
    const res = await invokeObpay({ action: "bank-status", reference: lookupRef });
    setLookup(res?.success ? res.data : { error: res?.error });
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bank Transfer</h1>
          <p className="text-sm text-muted-foreground">Push funds from your ObPay wallet straight to a Ugandan bank account.</p>
        </div>

        {settings && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Minimum", `${Number(settings.minimum_transfer_amount || 0).toLocaleString()} UGX`],
              ["Maximum", `${Number(settings.maximum_transfer_amount || 0).toLocaleString()} UGX`],
              ["Charge type", settings.amount_type],
              ["Charge", (settings.amount_type || "").toLowerCase() === "percentage" ? `${settings.charge_percentage}%` : `${Number(settings.fixed_transfer_charge || 0).toLocaleString()} UGX`],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="text-sm font-semibold text-foreground break-words">{String(v)}</p>
              </div>
            ))}
          </div>
        )}

        {!loading && !available && <p role="alert" className="text-sm text-destructive">Bank transfers are currently unavailable for this account.</p>}
        <form onSubmit={submit} className="border-y border-border py-5 space-y-4">
          <div>
            <label htmlFor="saved-bank-account" className="block text-sm mb-1">Saved receiving account</label>
            <select id="saved-bank-account" className="w-full rounded-md border border-border bg-background p-2.5 text-sm" disabled={!!reference} defaultValue="" onChange={e => {
              const account = savedAccounts.find(a => a.id === e.target.value);
              if (account) { setForm(f => ({ ...f, bankName: account.bank_name, accountNumber: account.account_number, accountName: account.account_name })); setValidated(null); }
            }}><option value="">Enter recipient details below</option>{savedAccounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} · {a.account_name} · ending {a.account_number.slice(-4)}</option>)}</select>
            <Link to="/dashboard/settings" className="text-sm text-primary underline">Manage receiving bank accounts</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 text-foreground">Bank</label>
              <select
                required
                value={form.bankName}
                disabled={!!reference}
                onChange={(e) => { setForm({ ...form, bankName: e.target.value }); setValidated(null); }}
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
              >
                <option value="">{loading ? "Loading banks…" : "Select bank"}</option>
                {banks.map((b) => (
                  <option key={b.code} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 text-foreground">Account number</label>
              <div className="flex gap-2">
                <input
                  required
                  value={form.accountNumber}
                  disabled={!!reference}
                  onChange={(e) => { setForm({ ...form, accountNumber: e.target.value }); setValidated(null); }}
                  className="flex-1 min-w-0 rounded-lg border border-border bg-background p-2.5 text-sm"
                  placeholder="60001256421"
                />
                <Button
                  type="button"
                  onClick={validate}
                  disabled={!form.bankName || !form.accountNumber || validating}
                  className="shrink-0 rounded-lg bg-secondary px-3 text-sm text-secondary-foreground disabled:opacity-50"
                >
                  {validating ? "…" : "Verify"}
                </Button>
              </div>
              {validated && <p className="mt-1 text-xs text-primary">{validated}</p>}
            </div>
            <div>
              <label className="block text-sm mb-1 text-foreground">Account name</label>
              <input
                readOnly
                required
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-foreground">Recipient email (optional)</label>
              <input
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-foreground">Amount (UGX)</label>
              <input
                required
                type="number"
                min={1}
                step={1}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
              />
              {amount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {charge == null ? "The exact network fee is not available yet. Transfers remain disabled until it is confirmed." : `Charge ${charge.toLocaleString()} UGX · total ${(amount + charge).toLocaleString()} UGX · recipient gets ${amount.toLocaleString()} UGX`}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm mb-1 text-foreground">Description</label>
              <input
                required
                maxLength={500}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
              />
            </div>
          </div>

          {result && (
            <div className={`rounded-lg p-3 text-sm ${result.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              {result.message}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || !available || !validated || charge == null || !!reference}
            className="w-full sm:w-auto rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send transfer"}
          </Button>
        </form>

        <div className="border-t border-border py-5 space-y-3">
          <h2 className="font-semibold text-foreground">Check a transfer</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={lookupRef}
              onChange={(e) => setLookupRef(e.target.value)}
              placeholder="Transfer reference"
              className="flex-1 rounded-lg border border-border bg-background p-2.5 text-sm"
            />
            <Button onClick={checkStatus} className="rounded-lg bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
              Check
            </Button>
          </div>
          {lookup && (
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs text-foreground">{JSON.stringify(lookup, null, 2)}</pre>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
