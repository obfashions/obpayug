import { formatCurrency } from "@/lib/currency";

interface Transaction {
  id: string;
  amount: number;
  status: string;
  type: string;
  created_at: string;
  fee_amount: number;
  net_amount: number;
  currency?: string;
}

interface CollectionBreakdownProps {
  transactions: Transaction[];
  activeCurrency?: string;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function CollectionBreakdown({ transactions, activeCurrency = "UGX" }: CollectionBreakdownProps) {
  const successCollections = transactions.filter(
    (t) => t.type === "collection" && t.status === "success" && (t.currency || "UGX") === activeCurrency
  );

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = getWeekStart(now);
  const monthStart = getMonthStart(now);

  const dailyCollections = successCollections.filter(
    (t) => new Date(t.created_at) >= todayStart
  );
  const dailyGross = dailyCollections.reduce((s, t) => s + t.amount, 0);
  const dailyFees = dailyCollections.reduce((s, t) => s + (t.fee_amount || 0), 0);
  const dailyNet = dailyCollections.reduce((s, t) => s + (t.net_amount || 0), 0);
  const dailyCount = dailyCollections.length;

  const weeklyCollections = successCollections.filter(
    (t) => new Date(t.created_at) >= weekStart
  );
  const weeklyGross = weeklyCollections.reduce((s, t) => s + t.amount, 0);
  const weeklyFees = weeklyCollections.reduce((s, t) => s + (t.fee_amount || 0), 0);
  const weeklyNet = weeklyCollections.reduce((s, t) => s + (t.net_amount || 0), 0);
  const weeklyCount = weeklyCollections.length;

  const monthlyCollections = successCollections.filter(
    (t) => new Date(t.created_at) >= monthStart
  );
  const monthlyGross = monthlyCollections.reduce((s, t) => s + t.amount, 0);
  const monthlyFees = monthlyCollections.reduce((s, t) => s + (t.fee_amount || 0), 0);
  const monthlyNet = monthlyCollections.reduce((s, t) => s + (t.net_amount || 0), 0);
  const monthlyCount = monthlyCollections.length;

  const periods = [
    {
      label: "Today",
      icon: "ri-sun-line",
      color: "bg-amber-100 text-amber-600",
      borderColor: "border-amber-200/70",
      count: dailyCount,
      gross: dailyGross,
      fees: dailyFees,
      net: dailyNet,
    },
    {
      label: "This Week",
      icon: "ri-calendar-line",
      color: "bg-emerald-100 text-emerald-600",
      borderColor: "border-emerald-200/70",
      count: weeklyCount,
      gross: weeklyGross,
      fees: weeklyFees,
      net: weeklyNet,
    },
    {
      label: "This Month",
      icon: "ri-calendar-2-line",
      color: "bg-primary-100 text-primary-600",
      borderColor: "border-primary-200/70",
      count: monthlyCount,
      gross: monthlyGross,
      fees: monthlyFees,
      net: monthlyNet,
    },
  ];

  return (
    <div className="bg-background-50 rounded-xl border border-background-200/70">
      <div className="p-5 border-b border-background-200/70">
        <div className="flex items-center gap-2">
          <i className="ri-bar-chart-grouped-line text-accent-600" />
          <h3 className="font-heading font-semibold text-sm text-foreground-900">Collection Breakdown</h3>
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {periods.map((period) => (
            <div
              key={period.label}
              className={`bg-background-100 rounded-lg p-4 border ${period.borderColor} hover:border-background-300/60 transition-all`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg ${period.color} flex items-center justify-center`}>
                  <i className={`${period.icon} text-sm`} />
                </div>
                <span className="text-xs font-medium text-foreground-600">{period.label}</span>
              </div>

              {period.count === 0 ? (
                <p className="text-xs text-foreground-400 italic">No collections yet</p>
              ) : (
                <div className="space-y-2">
                  <div>
                    <p className="text-[11px] text-foreground-500">Gross</p>
                    <p className="text-sm font-bold text-foreground-900">{formatCurrency(period.gross, activeCurrency)}</p>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[11px] text-foreground-500">Fees</p>
                      <p className="text-xs font-medium text-red-600">-{formatCurrency(period.fees, activeCurrency)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-foreground-500">Net</p>
                      <p className="text-xs font-bold text-primary-600">{formatCurrency(period.net, activeCurrency)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1 bg-background-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (period.net / (period.gross || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-foreground-500 whitespace-nowrap">{period.count} txns</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}