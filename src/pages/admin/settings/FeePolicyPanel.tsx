import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { partnerFeeSchedule } from "@/lib/fee-policy.functions";
import { getAccessToken } from "@/lib/session-token";
import { WALLET_CURRENCIES } from "@/lib/countries";
import { getCurrencyInfo } from "@/lib/currency";

export type CurrencyFees = Record<string, { collect?: number | string; collect_margin?: number | string; withdraw?: number | string }>;

export default function FeePolicyPanel({ fees, withdrawDefault, onChange }: { fees: CurrencyFees; withdrawDefault: number; onChange: (fees: CurrencyFees) => void }) {
  const [schedule, setSchedule] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true); setError("");
    try { setSchedule(await partnerFeeSchedule({ data: { accessToken: await getAccessToken() } })); }
    catch { setError("Current partner pricing could not be checked. Previously recorded figures are not a guaranteed tariff."); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, []);
  return <section className="border-y border-background-200 py-5 space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><h3 className="font-heading font-semibold text-foreground-900">Currency earnings &amp; partner costs</h3><Button variant="outline" size="sm" disabled={busy} onClick={refresh}>{busy ? "Checking…" : "Refresh partner fees"}</Button></div>
    <p className="text-xs text-foreground-600">Collection margin is ObPay’s earning above the verified partner charge, deducted once as one total fee. Payout margin is added to the live partner quote. Existing merchant exemptions remain unchanged. Save Changes applies future transactions only.</p>
    <Button variant="outline" onClick={() => onChange(Object.fromEntries(WALLET_CURRENCIES.map((c) => [c, { ...fees[c], collect_margin: 2, withdraw: 2 }])))}>Set ObPay margin to 2% in every currency</Button>
    {error && <p role="alert" className="text-xs text-accent-600">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full text-xs min-w-[560px]"><thead><tr className="text-left text-foreground-500 border-b border-background-200"><th className="py-3">Currency</th><th>Partner collection evidence</th><th>Partner payout fee</th><th>ObPay collect margin %</th><th>ObPay payout %</th></tr></thead><tbody>
      {WALLET_CURRENCIES.map((c) => {
        const row = schedule?.rows?.find((r: any) => r.currency === c);
        const payout = row?.payout;
        const fee = payout?.fee;
        const setFee = (kind: "collect_margin" | "withdraw", value: string) => onChange({ ...fees, [c]: { ...fees[c], [kind]: value } });
        return <tr key={c} className="border-b border-background-100"><td className="py-3 font-medium text-foreground-900">{getCurrencyInfo(c).flag} {c === "SLL" ? "SLE" : c}</td><td className="text-foreground-600">{row?.collection ? <>{row.collection.percent.toFixed(2)}% observed<br/><span className="text-[10px]">{new Date(row.collection.at).toLocaleDateString()}</span></> : "Not verified"}</td><td className="text-foreground-600">{payout?.available === false ? "Not enabled" : fee?.type === "flat" ? `${fee.amount} ${c}` : fee?.percent != null ? `${fee.percent}% · min fee ${fee.floor} ${c}` : "Unavailable"}</td><td className="p-2"><input aria-label={`${c} collection margin`} type="number" min="0" max="100" step="0.1" value={fees[c]?.collect_margin ?? ""} onChange={(e) => setFee("collect_margin", e.target.value)} placeholder="Legacy total fee" className="w-24 border border-background-300 bg-background-50 rounded-md p-2"/></td><td className="p-2"><input aria-label={`${c} payout margin`} type="number" min="0" max="100" step="0.1" value={fees[c]?.withdraw ?? ""} onChange={(e) => setFee("withdraw", e.target.value)} placeholder={String(withdrawDefault)} className="w-24 border border-background-300 bg-background-50 rounded-md p-2"/></td></tr>;
      })}
    </tbody></table></div>
    <p className="text-[11px] text-foreground-500">A past collection’s effective percentage is evidence, not a promised rate. Fixed fees and floors raise small-payment costs. Unknown collection charges remain awaiting verification rather than crediting unbacked funds. The 2% is transaction margin before taxes, refunds, operating costs and chargebacks.</p>
    {schedule && <p className="text-[11px] text-foreground-500">Payout schedule checked {new Date(schedule.checkedAt).toLocaleString()} · <a href="https://payzaapi.co.ke/docs" target="_blank" rel="noreferrer" className="underline">Payza API documentation</a></p>}
  </section>;
}