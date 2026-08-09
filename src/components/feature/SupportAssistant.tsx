import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

const QUICK_ASKS = [
  "How do I collect a payment?",
  "Why is my payout still pending?",
  "How do I get my API keys?",
  "What documents do I need for verification?",
];

/**
 * Live AI support assistant. One conversation per visit — nothing is stored,
 * so no customer detail is retained after the tab is closed.
 */
export default function SupportAssistant() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/public/support-chat" }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  // Keep the composer focused for normal chat use.
  useEffect(() => {
    if (!isBusy) textareaRef.current?.focus();
  }, [isBusy, messages.length]);

  const send = (text: string) => {
    const value = text.trim();
    if (!value || isBusy) return;
    setInput("");
    sendMessage({ text: value });
  };

  return (
    <div className="rounded-2xl border border-foreground-200/20 bg-background-100/40 overflow-hidden">
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-foreground-200/15">
        <span className="h-9 w-9 rounded-full bg-accent-500/15 text-accent-500 grid place-items-center">
          <i className="ri-customer-service-2-line text-lg" />
        </span>
        <div className="min-w-0">
          <p className="font-medium leading-tight">Oba · ObPay Assistant</p>
          <p className="text-xs text-foreground-500 leading-tight">
            Instant answers, 24/7. A human takes over for anything account-specific.
          </p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-500">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Online
        </span>
      </div>

      <Conversation className="h-[380px] sm:h-[440px]">
        <ConversationContent className="gap-4">
          {messages.length === 0 && (
            <div className="space-y-4 py-6 text-center">
              <p className="text-sm text-foreground-500">
                Ask me anything about collections, payouts, verification, payment links or the ObPay API.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_ASKS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="text-xs px-3 py-1.5 rounded-full border border-foreground-200/25 hover:border-accent-500/60 cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => {
            const text = message.parts
              .map((part) => (part.type === "text" ? part.text : ""))
              .join("");
            if (!text) return null;
            return (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  <MessageResponse>{text}</MessageResponse>
                </MessageContent>
              </Message>
            );
          })}

          {status === "submitted" && (
            <Shimmer className="text-sm">Oba is thinking…</Shimmer>
          )}

          {error && (
            <p className="text-sm text-red-500">
              The assistant is unavailable right now. Please open a ticket below and our team will reply.
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="p-3 sm:p-4 border-t border-foreground-200/15">
        <PromptInput
          onSubmit={(_message, event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question…"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={!input.trim() && !isBusy} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-[11px] text-foreground-500">
          Oba is an AI assistant and can make mistakes. Never share PINs, passwords or OTP codes.
        </p>
      </div>
    </div>
  );
}
