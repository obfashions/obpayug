import { useState, useEffect } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { Link } from "@/lib/router-compat";
import { invokeObpay } from "@/lib/edge-function";

const SERVICE_LINKS = [
  { title: "Collections", desc: "Mobile money and card payments from customers.", href: "/dashboard/collections", icon: "ri-download-cloud-line" },
  { title: "Payouts", desc: "Send money to MTN, Airtel and M-Pesa wallets.", href: "/dashboard/payouts", icon: "ri-upload-cloud-line" },
  { title: "Bank Transfer", desc: "Push funds to any supported Ugandan bank account.", href: "/dashboard/bank-transfer", icon: "ri-bank-line" },
  { title: "Bill Payments", desc: "LIGHT/UMEME, NWSC water, DSTV and GOTV.", href: "/dashboard/bill-payments", icon: "ri-flashlight-line" },
  { title: "Airtime & Data", desc: "MTN, Airtel and Lyca airtime and data bundles.", href: "/dashboard/airtime-data", icon: "ri-smartphone-line" },
  { title: "Payment Links", desc: "Shareable hosted checkout pages.", href: "/dashboard/payment-links", icon: "ri-link-m" },
];

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invokeObpay({ action: "svc-list" }).then((res) => {
      if (res?.success) setServices(res.data?.services || []);
      setLoading(false);
    });
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Services</h1>
          <p className="text-sm text-muted-foreground">Everything your ObPay account can do, and which provider services are active.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICE_LINKS.map((s) => (
            <Link
              key={s.href}
              to={s.href}
              className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary hover:shadow-sm"
            >
              <i className={`${s.icon} text-2xl text-primary`} />
              <h2 className="mt-2 font-semibold text-foreground">{s.title}</h2>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </Link>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold text-foreground">Provider service status</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : services.length === 0 ? (
            <p className="text-sm text-muted-foreground">No provider services reported.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {services.map((s: any) => (
                <div key={s.service?.uuid} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{s.service?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.service?.type}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      s.availability?.is_subscribed ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.availability?.is_subscribed ? "Active" : "Not enabled"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
