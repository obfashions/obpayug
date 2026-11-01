import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getVerificationSenders, saveVerificationSender } from "@/lib/verification-senders.functions";
import { getAccessToken } from "@/lib/session-token";
import { Button } from "@/components/ui/button";

export default function VerificationSenderCard() {
  const read = useServerFn(getVerificationSenders);
  const saveSender = useServerFn(saveVerificationSender);
  const [senders, setSenders] = useState<{ id: string; label: string; ready: boolean }[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await read({ data: { accessToken: await getAccessToken() } });
        if (active) { setSenders(result.senders); setSelected(result.selected); }
      } catch { if (active) setMessage("Email accounts could not be loaded."); }
    })();
    return () => { active = false; };
  }, [read]);
  const save = async () => {
    setBusy(true); setMessage("");
    try {
      await saveSender({ data: { accessToken: await getAccessToken(), sender: selected } });
      setMessage("Saved. New registration and login codes use this account.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the email account."); }
    finally { setBusy(false); }
  };
  return <section className="border-t border-background-200 py-6 space-y-3">
    <h3 className="font-heading font-semibold text-foreground-900">Verification email account</h3>
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1 min-w-0"><label htmlFor="verification-sender" className="block text-xs text-foreground-600 mb-1.5">Registration and login codes</label>
        <select id="verification-sender" value={selected} onChange={(event) => setSelected(event.target.value)} disabled={busy || !senders.length} className="w-full rounded-md border border-background-300 bg-background-50 text-foreground-900 text-sm px-3 py-2">
          {!senders.length && <option value="">Loading accounts…</option>}
          {senders.map((sender) => <option key={sender.id} value={sender.id} disabled={!sender.ready}>{sender.label}{!sender.ready ? " — not configured" : ""}</option>)}
        </select>
      </div>
      <Button onClick={save} disabled={busy || !selected} className="sm:self-end">{busy ? "Saving…" : "Save email account"}</Button>
    </div>
    <p className="text-xs text-foreground-500">Mailjet sending limits depend on each account’s plan and quota. Additional keys may share the same allowance. Campaign emails remain unchanged.</p>
    {message && <p role="status" className="text-sm text-foreground-700">{message}</p>}
  </section>;
}