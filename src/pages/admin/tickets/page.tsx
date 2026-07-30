import { useState, useEffect, useRef, useCallback } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface SupportTicket {
  id: number;
  user_id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
}

interface TicketReply {
  id: number;
  ticket_id: number;
  user_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  sender_name?: string;
  is_admin?: boolean;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All", color: "bg-background-200 text-foreground-600" },
  { value: "open", label: "Open", color: "bg-amber-100 text-amber-700" },
  { value: "in_progress", label: "In Progress", color: "bg-sky-100 text-sky-700" },
  { value: "waiting_on_user", label: "Waiting", color: "bg-violet-100 text-violet-700" },
  { value: "resolved", label: "Resolved", color: "bg-emerald-100 text-emerald-700" },
  { value: "closed", label: "Closed", color: "bg-background-200 text-foreground-500" },
];

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-background-200 text-foreground-600" },
  normal: { label: "Normal", color: "bg-sky-100 text-sky-700" },
  high: { label: "High", color: "bg-amber-100 text-amber-700" },
  urgent: { label: "Urgent", color: "bg-accent-100 text-accent-700" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDateFull(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminTicketsPage() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const repliesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      if (searchQuery.trim()) {
        query = query.or(`subject.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`);
      }

      const { data, error: ticketsErr } = await query;
      if (ticketsErr) throw ticketsErr;

      const ticketsData = data || [];

      // Fetch user profiles
      const userIds = [...new Set(ticketsData.map((t) => t.user_id))];
      let profileMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      }

      const enriched = ticketsData.map((t) => ({
        ...t,
        user_name: profileMap.get(t.user_id)?.full_name || "Unknown User",
        user_email: profileMap.get(t.user_id)?.email || "",
      }));

      setTickets(enriched);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchQuery]);

  const fetchReplies = useCallback(async (ticketId: number) => {
    setReplyLoading(true);
    try {
      const { data, error: repliesErr } = await supabase
        .from("support_ticket_replies")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (repliesErr) throw repliesErr;

      const repliesData = (data || []) as TicketReply[];

      // Fetch sender profiles
      const senderIds = [...new Set(repliesData.map((r) => r.user_id))];
      let profileMap = new Map<string, any>();
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("id", senderIds);
        profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      }

      const enriched = repliesData.map((r) => ({
        ...r,
        sender_name: profileMap.get(r.user_id)?.full_name || "Unknown",
        is_admin: profileMap.get(r.user_id)?.role === "admin",
      }));

      setReplies(enriched);
    } catch (err: any) {
      console.error("Failed to fetch replies:", err);
    } finally {
      setReplyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (selectedTicket) {
      fetchReplies(selectedTicket.id);
    }
  }, [selectedTicket, fetchReplies]);

  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies]);

  // Realtime subscription for new replies
  useEffect(() => {
    const channel = supabase
      .channel("admin-ticket-replies")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_ticket_replies" },
        () => {
          if (selectedTicket) fetchReplies(selectedTicket.id);
          fetchTickets();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket]);

  const handleSelectTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setShowDetailOnMobile(true);
  };

  const handleBackToList = () => {
    setShowDetailOnMobile(false);
  };

  const handleUpdateStatus = async (ticketId: number, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === "resolved" || newStatus === "closed") {
      updates.resolved_at = new Date().toISOString();
    }
    const { error: updateErr } = await supabase
      .from("support_tickets")
      .update(updates)
      .eq("id", ticketId);

    if (updateErr) {
      console.error("Failed to update status:", updateErr);
      return;
    }

    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, ...updates } : t))
    );
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket((prev) => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket || !profile?.id) return;
    setSubmitting(true);

    const { error: replyErr } = await supabase
      .from("support_ticket_replies")
      .insert({
        ticket_id: selectedTicket.id,
        user_id: profile.id,
        message: replyText.trim(),
        is_internal: false,
      });

    if (replyErr) {
      console.error("Failed to send reply:", replyErr);
      setSubmitting(false);
      return;
    }

    // If ticket was open, move to in_progress
    if (selectedTicket.status === "open") {
      await supabase
        .from("support_tickets")
        .update({ status: "in_progress" })
        .eq("id", selectedTicket.id);

      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: "in_progress" } : t))
      );
      setSelectedTicket((prev) => prev ? { ...prev, status: "in_progress" } : null);
    }

    // Send email notification to the ticket owner
    const ticketOwnerId = selectedTicket.user_id;
    if (ticketOwnerId) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", ticketOwnerId)
        .maybeSingle();

      if (ownerProfile?.email) {
        supabase.functions.invoke("send-transactional-email", {
          body: {
            email: ownerProfile.email,
            type: "support_ticket_replied",
            data: {
              ticket_id: String(selectedTicket.id),
              ticket_subject: selectedTicket.subject,
              reply_message: replyText.trim(),
              full_name: ownerProfile.full_name || "",
            },
          },
        }).then(() => {}, (e: any) => console.warn("[Tickets] Reply email failed silently:", e));
      }
    }

    setReplyText("");
    setSubmitting(false);
    fetchReplies(selectedTicket.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const filteredTickets = tickets;

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-10rem)] bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
        {/* Ticket List — hidden on mobile when detail is open */}
        <div className={`${showDetailOnMobile ? "hidden lg:flex" : "flex"} w-full lg:w-96 xl:w-[420px] shrink-0 border-r border-background-200/70 flex-col`}>
          <div className="p-4 border-b border-background-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-lg text-foreground-900">Support Tickets</h2>
                <p className="text-xs text-foreground-500 mt-0.5">
                  {filteredTickets.length} ticket{filteredTickets.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={fetchTickets}
                className="w-8 h-8 rounded-lg hover:bg-background-100 flex items-center justify-center text-foreground-400 hover:text-foreground-600 transition-colors cursor-pointer"
              >
                <i className="ri-refresh-line" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tickets..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-background-200/70 bg-background-100 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400"
              />
            </div>

            {/* Status Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFilterStatus(opt.value)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                    filterStatus === opt.value
                      ? "bg-primary-500 text-background-50"
                      : `${opt.color} hover:opacity-80`
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <i className="ri-loader-4-line animate-spin text-2xl text-foreground-400" />
              </div>
            ) : error ? (
              <div className="text-center py-12 px-4">
                <p className="text-sm text-accent-600 mb-3">{error}</p>
                <button onClick={fetchTickets} className="text-sm text-primary-500 font-medium cursor-pointer">Retry</button>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-4">
                  <i className="ri-ticket-2-line text-foreground-400 text-2xl" />
                </div>
                <p className="text-sm text-foreground-500 mb-1">No tickets found</p>
                <p className="text-xs text-foreground-400">
                  {filterStatus !== "all" ? "Try a different filter" : "Users can create tickets from the Support page"}
                </p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const statusInfo = STATUS_OPTIONS.find((s) => s.value === ticket.status);
                const priorityInfo = PRIORITY_LABELS[ticket.priority] || PRIORITY_LABELS.normal;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket)}
                    className={`w-full text-left px-4 py-3.5 border-b border-background-100 hover:bg-background-100/50 transition-colors cursor-pointer ${
                      selectedTicket?.id === ticket.id ? "bg-primary-50 border-l-[3px] border-l-primary-500" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-background-200 flex items-center justify-center shrink-0">
                        <span className="font-heading font-bold text-xs text-foreground-600">
                          {ticket.user_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "??"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusInfo?.color || "bg-background-200 text-foreground-600"}`}>
                            {statusInfo?.label || ticket.status}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${priorityInfo.color}`}>
                            {priorityInfo.label}
                          </span>
                          <span className="text-[10px] text-foreground-400 ml-auto">{formatDate(ticket.created_at)}</span>
                        </div>
                        <p className="text-sm font-medium text-foreground-900 truncate">{ticket.subject}</p>
                        <p className="text-xs text-foreground-600 truncate mt-0.5">{ticket.description}</p>
                        <p className="text-[10px] text-foreground-400 mt-1">{ticket.user_email}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Ticket Detail */}
        <div className={`${showDetailOnMobile ? "flex" : "hidden lg:flex"} flex-1 flex-col min-w-0`}>
          {!selectedTicket ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-full bg-background-100 flex items-center justify-center mb-5">
                <i className="ri-ticket-2-line text-3xl text-foreground-400" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-foreground-900 mb-1">Select a Ticket</h3>
              <p className="text-sm text-foreground-500 max-w-xs">
                Pick a ticket from the left to view details and reply.
              </p>
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="px-4 py-3 border-b border-background-200/70 shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={handleBackToList}
                    className="lg:hidden w-9 h-9 rounded-lg hover:bg-background-100 flex items-center justify-center text-foreground-500 cursor-pointer shrink-0"
                  >
                    <i className="ri-arrow-left-line text-lg" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground-900 truncate">#{selectedTicket.id} — {selectedTicket.subject}</p>
                    <p className="text-xs text-foreground-500">
                      {selectedTicket.user_name} · {formatDateFull(selectedTicket.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Status dropdown */}
                  <div className="relative group">
                    <button className={`text-[11px] font-medium px-2.5 py-1 rounded-full cursor-pointer whitespace-nowrap ${
                      STATUS_OPTIONS.find((s) => s.value === selectedTicket.status)?.color || "bg-background-200 text-foreground-600"
                    }`}>
                      {STATUS_OPTIONS.find((s) => s.value === selectedTicket.status)?.label || selectedTicket.status}
                      <i className="ri-arrow-down-s-line ml-1 text-[10px]" />
                    </button>
                    <div className="absolute top-full left-0 mt-1 bg-background-50 rounded-lg border border-background-200/70 shadow-lg py-1 z-40 hidden group-hover:block min-w-[140px]">
                      {STATUS_OPTIONS.filter((s) => s.value !== "all").map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleUpdateStatus(selectedTicket.id, opt.value)}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap ${
                            selectedTicket.status === opt.value ? "font-semibold text-primary-600" : "text-foreground-700"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${PRIORITY_LABELS[selectedTicket.priority]?.color || ""}`}>
                    {PRIORITY_LABELS[selectedTicket.priority]?.label || "Normal"}
                  </span>
                  <span className="text-[11px] text-foreground-400">{selectedTicket.user_email}</span>
                </div>
              </div>

              {/* Description */}
              <div className="px-4 py-3 bg-background-100/50 border-b border-background-200/70 shrink-0">
                <p className="text-xs font-medium text-foreground-500 mb-1">Description</p>
                <p className="text-sm text-foreground-800 whitespace-pre-wrap leading-relaxed">{selectedTicket.description}</p>
              </div>

              {/* Replies */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {replyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <i className="ri-loader-4-line animate-spin text-xl text-foreground-400" />
                  </div>
                ) : replies.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-3">
                      <i className="ri-chat-smile-2-line text-xl text-foreground-400" />
                    </div>
                    <p className="text-sm text-foreground-500">No replies yet</p>
                    <p className="text-xs text-foreground-400 mt-1">Be the first to respond</p>
                  </div>
                ) : (
                  replies.map((reply) => {
                    const isAdmin = reply.is_admin;
                    return (
                      <div key={reply.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] ${isAdmin ? "" : ""}`}>
                          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                            isAdmin
                              ? "bg-primary-500 text-background-50 rounded-br-md"
                              : "bg-background-50 text-foreground-900 rounded-bl-md border border-background-200/70"
                          }`}>
                            {reply.is_internal && (
                              <span className="block text-[10px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded mb-1.5 w-fit">Internal Note</span>
                            )}
                            <p className="whitespace-pre-wrap break-words">{reply.message}</p>
                          </div>
                          <p className={`text-[10px] text-foreground-400 mt-1 ${isAdmin ? "text-right" : "text-left"}`}>
                            {reply.sender_name} · {formatDate(reply.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={repliesEndRef} />
              </div>

              {/* Reply Input */}
              <div className="p-3 border-t border-background-200/70 bg-background-50 shrink-0">
                <div className="flex items-end gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your reply..."
                    rows={2}
                    maxLength={2000}
                    className="flex-1 px-4 py-3 rounded-xl border border-background-300/60 bg-background-100 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 resize-none"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || submitting}
                    className="w-12 h-12 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-background-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    {submitting ? (
                      <i className="ri-loader-4-line animate-spin text-xl" />
                    ) : (
                      <i className="ri-send-plane-fill text-xl" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}