import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "@/lib/router-compat";
import { JsonLd } from "@/components/base/JsonLd";

interface Ticket {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  sender_id: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SupportPage() {
  const { user, profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [supportEmail, setSupportEmail] = useState("support@obpay.com");
  const [supportPhone, setSupportPhone] = useState("+256762201984");
  const [supportWhatsApp, setSupportWhatsApp] = useState("+256745482977");

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const { data } = await supabase.from("platform_settings").select("support_email, support_phone, support_whatsapp").limit(1).maybeSingle();
        if (data?.support_email) setSupportEmail(data.support_email);
        if (data?.support_phone) setSupportPhone(data.support_phone);
        if (data?.support_whatsapp) setSupportWhatsApp(data.support_whatsapp);
      } catch { /* silent */ }
    };
    fetchContact();
  }, []);

  const whatsappUrl = supportWhatsApp
    ? `https://wa.me/${supportWhatsApp.replace(/\+/g, "")}?text=Hi%20ObPay%20Support%2C%20I%20need%20help%20with...`
    : "https://wa.me/256745482977?text=Hi%20ObPay%20Support%2C%20I%20need%20help%20with...";

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    setLoadingTickets(true);
    try {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setTickets((data as Ticket[]) || []);
    } catch { /* silent */ }
    finally { setLoadingTickets(false); }
  }, [user]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;
    setSubmitting(true);
    setSubmitStatus(null);
    try {
      const fullMessage = subject.trim() ? `[${subject.trim()}] ${newMessage.trim()}` : newMessage.trim();
      const { error } = await supabase.from("support_messages").insert({
        sender_id: user.id,
        receiver_id: null,
        message: fullMessage,
        is_read: false,
      });
      if (error) throw error;
      setSubmitStatus({ ok: true, message: "Ticket created! Our team will respond shortly. Check back here for replies." });

      // Send support ticket confirmation email
      if (user.email) {
        supabase.functions.invoke("send-transactional-email", {
          body: {
            email: user.email,
            type: "support_ticket_received",
            data: {
              ticket_message: newMessage.trim(),
              ticket_subject: subject.trim() || null,
              submitted_at: new Date().toISOString(),
            },
          },
        }).then(() => {}, (e) => console.warn("[Support] Ticket email failed silently:", e));
      }

      setNewMessage("");
      setSubject("");
      fetchTickets();
    } catch (err: any) {
      setSubmitStatus({ ok: false, message: err.message || "Failed to create ticket. Please try again." });
    } finally { setSubmitting(false); }
  };

  const faqs = [
    {
      q: "How do I start collecting payments?",
      a: "Complete KYC verification from your Dashboard, then go to Collections to initiate a payment request. Enter the customer's phone number and amount — they'll receive an STK push to confirm."
    },
    {
      q: "How long do payouts take?",
      a: "Payouts to mobile money are usually instant once confirmed. If pending, they auto-sync every 5 seconds. Bank transfers may take 1-2 business days."
    },
    {
      q: "What are the fees?",
      a: "ObPay charges a platform fee on collections (default 5%, set by admin). There are no fees for receiving collections — fees are only applied during payouts. Mobile network fees are handled by the payment provider."
    },
    {
      q: "How do I integrate ObPay into my website?",
      a: "Check out our Docs page for complete API documentation. You can use payment links (simplest), embed a pay button, or use the full REST API. All methods are documented with code examples."
    },
    {
      q: "What happens if a customer doesn't complete the payment?",
      a: "The transaction is marked as 'failed' and no money moves. The customer can try again. You're never charged for failed transactions."
    },
    {
      q: "How do webhooks work?",
      a: "Webhooks let ObPay notify your server automatically when payments succeed or fail. Go to Dashboard → Webhooks to add your endpoint URLs and get your signing secret for verification."
    },
    {
      q: "Is my money safe?",
      a: "Yes. ObPay uses SSL encryption, PCI DSS Level 1 compliance, and all funds are held in regulated financial accounts. Your API keys should never be shared."
    },
  ];

  return (
    <div className="min-h-screen bg-background-100">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "ObPay Support — Help Center",
          url: `${import.meta.env.VITE_SITE_URL}/support`,
          description: "Get help with ObPay payments, payouts, API integration, and account issues. Contact support via WhatsApp, live chat, or create a support ticket.",
        }}
      />

      {/* Header */}
      <div className="bg-background-50 border-b border-background-200/70">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
          <div className="flex items-center gap-3 mb-3">
            <Link to="/" className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
              <span className="text-background-50 font-heading font-bold text-sm">Ob</span>
            </Link>
            <span className="text-sm text-foreground-500">/</span>
            <span className="text-sm font-medium text-foreground-700">Support</span>
          </div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mb-2">How can we help?</h1>
          <p className="text-sm text-foreground-600 max-w-lg">
            Choose how you'd like to reach us — WhatsApp, live chat, or create a support ticket. We usually respond within minutes.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* AI Assistant */}
        <SupportAssistant />

        {/* Contact Options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`bg-background-50 rounded-xl border border-background-200/70 p-5 hover:border-emerald-300/60 transition-all group cursor-pointer ${!supportPhone ? "opacity-50 pointer-events-none" : ""}`}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <i className="ri-whatsapp-line text-emerald-600 text-2xl" />
            </div>
            <h3 className="font-heading font-semibold text-foreground-900 mb-1">WhatsApp</h3>
            <p className="text-xs text-foreground-500 mb-2">Chat with us directly on WhatsApp for quick help.</p>
            <span className="inline-flex items-center gap-1.5 text-sm font-mono font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
              <i className="ri-whatsapp-line" />
              {supportPhone || "Not configured"}
            </span>
          </a>

          {/* Live Chat */}
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-5 hover:border-primary-300/60 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <i className="ri-chat-smile-2-line text-primary-600 text-2xl" />
            </div>
            <h3 className="font-heading font-semibold text-foreground-900 mb-1">Live Chat</h3>
            <p className="text-xs text-foreground-500 mb-2">The chat bubble at the bottom-right corner connects you to our team instantly.</p>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg">
              <i className="ri-chat-3-line" />
              Click the chat bubble ↘
            </span>
          </div>

          {/* Email */}
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-5 hover:border-accent-300/60 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-accent-100 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <i className="ri-mail-line text-accent-600 text-2xl" />
            </div>
            <h3 className="font-heading font-semibold text-foreground-900 mb-1">Email</h3>
            <p className="text-xs text-foreground-500 mb-2">Prefer email? Send us a message anytime.</p>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-accent-600 bg-accent-50 px-3 py-1.5 rounded-lg">
              <i className="ri-mail-line" />
              {supportEmail}
            </span>
          </div>
        </div>

        {/* Create Ticket Form */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5 md:p-6">
          <h2 className="font-heading font-semibold text-lg text-foreground-900 mb-1">Create a Support Ticket</h2>
          <p className="text-sm text-foreground-500 mb-5">Describe your issue and we'll get back to you as soon as possible.</p>

          {submitStatus && (
            <div className={`rounded-lg px-4 py-3 mb-4 text-sm ${submitStatus.ok ? "bg-emerald-100 text-emerald-700" : "bg-accent-100 text-accent-700"}`}>
              <div className="flex items-start gap-2">
                <i className={`${submitStatus.ok ? "ri-checkbox-circle-line text-emerald-500" : "ri-error-warning-line text-accent-500"} mt-0.5`} />
                <p>{submitStatus.message}</p>
              </div>
            </div>
          )}

          {!user ? (
            <div className="text-center py-8 bg-background-100 rounded-lg">
              <i className="ri-user-line text-3xl text-foreground-400 mb-3 block" />
              <p className="text-sm text-foreground-600 mb-3">Log in to create a support ticket</p>
              <Link to="/login" className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-medium px-5 py-2.5 rounded-lg text-sm cursor-pointer whitespace-nowrap">
                <i className="ri-login-box-line" />Log In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Payment not reflecting, API key issue, Payout failed"
                  className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Describe Your Issue *</label>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Please describe what happened. Include any reference numbers, error messages, or screenshots that would help us understand the issue."
                  rows={5}
                  maxLength={500}
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <p className="text-[11px] text-foreground-400 mt-1 text-right">{newMessage.length}/500</p>
              </div>
              <button
                type="submit"
                disabled={submitting || !newMessage.trim()}
                className="w-full sm:w-auto inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                {submitting ? <><i className="ri-loader-4-line animate-spin" />Submitting...</> : <><i className="ri-send-plane-line" />Submit Ticket</>}
              </button>
            </form>
          )}
        </div>

        {/* Previous Tickets */}
        {user && (
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-5 md:p-6">
            <h2 className="font-heading font-semibold text-lg text-foreground-900 mb-1">Your Tickets</h2>
            <p className="text-sm text-foreground-500 mb-4">Previous support requests and our responses</p>

            {loadingTickets ? (
              <div className="flex items-center justify-center py-8">
                <i className="ri-loader-4-line animate-spin text-2xl text-foreground-400" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-8 bg-background-100 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-background-200/70 flex items-center justify-center mx-auto mb-3">
                  <i className="ri-inbox-line text-foreground-400 text-xl" />
                </div>
                <p className="text-sm text-foreground-500">No tickets yet</p>
                <p className="text-xs text-foreground-400 mt-1">Your support conversations will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className={`bg-background-100 rounded-lg p-4 border ${ticket.is_read ? "border-background-200/70" : "border-primary-200/70"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ticket.is_read ? "bg-background-200" : "bg-primary-100"}`}>
                        <i className={`${ticket.is_read ? "ri-mail-open-line text-foreground-400" : "ri-mail-line text-primary-600"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground-900 whitespace-pre-wrap break-words">{ticket.message}</p>
                        <p className="text-[11px] text-foreground-400 mt-1">{formatDate(ticket.created_at)}</p>
                      </div>
                      {!ticket.is_read && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-primary-500 mt-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FAQ */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5 md:p-6">
          <h2 className="font-heading font-semibold text-lg text-foreground-900 mb-1">Frequently Asked Questions</h2>
          <p className="text-sm text-foreground-500 mb-5">Quick answers to common questions</p>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-lg border border-background-200/70 overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-background-100/50 transition-colors cursor-pointer"
                >
                  <span className="text-sm font-medium text-foreground-900 pr-4">{faq.q}</span>
                  {expandedFaq === i ? <i className="ri-arrow-up-s-line text-foreground-400 shrink-0 transition-transform" /> : <i className="ri-arrow-down-s-line text-foreground-400 shrink-0 transition-transform" />}
                </button>
                {expandedFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-foreground-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to="/docs" className="bg-background-50 rounded-xl border border-background-200/70 p-5 hover:border-primary-300/60 transition-all group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                <i className="ri-book-open-line text-primary-600 text-lg" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-sm text-foreground-900">API Documentation</h3>
                <p className="text-xs text-foreground-500 mt-0.5">Complete integration guide</p>
              </div>
              <i className="ri-arrow-right-line text-foreground-400 ml-auto" />
            </div>
          </Link>
          <Link to="/dashboard/api-keys" className="bg-background-50 rounded-xl border border-background-200/70 p-5 hover:border-primary-300/60 transition-all group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                <i className="ri-key-2-line text-secondary-600 text-lg" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-sm text-foreground-900">API Keys</h3>
                <p className="text-xs text-foreground-500 mt-0.5">Manage your credentials</p>
              </div>
              <i className="ri-arrow-right-line text-foreground-400 ml-auto" />
            </div>
          </Link>
          <Link to="/dashboard/kyc" className="bg-background-50 rounded-xl border border-background-200/70 p-5 hover:border-primary-300/60 transition-all group cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                <i className="ri-shield-user-line text-accent-600 text-lg" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-sm text-foreground-900">KYC Verification</h3>
                <p className="text-xs text-foreground-500 mt-0.5">Verify your account</p>
              </div>
              <i className="ri-arrow-right-line text-foreground-400 ml-auto" />
            </div>
          </Link>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-foreground-400 pt-4 border-t border-background-200/70">
          Support hours: Monday — Friday, 8:00 AM — 6:00 PM EAT. We aim to respond within 1 hour during business hours.
        </p>
      </div>
    </div>
  );
}