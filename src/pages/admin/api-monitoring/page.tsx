import { useState } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { adminAPIMetrics } from "@/mocks/admin";

export default function AdminAPIMonitoring() {
  const [metrics] = useState(adminAPIMetrics);

  const totalRequests = metrics.reduce((sum, m) => sum + m.requests, 0);
  const avgSuccessRate = metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length;
  const avgLatency = metrics.reduce((sum, m) => sum + m.avgLatencyMs, 0) / metrics.length;
  const totalErrors = metrics.reduce((sum, m) => sum + m.errors, 0);

  const summaryCards = [
    { label: "Total Requests", value: totalRequests.toLocaleString(), icon: "ri-global-line" },
    { label: "Avg Success Rate", value: `${avgSuccessRate.toFixed(1)}%`, icon: "ri-check-double-line" },
    { label: "Avg Latency", value: `${Math.round(avgLatency)}ms`, icon: "ri-timer-line" },
    { label: "Total Errors", value: totalErrors.toLocaleString(), icon: "ri-error-warning-line" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-900">API Monitoring</h1>
          <p className="text-sm text-foreground-600 mt-1">Real-time API performance and health metrics</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="bg-background-50 rounded-xl p-5 border border-background-200/70">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
                  <i className={`${card.icon} text-primary-600`} />
                </div>
              </div>
              <p className="font-heading font-bold text-2xl text-foreground-900">{card.value}</p>
              <p className="text-xs text-foreground-500 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Endpoints Table */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
          <div className="p-5 border-b border-background-200/70">
            <h2 className="font-heading font-semibold text-foreground-900">Endpoint Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-background-200/70">
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Endpoint</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Requests</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Success Rate</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Avg Latency</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Errors</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Health</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.endpoint} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                    <td className="px-5 py-3">
                      <code className="text-xs font-medium text-foreground-900 bg-background-100 px-2 py-0.5 rounded">{m.endpoint}</code>
                    </td>
                    <td className="px-5 py-3 text-right"><span className="text-xs text-foreground-700">{m.requests.toLocaleString()}</span></td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-xs font-medium ${m.successRate >= 99 ? "text-primary-600" : m.successRate >= 97 ? "text-secondary-600" : "text-accent-600"}`}>{m.successRate}%</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`text-xs ${m.avgLatencyMs < 200 ? "text-primary-600" : m.avgLatencyMs < 400 ? "text-secondary-600" : "text-accent-600"}`}>{m.avgLatencyMs}ms</span>
                    </td>
                    <td className="px-5 py-3 text-right"><span className="text-xs text-foreground-600">{m.errors.toLocaleString()}</span></td>
                    <td className="px-5 py-3 text-center">
                      <div className={`w-2 h-2 rounded-full mx-auto ${m.successRate >= 99 ? "bg-primary-500" : m.successRate >= 97 ? "bg-secondary-500" : "bg-accent-500"}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}