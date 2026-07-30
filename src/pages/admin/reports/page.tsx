import { useState } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { adminDashboardStats } from "@/mocks/admin";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "UGX", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export default function AdminReports() {
  const [period, setPeriod] = useState("monthly");

  const stats = adminDashboardStats;

  const reportCards = [
    { label: "Total Volume", value: formatCurrency(stats.totalVolume), change: "+12.5%", up: true },
    { label: "Today's Volume", value: formatCurrency(stats.todayVolume), change: "+5.3%", up: true },
    { label: "Monthly Volume", value: formatCurrency(stats.monthlyVolume), change: "+18.2%", up: true },
    { label: "Total Payouts", value: formatCurrency(stats.totalPayouts), change: "-2.1%", up: false },
    { label: "Total Transactions", value: stats.totalTransactions.toLocaleString(), change: "+23.4%", up: true },
    { label: "Success Rate", value: `${stats.successRate}%`, change: "+0.3%", up: true },
  ];

  const handleExport = () => {
    const headers = ["Label", "Value", "Change"];
    const rows = reportCards.map((card) => [card.label, card.value.replace("UGX", "").trim(), card.change]);
    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `obpay-report-${period}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground-900">Reports</h1>
            <p className="text-sm text-foreground-600 mt-1">Platform performance and financial reports</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 rounded-lg border border-background-200/70 bg-background-50 text-sm text-foreground-700 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <button onClick={handleExport} className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-background-50 text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <i className="ri-download-line" />
              Export Report
            </button>
          </div>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportCards.map((card) => (
            <div key={card.label} className="bg-background-50 rounded-xl p-5 border border-background-200/70">
              <p className="text-xs text-foreground-500 mb-1">{card.label}</p>
              <p className="font-heading font-bold text-2xl text-foreground-900 mb-2">{card.value}</p>
              <span className={`inline-flex items-center text-xs font-medium ${card.up ? "text-primary-600" : "text-accent-600"}`}>
                <i className={`${card.up ? "ri-arrow-up-line" : "ri-arrow-down-line"} mr-0.5`} />
                {card.change} vs last period
              </span>
            </div>
          ))}
        </div>

        {/* Chart Placeholder */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
          <h3 className="font-heading font-semibold text-foreground-900 mb-4">Volume Over Time</h3>
          <div className="h-64 flex items-end gap-2">
            {[35, 42, 38, 55, 48, 62, 58, 72, 65, 80, 75, 88].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-primary-400/60 rounded-t-md transition-all hover:bg-primary-500/80"
                  style={{ height: `${h}%` }}
                />
                <span className="text-[10px] text-foreground-500">{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
          <h3 className="font-heading font-semibold text-foreground-900 mb-4">Quick Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-foreground-600">Active Merchants</span><span className="font-medium text-foreground-900">{stats.activeMerchants.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-foreground-600">Pending KYC</span><span className="font-medium text-foreground-900">{stats.pendingKYCCount.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-foreground-600">Avg. Transaction Size</span><span className="font-medium text-foreground-900">{formatCurrency(Math.floor(stats.totalVolume / stats.totalTransactions))}</span></div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-foreground-600">Platform Fee Revenue</span><span className="font-medium text-foreground-900">{formatCurrency(Math.floor(stats.totalVolume * 0.025))}</span></div>
              <div className="flex justify-between"><span className="text-foreground-600">Payouts Processed</span><span className="font-medium text-foreground-900">{formatCurrency(stats.totalPayouts)}</span></div>
              <div className="flex justify-between"><span className="text-foreground-600">Success Rate</span><span className="font-medium text-primary-600">{stats.successRate}%</span></div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}