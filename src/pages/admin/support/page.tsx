import { useState, useEffect, useRef, useCallback } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Conversation {
  userId: string;
  userName: string;
  userEmail: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  userStatus: string;
}

interface Message {
  id: number;
  sender_id: string;
  receiver_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function AdminSupportPage() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      // Fetch messages where this admin is the receiver OR legacy null-receiver messages
      const { data: allMsgs, error: msgErr } = await supabase
        .from("support_messages")
        .select("sender_id, receiver_id, message, created_at, is_read")
        .or(profile?.id ? `receiver_id.eq.${profile.id},receiver_id.is.null` : "receiver_id.is.null")
        .order("created_at", { ascending: false });

      if (msgErr) throw msgErr;

      const convMap = new Map<string, { lastMsg: string; lastTime: string; unread: number }>();
      (allMsgs || []).forEach((m: any) => {
        if (profile?.id && m.sender_id === profile.id) return;
        const existing = convMap.get(m.sender_id);
        if (!existing || m.created_at > existing.lastTime) {
          convMap.set(m.sender_id, {
            lastMsg: m.message,
            lastTime: m.created_at,
            unread: (existing?.unread || 0) + (m.is_read ? 0 : 1),
          });
        } else if (!m.is_read) {
          convMap.set(m.sender_id, { ...existing, unread: existing.unread + 1 });
        }
      });

