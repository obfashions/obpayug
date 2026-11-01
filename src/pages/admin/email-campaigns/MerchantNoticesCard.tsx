import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { NOTICE_TEMPLATES } from "@/lib/merchant-notices";
import { sendMerchantNotice } from "@/lib/mailjet.functions";
import { getAccessToken } from "@/lib/session-token";
import { supabase } from "@/lib/supabase";

async function loadVerifiedIds() {
  const ids = new Set<string>();
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase.from("merchant_profiles").select("user_id, verification_status").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of (data as any[]) || []) if (r?.verification_status === "approved") ids.add(r.user_id);
    if (!data || data.length < 1000) break;
  }
  return ids;
}

async function loadRecipients(verifiedOnly = false) {
  const verified = verifiedOnly ? await loadVerifiedIds() : null;
  const all: Array<{ email: string; name: string | null }> = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await supabase.from("profiles").select("id, email, full_name, status").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of (data as any[]) || []) if (r?.email && r.status !== "deactivated" && (!verified || verified.has(r.id))) all.push({ email: r.email, name: r.full_name || null });
    if (!data || data.length < 1000) break;
  }
  return all;
}

export default function MerchantNoticesCard() {
  const send = useServerFn(sendMerchantNotice);
  const [subject, setSubject] = useState(NOTICE_TEMPLATES[0].subject);
  const [body, setBody] = useState(NOTICE_TEMPLATES[0].body);
  const [active, setActive] = useState(NOTICE_TEMPLATES[0].id);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const verifiedOnly = !!NOTICE_TEMPLATES.find((t) => t.id === active)?.verifiedOnly;
  const run = async (test: boolean) => {
    if (!test && !window.confirm(verifiedOnly ? "Send this email to every VERIFIED ObPay merchant now?" : "Send this email to EVERY registered ObPay account now?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const accessToken = await getAccessToken();
      const recipients = test ? [] : await loadRecipients(verifiedOnly);
      if (!test && !recipients.length) throw new Error("No matching merchant emails found.");
      const r: any = await send({ data: { accessToken, subject, body, testTo: test ? testTo : "", recipients } });
      setMsg(
        r.success
          ? { ok: true, text: `Sent ${r.sent} of ${r.total}${r.failed ? ` (${r.failed} failed)` : ""}.` }
          : { ok: false, text: r.error || "Could not send." },
      );
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Could not send." });
    }
    setBusy(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h2 className="font-bold text-lg text-gray-900">Merchant notices</h2>
        <p className="text-sm text-gray-600">Tap a template, edit if needed, then send. {"{name}"} becomes each merchant's name.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {NOTICE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActive(t.id); setSubject(t.subject); setBody(t.body); setMsg(null); }}
            className={`px-3 py-1.5 rounded-full text-sm border ${active === t.id ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Subject" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={testTo} onChange={(e) => setTestTo(e.target.value)} type="email" placeholder="Your email for a test" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <button disabled={busy || !testTo} onClick={() => run(true)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50">Send test</button>
        <button disabled={busy} onClick={() => run(false)} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50">
          {busy ? "Sending…" : verifiedOnly ? "Send to verified merchants" : "Send to all merchants"}
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
