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

const HELP_TOPICS = [
  "Payments & collections",
  "Payouts & withdrawals",
  "Currency exchange",
  "API & integration",
  "Identity verification (KYC)",
  "Account & security",
  "Something else",
];

export default function SupportChatWidget() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showBubble, setShowBubble] = useState(true);
  const [phase, setPhase] = useState<"topic" | "chat">("topic");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [customTopic, setCustomTopic] = useState("");
  const [assignedAgent, setAssignedAgent] = useState<SupportAgent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch chat messages with the assigned assistant
  const fetchMessages = useCallback(async () => {
    if (!profile?.id || !assignedAgent?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .or(
          `and(sender_id.eq.${profile.id},receiver_id.eq.${assignedAgent.id}),and(sender_id.eq.${assignedAgent.id},receiver_id.eq.${profile.id})`
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
  }, [profile?.id, assignedAgent?.id]);

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
    if (!profile?.id || !assignedAgent?.id) return;

    const channel = supabase
      .channel(`support-chat-${profile.id}-${assignedAgent.id}`)
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
          // Only add if it's from our assigned agent
          if (newMsg.sender_id !== assignedAgent.id) return;
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
          if (newMsg.receiver_id !== assignedAgent.id) return;
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
  }, [profile?.id, assignedAgent?.id, isOpen]);

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
    setPhase("topic");
    setAssignedAgent(null);
    setSelectedTopic(null);
    setCustomTopic("");
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowBubble(true);
    setAssignedAgent(null);
    setPhase("topic");
    setSelectedTopic(null);
    setCustomTopic("");
    fetchUnreadCount();
  };

  // Start a conversation: assign an available assistant internally and send the topic as the first message
  const handleStartChat = async () => {
    if (!profile) return;
    const topic = selectedTopic === "Something else" ? customTopic.trim() : selectedTopic;
    if (!topic) return;
    setStarting(true);
    try {
      // Internally pick an available support assistant — never shown to the user
      const { data: agents } = await supabase
        .from("profiles")
        .select("id, full_name, email, role_tag")
        .eq("support_agent", true)
        .eq("status", "active")
        .order("full_name", { ascending: true });

      const agent = (agents as SupportAgent[] | null)?.[0] || null;
      if (!agent) {
        console.error("No support assistant available");
        setStarting(false);
        return;
      }

      // Send the topic as the opening message
      const { error } = await supabase.from("support_messages").insert({
        sender_id: profile.id,
        receiver_id: agent.id,
        message: `I need help with: ${topic}`,
        is_read: false,
      });
      if (error) throw error;

      setAssignedAgent(agent);
      setPhase("chat");

      // Notify the assistant by email (non-critical)
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
            requester_message: `Help topic: ${topic}`,
          },
        });
      } catch {
        // silent — email is non-critical
      }
    } catch (err) {
      console.error("Failed to start support chat:", err);
    } finally {
      setStarting(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !profile?.id || !assignedAgent?.id) return;
    const trimmed = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase.from("support_messages").insert({
      sender_id: profile.id,
      receiver_id: assignedAgent.id,
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

  const canStart = selectedTopic && (selectedTopic !== "Something else" || customTopic.trim().length > 0);

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-96 h-[520px] sm:h-[560px] bg-background-50 rounded-t-2xl sm:rounded-2xl border border-background-200/70 shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-primary-500 text-background-50 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-background-50/20 flex items-center justify-center shrink-0">
              <i className="ri-customer-service-2-line text-lg" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">ObPay Support</p>
              <p className="text-xs opacity-70">
                {phase === "topic" ? "How can we help you?" : "Waiting for an available support assistant"}
              </p>
            </div>
            <button onClick={handleClose} className="w-8 h-8 rounded-lg hover:bg-background-50/20 flex items-center justify-center cursor-pointer shrink-0">
              <i className="ri-close-line" />
            </button>
          </div>

          {/* Topic Selection Screen */}
          {phase === "topic" && (
            <div className="flex-1 overflow-y-auto bg-background-100/50 p-4 flex flex-col">
              <div className="bg-background-50 rounded-2xl border border-background-200/70 p-4 mb-4">
                <p className="text-sm font-semibold text-foreground-900 mb-1">What do you need assistance with?</p>
                <p className="text-xs text-foreground-500">Choose a topic and a support assistant will join the conversation.</p>
              </div>
              <div className="space-y-2 flex-1">
                {HELP_TOPICS.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => setSelectedTopic(topic)}
                    className={`w-full text-left rounded-xl border p-3.5 flex items-center gap-3 transition-all cursor-pointer ${
                      selectedTopic === topic
                        ? "bg-primary-50 border-primary-400"
                        : "bg-background-50 border-background-200/70 hover:border-primary-300"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedTopic === topic ? "border-primary-500" : "border-background-300"
                    }`}>
                      {selectedTopic === topic && <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />}
                    </div>
                    <span className="text-sm text-foreground-900">{topic}</span>
                  </button>
                ))}
                {selectedTopic === "Something else" && (
                  <textarea
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="Briefly describe what you need help with..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-background-300/60 bg-background-50 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 resize-none"
                  />
                )}
              </div>
              <button
                onClick={handleStartChat}
                disabled={!canStart || starting}
                className="mt-4 w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-background-50 text-sm font-semibold transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-2"
              >
                {starting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Start conversation"
                )}
              </button>
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
                ) : (
                  <>
                    {/* Waiting notice */}
                    <div className="flex justify-center">
                      <div className="bg-background-50 border border-background-200/70 rounded-full px-4 py-1.5 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-[11px] text-foreground-500">Waiting for an available support assistant</span>
                      </div>
                    </div>
                    {messages.map((msg) => {
                      const isMine = msg.sender_id === profile?.id;
                      return (
                        <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                          {!isMine && (
                            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                              <i className="ri-customer-service-2-line text-primary-600 text-xs" />
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
                    })}
                  </>
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
                    placeholder="Type your message..."
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
