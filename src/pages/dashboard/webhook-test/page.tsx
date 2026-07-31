import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { invokeObpay } from "@/lib/edge-function";

interface TestResult {
  test: string;
  status: "pass" | "fail" | "warn" | "pending" | "running";
  message: string;
  detail?: string;
  timestamp?: string;
}

interface WebhookLog {
  id: string;
  event_type: string;
  status: string;
  attempts: number;
  response_code: number;
  payload: any;
  created_at: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtCurrency(n: number) { return "UGX " + n.toLocaleString("en-UG"); }

export default function WebhookTestPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<TestResult[]>([
    { test: "1. Payment Provider API Connection", status: "pending", message: "Not started" },
    { test: "2. Sync All Pending (5-Pass Polling)", status: "pending", message: "Not started" },
    { test: "3. Collection Flow (Create → Auto-Sync)", status: "pending", message: "Not started" },
    { test: "4. Database Integrity Check", status: "pending", message: "Not started" },
    { test: "5. API Key Configuration", status: "pending", message: "Not started" },
    { test: "6. Wallet Balance Check", status: "pending", message: "Not started" },
    { test: "7. Sync Logs & Activity", status: "pending", message: "Not started" },
  ]);
  const [running, setRunning] = useState(false);
  const [allPassed, setAllPassed] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [testCollection, setTestCollection] = useState<{ ref: string; amount: number; phone: string } | null>(null);
  const [syncSummary, setSyncSummary] = useState<{ checked: number; updated: number; stillPending: number; logs: string[] } | null>(null);
  const [userApiKey, setUserApiKey] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    supabase.from("api_keys")
      .select("secret_key")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.secret_key) setUserApiKey(data.secret_key);
      });
  }, [user]);

  const setResult = useCallback((i: number, r: TestResult) => {
    setResults(prev => {
      const next = [...prev];
      next[i] = { ...r, timestamp: new Date().toISOString() };
      return next;
    });
  }, []);

  const makeApiCall = useCallback(async (body: Record<string, unknown>) => {
    return invokeObpay(body, userApiKey ? { "X-API-Key": userApiKey } : undefined);
  }, [userApiKey]);

  const runAllTests = useCallback(async () => {
    if (!user) return;
    setRunning(true);
    setAllPassed(null);

    const initial = results.map(r => ({ ...r, status: "pending" as const, message: "Not started", detail: undefined, timestamp: undefined }));
    setResults(initial);
    setSyncSummary(null);

    try {
      // ─── Test 1: Payment Provider API Connection ───
      setResult(0, { test: "1. Payment Provider API Connection", status: "running", message: "Testing connection to payment provider..." });
      try {
        const apiData = await makeApiCall({ _action: "test-connection" });
        if (apiData?.success) {
          setResult(0, { test: "1. Payment Provider API Connection", status: "pass", message: "Provider connection successful", detail: `Balance data: ${JSON.stringify(apiData.data).slice(0, 150)}` });
        } else {
          setResult(0, { test: "1. Payment Provider API Connection", status: "fail", message: apiData?.error || "Connection test failed", detail: "Check your provider credentials in Dashboard → Settings → Payment Provider" });
        }
      } catch (err: any) {
        setResult(0, { test: "1. Payment Provider API Connection", status: "fail", message: "API connection error", detail: err.message || "Unknown error" });
      }

      // ─── Test 2: Sync All Pending ───
      setResult(1, { test: "2. Sync All Pending (Active Polling)", status: "running", message: "Checking all pending transactions with payment provider..." });
      try {
        const syncData = await makeApiCall({ _action: "sync-all-pending" });
        if (syncData?.success) {
          setSyncSummary({
            checked: syncData.data?.synced || 0,
            updated: syncData.data?.updated?.length || 0,
            stillPending: syncData.data?.stillPending || 0,
            logs: syncData.data?.logs || [],
          });
          const successCount = (syncData.data?.updated || []).filter((u: any) => u.status === "success").length;
          const failCount = (syncData.data?.updated || []).filter((u: any) => u.status === "failed").length;
          setResult(1, {
            test: "2. Sync All Pending (Active Polling)",
            status: successCount > 0 ? "pass" : syncData.data?.stillPending > 0 ? "warn" : "pass",
            message: `Checked ${syncData.data?.synced} transaction(s): ${successCount} confirmed, ${failCount} failed, ${syncData.data?.stillPending || 0} still pending`,
            detail: syncData.message || "Sync completed",
          });
        } else {
          setResult(1, { test: "2. Sync All Pending (5-Pass Polling)", status: "fail", message: syncData?.error || "Sync failed", detail: "Check edge function logs for details" });
        }
      } catch (err: any) {
        setResult(1, { test: "2. Sync All Pending (5-Pass Polling)", status: "fail", message: "Sync error", detail: err.message || "Unknown" });
      }

      // ─── Test 3: Collection Flow ───
      setResult(2, { test: "3. Collection Flow (Create → Auto-Sync)", status: "running", message: "Creating test collection..." });
      try {
        const testRef = `DIAG${Date.now().toString(36).toUpperCase()}`.slice(0, 25);
        const testAmount = 500;
        const testPhone = "256700000001";

        const collData = await makeApiCall({
          _action: "collect",
          phoneNumber: testPhone,
          amount: testAmount,
          currency: "UGX",
          network: "mtn",
          description: "Diagnostic test collection",
          reference: testRef,
        });

        if (collData?.success) {
          setTestCollection({ ref: testRef, amount: testAmount, phone: testPhone });
          const { data: dbTxn } = await supabase.from("transactions").select("*").eq("reference", testRef).maybeSingle();
          if (dbTxn) {
            setResult(2, {
              test: "3. Collection Flow (Create → Auto-Sync)",
              status: "pass",
              message: `Collection created — Ref: ${testRef}`,
              detail: `Amount: ${fmtCurrency(testAmount)} | Status: ${dbTxn.status} | 5-pass sync runs at 2s, 5s, 10s, 20s, 35s`,
            });
          } else {
            setResult(2, { test: "3. Collection Flow (Create → Auto-Sync)", status: "warn", message: "Collection created via API but not in DB — sync delay?", detail: `Ref ${testRef} — wait a moment and re-run` });
          }
        } else {
          setResult(2, { test: "3. Collection Flow (Create → Auto-Sync)", status: "fail", message: collData?.error || "Collection failed", detail: collData?.rate_limited ? "Provider rate limited — retry in 1-2 min" : "Check credentials" });
        }
      } catch (err: any) {
        setResult(2, { test: "3. Collection Flow (Create → Auto-Sync)", status: "fail", message: "Collection test error", detail: err.message || "Unknown" });
      }

      // ─── Test 4: Database Integrity ───
      setResult(3, { test: "4. Database Integrity Check", status: "running", message: "Checking transactions and wallet integrity..." });
      try {
        const [txnRes, walletRes] = await Promise.all([
          supabase.from("transactions").select("id,status,type").eq("user_id", user.id),
          supabase.from("merchant_wallets").select("*").eq("user_id", user.id).maybeSingle(),
        ]);
        if (txnRes.error) throw txnRes.error;
        const txns = txnRes.data || [];
        const pending = txns.filter((t: any) => t.status === "pending");
        const success = txns.filter((t: any) => t.status === "success");
        const failed = txns.filter((t: any) => t.status === "failed");
        const walletOk = walletRes.data ? `Balance: ${fmtCurrency(walletRes.data.available_balance || 0)}` : "No wallet yet (auto-created on first collection)";
        setResult(3, {
          test: "4. Database Integrity Check",
          status: "pass",
          message: `Total: ${txns.length} txns (${success.length} success, ${pending.length} pending, ${failed.length} failed)`,
          detail: `${walletOk} | ${pending.length > 0 ? `${pending.length} pending — 5-pass polling will resolve them` : "All caught up!"}`,
        });
      } catch (err: any) {
        setResult(3, { test: "4. Database Integrity Check", status: "fail", message: "Database check failed", detail: err.message });
      }

      // ─── Test 5: API Key Configuration ───
      setResult(4, { test: "5. API Key Configuration", status: "running", message: "Checking API key setup..." });
      try {
        const { data: creds } = await supabase.from("livepay_credentials").select("id,status").eq("user_id", user.id).eq("status", "active").maybeSingle();
        if (creds) {
          setResult(4, { test: "5. API Key Configuration", status: "pass", message: "Provider API key is configured and active", detail: `Credential ID: ${creds.id} — sync can access provider` });
        } else {
          setResult(4, { test: "5. API Key Configuration", status: "fail", message: "No active provider API key found", detail: "Go to Dashboard → Settings → Payment Provider to add your API key" });
        }
      } catch (err: any) {
        setResult(4, { test: "5. API Key Configuration", status: "fail", message: "Failed to check credentials", detail: err.message });
      }

      // ─── Test 6: Wallet Balance ───
      setResult(5, { test: "6. Wallet Balance Check", status: "running", message: "Checking wallet..." });
      try {
        const { data: wallet } = await supabase.from("merchant_wallets").select("*").eq("user_id", user.id).maybeSingle();
        if (wallet) {
          setResult(5, {
            test: "6. Wallet Balance Check",
            status: "pass",
            message: `Available: ${fmtCurrency(wallet.available_balance || 0)}`,
            detail: `Total collections: ${fmtCurrency(wallet.total_collections || 0)} | Total payouts: ${fmtCurrency(wallet.total_payouts || 0)} | Currency: ${wallet.currency || "UGX"}`,
          });
        } else {
          setResult(5, { test: "6. Wallet Balance Check", status: "warn", message: "No wallet found — will be auto-created on first successful collection", detail: "Normal for new accounts" });
        }
      } catch (err: any) {
        setResult(5, { test: "6. Wallet Balance Check", status: "fail", message: "Wallet check failed", detail: err.message });
      }

      // ─── Test 7: Sync Logs ───
      setResult(6, { test: "7. Sync Logs & Activity", status: "running", message: "Checking recent activity logs..." });
      try {
        const { data: logData, error: logErr } = await supabase.from("webhook_logs").select("*").order("created_at", { ascending: false }).limit(20);
        if (logErr) throw logErr;
        setLogs((logData as WebhookLog[]) || []);
        if (logData && logData.length > 0) {
          const recent = logData.filter((l: any) => {
            const d = new Date(l.created_at).getTime();
            return Date.now() - d < 3600000; // last hour
          });
          setResult(6, {
            test: "7. Sync Logs & Activity",
            status: recent.length > 0 ? "pass" : "warn",
            message: `${logData.length} total log entries, ${recent.length} in the last hour`,
            detail: recent.length > 0 ? "Active 5-pass polling is running — transactions are being monitored aggressively" : "No recent activity — 5-pass sync runs when pending transactions exist",
          });
        } else {
          setResult(6, { test: "7. Sync Logs & Activity", status: "warn", message: "No sync logs recorded yet", detail: "Logs appear when the active sync checks pending transactions" });
        }
      } catch (err: any) {
        setResult(6, { test: "7. Sync Logs & Activity", status: "fail", message: "Failed to fetch logs", detail: err.message });
      }

    } catch (err: any) {
      console.error("Test suite error:", err);
    }

    setRunning(false);
    const currentResults = results;
    const allOk = currentResults.every(r => r.status === "pass");
    setAllPassed(allOk);
  }, [user, results, setResult, makeApiCall]);

  const passedCount = results.filter(r => r.status === "pass").length;
  const failedCount = results.filter(r => r.status === "fail").length;
  const warnCount = results.filter(r => r.status === "warn").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground-900">Pipeline Test & Diagnostics</h1>
            <p className="text-sm text-foreground-600 mt-1">
              Test the OBPay payment pipeline. Sync uses <strong>aggressive 5-pass polling</strong> (2s → 35s window).
            </p>
          </div>
          <button
            onClick={runAllTests}
            disabled={running}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer whitespace-nowrap transition-colors ${running ? "bg-background-200 text-foreground-400 cursor-not-allowed" : "bg-accent-500 hover:bg-accent-600 text-background-50"}`}
          >
            <i className={`${running ? "ri-loader-4-line animate-spin" : "ri-play-circle-line"}`} />
            {running ? "Running Tests..." : "Run Full Test Suite"}
          </button>
        </div>

        {/* Note about webhooks */}
        <div className="bg-background-100 rounded-xl p-4 border border-background-200/70">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-100 flex items-center justify-center shrink-0">
              <i className="ri-information-line text-accent-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground-900 mb-1">How Sync Works — Aggressive 5-Pass Polling</p>
              <p className="text-xs text-foreground-600 leading-relaxed">
                OBPay uses <strong>aggressive active polling</strong> — after a collection is initiated, it calls MarzPay directly 5 times over 35 seconds (at 2s, 5s, 10s, 20s, and 35s). This is <strong>faster than webhooks</strong> because we control the timing with zero delivery delay. When MarzPay confirms the payment, your wallet is credited and merchant webhooks are dispatched immediately. A MarzPay webhook fallback also exists as a safety net.
              </p>
            </div>
          </div>
        </div>

        {/* Summary Bar */}
        {allPassed !== null && (
          <div className={`rounded-xl p-4 border ${allPassed ? "bg-emerald-50 border-emerald-200" : failedCount > 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${allPassed ? "bg-emerald-100" : failedCount > 0 ? "bg-red-100" : "bg-amber-100"}`}>
                <i className={`text-2xl ${allPassed ? "ri-check-line text-emerald-600" : failedCount > 0 ? "ri-close-line text-red-600" : "ri-error-warning-line text-amber-600"}`} />
              </div>
              <div>
                <h3 className={`font-heading font-semibold ${allPassed ? "text-emerald-800" : failedCount > 0 ? "text-red-800" : "text-amber-800"}`}>
                  {allPassed ? "All systems go!" : failedCount > 0 ? "Issues detected — fix and re-run" : "Some warnings — review below"}
                </h3>
                <p className="text-sm text-foreground-600 mt-0.5">
                  {passedCount}/{results.length} passed, {failedCount} failed, {warnCount} warnings
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sync Summary */}
        {syncSummary && (
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
            <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-3 flex items-center gap-2">
              <i className="ri-radar-line text-accent-500" />
              Sync Summary
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-background-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-foreground-900">{syncSummary.checked}</p>
                <p className="text-[11px] text-foreground-500">Checked</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{syncSummary.updated}</p>
                <p className="text-[11px] text-emerald-600">Updated</p>
              </div>
              <div className={`rounded-lg p-3 text-center ${syncSummary.stillPending > 0 ? "bg-amber-50" : "bg-background-100"}`}>
                <p className={`text-2xl font-bold ${syncSummary.stillPending > 0 ? "text-amber-700" : "text-foreground-900"}`}>{syncSummary.stillPending}</p>
                <p className={`text-[11px] ${syncSummary.stillPending > 0 ? "text-amber-600" : "text-foreground-500"}`}>Still Pending</p>
              </div>
            </div>
            {syncSummary.logs.length > 0 && (
              <div className="bg-foreground-900 rounded-lg p-3 max-h-40 overflow-y-auto">
                {syncSummary.logs.map((msg: string, i: number) => (
                  <p key={i} className="text-[11px] font-mono text-emerald-300 leading-relaxed">{msg}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Test Results */}
        <div className="space-y-3">
          {results.map((r, i) => (
            <div key={i} className={`bg-background-50 rounded-xl border p-4 transition-all ${r.status === "running" ? "border-accent-300/60 bg-accent-50/50" : r.status === "pass" ? "border-emerald-200/70" : r.status === "fail" ? "border-red-200/70" : r.status === "warn" ? "border-amber-200/70" : "border-background-200/70"}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  r.status === "pass" ? "bg-emerald-100" :
                  r.status === "fail" ? "bg-red-100" :
                  r.status === "warn" ? "bg-amber-100" :
                  r.status === "running" ? "bg-accent-100" : "bg-background-200"
                }`}>
                  {r.status === "running" && <i className="ri-loader-4-line animate-spin text-accent-600" />}
                  {r.status === "pass" && <i className="ri-check-line text-emerald-600" />}
                  {r.status === "fail" && <i className="ri-close-line text-red-600" />}
                  {r.status === "warn" && <i className="ri-error-warning-line text-amber-600" />}
                  {r.status === "pending" && <i className="ri-time-line text-foreground-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-heading font-semibold text-sm text-foreground-900">{r.test}</h4>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      r.status === "pass" ? "bg-emerald-100 text-emerald-700" :
                      r.status === "fail" ? "bg-red-100 text-red-700" :
                      r.status === "warn" ? "bg-amber-100 text-amber-700" :
                      r.status === "running" ? "bg-accent-100 text-accent-700" : "bg-background-200 text-foreground-500"
                    }`}>
                      {r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : r.status === "warn" ? "WARN" : r.status === "running" ? "RUNNING" : "PENDING"}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${r.status === "fail" ? "text-red-600" : r.status === "warn" ? "text-amber-600" : "text-foreground-600"}`}>
                    {r.message}
                  </p>
                  {r.detail && (
                    <p className="text-[11px] text-foreground-500 mt-1 bg-background-100 rounded p-2 break-all font-mono leading-relaxed">
                      {r.detail}
                    </p>
                  )}
                  {r.timestamp && <p className="text-[10px] text-foreground-400 mt-1">{formatDate(r.timestamp)}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Test Collection Details */}
        {testCollection && (
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
            <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-3 flex items-center gap-2">
              <i className="ri-test-tube-line text-accent-500" />
              Test Collection Created
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-background-100 rounded-lg p-3">
                <p className="text-[11px] text-foreground-500">Reference</p>
                <p className="text-sm font-mono font-medium text-foreground-900">{testCollection.ref}</p>
              </div>
              <div className="bg-background-100 rounded-lg p-3">
                <p className="text-[11px] text-foreground-500">Amount</p>
                <p className="text-sm font-medium text-foreground-900">{fmtCurrency(testCollection.amount)}</p>
              </div>
              <div className="bg-background-100 rounded-lg p-3">
                <p className="text-[11px] text-foreground-500">Phone</p>
                <p className="text-sm font-medium text-foreground-900">{testCollection.phone}</p>
              </div>
              <div className="bg-background-100 rounded-lg p-3">
                <p className="text-[11px] text-foreground-500">Sync Status</p>
                <p className="text-sm font-medium text-emerald-600">5-pass sync active (2s → 35s)</p>
              </div>
            </div>
          </div>
        )}

        {/* Sync Logs */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
          <div className="p-5 border-b border-background-200/70 flex items-center justify-between">
            <h3 className="font-heading font-semibold text-sm text-foreground-900 flex items-center gap-2">
              <i className="ri-history-line text-accent-500" />
              Sync & Activity Logs
            </h3>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="text-xs font-medium text-primary-500 hover:text-primary-600 cursor-pointer whitespace-nowrap"
            >
              {showLogs ? "Hide" : "Show"} ({logs.length})
            </button>
          </div>

          {showLogs && (
            logs.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-background-200/70 flex items-center justify-center mx-auto mb-3">
                  <i className="ri-inbox-line text-foreground-400 text-xl" />
                </div>
                <p className="text-sm text-foreground-500">No activity logs recorded yet</p>
                <p className="text-xs text-foreground-400 mt-1">Logs appear when sync resolves transactions or merchant webhooks are dispatched</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-background-200/70">
                      <th className="text-left px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Event</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Status</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-foreground-500 uppercase">HTTP</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-background-100 hover:bg-background-100/50">
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-mono text-foreground-900">{log.event_type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                            log.status === "received" ? "bg-emerald-100 text-emerald-700" :
                            log.status === "received_unverified" ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-xs text-foreground-600">{log.response_code || "—"}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-xs text-foreground-500">{formatDate(log.created_at)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}