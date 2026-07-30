import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/lib/supabase";
import { JsonLd } from "@/components/base/JsonLd";
import { invokeObpay, invokePublicLookup } from "@/lib/edge-function";

interface PaymentLinkData {
  id: string;
  amount: number;
  currency: string;
  description: string;
  reference: string;
  status: string;
  expiry_date: string;
  user_id: string;
}

interface MerchantData {
  company_name: string;
  merchant_id: string;
  user_id: string;
}

function formatCurrency(amount: number) { return "UGX " + amount.toLocaleString("en-UG"); }

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
  ]);
}

export default function PayPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [link, setLink] = useState<PaymentLinkData | null>(null);
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState(0);
  const [network, setNetwork] = useState("mtn");
  const [submitting, setSubmitting] = useState(false);
  const [txnRef, setTxnRef] = useState("");
  const [pollStatus, setPollStatus] = useState<"idle" | "polling" | "success" | "failed" | "pending">("idle");
  const [pollMessage, setPollMessage] = useState("");
  const [feePercent, setFeePercent] = useState(5);
  const [showQR, setShowQR] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState("");
  const [txnStartTime, setTxnStartTime] = useState<number | null>(null);
  const [txnElapsed, setTxnElapsed] = useState<number>(0);

  useEffect(() => {
    if (!slug) { setError("Invalid payment link"); setLoading(false); return; }

    const fetchLink = async () => {
      try {
        // Use dedicated public-lookup function (no JWT required, bypasses RLS)
        const lookupData = await withTimeout(
          invokePublicLookup({ _action: "public-lookup", _merchant_slug: slug }),
          15000,
          "Merchant lookup"
        );

        if (lookupData?.success && lookupData.data) {
          const d = lookupData.data;
          setFeePercent(d.platform_fee_percent ?? 5);

          if (d.link) {
            setLink(d.link as PaymentLinkData);
            if (d.link.amount > 0) setAmount(d.link.amount);
          }

          if (d.merchant) {
            setMerchant(d.merchant as MerchantData);
            const amountParam = searchParams.get("amount");
            if (amountParam) setAmount(parseFloat(amountParam));
          }

          if (d.link?.expiry_date && new Date(d.link.expiry_date) < new Date()) {
            setError("This payment link has expired.");
          }
        } else {
          setError(lookupData?.error || "Payment link not found or is no longer active.");
        }
      } catch (err: any) {
        setError(err.message || "Unable to load payment page. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchLink();
  }, [slug, searchParams]);

  const estimatedFee = amount > 0 ? Math.round(amount * (feePercent / 100) * 100) / 100 : 0;
  const netAmount = amount > 0 ? amount - estimatedFee : 0;
  const currentUrl = window.location.href;

  const copyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const getQRCodeUrl = (url: string) => {
    const encoded = encodeURIComponent(url);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}&bgcolor=ffffff&color=000000`;
  };

  const pollForStatus = useCallback(async (ref: string, maxAttempts = 12) => {
    const start = Date.now();
    setTxnStartTime(start);
    setPollStatus("polling");
    let confirmed = false;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 4000));
      try {
        const pollData = await invokeObpay({ _action: "public-check-transaction", reference: ref });
        if (pollData?.data?.status === "success") {
          confirmed = true;
          const elapsed = Math.round((Date.now() - start) / 1000);
          setTxnElapsed(elapsed);
          setPollStatus("success");
          setPollMessage(`Payment of ${formatCurrency(link?.amount || amount)} was successful! Thank you for your payment.`);
          break;
        }
        if (pollData?.data?.status === "failed") {
          const elapsed = Math.round((Date.now() - start) / 1000);
          setTxnElapsed(elapsed);
          setPollStatus("failed");
          setPollMessage("Payment was not completed. Please try again or use a different payment method.");
          break;
        }
      } catch { /* keep polling */ }
    }

    if (!confirmed && pollStatus !== "failed") {
      setPollStatus("pending");
      setPollMessage(`Payment request sent. If your mobile money was charged, the merchant will be notified once confirmed. Reference: ${ref}`);
    }
  }, [link, amount]);

  // Realtime: watch transaction status updates from webhooks
  useEffect(() => {
    if (!txnRef || !merchant?.user_id) return;

    const channel = supabase
      .channel("pay-page-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions", filter: `reference=eq.${txnRef}` },
        (payload) => {
          const newStatus = (payload.new as any).status;
          const txnAmount = (payload.new as any).amount;
          if (newStatus === "success") {
            if (txnStartTime) {
              setTxnElapsed(Math.round((Date.now() - txnStartTime) / 1000));
            }
            setPollStatus("success");
            setPollMessage(`Payment of ${formatCurrency(txnAmount || link?.amount || amount)} was successful! Thank you for your payment.`);
          } else if (newStatus === "failed") {
            if (txnStartTime) {
              setTxnElapsed(Math.round((Date.now() - txnStartTime) / 1000));
            }
            setPollStatus("failed");
            setPollMessage("Payment was not completed. Please try again or use a different payment method.");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [txnRef, merchant, link, amount, txnStartTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || amount <= 0) return;
    setSubmitting(true);
    setPollStatus("idle");
    setPollMessage("");
    setTxnStartTime(Date.now());
    setTxnElapsed(0);

    try {
      const payAmount = link?.amount || amount;
      const ref = link?.reference || `PAY_${Date.now()}`;

      let edgeUnreachable = false;

      try {
        const apiData = await invokeObpay({
          _action: "public-collect",
          _merchant_slug: slug,
          phoneNumber,
          amount: payAmount,
          currency: "UGX",
          network,
          description: link?.description || `Payment to ${merchant?.company_name || "Merchant"}`,
          reference: ref,
        });

        if (apiData?.success) {
          const edgeTxnRef = apiData?.data?.reference || ref;
          setTxnRef(edgeTxnRef);
          setPollStatus("polling");
          setPollMessage(`Payment of ${formatCurrency(payAmount)} is being processed. Waiting for confirmation from the mobile money provider...`);
          setSubmitting(false);
          await pollForStatus(edgeTxnRef);
          return;
        }

        if (apiData?.error) {
          setPollStatus("failed");
          setPollMessage(apiData.error);
          setSubmitting(false);
          return;
        }
        edgeUnreachable = true;
      } catch {
        edgeUnreachable = true;
      }

      if (edgeUnreachable) {
        const { error: insErr } = await supabase.from("transactions").insert({
          user_id: link?.user_id || merchant?.user_id,
          reference: ref,
          amount: payAmount,
          currency: "UGX",
          status: "pending",
          type: "collection",
          payment_method: network,
          customer_phone: phoneNumber,
          description: link?.description || `Payment to ${merchant?.company_name || "Merchant"}`,
          merchant_reference: ref,
        });

        if (insErr) {
          setPollStatus("failed");
          setPollMessage("Unable to process payment right now. Please try again later.");
          setSubmitting(false);
        } else {
          setTxnRef(ref);
          setPollStatus("pending");
          setPollMessage(`Payment request for ${formatCurrency(payAmount)} has been submitted. The merchant will be notified once it's confirmed.`);
          setSubmitting(false);
        }
        return;
      }

    } catch (err: any) {
      setPollStatus("failed");
      setPollMessage(err.message || "Payment failed. Please try again.");
    } finally { setSubmitting(false); }
  };

  const recheckStatus = async () => {
    if (!txnRef) return;
    setPollStatus("polling");
    setPollMessage("Checking payment status with ObPay...");
    try {
      const pollData = await invokeObpay({ _action: "public-check-transaction", reference: txnRef });
      if (pollData?.data?.status === "success") {
        setPollStatus("success");
        setPollMessage(`Payment confirmed! ${formatCurrency(link?.amount || amount)} was successful.`);
      } else if (pollData?.data?.status === "failed") {
        setPollStatus("failed");
        setPollMessage("Payment failed. Please try again.");
      } else {
        setPollStatus("pending");
        setPollMessage(`Still pending with ObPay. Reference: ${txnRef}. You can check again in a few seconds.`);
      }
    } catch {
      setPollStatus("pending");
      setPollMessage(`Unable to reach ObPay right now. Reference: ${txnRef}. Please check again shortly.`);
    }
  };

  const handleVerifyPhone = async () => {
    const phone = phoneNumber.trim();
    if (!phone) return;
    setVerifyingPhone(true);
    setVerifyError("");
    setVerifiedName(null);
    try {
      const data = await invokeObpay({ _action: "verify-phone", phoneNumber: phone });
      if (data?.success && data.data?.customer_name) {
        setVerifiedName(data.data.customer_name);
      } else {
        setVerifyError(data?.error || "This number may not be registered for mobile money.");
        setVerifiedName(null);
      }
    } catch {
      setVerifyError("Unable to verify this number right now.");
      setVerifiedName(null);
    } finally {
      setVerifyingPhone(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-100 flex items-center justify-center">
        <div className="text-center"><i className="ri-loader-4-line animate-spin text-3xl text-accent-500" /><p className="text-sm text-foreground-500 mt-3">Loading payment page...</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background-100 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4"><i className="ri-error-warning-line text-accent-600 text-3xl" /></div>
          <h1 className="font-heading font-bold text-xl text-foreground-900 mb-2">Payment Unavailable</h1>
          <p className="text-sm text-foreground-600">{error}</p>
        </div>
      </div>
    );
  }

  // Result screens
  if (pollStatus === "success") {
    return (
      <div className="min-h-screen bg-background-100 flex items-center justify-center p-4">
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4"><i className="ri-check-line text-primary-600 text-3xl" /></div>
          <h1 className="font-heading font-bold text-xl text-foreground-900 mb-2">Transaction Successful!</h1>
          <p className="text-sm text-foreground-600 mb-1">{pollMessage}</p>
          {txnElapsed > 0 && (
            <p className="text-xs text-foreground-500 mb-4">
              <i className="ri-timer-line mr-1" />
              Transaction completed in <span className="font-semibold text-foreground-700">{formatElapsed(txnElapsed)}</span>
            </p>
          )}
          <div className="bg-background-100 rounded-lg p-4 text-left space-y-2 text-sm mb-6">
            <div className="flex justify-between"><span className="text-foreground-500">Amount:</span><span className="font-semibold text-foreground-900">{formatCurrency(link?.amount || amount)}</span></div>
            <div className="flex justify-between"><span className="text-foreground-500">Fee ({feePercent}%):</span><span className="text-foreground-600">{formatCurrency(estimatedFee)}</span></div>
            <div className="flex justify-between border-t border-background-200/70 pt-2"><span className="text-foreground-500">Net to Merchant:</span><span className="font-semibold text-primary-700">{formatCurrency(netAmount)}</span></div>
            <div className="flex justify-between"><span className="text-foreground-500">Merchant:</span><span className="font-semibold text-foreground-900">{merchant?.company_name || "ObPay Merchant"}</span></div>
            <div className="flex justify-between"><span className="text-foreground-500">Reference:</span><span className="text-xs font-mono text-foreground-600">{txnRef || "N/A"}</span></div>
            {txnElapsed > 0 && (
              <div className="flex justify-between border-t border-background-200/70 pt-2"><span className="text-foreground-500">Time Spent:</span><span className="font-semibold text-foreground-700">{formatElapsed(txnElapsed)}</span></div>
            )}
          </div>
          <button
            onClick={() => window.close()}
            className="w-full bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm"
          >
            Close Page
          </button>
          <p className="text-xs text-foreground-500 mt-3">You can safely close this page now.</p>
        </div>
      </div>
    );
  }

  if (pollStatus === "failed") {
    return (
      <div className="min-h-screen bg-background-100 flex items-center justify-center p-4">
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"><i className="ri-close-line text-red-600 text-3xl" /></div>
          <h1 className="font-heading font-bold text-xl text-foreground-900 mb-2">Transaction Failed</h1>
          <p className="text-sm text-red-600 mb-1">{pollMessage}</p>
          {txnElapsed > 0 && (
            <p className="text-xs text-foreground-500 mb-4">
              <i className="ri-timer-line mr-1" />
              Attempt took <span className="font-semibold text-foreground-700">{formatElapsed(txnElapsed)}</span>
            </p>
          )}
          <button
            onClick={() => { setPollStatus("idle"); setPollMessage(""); setTxnRef(""); setTxnStartTime(null); setTxnElapsed(0); }}
            className="w-full bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm"
          >
            Try Again
          </button>
          <button
            onClick={() => window.close()}
            className="w-full mt-3 text-sm text-foreground-500 hover:text-foreground-700 py-2 cursor-pointer whitespace-nowrap"
          >
            Close Page
          </button>
        </div>
      </div>
    );
  }

  if (pollStatus === "pending") {
    return (
      <div className="min-h-screen bg-background-100 flex items-center justify-center p-4">
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-time-line text-accent-600 text-3xl" />
          </div>
          <h1 className="font-heading font-bold text-xl text-foreground-900 mb-2">Payment Pending</h1>
          <p className="text-sm text-foreground-600 mb-6">{pollMessage}</p>

          <div className="bg-background-100 rounded-lg p-4 text-left space-y-2 text-sm mb-6">
            <div className="flex justify-between"><span className="text-foreground-500">Amount:</span><span className="font-semibold text-foreground-900">{formatCurrency(link?.amount || amount)}</span></div>
            <div className="flex justify-between"><span className="text-foreground-500">Fee ({feePercent}%):</span><span className="text-foreground-600">{formatCurrency(estimatedFee)}</span></div>
            <div className="flex justify-between border-t border-background-200/70 pt-2"><span className="text-foreground-500">Net to Merchant:</span><span className="font-semibold text-primary-700">{formatCurrency(netAmount)}</span></div>
            <div className="flex justify-between"><span className="text-foreground-500">Reference:</span><span className="text-xs font-mono text-foreground-600">{txnRef || "N/A"}</span></div>
          </div>

          <button
            onClick={recheckStatus}
            disabled={submitting}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-semibold py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm"
          >
            {submitting ? (<><i className="ri-loader-4-line animate-spin mr-2" />Checking...</>) : (<><i className="ri-refresh-line mr-2" />Check Payment Status</>)}
          </button>

          <button
            onClick={() => { setPollStatus("idle"); setPollMessage(""); setTxnRef(""); setTxnStartTime(null); setTxnElapsed(0); }}
            className="w-full mt-3 text-sm text-foreground-500 hover:text-foreground-700 py-2 cursor-pointer"
          >
            Make another payment
          </button>
        </div>
      </div>
    );
  }

  if (pollStatus === "polling") {
    return (
      <div className="min-h-screen bg-background-100 flex items-center justify-center p-4">
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-loader-4-line animate-spin text-accent-600 text-3xl" />
          </div>
          <h1 className="font-heading font-bold text-xl text-foreground-900 mb-2">Processing...</h1>
          <p className="text-sm text-foreground-600 mb-4">{pollMessage}</p>
          <div className="w-full bg-background-200/70 rounded-full h-2 overflow-hidden">
            <div className="bg-accent-500 h-full rounded-full animate-[pulse_1.5s_infinite]" style={{ width: "60%" }} />
          </div>
          <p className="text-xs text-foreground-500 mt-3">This usually takes 10-30 seconds</p>
        </div>
      </div>
    );
  }

  // Main payment form
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: `${merchant?.company_name || "ObPay"} — Payment`,
          url: currentUrl,
          description: link?.description || `Make a secure mobile money payment to ${merchant?.company_name || "an ObPay merchant"} via MTN Mobile Money or Airtel Money.`,
          about: {
            "@type": "Thing",
            name: "Mobile Money Payment",
          },
        }}
      />
      <div className="min-h-screen bg-background-100 flex items-center justify-center p-4">
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-8 max-w-sm w-full">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-lg bg-primary-500 flex items-center justify-center mx-auto mb-3">
              <span className="text-background-50 font-heading font-bold text-sm">Ob</span>
            </div>
            <h1 className="font-heading font-bold text-lg text-foreground-900">{merchant?.company_name || "ObPay"}</h1>
            {link?.description && <p className="text-sm text-foreground-600 mt-1">{link.description}</p>}
          </div>

          {/* Amount */}
          <div className="bg-background-100 rounded-lg p-4 mb-4 text-center">
            <p className="text-xs text-foreground-500 mb-1">Amount to Pay</p>
            <p className="font-heading font-bold text-2xl text-foreground-900">
              {link?.amount ? formatCurrency(link.amount) : (
                <input type="number" value={amount || ""} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} placeholder="Enter amount" className="w-full text-center px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" min="1000" />
              )}
            </p>
          </div>

          {/* Fee Breakdown */}
          {amount > 0 && (
            <div className="bg-background-100 rounded-lg p-3 mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-foreground-500">Payment Amount</span><span className="font-semibold text-foreground-900">{formatCurrency(amount)}</span></div>
              <div className="flex justify-between"><span className="text-foreground-500">Platform Fee ({feePercent}%)</span><span className="text-accent-600">{formatCurrency(estimatedFee)}</span></div>
              <div className="flex justify-between border-t border-background-200/70 pt-1.5"><span className="text-foreground-500">Merchant Receives</span><span className="font-bold text-primary-700">{formatCurrency(netAmount)}</span></div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground-600 mb-1">Mobile Money Number</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => { setPhoneNumber(e.target.value); setVerifiedName(null); setVerifyError(""); }}
                  placeholder="e.g. 2567XXXXXXXX"
                  className="flex-1 px-4 py-3 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  required
                />
                <button
                  type="button"
                  onClick={handleVerifyPhone}
                  disabled={verifyingPhone || !phoneNumber.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-3 rounded-lg bg-background-100 hover:bg-background-200 border border-background-300/60 text-xs font-medium text-foreground-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                >
                  {verifyingPhone ? (
                    <><i className="ri-loader-4-line animate-spin" />Checking...</>
                  ) : (
                    <><i className="ri-user-search-line" />Verify</>
                  )}
                </button>
              </div>
              {verifyingPhone && <p className="text-xs text-foreground-500 mt-1">Looking up your account name...</p>}
              {verifiedName && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <i className="ri-checkbox-circle-fill" /> This number is registered to: <strong>{verifiedName}</strong>
                </p>
              )}
              {verifyError && (
                <p className="text-xs text-accent-600 mt-1 flex items-center gap-1">
                  <i className="ri-error-warning-line" /> {verifyError}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground-600 mb-1">Payment Method</label>
              <select value={network} onChange={(e) => setNetwork(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="mtn">MTN Mobile Money</option>
                <option value="airtel">Airtel Money</option>
              </select>
            </div>
            <button type="submit" disabled={submitting || (!link?.amount && amount <= 0) || !phoneNumber} className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-semibold py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm">
              {submitting ? (<><i className="ri-loader-4-line animate-spin mr-2" />Processing...</>) : `Pay ${link?.amount ? formatCurrency(link.amount) : (amount > 0 ? formatCurrency(amount) : "")}`}
            </button>
          </form>

          {/* QR Code + Share */}
          <div className="mt-4 pt-4 border-t border-background-200/70 space-y-3">
            <button
              onClick={() => setShowQR(!showQR)}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium text-foreground-600 hover:text-primary-600 py-2 px-4 rounded-lg border border-background-200/70 hover:border-primary-300/60 transition-colors cursor-pointer"
            >
              <i className={showQR ? "ri-qr-scan-line" : "ri-qr-code-line"} />
              {showQR ? "Hide QR Code" : "Show QR Code"}
            </button>

            {showQR && (
              <div className="flex flex-col items-center gap-3 p-4 bg-background-100 rounded-lg">
                <div className="w-40 h-40 bg-background-50 rounded-lg border border-background-200/70 p-2 flex items-center justify-center">
                  <img loading="lazy" decoding="async"
                    src={getQRCodeUrl(currentUrl)}
                    alt="QR Code for payment"
                    className="w-full h-full object-contain"
                    width={160}
                    height={160}
                  />
                </div>
                <p className="text-xs text-foreground-500 text-center">Scan to open this payment page on your phone</p>
              </div>
            )}

            <button
              onClick={copyUrl}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium text-foreground-500 hover:text-primary-600 py-2 px-4 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className={copiedUrl ? "ri-check-line text-primary-500" : "ri-file-copy-line"} />
              {copiedUrl ? "Link Copied!" : "Copy Payment Link"}
            </button>
          </div>

          <p className="text-center text-xs text-foreground-500 mt-4">
            Secured by <span className="font-semibold text-foreground-700">ObPay</span>
          </p>
        </div>
      </div>
    </>
  );
}