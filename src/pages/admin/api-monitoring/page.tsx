import { useEffect, useState } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { adminApiMetrics } from "@/lib/admin-insights.functions";
import { getAccessToken } from "@/lib/session-token";

type Metric = { endpoint: string; requests: number; errors: number; successRate: number; avgLatencyMs: number };
type ErrRow = { at: string; endpoint: string; code: number; message: string };

export default function AdminAPIMonitoring() {
  const [days, setDays] = useState(7);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [errors, setErrors] = useState<ErrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const accessToken = await getAccessToken();
      const r: any = await adminApiMetrics({ data: { accessToken, days } });
      if (!r?.success) throw new Error(r?.error);
      setMetrics(r.endpoints);
      setErrors(r.recentErrors);
    } catch (e: any) {
      setError(e?.message || "Could not load API data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [days]);

  const totalRequests = metrics.reduce((s, m) => s + m.requests, 0);
  const totalErrors = metrics.reduce((s, m) => s + m.errors, 0);
  const success = totalRequests ? ((totalRequests - totalErrors) / totalRequests) * 100 : 100;
  const avgLatency = totalRequests ? metrics.reduce((s, m) => s + m.avgLatencyMs * m.requests, 0) / totalRequests : 0;

  const cards = [
    { label: "Total Requests", value: totalRequests.toLocaleString(), icon: "ri-global-line" },
    { label: "Success Rate", value: `${success.toFixed(1)}%`, icon: "ri-check-double-line" },
    { label: "Avg Response", value: `${Math.round(avgLatency)}ms`, icon: "ri-timer-line" },
    { label: "Errors", value: totalErrors.toLocaleString(), icon: "ri-error-warning-line" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground-900">API Monitoring</h1>
            <p className="text-sm text-foreground-600 mt-1">Live usage of the merchant API</p>
          </div>
          <div className="flex gap-2">
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="px-3 py-2 rounded-lg border border-background-200/70 bg-background-50 text-sm">
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
            </select>
            <button onClick={load} className="px-3 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-background-50 text-sm"><i className="ri-refresh-line" /></button>
          </div>
        </div>

        {error && <div className="p-3 rounded-lg bg-accent-50 text-accent-700 text-sm">{error}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="bg-background-50 rounded-xl p-4 sm:p-5 border border-background-200/70">
              <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center mb-3"><i className={`${c.icon} text-primary-600`} /></div>
              <p className="font-heading font-bold text-xl sm:text-2xl text-foreground-900">{loading ? "…" : c.value}</p>
              <p className="text-xs text-foreground-500 mt-1">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
          <div className="p-5 border-b border-background-200/70"><h2 className="font-heading font-semibold text-foreground-900">Endpoint Performance</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-background-200/70 text-xs text-foreground-500 uppercase">
                  <th className="text-left px-5 py-3">Endpoint</th>
                  <th className="text-right px-5 py-3">Requests</th>
                  <th className="text-right px-5 py-3">Success</th>
                  <th className="text-right px-5 py-3">Avg time</th>
                  <th className="text-right px-5 py-3">Errors</th>
                </tr>
              </thead>
              <tbody>
                {!loading && metrics.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-foreground-500">No API requests in this period.</td></tr>
                )}
                {metrics.map((m) => (
                  <tr key={m.endpoint} className="border-b border-background-100">
                    <td className="px-5 py-3"><code className="text-xs bg-background-100 px-2 py-0.5 rounded">{m.endpoint}</code></td>
                    <td className="px-5 py-3 text-right text-xs">{m.requests.toLocaleString()}</td>
                    <td className={`px-5 py-3 text-right text-xs font-medium ${m.successRate >= 95 ? "text-primary-600" : "text-accent-600"}`}>{m.successRate}%</td>
                    <td className="px-5 py-3 text-right text-xs">{m.avgLatencyMs}ms</td>
                    <td className="px-5 py-3 text-right text-xs">{m.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
            <h2 className="font-heading font-semibold text-foreground-900 mb-3">Recent Errors</h2>
            <ul className="space-y-2">
              {errors.map((e, i) => (
                <li key={i} className="text-xs flex flex-col sm:flex-row sm:gap-3 border-b border-background-100 pb-2">
                  <span className="text-foreground-500 whitespace-nowrap">{new Date(e.at).toLocaleString()}</span>
                  <code className="break-all">{e.endpoint}</code>
                  <span className="text-accent-600 font-medium">{e.code}</span>
                  <span className="text-foreground-600 break-words">{e.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
