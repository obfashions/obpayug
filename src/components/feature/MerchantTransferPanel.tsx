import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRightLeft, CheckCircle2, Loader2, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { findTransferRecipient, listMerchantTransfers, sendMerchantTransfer, type TransferRecipient, type MerchantTransfer } from "@/lib/merchant-transfers.functions";
import { formatCurrency, formatDate } from "@/lib/currency";

export default function MerchantTransferPanel() {
  const { user } = useAuth();
  const { walletCurrencies, balances, activeCurrency, refreshBalances } = useCurrency();
  const find = useServerFn(findTransferRecipient);
  const send = useServerFn(sendMerchantTransfer);
  const list = useServerFn(listMerchantTransfers);
  const [open, setOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [recipient, setRecipient] = useState<TransferRecipient | null>(null);
  const [currency, setCurrency] = useState(activeCurrency);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const [receipt, setReceipt] = useState<MerchantTransfer | null>(null);
  const [history, setHistory] = useState<MerchantTransfer[]>([]);
  const [historyError, setHistoryError] = useState("");
  // Keep the same key on retries, including after a lost response. Never issue a new transfer implicitly.
  const [pending, setPending] = useState<{ requestId: string; recipientId: string; currency: string; amount: number; reason: string } | null>(null);
  const lookupVersion = useRef(0);
  const submitting = useRef(false);
  useEffect(() => {
    if (!user) return;
    list().then(setHistory).catch(() => setHistoryError("Transfer history could not be loaded."));
    const saved = sessionStorage.getItem(`obpay-transfer-${user.id}`);
    if (saved) {
      try { setPending(JSON.parse(saved)); } catch { sessionStorage.removeItem(`obpay-transfer-${user.id}`); }
    }
  }, [user, list]);

  const lookup = async () => {
    const version = ++lookupVersion.current;
    setBusy(true); setError(""); setRecipient(null);
    try {
      const result = await find({ data: { identifier } });
      if (version !== lookupVersion.current) return;
      setRecipient(result);
      const common = walletCurrencies.filter(c => result.currencies.includes(c));
      setCurrency(common.includes(activeCurrency) ? activeCurrency : common[0] || activeCurrency);
    } catch (e) { if (version === lookupVersion.current) setError(e instanceof Error ? e.message : "Recipient could not be checked."); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (submitting.current || (!recipient && !pending)) return;
    submitting.current = true; setBusy(true); setError("");
    const request = pending || { requestId: crypto.randomUUID(), recipientId: recipient?.id || "", currency, amount: Number(amount), reason: reason.trim() };
    setPending(request);
    if (user) sessionStorage.setItem(`obpay-transfer-${user.id}`, JSON.stringify(request));
    try {
      const result = await send({ data: request });
      setReceipt(result); setReview(false); setPending(null);
      if (user) sessionStorage.removeItem(`obpay-transfer-${user.id}`);
      await refreshBalances();
      try { setHistory(await list()); setHistoryError(""); } catch { setHistoryError("Transfer completed. History could not be refreshed yet."); }
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "The result could not be confirmed."} Retry this same transfer to check its result; do not create another payment.`);
    } finally { submitting.current = false; setBusy(false); }
  };
  const common = walletCurrencies.filter(c => recipient?.currencies.includes(c));
  const decimals = ["USD", "NGN"].includes(currency) ? 2 : 0;
  const validAmount = Number(amount)>0 && Number(amount) <= (balances[currency] || 0) && Number.isInteger(Number(amount) * 10 ** decimals);
  return (
    <section className="border-y border-background-200 py-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading font-semibold text-lg text-foreground-900 flex items-center gap-2"><ArrowRightLeft className="size-5 text-primary-600" />ObPay account transfers</h2>
        <Button variant="outline" onClick={() => { setOpen(true); setReceipt(null); setError(""); setReview(false); if (!pending) { setIdentifier(""); setRecipient(null); setAmount(""); setReason(""); } }}><ArrowRightLeft />Send to ObPay merchant</Button>
      </div>
      {historyError && <p role="alert" className="text-sm text-destructive">{historyError}</p>}
      {history.length>0 && <div className="divide-y divide-background-200">
        {history.slice(0,5).map(t => {
          const outgoing = t.sender_id===user?.id;
          return <div key={t.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
            <div className="min-w-0"><p className="font-medium text-foreground-900 break-words">{outgoing ? "To" : "From"} {outgoing ? t.recipient_name : t.sender_name}</p><p className="text-foreground-600 break-words">{t.reason}</p><p className="text-xs text-foreground-500">{formatDate(t.created_at)}</p></div>
            <span className="font-semibold text-foreground-900">{outgoing ? "−" : "+"}{formatCurrency(Number(t.amount),t.currency)}</span>
          </div>;
        })}
      </div>}
      <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-lg bg-background-50 text-foreground-900 border-background-200">
          <DialogHeader><DialogTitle className="pr-5 tracking-normal">Send to ObPay merchant</DialogTitle><DialogDescription>ObPay account transfer · No payment-network fee</DialogDescription></DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
          {receipt ? <div className="space-y-4">
            <CheckCircle2 className="size-9 text-primary-600" /><h3 className="font-semibold">Transfer successful</h3>
            <dl className="space-y-2 text-sm"><div><dt className="text-foreground-500">Recipient</dt><dd>{receipt.recipient_name}</dd></div><div><dt className="text-foreground-500">Amount sent</dt><dd>{formatCurrency(Number(receipt.amount),receipt.currency)}</dd></div><div><dt className="text-foreground-500">Reason</dt><dd className="break-words">{receipt.reason}</dd></div><div><dt className="text-foreground-500">Balance after</dt><dd>{formatCurrency(Number(receipt.sender_balance_after),receipt.currency)}</dd></div><div><dt className="text-foreground-500">Reference</dt><dd className="break-all font-mono text-xs">{receipt.reference}</dd></div></dl>
            <Button className="w-full" onClick={() => setOpen(false)}>Done</Button>
          </div> : pending ? <div className="space-y-4">
            <p className="text-sm text-foreground-600">An existing transfer request needs its result checked.</p><p className="font-semibold">{formatCurrency(pending.amount,pending.currency)}</p><p className="text-sm break-words">{pending.reason}</p><Button className="w-full" disabled={busy} onClick={confirm}>{busy ? <Loader2 className="animate-spin" /> : <Search />}Check / retry same transfer</Button>
          </div> : review && recipient ? <div className="space-y-4">
            <h3 className="font-semibold">Confirm transfer</h3><p className="text-sm break-words">{recipient.name} · {recipient.username}</p>
            <dl className="space-y-2 text-sm"><div className="flex justify-between gap-2"><dt>Recipient receives</dt><dd className="font-semibold">{formatCurrency(Number(amount),currency)}</dd></div><div className="flex justify-between gap-2"><dt>Transfer fee</dt><dd>{formatCurrency(0,currency)}</dd></div><div className="flex justify-between gap-2"><dt>Total deducted</dt><dd>{formatCurrency(Number(amount),currency)}</dd></div><div className="flex justify-between gap-2"><dt>Balance after</dt><dd>{formatCurrency((balances[currency] || 0)-Number(amount),currency)}</dd></div></dl><p className="text-sm break-words">{reason}</p>
            <div className="flex gap-2"><Button variant="outline" className="flex-1" disabled={busy} onClick={() => setReview(false)}>Back</Button><Button className="flex-1" disabled={busy} onClick={confirm}>{busy ? <Loader2 className="animate-spin" /> : <ArrowRightLeft />}Confirm transfer</Button></div>
          </div> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (recipient && validAmount && reason.trim()) setReview(true); }}>
            <div className="space-y-2"><label htmlFor="obpay-recipient" className="text-sm font-medium">Merchant username, email or account ID</label><div className="flex gap-2"><Input id="obpay-recipient" value={identifier} maxLength={160} onChange={e => { lookupVersion.current++; setIdentifier(e.target.value); setRecipient(null); setError(""); }} /><Button type="button" variant="outline" size="icon" aria-label="Check recipient" title="Check recipient" disabled={busy || identifier.trim().length<3} onClick={lookup}>{busy ? <Loader2 className="animate-spin" /> : <Search />}</Button></div></div>
            {recipient && <div className="border-l-2 border-primary-500 pl-3"><p className="text-sm font-semibold break-words">{recipient.name}</p><p className="text-xs text-foreground-600 break-all">{recipient.username}</p></div>}
            {recipient && common.length===0 && <p role="alert" className="text-sm text-destructive">No shared currency wallet. The recipient must enable one of your wallet currencies first.</p>}
            <div className="space-y-2"><label htmlFor="transfer-currency" className="text-sm font-medium">Wallet currency</label><select id="transfer-currency" className="w-full h-9 rounded-md border border-input bg-background-50 px-3 text-sm" value={currency} disabled={!recipient || common.length===0} onChange={e => setCurrency(e.target.value)}>{(recipient ? common : walletCurrencies).map(c => <option key={c} value={c}>{c==="SLL" ? "SLE" : c}</option>)}</select><p className="text-xs text-foreground-500">Available: {formatCurrency(balances[currency] || 0,currency)}</p></div>
            <div className="space-y-2"><label htmlFor="transfer-amount" className="text-sm font-medium">Amount</label><Input id="transfer-amount" type="number" inputMode="decimal" min={decimals ? 0.01 : 1} step={decimals ? 0.01 : 1} max={balances[currency] || 0} value={amount} onChange={e => setAmount(e.target.value)} required /></div>
            <div className="space-y-2"><label htmlFor="transfer-reason" className="text-sm font-medium">Reason</label><Input id="transfer-reason" maxLength={200} value={reason} onChange={e => setReason(e.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={busy || !recipient || common.length===0 || !validAmount || !reason.trim()}><ArrowRightLeft />Review transfer</Button>
          </form>}
        </DialogContent>
      </Dialog>
    </section>
  );
}