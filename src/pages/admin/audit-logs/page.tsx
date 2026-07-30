import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase } from "@/lib/supabase";

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  resource: string;
  resource_id: string;
  details: any;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchErr } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (fetchErr) throw fetchErr;
      setLogs((data as AuditLog[]) || []);
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const actions = [...new Set(logs.map((l) => l.action))];

  const filtered = logs.filter((l) => {
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = l.user_name || "";
      if (!name.toLowerCase().includes(q) && !l.action.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
            <p className="text-sm text-foreground-500 mt-3">Loading audit logs...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="text-center py-24">
          <p className="text-sm text-foreground-800 mb-4">{error}</p>
          <button onClick={fetchLogs} className="bg-accent-500 text-background-50 px-4 py-2 rounded-lg text-sm cursor-pointer">Retry</button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-900">Audit Logs</h1>
          <p className="text-sm text-foreground-600 mt-1">{filtered.length} log entries</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center bg-background-50 rounded-lg px-3 py-2 border border-background-200/70 flex-1 max-w-sm">
            <i className="ri-search-line text-foreground-400 text-sm mr-2" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by user or action..." className="bg-transparent text-sm text-foreground-700 placeholder-foreground-400 focus:outline-none w-full" />
          </div>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-background-200/70 bg-background-50 text-sm text-foreground-700 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer">
            <option value="all">All Actions</option>
            {actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-background-50 rounded-xl border border-background-200/70 text-center py-16">
            <div className="w-16 h-16 rounded-full bg-background-200/70 flex items-center justify-center mx-auto mb-4">
              <i className="ri-file-list-3-line text-foreground-400 text-2xl" />
            </div>
            <h3 className="font-heading font-semibold text-lg text-foreground-900 mb-2">No audit logs found</h3>
            <p className="text-sm text-foreground-600">Logs will appear as admin actions are performed</p>
          </div>
        ) : (
          <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background-200/70">
                    <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">User</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Action</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Resource</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => (
                    <tr key={log.id} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="text-xs font-medium text-foreground-900">{log.user_name || "System"}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex text-[11px] font-medium bg-secondary-100 text-secondary-700 px-2 py-0.5 rounded-full capitalize">
                          {(log.action || "").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-xs text-foreground-700 capitalize">{log.resource}</p>
                        {log.resource_id && <code className="text-[10px] text-foreground-500">{log.resource_id}</code>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs text-foreground-500">{timeAgo(log.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}