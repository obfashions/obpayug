import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { marzBank } from "@/lib/bank-services.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Clock } from "lucide-react";

const sel = "w-full h-10 rounded-md border border-input bg-background px-3 text-sm";

/**
 * Dormant bank receiving: the merchant fills in their bank account and the
 * account is genuinely verified with the bank, but "Receive payment" only
 * announces the upcoming feature — no request is submitted and no money moves.
 */
export default function BankReceive() {
  const call = useServerFn(marzBank);
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [verifiedName, setVerifiedName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [comingNext, setComingNext] = useState(false);

  useEffect(() => {
    void call({ data: { action: "bank-banks", body: {} } }).then((r: any) => r.success && setBanks(r.data.banks));
  }, []);

  const resetVerification = () => { setVerifiedName(""); setComingNext(false); setMsg(null); };

  async function verify() {
    setMsg(null); setVerifiedName(""); setComingNext(false); setBusy(true);
    try {
      const r: any = await call({ data: { action: "bank-validate", body: { bankName, accountNumber } } });
      if (r.success) setVerifiedName(r.data.account_name);
      else setMsg({ ok: false, text: r.error });
    } finally { setBusy(false); }
  }

  function receive(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!verifiedName) { setMsg({ ok: false, text: "Verify the account with the bank first." }); return; }
    // Dormant by design: no server call, no record, no balance change.
    setComingNext(true);
  }

  return <form onSubmit={receive} className="space-y-4 py-5 max-w-xl">
    <div className="flex items-center gap-3"><Building2 className="text-primary shrink-0" size={24}/><div>
      <h2 className="font-semibold">Receive bank payments</h2>
      <p className="text-sm text-muted-foreground mt-1">Register the bank account you want customers to pay into. Bank receiving is launching next.</p>
    </div></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="br-bank">Bank</Label><select id="br-bank" className={sel} value={bankName} onChange={(e) => { setBankName(e.target.value); resetVerification(); }} required><option value="">Choose a bank</option>{banks.map((b) => <option key={b.code} value={b.name}>{b.name}</option>)}</select></div>
      <div className="space-y-1.5"><Label htmlFor="br-num">Account number</Label><Input id="br-num" inputMode="numeric" value={accountNumber} onChange={(e) => { setAccountNumber(e.target.value); resetVerification(); }} required /></div>
    </div>
    <Button type="button" variant="outline" disabled={busy || !bankName || !accountNumber} onClick={verify}>{busy ? "Checking…" : "Verify account"}</Button>
    {verifiedName && <p className="text-sm">Registered name: <span className="font-semibold">{verifiedName}</span></p>}
    {comingNext && verifiedName && <div role="status" className="rounded-md border border-border p-4 space-y-1.5">
      <p className="text-sm font-semibold flex items-center gap-2"><Clock size={16} className="text-primary"/>Coming next</p>
      <p className="text-sm text-muted-foreground">Your account at {bankName} ({verifiedName}) is verified and ready. Bank receiving will be switched on here soon — you will be able to share bank payment details and see incoming payments credited to your wallet. No request has been submitted and no money has moved.</p>
    </div>}
    {msg && <p role="status" className={`text-sm ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
    <Button type="submit" disabled={busy || !verifiedName}>Receive payment</Button>
  </form>;
}
