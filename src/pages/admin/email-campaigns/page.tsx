import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase, safeGetSession } from "@/lib/supabase";

interface CampaignLog {
  id: number;
  recipient_email: string;
  recipient_name: string;
  campaign_type: string;
  subject: string;
  body_preview: string;
  status: string;
  sent_at: string;
}

interface CampaignStatus {
  type: string;
  lastSentAt: string | null;
  lastSentCount: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminEmailCampaigns() {
  const [activeTab, setActiveTab] = useState<"automated" | "blast" | "logs">("automated");
  const [campaignStatuses, setCampaignStatuses] = useState<CampaignStatus[]>([]);
  const [recentLogs, setRecentLogs] = useState<CampaignLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Blast form
  const [blastSubject, setBlastSubject] = useState("");
  const [blastBody, setBlastBody] = useState("");
  const [blastPreview, setBlastPreview] = useState(false);

  // Merchant count
  const [merchantCount, setMerchantCount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch merchant count
      const { count: mCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "merchant")
        .eq("status", "active");
      setMerchantCount(mCount || 0);

      // Fetch campaign statuses (latest per type)
      const campaignTypes = ["greeting_morning", "greeting_afternoon", "greeting_evening", "referral"];
      const statuses: CampaignStatus[] = [];

      for (const cType of campaignTypes) {
        const { data } = await supabase
          .from("email_campaign_logs")
          .select("sent_at")
          .eq("campaign_type", cType)
          .order("sent_at", { ascending: false })
          .limit(1);

        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);

        const todayCount = data?.[0] && new Date(data[0].sent_at) >= dayStart ? 1 : 0;

        statuses.push({
          type: cType,
          lastSentAt: data?.[0]?.sent_at || null,
          lastSentCount: todayCount,
        });
      }
      setCampaignStatuses(statuses);

      // Fetch recent logs
      const { data: logs } = await supabase
        .from("email_campaign_logs")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(50);

      setRecentLogs((logs as CampaignLog[]) || []);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const triggerAutomated = async (campaigns: string[], forceResend = false) => {
    setSending(campaigns.join(","));
    setSendResult(null);
    try {
      const { data: sessionData } = await safeGetSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/send-automated-emails`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ campaigns, force: forceResend }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(json.error || "Session expired. Please log out and log back in, then try again.");
        }
        throw new Error(json.error || json.detail || "Request failed");
      }

      const parts: string[] = [];
      if (forceResend) parts.push("[FORCE RESEND — dedup bypassed]");
      if (json.results?.greeting) {
        const g = json.results.greeting;
        parts.push(`Greetings: ${g.sent} sent, ${g.skipped} skipped, ${g.failed} failed`);
        if (g.skipped > 0 && g.skipReason && !forceResend) {
          parts.push(`  (${g.skipReason})`);
        }
      }
      if (json.results?.referral) {
        const r = json.results.referral;
        parts.push(`Referrals: ${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed`);
        if (r.skipped > 0 && r.skipReason && !forceResend) {
          parts.push(`  (${r.skipReason})`);
        }
      }

      setSendResult({ type: "success", message: parts.join(" | ") });
      fetchData();
    } catch (err: any) {
      setSendResult({ type: "error", message: err.message });
    } finally {
      setSending(null);
    }
  };

  const sendBlast = async () => {
    if (!blastSubject.trim() || !blastBody) {
      setSendResult({ type: "error", message: "Please provide both subject and HTML body." });
      return;
    }
    setSending("blast");
    setSendResult(null);
    try {
      const { data: sessionData2 } = await safeGetSession();
      const token = sessionData2?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/send-email-blast`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subject: blastSubject, html_body: blastBody }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(json.error || "Session expired. Please log out and log back in, then try again.");
        }
        throw new Error(json.error || json.detail || "Failed to send blast");
      }

      setSendResult({
        type: "success",
        message: `Blast sent to ${json.sent} merchant${json.sent !== 1 ? "s" : ""}! (${json.failed} failed)`,
      });
      setBlastSubject("");
      setBlastBody("");
      fetchData();
    } catch (err: any) {
      setSendResult({ type: "error", message: err.message });
    } finally {
      setSending(null);
    }
  };

  const getGreetingStatus = (): { label: string; timeRange: string; lastSent: string | null; todaySent: boolean } => {
    const hour = new Date().getHours();
    let activeType: string;
    let label: string;
    let timeRange: string;

    if (hour >= 6 && hour < 12) {
      activeType = "greeting_morning";
      label = "Good Morning";
      timeRange = "6 AM – 12 PM";
    } else if (hour >= 12 && hour < 18) {
      activeType = "greeting_afternoon";
      label = "Good Afternoon";
      timeRange = "12 PM – 6 PM";
    } else {
      activeType = "greeting_evening";
      label = "Good Evening";
      timeRange = "6 PM – 12 AM";
    }

    const status = campaignStatuses.find((s) => s.type === activeType);
    return {
      label,
      timeRange,
      lastSent: status?.lastSentAt || null,
      todaySent: status ? status.lastSentCount > 0 : false,
    };
  };

  const getReferralStatus = () => {
    const status = campaignStatuses.find((s) => s.type === "referral");
    return {
      lastSent: status?.lastSentAt || null,
      canSend: status?.lastSentAt
        ? Date.now() - new Date(status.lastSentAt).getTime() >= 8 * 60 * 60 * 1000
        : true,
    };
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
            <p className="text-sm text-foreground-500 mt-3">Loading campaigns...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const greetingStatus = getGreetingStatus();
  const referralStatus = getReferralStatus();

  // Count logs by type for stats
  const greetingLogs = recentLogs.filter((l) => l.campaign_type.startsWith("greeting_"));
  const referralLogs = recentLogs.filter((l) => l.campaign_type === "referral");
  const blastLogs = recentLogs.filter((l) => l.campaign_type === "blast");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground-900">Email Campaigns</h1>
            <p className="text-sm text-foreground-600 mt-1">
              Automated greetings, referral nudges &amp; manual blasts — {merchantCount} active merchant{merchantCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-accent-100 border border-accent-200 text-accent-700 rounded-xl p-4 flex items-start gap-3">
            <i className="ri-error-warning-line text-lg shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button onClick={fetchData} className="text-sm underline cursor-pointer whitespace-nowrap">Retry</button>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-background-100 rounded-full p-1 w-fit">
          {[
            { key: "automated", label: "Automated", icon: "ri-timer-flash-line" },
            { key: "blast", label: "Email Blast", icon: "ri-send-plane-line" },
            { key: "logs", label: "Campaign Log", icon: "ri-history-line" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-background-50 text-foreground-900"
                  : "text-foreground-500 hover:text-foreground-700"
              }`}
            >
              <i className={`${tab.icon} text-sm`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Send Result Toast */}
        {sendResult && (
          <div
            className={`rounded-xl p-4 flex items-start gap-3 ${
              sendResult.type === "success"
                ? "bg-primary-100 border border-primary-200 text-primary-700"
                : "bg-accent-100 border border-accent-200 text-accent-700"
            }`}
          >
            <i className={`${sendResult.type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} text-lg shrink-0 mt-0.5`} />
            <div className="flex-1">
              <p className="text-sm font-medium">{sendResult.message}</p>
            </div>
            <button
              onClick={() => setSendResult(null)}
              className="text-current opacity-60 hover:opacity-100 cursor-pointer"
            >
              <i className="ri-close-line" />
            </button>
          </div>
        )}

        {/* === AUTOMATED TAB === */}
        {activeTab === "automated" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Greeting Card */}
            <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                    <i className="ri-sun-line text-primary-600 text-lg" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-foreground-900">Time-Based Greetings</h3>
                    <p className="text-xs text-foreground-500">Automatically sends greeting emails based on time of day</p>
                  </div>
                </div>
              </div>

              <div className="bg-background-100 rounded-lg p-4 mb-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-600">Current window</span>
                  <span className="text-sm font-semibold text-foreground-900">{greetingStatus.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-600">Time range</span>
                  <span className="text-sm text-foreground-700">{greetingStatus.timeRange}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-600">Today's status</span>
                  {greetingStatus.todaySent ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">
                      <i className="ri-check-line text-xs" /> Sent {greetingStatus.lastSent ? timeAgo(greetingStatus.lastSent) : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary-700 bg-secondary-100 px-2 py-0.5 rounded-full">
                      <i className="ri-time-line text-xs" /> Not yet sent
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-600">Recipients</span>
                  <span className="text-sm text-foreground-700">{merchantCount} active merchant{merchantCount !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-foreground-500">
                  The scheduler automatically sends the appropriate greeting at 8 AM, 2 PM, and 8 PM (EAT) daily.
                  Each merchant gets at most one greeting per time window per day. Use the button below
                  to send immediately if the cron has not run yet.
                </p>
                <button
                  onClick={() => triggerAutomated(["greeting"])}
                  disabled={sending !== null}
                  className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-background-50 font-medium px-4 py-3 rounded-xl text-sm cursor-pointer whitespace-nowrap transition-colors"
                >
                  {sending === "greeting" ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <i className="ri-send-plane-line" /> Send {greetingStatus.label} Emails Now
                    </>
                  )}
                </button>
                <button
                  onClick={() => triggerAutomated(["greeting"], true)}
                  disabled={sending !== null}
                  className="w-full flex items-center justify-center gap-2 border border-foreground-300 hover:border-foreground-500 disabled:opacity-30 text-foreground-600 font-medium px-4 py-2.5 rounded-xl text-xs cursor-pointer whitespace-nowrap transition-colors"
                >
                  <i className="ri-forbid-line" /> Force Resend (ignore today's dedup)
                </button>
              </div>
            </div>

            {/* Referral Card */}
            <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center">
                    <i className="ri-gift-line text-accent-600 text-lg" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-foreground-900">Referral Nudge</h3>
                    <p className="text-xs text-foreground-500">Encourages merchants to refer ObPay — sent every 8 hours</p>
                  </div>
                </div>
              </div>

              <div className="bg-background-100 rounded-lg p-4 mb-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-600">Frequency</span>
                  <span className="text-sm font-semibold text-foreground-900">Every 8 hours</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-600">Last sent</span>
                  <span className="text-sm text-foreground-700">
                    {referralStatus.lastSent ? formatTime(referralStatus.lastSent) : "Never"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-600">Can send now?</span>
                  {referralStatus.canSend ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">
                      <i className="ri-check-line text-xs" /> Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-secondary-700 bg-secondary-100 px-2 py-0.5 rounded-full">
                      <i className="ri-time-line text-xs" /> Cooling down
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-600">Recipients</span>
                  <span className="text-sm text-foreground-700">{merchantCount} active merchant{merchantCount !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-foreground-500">
                  The scheduler automatically sends referral nudges every 8 hours (12 AM, 8 AM, 4 PM EAT).
                  Merchants who received one in the last 8 hours are automatically skipped.
                  Use the button below to send immediately if the cron has not run yet.
                </p>
                <button
                  onClick={() => triggerAutomated(["referral"])}
                  disabled={sending !== null}
                  className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-background-50 font-medium px-4 py-3 rounded-xl text-sm cursor-pointer whitespace-nowrap transition-colors"
                >
                  {sending === "referral" ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <i className="ri-send-plane-line" /> Send Referral Emails Now
                    </>
                  )}
                </button>
                <button
                  onClick={() => triggerAutomated(["referral"], true)}
                  disabled={sending !== null}
                  className="w-full flex items-center justify-center gap-2 border border-foreground-300 hover:border-foreground-500 disabled:opacity-30 text-foreground-600 font-medium px-4 py-2.5 rounded-xl text-xs cursor-pointer whitespace-nowrap transition-colors"
                >
                  <i className="ri-forbid-line" /> Force Resend (ignore 8hr dedup)
                </button>
              </div>
            </div>

            {/* Run Both */}
            <div className="lg:col-span-2 space-y-2">
              <button
                onClick={() => triggerAutomated(["greeting", "referral"])}
                disabled={sending !== null}
                className="w-full flex items-center justify-center gap-2 bg-foreground-900 hover:bg-foreground-800 disabled:opacity-50 text-background-50 font-medium px-4 py-3.5 rounded-xl text-sm cursor-pointer whitespace-nowrap transition-colors"
              >
                {sending === "greeting,referral" ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" /> Running both campaigns...
                  </>
                ) : (
                  <>
                    <i className="ri-flashlight-line" /> Run All Automated Campaigns
                  </>
                )}
              </button>
              <button
                onClick={() => triggerAutomated(["greeting", "referral"], true)}
                disabled={sending !== null}
                className="w-full flex items-center justify-center gap-2 border border-foreground-300 hover:border-foreground-700 disabled:opacity-30 text-foreground-600 font-medium px-4 py-2.5 rounded-xl text-xs cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-forbid-line" /> Force Run All (bypass all dedup checks)
              </button>
            </div>

            {/* Recent greeting/referral logs */}
            <div className="lg:col-span-2 bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
              <div className="p-5 border-b border-background-200/70">
                <h3 className="font-heading font-semibold text-foreground-900">Recent Automated Sends</h3>
              </div>
              {[...greetingLogs, ...referralLogs].length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-3">
                    <i className="ri-mail-line text-foreground-400 text-xl" />
                  </div>
                  <p className="text-sm text-foreground-500">No automated emails sent yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-background-200/70">
                        <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Type</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Recipient</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Preview</th>
                        <th className="text-center px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Status</th>
                        <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...greetingLogs, ...referralLogs]
                        .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
                        .slice(0, 15)
                        .map((log) => (
                          <tr key={log.id} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                            <td className="px-5 py-3">
                              <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                log.campaign_type === "referral"
                                  ? "bg-accent-100 text-accent-700"
                                  : "bg-primary-100 text-primary-700"
                              }`}>
                                {log.campaign_type === "referral" ? "Referral" : log.campaign_type.replace("greeting_", "Greeting ")}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-xs font-medium text-foreground-900">{log.recipient_name || log.recipient_email}</p>
                              <p className="text-[11px] text-foreground-500">{log.recipient_email}</p>
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-xs text-foreground-600 max-w-[240px] truncate">{log.body_preview || log.subject}</p>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                log.status === "sent" ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-700"
                              }`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right text-xs text-foreground-500">{timeAgo(log.sent_at)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === BLAST TAB === */}
        {activeTab === "blast" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Compose */}
            <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-secondary-100 flex items-center justify-center">
                  <i className="ri-mail-send-line text-secondary-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground-900">Compose Blast</h3>
                  <p className="text-xs text-foreground-500">Write an email to send to all {merchantCount} merchants</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-700 mb-1.5">Subject Line</label>
                  <input
                    type="text"
                    value={blastSubject}
                    onChange={(e) => setBlastSubject(e.target.value)}
                    placeholder="e.g. Exciting new features on ObPay!"
                    className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground-700 mb-1.5">
                    Email Body (HTML)
                    <span className="text-foreground-400 font-normal ml-1">— use {"{{name}}"} for merchant name</span>
                  </label>
                  <textarea
                    value={blastBody}
                    onChange={(e) => setBlastBody(e.target.value)}
                    placeholder={`<p>Hi {{name}},</p>\n<p>We're excited to announce...</p>\n<p>— The ObPay Team</p>`}
                    rows={10}
                    className="w-full px-4 py-3 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 resize-none font-mono"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={sendBlast}
                    disabled={sending !== null || !blastSubject.trim() || !blastBody.trim()}
                    className="flex items-center gap-2 bg-secondary-500 hover:bg-secondary-600 disabled:opacity-40 text-background-50 font-medium px-6 py-2.5 rounded-xl text-sm cursor-pointer whitespace-nowrap transition-colors"
                  >
                    {sending === "blast" ? (
                      <>
                        <i className="ri-loader-4-line animate-spin" /> Sending to {merchantCount} merchants...
                      </>
                    ) : (
                      <>
                        <i className="ri-send-plane-line" /> Send to All {merchantCount} Merchants
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setBlastSubject("");
                      setBlastBody("");
                    }}
                    className="text-sm text-foreground-500 hover:text-foreground-700 cursor-pointer whitespace-nowrap"
                  >
                    Clear
                  </button>
                </div>

                <details className="mt-2">
                  <summary className="text-xs text-foreground-500 cursor-pointer hover:text-foreground-700">
                    Quick templates
                  </summary>
                  <div className="mt-2 space-y-2">
                    {[
                      {
                        label: "Feature Announcement",
                        subject: "New features on ObPay!",
                        body: `<p>Hi {{name}},</p>
<p>We're excited to share some new features on ObPay that will make your payment collections even smoother:</p>
<ul>
  <li>Feature one description</li>
  <li>Feature two description</li>
  <li>Feature three description</li>
</ul>
<p>Log in to your dashboard to explore these updates, or reach out to support if you have any questions.</p>
<p>Best,<br/>The ObPay Team</p>`,
                      },
                      {
                        label: "Maintenance Notice",
                        subject: "Scheduled Maintenance — ObPay",
                        body: `<p>Hi {{name}},</p>
<p>We'll be performing scheduled maintenance on <strong>[DATE]</strong> from <strong>[TIME]</strong> to <strong>[TIME]</strong> EAT.</p>
<p>During this window, payment collections and payouts may be briefly unavailable. All transactions will resume normally once maintenance is complete.</p>
<p>We apologize for any inconvenience and appreciate your patience.</p>
<p>— The ObPay Team</p>`,
                      },
                      {
                        label: "Tips & Best Practices",
                        subject: "Tips to maximize your ObPay collections",
                        body: `<p>Hi {{name}},</p>
<p>Here are a few tips to get the most out of ObPay:</p>
<ol>
  <li><strong>Share your payment link</strong> — Add it to your social media bios and invoices</li>
  <li><strong>Use the API</strong> — Integrate ObPay directly into your website or app</li>
  <li><strong>Monitor your dashboard</strong> — Keep an eye on real-time transaction feeds</li>
</ol>
<p>Need help? We're just an email away at support@obpay.online.</p>
<p>Happy collecting!<br/>— The ObPay Team</p>`,
                      },
                    ].map((tpl) => (
                      <button
                        key={tpl.label}
                        onClick={() => {
                          setBlastSubject(tpl.subject);
                          setBlastBody(tpl.body);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg border border-background-200/70 hover:bg-background-100 transition-colors cursor-pointer"
                      >
                        <p className="text-xs font-medium text-foreground-700">{tpl.label}</p>
                        <p className="text-[11px] text-foreground-500 truncate">{tpl.subject}</p>
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-background-100 flex items-center justify-center">
                  <i className="ri-eye-line text-foreground-600 text-lg" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground-900">Preview</h3>
                  <p className="text-xs text-foreground-500">How your email will look to merchants</p>
                </div>
              </div>

              {!blastSubject && !blastBody ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-mail-open-line text-foreground-400 text-2xl" />
                  </div>
                  <p className="text-sm text-foreground-500">Write something on the left to see a preview</p>
                </div>
              ) : (
                <div className="border border-background-200/70 rounded-lg overflow-hidden">
                  {/* Email header mock */}
                  <div className="bg-foreground-900 px-4 py-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-background-50 tracking-tight">ObPay</span>
                    <span className="text-[10px] text-background-50/60">Secure Payments</span>
                  </div>
                  <div className="p-4 bg-background-50">
                    <h4 className="font-heading font-bold text-base text-foreground-900 mb-3">
                      {blastSubject || "No subject"}
                    </h4>
                    <div
                      className="text-sm text-foreground-700 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: (blastBody || "<p>No content</p>").replace(/\{\{name\}\}/g, "John Doe"),
                      }}
                    />
                  </div>
                  <div className="bg-background-100 px-4 py-3 border-t border-background-200/70">
                    <p className="text-[10px] text-foreground-500">
                      This message was sent by the ObPay team · support@obpay.online
                    </p>
                  </div>
                </div>
              )}

              {/* Recent blast logs */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-foreground-700 mb-3">Recent Blasts</h4>
                {blastLogs.length === 0 ? (
                  <p className="text-xs text-foreground-500">No blasts sent yet</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {blastLogs.slice(0, 10).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-background-100"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground-800 truncate">{log.subject}</p>
                          <p className="text-[11px] text-foreground-500">{log.recipient_email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              log.status === "sent" ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-700"
                            }`}
                          >
                            {log.status}
                          </span>
                          <span className="text-[10px] text-foreground-400">{timeAgo(log.sent_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === LOGS TAB === */}
        {activeTab === "logs" && (
          <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
            <div className="p-5 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-semibold text-foreground-900">All Campaign Logs</h3>
              <span className="text-xs text-foreground-500">{recentLogs.length} entries</span>
            </div>
            {recentLogs.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-4">
                  <i className="ri-mail-line text-foreground-400 text-2xl" />
                </div>
                <p className="text-sm text-foreground-500">No emails have been sent yet</p>
                <p className="text-xs text-foreground-400 mt-1">Trigger a campaign from the Automated or Blast tab</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-background-200/70">
                      <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Type</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Recipient</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Subject</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Status</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map((log) => (
                      <tr key={log.id} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                              log.campaign_type === "referral"
                                ? "bg-accent-100 text-accent-700"
                                : log.campaign_type === "blast"
                                ? "bg-secondary-100 text-secondary-700"
                                : "bg-primary-100 text-primary-700"
                            }`}
                          >
                            {log.campaign_type === "referral"
                              ? "Referral"
                              : log.campaign_type === "blast"
                              ? "Blast"
                              : log.campaign_type.replace("greeting_", "Greeting ")}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-xs font-medium text-foreground-900">{log.recipient_name || "—"}</p>
                          <p className="text-[11px] text-foreground-500">{log.recipient_email}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-xs text-foreground-700 max-w-[280px] truncate">{log.subject}</p>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                              log.status === "sent" ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-700"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-foreground-500">{formatTime(log.sent_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}