import { useState } from "react";

interface SavingsPlan {
  amount: number;
  duration: number;
  dailyRate: number;
  totalReturn: number;
  totalInterest: number;
  createdAt: string;
}

function formatCurrency(amount: number) {
  return "UGX " + amount.toLocaleString("en-UG");
}

export default function SavingsCalculator() {
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [savedPlans, setSavedPlans] = useState<SavingsPlan[]>(() => {
    try {
      const stored = localStorage.getItem("obpay_savings_plans");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showResult, setShowResult] = useState(false);
  const [toast, setToast] = useState("");

  const dailyRate = 0.04; // 4% daily

  const amountNum = parseFloat(amount) || 0;
  const durationNum = parseInt(duration) || 0;
  const totalReturn = amountNum > 0 && durationNum > 0 ? amountNum * Math.pow(1 + dailyRate, durationNum) : 0;
  const totalInterest = totalReturn - amountNum;

  const handleCalculate = () => {
    if (amountNum <= 0 || durationNum <= 0) return;
    setShowResult(true);
  };

  const handleSave = () => {
    if (amountNum <= 0 || durationNum <= 0) return;

    const plan: SavingsPlan = {
      amount: amountNum,
      duration: durationNum,
      dailyRate: dailyRate * 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      createdAt: new Date().toISOString(),
    };

    const updated = [plan, ...savedPlans].slice(0, 20);
    setSavedPlans(updated);
    localStorage.setItem("obpay_savings_plans", JSON.stringify(updated));

    setToast("Savings plan saved successfully!");
    setTimeout(() => setToast(""), 3000);
    setAmount("");
    setDuration("");
    setShowResult(false);
  };

  const handleDeletePlan = (index: number) => {
    const updated = savedPlans.filter((_, i) => i !== index);
    setSavedPlans(updated);
    localStorage.setItem("obpay_savings_plans", JSON.stringify(updated));
  };

  const durationOptions = [
    { value: 7, label: "7 Days" },
    { value: 14, label: "14 Days" },
    { value: 30, label: "30 Days" },
    { value: 60, label: "60 Days" },
    { value: 90, label: "90 Days" },
    { value: 180, label: "180 Days" },
    { value: 365, label: "1 Year" },
  ];

  return (
    <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
      <div className="p-5 border-b border-background-200/70">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <i className="ri-plant-line text-emerald-600" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-sm text-foreground-900">Savings Calculator</h3>
            <p className="text-[11px] text-foreground-500">Earn 4% daily compound returns</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Toast */}
        {toast && (
          <div className="bg-emerald-100 text-emerald-700 text-xs px-3 py-2 rounded-lg flex items-center gap-2 animate-[fadeSlideIn_0.3s_ease-out]">
            <i className="ri-check-line" />
            {toast}
          </div>
        )}

        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground-600 mb-1">Amount (UGX)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-foreground-400 font-medium">UGX</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setShowResult(false); }}
                placeholder="100,000"
                min="1000"
                className="w-full pl-12 pr-4 py-2.5 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-600 mb-1">Duration</label>
            <select
              value={duration}
              onChange={(e) => { setDuration(e.target.value); setShowResult(false); }}
              className="w-full px-3 py-2.5 rounded-lg border border-background-300/60 bg-background-50 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">Select duration...</option>
              {durationOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Calculate button */}
        <button
          onClick={handleCalculate}
          disabled={amountNum <= 0 || durationNum <= 0}
          className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-background-200 disabled:text-foreground-400 text-background-50 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
        >
          Calculate Returns
        </button>

        {/* Results */}
        {showResult && amountNum > 0 && durationNum > 0 && (
          <div className="bg-background-100 rounded-lg p-4 space-y-3 animate-[fadeSlideIn_0.3s_ease-out]">
            <div className="flex justify-between items-center">
              <span className="text-xs text-foreground-500">Principal</span>
              <span className="text-sm font-semibold text-foreground-900">{formatCurrency(amountNum)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-foreground-500">Duration</span>
              <span className="text-sm font-medium text-foreground-700">{durationNum} days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-foreground-500">Daily Rate</span>
              <span className="text-sm font-medium text-emerald-600">4% (compound)</span>
            </div>
            <div className="border-t border-background-200/70 pt-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-foreground-500">Total Interest</span>
                <span className="text-sm font-bold text-emerald-600">+{formatCurrency(Math.round(totalInterest * 100) / 100)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-foreground-700">Total Return</span>
                <span className="text-base font-bold text-foreground-900">{formatCurrency(Math.round(totalReturn * 100) / 100)}</span>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-background-50 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              <i className="ri-save-line" />
              Save Plan
            </button>
          </div>
        )}
      </div>

      {/* Saved Plans */}
      {savedPlans.length > 0 && (
        <div className="border-t border-background-200/70">
          <div className="px-5 py-3 flex items-center justify-between">
            <span className="text-xs font-medium text-foreground-600">Saved Plans ({savedPlans.length})</span>
          </div>
          <div className="px-5 pb-4 space-y-2 max-h-64 overflow-y-auto">
            {savedPlans.map((plan, i) => (
              <div key={i} className="bg-background-100 rounded-lg p-3 flex items-center justify-between group">
                <div>
                  <p className="text-sm font-semibold text-foreground-900">{formatCurrency(plan.amount)}</p>
                  <p className="text-[11px] text-foreground-500">
                    {plan.duration} days · {plan.dailyRate}% daily · Return: {formatCurrency(plan.totalReturn)}
                  </p>
                </div>
                <button
                  onClick={() => handleDeletePlan(i)}
                  className="w-7 h-7 rounded-md hover:bg-red-50 flex items-center justify-center text-foreground-400 hover:text-red-500 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                >
                  <i className="ri-delete-bin-line text-xs" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}