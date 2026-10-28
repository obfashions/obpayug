import { useState, useEffect } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { Link } from "@/lib/router-compat";
import { invokeObpay } from "@/lib/edge-function";
import { ServiceDirectory } from "@/pages/services/page";

const SERVICE_LINKS = [
  { title: "Collections", desc: "Mobile money and card payments from customers.", href: "/dashboard/collections", icon: "ri-download-cloud-line" },
  { title: "Payouts", desc: "Send money to MTN, Airtel and M-Pesa wallets.", href: "/dashboard/payouts", icon: "ri-upload-cloud-line" },
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
          <p className="text-sm text-muted-foreground">Payments and everyday services for your business.</p>
        </div>

        <ServiceDirectory />
        <Link to="/dashboard/service-history" className="text-primary underline text-sm">View service history</Link>

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
          <h2 className="mb-3 font-semibold text-foreground">Service availability</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Service availability could not be confirmed.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {services.map((s: any) => (
                <div key={s.code} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      s.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.status === "active" ? "Available" : s.status === "manual_review" ? "Contact support" : "Unavailable"}
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
