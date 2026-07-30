import { useEffect, useState, useRef, useMemo } from "react";
import { formatCurrency } from "@/lib/currency";

interface Transaction {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  customer_phone: string;
  customer_name: string;
  created_at: string;
}

interface LiveTransactionFeedProps {
  transactions: Transaction[];
  activeCurrency?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function maskName(name: string | null | undefined): string {
  if (!name || name.trim().length === 0) return "Customer";
  const trimmed = name.trim();
  if (/^\+?\d[\d\s\-]+$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length >= 8) {
      return digits.slice(0, 3) + "****" + digits.slice(-2);
    }
    return "Customer";
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts[0] + " " + parts[parts.length - 1].charAt(0) + ".";
}

export default function LiveTransactionFeed({ transactions, activeCurrency = "UGX" }: LiveTransactionFeedProps) {
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const successOnly = useMemo(
    () => transactions.filter((t) => t.status === "success"),
    [transactions]
  );

  useEffect(() => {
    const currentIds = new Set(successOnly.map((t) => t.id));
    const prevIds = prevIdsRef.current;

    if (prevIds.size > 0) {
      const added = new Set([...currentIds].filter((id) => !prevIds.has(id)));
      if (added.size > 0) {
        setNewIds(added);
        setTimeout(() => setNewIds(new Set()), 3000);
      }
    }

    prevIdsRef.current = currentIds;
  }, [successOnly]);

  const recent = successOnly.slice(0, 15);

  if (recent.length === 0) {
    return (
      <div className="bg-background-50 rounded-xl border border-background-200/70">
        <div className="p-5 border-b border-background-200/70">
          <div className="flex items-center gap-2">
            <i className="ri-live-line text-red-500" />
            <h3 className="font-heading font-semibold text-sm text-foreground-900">Live Transactions</h3>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-1" />
          </div>
        </div>
        <div className="p-8 text-center">
          <div className="w-10 h-10 rounded-full bg-background-200/70 flex items-center justify-center mx-auto mb-3">
            <i className="ri-exchange-line text-foreground-400" />
          </div>
          <p className="text-xs text-foreground-500">Waiting for transactions...</p>
          <p className="text-[11px] text-foreground-400 mt-1">Real-time feed will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-50 rounded-xl border border-background-200/70">
      <div className="p-5 border-b border-background-200/70">
        <div className="flex items-center gap-2">
          <i className="ri-live-line text-red-500" />
          <h3 className="font-heading font-semibold text-sm text-foreground-900">Live Transactions</h3>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse ml-1" />
          <span className="text-[10px] text-foreground-400 ml-auto">{recent.length} recent</span>
        </div>
      </div>
      <div ref={scrollRef} className="divide-y divide-background-100 max-h-[420px] overflow-y-auto">
        {recent.map((txn) => {
          const isNew = newIds.has(txn.id);
          const displayName = maskName(txn.customer_name || txn.customer_phone);
          return (
            <div
              key={txn.id}
              className={`px-5 py-3 flex items-center gap-3 transition-all ${
                isNew ? "bg-emerald-50/50 animate-[fadeSlideIn_0.5s_ease-out]" : "hover:bg-background-100/50"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  txn.type === "collection"
                    ? "bg-emerald-100"
                    : "bg-accent-100"
                }`}
              >
                <i
                  className={`${
                    txn.type === "collection" ? "ri-arrow-down-line" : "ri-arrow-up-line"
                  } ${
                    txn.type === "collection"
                      ? "text-emerald-600"
                      : "text-accent-600"
                  } text-sm`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground-900 truncate">
                    {displayName}
                  </span>
                  {isNew && (
                    <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full animate-pulse">
                      NEW
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-foreground-500 font-mono">{txn.reference}</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    success
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p
                  className={`text-sm font-semibold ${
                    txn.type === "collection" ? "text-emerald-600" : "text-accent-600"
                  }`}
                >
                  {txn.type === "collection" ? "+" : "-"}
                  {formatCurrency(txn.amount, txn.currency || activeCurrency)}
                </p>
                <p className="text-[10px] text-foreground-400">{timeAgo(txn.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}