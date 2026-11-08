import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeObpay } from "@/lib/edge-function";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function BankAccounts() {
  const [banks, setBanks] = useState<{name: string; code: string}[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [bank, setBank] = useState("");
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    const { data, error } = await supabase.from("merchant_bank_accounts").select("id,bank_name,account_number,account_name").order("created_at", { ascending: false });
    if (error) setMessage("Your saved bank accounts could not be loaded."); else setAccounts(data || []);
  }
  useEffect(() => { void load(); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const check = await invokeObpay({ action: "bank-validate", bankName: bank, accountNumber: number.trim() });
      if (!check.success || check.data?.valid !== true || !check.data?.account_name) throw new Error(check.error || "The bank account could not be verified.");
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in again.");
      const { data, error } = await supabase.from("merchant_bank_accounts").insert({ merchant_id: auth.user.id, bank_name: bank, account_number: number, account_name: check.data.account_name }).select("id").single();
      if (error || !data) throw new Error("The bank account could not be saved; it may already be listed.");
      setBank(""); setNumber(""); await load(); setMessage("Bank account verified and saved.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Bank account could not be saved."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    const { data, error } = await supabase.from("merchant_bank_accounts").delete().eq("id", id).select("id");
    if (error || !data?.length) setMessage("The bank account could not be removed."); else await load();
  }
  return <section className="border-y border-border py-6 space-y-4">
    <h3 className="font-semibold">Receiving bank accounts</h3>
    <p className="text-sm text-muted-foreground">The bank connection is established; collections and disbursements await the network’s bank integration contract. Existing saved details are retained; adding or verifying accounts is currently unavailable.</p>
    {accounts.map(a => <div key={a.id} className="flex items-center justify-between gap-3 border-b border-border pb-3"><div><p className="font-medium">{a.bank_name}</p><p className="text-sm text-muted-foreground">{a.account_name} · ending {a.account_number.slice(-4)}</p></div><Button variant="outline" onClick={() => remove(a.id)}>Remove</Button></div>)}
    <form onSubmit={save} className="hidden">
      <div><label htmlFor="receiving-bank" className="text-sm">Bank</label><select id="receiving-bank" required value={bank} onChange={e => setBank(e.target.value)} className="w-full border border-border rounded-md bg-background p-2"><option value="">Select bank</option>{banks.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}</select></div>
      <div><label htmlFor="receiving-account" className="text-sm">Account number (UGX)</label><Input id="receiving-account" required inputMode="numeric" pattern="[0-9]{5,30}" value={number} onChange={e => setNumber(e.target.value.replace(/\D/g, ""))}/></div>
      <Button disabled={busy || !bank}>{busy ? "Verifying…" : "Verify and add bank account"}</Button>
    </form>{message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}