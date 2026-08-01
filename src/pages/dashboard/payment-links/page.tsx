import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { platform } from "@/lib/platform";

interface PaymentLink {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  amount: number | null;
  currency: string;
  fixed_amount: boolean;
  redirect_url: string | null;
  status: string;
  views: number;
  payments_count: number;
  created_at: string;
}

function siteOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return (import.meta.env.VITE_SITE_URL as string) || "https://obpay.online";
}

export default function PaymentLinksPage() {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    amount: "",
    currency: "UGX",
    description: "",
    redirect_url: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await platform<PaymentLink[]>("links.list");
    if (!res.success) setError(res.error || "Could not load your payment links.");
    else setLinks(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const res = await platform("links.create", form);
    setSubmitting(false);
    if (!res.success) {
      setError(res.error || "Could not create the link.");
      return;
    }
    setForm({ title: "", amount: "", currency: "UGX", description: "", redirect_url: "" });
    load();
  };

  const toggle = async (link: PaymentLink) => {
    const res = await platform("links.update", { id: link.id, status: link.status === "active" ? "paused" : "active" });
    if (!res.success) setError(res.error || "Could not update the link.");
    load();
  };

  const remove = async (id: string) => {
    const res = await platform("links.delete", { id });
    if (!res.success) setError(res.error || "Could not delete the link.");
    load();
  };

  const copy = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground-900">Payment links</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Share a link and collect mobile money without writing any code. Payments land in your ObPay balance.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
        )}

        <form onSubmit={create} className="rounded-xl border border-background-200 bg-white p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground-900">New payment link</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What is this for? (e.g. Website design)"
              className="rounded-lg border border-background-200 px-3 py-2 text-sm"
              required
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="Amount (optional)"
                inputMode="decimal"
                className="col-span-2 rounded-lg border border-background-200 px-3 py-2 text-sm"
              />
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="rounded-lg border border-background-200 px-2 py-2 text-sm"
              >
                <option>UGX</option>
                <option>KES</option>
                <option>TZS</option>
              </select>
            </div>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short description shown to the payer"
              className="rounded-lg border border-background-200 px-3 py-2 text-sm"
            />
            <input
              value={form.redirect_url}
              onChange={(e) => setForm({ ...form, redirect_url: e.target.value })}
              placeholder="Redirect after payment (optional)"
              className="rounded-lg border border-background-200 px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-foreground-500">Leave the amount blank to let the payer enter their own amount.</p>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer"
          >
            {submitting ? "Creating…" : "Create link"}
          </button>
        </form>

        <div className="rounded-xl border border-background-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-foreground-500">Loading your links…</div>
          ) : links.length === 0 ? (
            <div className="p-6 text-sm text-foreground-500">No payment links yet.</div>
          ) : (
            <ul className="divide-y divide-background-100">
              {links.map((link) => {
                const url = `${siteOrigin()}/pay/${link.slug}`;
                return (
                  <li key={link.id} className="p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground-900">{link.title}</span>
                      <span className="text-sm text-foreground-500">
                        {link.amount != null
                          ? `${link.currency} ${Number(link.amount).toLocaleString()}`
                          : "Payer chooses amount"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          link.status === "active" ? "bg-green-100 text-green-700" : "bg-background-100 text-foreground-500"
                        }`}
                      >
                        {link.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="flex-1 truncate rounded-md bg-background-50 px-3 py-2 text-xs font-mono">{url}</code>
                      <button
                        onClick={() => copy(url, link.id)}
                        className="w-8 h-8 rounded-md bg-background-50 hover:bg-background-200 flex items-center justify-center shrink-0 cursor-pointer"
                        title="Copy link"
                      >
                        <i className={copied === link.id ? "ri-check-line text-primary-500 text-sm" : "ri-file-copy-line text-sm"} />
                      </button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 rounded-md bg-background-50 hover:bg-background-200 flex items-center justify-center shrink-0"
                        title="Open link"
                      >
                        <i className="ri-external-link-line text-sm" />
                      </a>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-500">
                      <span>{link.views || 0} views</span>
                      <span>{link.payments_count || 0} payments</span>
                      <span className="grow" />
                      <button onClick={() => toggle(link)} className="text-primary-600 hover:underline cursor-pointer">
                        {link.status === "active" ? "Pause" : "Activate"}
                      </button>
                      <button onClick={() => remove(link.id)} className="text-red-600 hover:underline cursor-pointer">
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
