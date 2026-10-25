import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { reviewPayout } from "@/lib/payout-confirmation.functions";

export default function PayoutConfirmation({ recordId, reference, onConfirmed }: { recordId: string; reference: string; onConfirmed: () => void }) {
  const review = useServerFn(reviewPayout);
  const [open, setOpen] = useState(false);
  const [partnerReference, setPartnerReference] = useState(reference);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState<{ status: string; currency: string; net_amount: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(status?: "success" | "failed") {
    setBusy(true); setMessage("");
    try {
      const result = await review({ data: { recordId, partnerReference, status, reason } });
      if (!result.success) { setMessage(result.error); setEvidence(null); return; }
      setEvidence(result.evidence);
      if ("result" in result) { setOpen(false); onConfirmed(); }
    } catch { setMessage("Could not complete verification. No confirmation was recorded. Please refresh before trying again."); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="outline" size="sm" onClick={() => { setOpen(true); setEvidence(null); setMessage(""); }}><i className="ri-shield-check-line" />Review payout</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Confirm payout · {reference}</DialogTitle></DialogHeader>
        <label className="text-sm">Payment-network reference
          <input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" value={partnerReference} onChange={e => { setPartnerReference(e.target.value); setEvidence(null); }} />
        </label>
        <Button variant="outline" disabled={busy || !partnerReference.trim()} onClick={() => run()}><i className="ri-refresh-line" />{busy ? "Checking…" : "Verify payment"}</Button>
        {evidence && <p className="text-sm">Verified result: <strong>{evidence.status}</strong> · Recipient amount: {evidence.net_amount.toLocaleString()} {evidence.currency}</p>}
        <label className="text-sm">Confirmation reason
          <textarea className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" value={reason} onChange={e => setReason(e.target.value)} />
        </label>
        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || evidence?.status !== "success" || reason.trim().length < 5} onClick={() => run("success")}><i className="ri-check-line" />Confirm success</Button>
          <Button variant="destructive" disabled={busy || evidence?.status !== "failed" || reason.trim().length < 5} onClick={() => run("failed")}><i className="ri-close-line" />Confirm failed</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}