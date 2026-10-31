import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: number;
  sender_id: string;
  receiver_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface SupportAgent {
  id: string;
  full_name: string;
  email: string;
  role_tag: string | null;
}

export default function SupportChatWidget() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(true);
  const [phase, setPhase] = useState<"choose" | "chat">("choose");
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<SupportAgent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch available support assistants
  const fetchAgents = useCallback(async () => {
    setAgentsLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, role_tag")
        .eq("support_agent", true)
        .eq("status", "active")
        .order("full_name", { ascending: true });

      setAgents((data as SupportAgent[]) || []);
    } catch (err) {
      console.error("Failed to load support agents:", err);
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  // Fetch chat messages with the selected assistant
  const fetchMessages = useCallback(async () => {
    if (!profile?.id || !selectedAgent?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${profile.id},receiver_id.eq.${selectedAgent.id}),and(sender_id.eq.${selectedAgent.id},receiver_id.eq.${profile.id})`
        )
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data as Message[]) || []);

      // Mark messages from this agent as read
      const unreadIds = (data || [])
        .filter((m: any) => m.receiver_id === profile.id && !m.is_read)
        .map((m: any) => m.id);

      if (unreadIds.length > 0) {
        await supabase
          .from("support_messages")
          .update({ is_read: true })
          .in("id", unreadIds);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, selectedAgent?.id]);

  // Count unread messages from ALL agents (for the floating bubble badge)
  const fetchUnreadCount = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from("support_messages")
        .select("id, is_read")
        .eq("receiver_id", profile.id)
        .eq("is_read", false);

      setUnreadCount((data || []).length);
    } catch {
      // silent
    }
  }, [profile?.id]);

  // Subscribe to realtime for THIS agent conversation
  useEffect(() => {
    if (!profile?.id || !selectedAgent?.id) return;

    const channel = supabase
      .channel(`support-chat-${profile.id}-${selectedAgent.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `receiver_id=eq.${profile.id}`,
        },
        (payload: any) => {
          const newMsg = payload.new as Message;
          // Only add if it's from our selected agent
          if (newMsg.sender_id !== selectedAgent.id) return;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (isOpen) {
            supabase.from("support_messages").update({ is_read: true }).eq("id", newMsg.id);
          } else {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `sender_id=eq.${profile.id}`,
        },
        (payload: any) => {
          const newMsg = payload.new as Message;
          if (newMsg.receiver_id !== selectedAgent.id) return;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
    fetchMessages();
    fetchUnreadCount();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, selectedAgent?.id, isOpen]);

  // Also listen for unread messages from all agents (for badge)
  useEffect(() => {
    if (!profile?.id) return;
    const unreadChannel = supabase
      .channel(`support-unread-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `receiver_id=eq.${profile.id}`,
        },
        () => {
          if (!isOpen) fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(unreadChannel);
    };
  }, [profile?.id, isOpen]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleOpen = () => {
    setIsOpen(true);
    setShowBubble(false);
    setPhase("choose");
    setSelectedAgent(null);
    fetchAgents();
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowBubble(true);
    setSelectedAgent(null);
    setPhase("choose");
    fetchUnreadCount();
  };

  const handleSelectAgent = async (agent: SupportAgent) => {
    if (!profile) return;
    setSelectedAgent(agent);
    setPhase("chat");

    // Send notification email to the assistant
    const mp = profile.merchant_profiles?.[0];
    try {
      await supabase.functions.invoke("send-support-notification", {
        body: {
          _action: "notify-assistant",
          assistant_id: agent.id,
          assistant_name: agent.full_name,
          assistant_email: agent.email,
          requester_name: profile.full_name,
          requester_email: profile.email,
          requester_company: (profile as any).merchant_profiles?.[0]?.company_name || "",
          requester_message: "",
        },
      });
    } catch {
      // silent — email is non-critical
    }
  };

  const handleBackToChoose = () => {
    setSelectedAgent(null);
    setPhase("choose");
    setMessages([]);
    fetchAgents();
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !profile?.id || !selectedAgent?.id) return;
    const trimmed = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase.from("support_messages").insert({
      sender_id: profile.id,
      receiver_id: selectedAgent.id,
      message: trimmed,
      is_read: false,
    });

    if (error) {
      console.error("Send failed:", error);
      setNewMessage(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const getRoleBadge = (roleTag: string | null) => {
    if (!roleTag) return null;
    const map: Record<string, { label: string; cls: string }> = {
      super_admin: { label: "Admin", cls: "bg-accent-100 text-accent-700" },
      support_agent: { label: "Support", cls: "bg-primary-100 text-primary-700" },
      finance_admin: { label: "Finance", cls: "bg-secondary-100 text-secondary-700" },
      kyc_reviewer: { label: "KYC", cls: "bg-amber-100 text-amber-700" },
    };
    const entry = map[roleTag] || { label: roleTag, cls: "bg-background-200 text-foreground-600" };
    return (
      <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full ${entry.cls}`}>
        {entry.label}
      </span>
    );
  };

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-96 h-[520px] sm:h-[560px] bg-background-50 rounded-t-2xl sm:rounded-2xl border border-background-200/70 shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-primary-500 text-background-50 flex items-center gap-3 shrink-0">
            {phase === "chat" && selectedAgent ? (
              <>
                <button onClick={handleBackToChoose} className="w-8 h-8 rounded-lg hover:bg-background-50/20 flex items-center justify-center cursor-pointer shrink-0">
                  <i className="ri-arrow-left-line" />
                </button>
                <div className="w-8 h-8 rounded-full bg-background-50/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold">{selectedAgent.full_name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedAgent.full_name}</p>
                  <p className="text-[10px] opacity-75 truncate">ObPay Support</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-background-50/20 flex items-center justify-center shrink-0">
                  <i className="ri-customer-service-2-line text-lg" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">ObPay Support</p>
                  <p className="text-xs opacity-70">Choose who to talk to</p>
                </div>
              </>
            )}
            <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-background-50/20 flex items-center justify-center cursor-pointer shrink-0">
              <i className="ri-close-line" />
            </button>
          </div>

          {/* Agent Selection Screen */}
          {phase === "choose" && (
            <div className="flex-1 overflow-y-auto bg-background-100/50 p-4">
              {agentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <i className="ri-loader-4-line animate-spin text-2xl text-foreground-400" />
                </div>
              ) : agents.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-14 h-14 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-3">
                    <i className="ri-user-voice-line text-2xl text-foreground-400" />
                  </div>
                  <p className="text-sm text-foreground-500 mb-1">No agents available</p>
                  <p className="text-xs text-foreground-400">Leave a message and we&apos;ll get back to you</p>
                  <button
                    onClick={() => {
                      // Fallback: start chat with no specific agent
                      setPhase("chat");
                      setSelectedAgent(null);
                    }}
                    className="mt-3 text-sm text-primary-500 hover:text-primary-600 font-medium cursor-pointer whitespace-nowrap"
                  >
                    Send a general message
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-foreground-500 mb-3 px-1">Select a support assistant to chat with:</p>
                  <div className="space-y-2">
                    {agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => handleSelectAgent(agent)}
                        className="w-full text-left bg-background-50 hover:bg-background-100 rounded-xl border border-background-200/70 p-4 flex items-center gap-3 transition-all cursor-pointer group hover:border-primary-300"
                      >
                        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center shrink-0 group-hover:bg-primary-200 transition-colors">
                          <span className="text-primary-600 font-heading font-bold text-base">
                            {agent.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground-900">{agent.full_name}</p>
                            {getRoleBadge(agent.role_tag)}
                          </div>
                          <p className="text-xs text-foreground-500 mt-0.5 truncate">{agent.email}</p>
                          <div className="flex items-center gap-1 mt-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-[10px] text-foreground-500">Support team</span>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-background-100 group-hover:bg-primary-100 flex items-center justify-center shrink-0 transition-colors">
                          <i className="ri-arrow-right-s-line text-foreground-400 group-hover:text-primary-600" />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Chat Messages */}
          {phase === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background-100/50">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <i className="ri-loader-4-line animate-spin text-2xl text-foreground-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-3">
                      <i className="ri-chat-smile-2-line text-2xl text-foreground-400" />
                    </div>
                    <p className="text-sm text-foreground-500 mb-1">
                      {selectedAgent ? `Chat with ${selectedAgent.full_name}` : "ObPay Support"}
                    </p>
                    <p className="text-xs text-foreground-400">Send a message to get started</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === profile?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        {!isMine && (
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                            <span className="text-primary-600 text-[10px] font-bold">
                              {selectedAgent?.full_name?.charAt(0)?.toUpperCase() || "S"}
                            </span>
                          </div>
                        )}
                        <div className={`max-w-[80%]`}>
                          <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                            isMine
                              ? "bg-primary-500 text-background-50 rounded-br-md"
                              : "bg-background-50 text-foreground-900 rounded-bl-md border border-background-200/70"
                          }`}>
                            <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                          </div>
                          <p className={`text-[10px] text-foreground-400 mt-0.5 ${isMine ? "text-right" : "text-left ml-9"}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-background-200/70 bg-background-50 shrink-0">
                <div className="flex items-end gap-2">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedAgent ? `Message ${selectedAgent.full_name}...` : "Type your message..."}
                    rows={1}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-background-300/60 bg-background-100 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 resize-none"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim()}
                    className="w-10 h-10 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-background-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <i className="ri-send-plane-fill text-lg" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Bubble Button */}
      {showBubble && (
        <button
          onClick={handleOpen}
          aria-label="Contact support"
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-primary-500 hover:bg-primary-600 text-background-50 flex items-center justify-center shadow-sm transition-colors z-50 cursor-pointer"
        >
          <i className="ri-chat-3-line text-2xl" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-accent-500 text-background-50 text-[11px] font-bold px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}
    </>
  );
}