      const userIds = Array.from(convMap.keys());
      if (userIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, status")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const convList: Conversation[] = userIds.map((uid) => {
        const conv = convMap.get(uid)!;
        const prof = profileMap.get(uid);
        return {
          userId: uid,
          userName: prof?.full_name || "Unknown User",
          userEmail: prof?.email || "",
          lastMessage: conv.lastMsg,
          lastMessageTime: conv.lastTime,
          unreadCount: conv.unread,
          userStatus: prof?.status || "unknown",
        };
      });

      convList.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
      setConversations(convList);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const fetchMessages = useCallback(async (userId: string) => {
    try {
      const { data, error: msgErr } = await supabase
        .from("support_messages")
        .select("*")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order("created_at", { ascending: true });

      if (msgErr) throw msgErr;
      setMessages((data as Message[]) || []);

      const unreadIds = (data || [])
        .filter((m: any) => m.receiver_id === profile?.id && !m.is_read)
        .map((m: any) => m.id);

      if (unreadIds.length > 0) {
        await supabase.from("support_messages").update({ is_read: true }).in("id", unreadIds);
      }
    } catch (err: any) {
      console.error("Failed to fetch messages:", err);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchConversations();

    const channel = supabase
      .channel("support-chat-admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload: any) => {
          const newMsg = payload.new as Message;
          fetchConversations();
          if (selectedUserId && (newMsg.sender_id === selectedUserId || newMsg.receiver_id === selectedUserId)) {
            setMessages((prev) => {
              const withoutOptimistic = newMsg.sender_id === profile?.id
                ? prev.filter((m) => m.id < 1000000000000)
                : prev;
              if (withoutOptimistic.find((m) => m.id === newMsg.id)) return withoutOptimistic;
              return [...withoutOptimistic, newMsg];
            });
            if (newMsg.sender_id === selectedUserId && profile?.id) {
              supabase.from("support_messages").update({ is_read: true }).eq("id", newMsg.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUserId, profile?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedUserId) {
      fetchMessages(selectedUserId);
    }
  }, [selectedUserId, fetchMessages]);

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setShowChatOnMobile(true);
  };

  const handleBackToList = () => {
    setShowChatOnMobile(false);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedUserId || !profile?.id) return;

    const trimmed = newMessage.trim();
    setNewMessage("");

    const tempId = Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      sender_id: profile.id,
      receiver_id: selectedUserId,
      message: trimmed,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const { error: sendErr } = await supabase.from("support_messages").insert({
      sender_id: profile.id,
      receiver_id: selectedUserId,
      message: trimmed,
      is_read: false,
    });

    if (sendErr) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(trimmed);
    }

    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const selectedConv = conversations.find((c) => c.userId === selectedUserId);

  const showList = !showChatOnMobile || window.innerWidth >= 1024;

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-10rem)] bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
        {/* Conversations List — hidden on mobile when chat is open */}
        <div className={`${showChatOnMobile ? "hidden lg:flex" : "flex"} w-full lg:w-80 xl:w-96 shrink-0 border-r border-background-200/70 flex-col`}>
          <div className="p-4 border-b border-background-200/70">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-lg text-foreground-900">Support Chat</h2>
                <p className="text-xs text-foreground-500 mt-0.5">
                  {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={fetchConversations}
                className="w-8 h-8 rounded-lg hover:bg-background-100 flex items-center justify-center text-foreground-400 hover:text-foreground-600 transition-colors cursor-pointer"
                title="Refresh"
              >
                <i className="ri-refresh-line" />
              </button>
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
                <button onClick={fetchConversations} className="text-sm text-primary-500 hover:text-primary-600 font-medium cursor-pointer">Retry</button>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-4">
                  <i className="ri-chat-3-line text-foreground-400 text-2xl" />
                </div>
                <p className="text-sm text-foreground-500 mb-1">No conversations yet</p>
                <p className="text-xs text-foreground-400">Users can start a chat from their dashboard</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.userId}
                  onClick={() => handleSelectUser(conv.userId)}
                  className={`w-full text-left px-4 py-3.5 border-b border-background-100 hover:bg-background-100/50 transition-colors cursor-pointer ${
                    selectedUserId === conv.userId ? "bg-primary-50 border-l-[3px] border-l-primary-500" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                      conv.userStatus === "active" ? "bg-primary-100" : "bg-background-200"
                    }`}>
                      <span className={`font-heading font-bold text-sm ${
                        conv.userStatus === "active" ? "text-primary-600" : "text-foreground-500"
                      }`}>
                        {conv.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground-900 truncate">{conv.userName}</p>
                        <span className="text-[10px] text-foreground-400 shrink-0">{formatTime(conv.lastMessageTime)}</span>
                      </div>
                      <p className="text-xs text-foreground-600 truncate mt-0.5 leading-relaxed">{conv.lastMessage}</p>
                      <span className="text-[10px] text-foreground-400 mt-1 block">{conv.userEmail}</span>
                    </div>
                    {conv.unreadCount > 0 && selectedUserId !== conv.userId && (
                      <span className="min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-accent-500 text-background-50 text-[10px] font-bold px-1.5 shrink-0">
                        {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div className={`${showChatOnMobile ? "flex" : "hidden lg:flex"} flex-1 flex-col min-w-0`}>
          {!selectedUserId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-full bg-background-100 flex items-center justify-center mb-5">
                <i className="ri-chat-3-line text-3xl text-foreground-400" />
              </div>
              <h3 className="font-heading font-semibold text-lg text-foreground-900 mb-1">Select a Conversation</h3>
              <p className="text-sm text-foreground-500 max-w-xs">
                Pick a conversation from the left to start chatting with a user.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-background-200/70 flex items-center gap-3 shrink-0">
                <button
                  onClick={handleBackToList}
                  className="lg:hidden w-9 h-9 rounded-lg hover:bg-background-100 flex items-center justify-center text-foreground-500 cursor-pointer shrink-0"
                >
                  <i className="ri-arrow-left-line text-lg" />
                </button>
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <span className="text-primary-600 font-heading font-bold text-sm">
                    {selectedConv?.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "??"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground-900">{selectedConv?.userName}</p>
                  <p className="text-xs text-foreground-500 truncate">{selectedConv?.userEmail}</p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                  selectedConv?.userStatus === "active"
                    ? "bg-primary-100 text-primary-700"
                    : "bg-background-200 text-foreground-500"
                }`}>
                  {selectedConv?.userStatus || "unknown"}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-background-100/50">
                {messages.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-3">
                      <i className="ri-chat-smile-2-line text-2xl text-foreground-400" />
                    </div>
                    <p className="text-sm text-foreground-500">No messages yet</p>
                    <p className="text-xs text-foreground-400 mt-1">Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === profile?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] ${isMine ? "order-1" : ""}`}>
                          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                            isMine
                              ? "bg-primary-500 text-background-50 rounded-br-md"
                              : "bg-background-50 text-foreground-900 rounded-bl-md border border-background-200/70"
                          }`}>
                            <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                          </div>
                          <p className={`text-[10px] text-foreground-400 mt-1 ${isMine ? "text-right" : "text-left"}`}>
                            {formatTime(msg.created_at)}
                            {isMine && <span className="ml-1">{msg.is_read ? "Read" : "Sent"}</span>}
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
                    ref={inputRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your reply..."
                    rows={2}
                    className="flex-1 px-4 py-3 rounded-xl border border-background-300/60 bg-background-100 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 resize-none"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim()}
                    className="w-12 h-12 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-background-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <i className="ri-send-plane-fill text-xl" />
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