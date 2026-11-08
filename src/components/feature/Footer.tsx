import { Link, useSearchParams } from "@/lib/router-compat";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getSiteSetting } from "@/lib/site-settings.functions";

import { oauthReturnPath, withOAuthNext } from "@/lib/oauth-return-path";

const WHATSAPP_UPDATES_FALLBACK = "https://chat.whatsapp.com/HKBWYaui63M3mQxmu7ciLh";

export default function Footer() {
  const [searchParams] = useSearchParams();
  const next = oauthReturnPath(searchParams.get("next"));
  const [supportEmail, setSupportEmail] = useState("support@obpay.com");
  const [supportPhone, setSupportPhone] = useState("+256762201984");
  const [supportWhatsApp, setSupportWhatsApp] = useState("+256745482977");
  const [updatesUrl, setUpdatesUrl] = useState(WHATSAPP_UPDATES_FALLBACK);

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const { data } = await supabase.from("platform_settings").select("support_email, support_phone, support_whatsapp").limit(1).maybeSingle();
        if (data?.support_email) setSupportEmail(data.support_email);
        if (data?.support_phone) setSupportPhone(data.support_phone);
        if (data?.support_whatsapp) setSupportWhatsApp(data.support_whatsapp);
      } catch { /* silent */ }
    };
    fetchContact();
    getSiteSetting({ data: { key: "whatsapp_group_url" } })
      .then((r) => { if (r?.value) setUpdatesUrl(r.value); })
      .catch(() => {});
  }, []);

  const productLinks = [
    { label: "Payment services", href: "/services" },
    { label: "Pricing", href: "/pricing" },
    { label: "Create an account", href: withOAuthNext("/register", next) },
  ];
  const developerLinks = [
    { label: "API documentation", href: "/docs" },
    { label: "API keys", href: "/dashboard/api-keys" },
    { label: "API sandbox", href: "/dashboard/api-sandbox" },
  ];
  const companyLinks = [
    { label: "Contact support", href: "/support" },
    { label: "Sign in", href: withOAuthNext("/login", next) },
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
  ];

  return (
    <footer className="bg-background-100 border-t border-background-200/70">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 md:gap-8">
          {/* Brand */}
          <div className="lg:col-span-4">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
                <span className="text-background-50 font-heading font-bold text-sm">
                  Ob
                </span>
              </div>
              <span className="font-heading font-bold text-lg text-foreground-900">
                ObPay.
              </span>
            </Link>
            <p className="text-sm text-foreground-600 leading-relaxed max-w-xs">
              Business payments across supported markets. Collections, payouts and separate currency wallets.
            </p>
            {supportEmail && (
              <div className="mt-4 space-y-1">
                <a href={`mailto:${supportEmail}`} className="flex items-center gap-2 text-sm text-foreground-600 hover:text-primary-500 transition-colors">
                  <i className="ri-mail-line text-foreground-400" />
                  {supportEmail}
                </a>
                {supportWhatsApp && (
                  <a href={`https://wa.me/${supportWhatsApp.replace(/\+/g, "")}`} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 text-sm text-foreground-600 hover:text-primary transition-colors">
                    <i className="ri-whatsapp-line text-foreground-400" />
                    {supportWhatsApp}
                  </a>
                )}
                <a href={updatesUrl} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 text-sm text-foreground-600 hover:text-primary transition-colors">
                  <i className="ri-whatsapp-line text-foreground-400" />
                  Get updates on WhatsApp
                </a>
                {supportPhone && (
                  <a href={`tel:${supportPhone}`} className="flex items-center gap-2 text-sm text-foreground-600 hover:text-primary-500 transition-colors">
                    <i className="ri-phone-line text-foreground-400" />
                    {supportPhone}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Product */}
          <div className="lg:col-span-2 lg:col-start-6">
            <h4 className="font-heading font-semibold text-sm text-foreground-900 uppercase tracking-wider mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-foreground-600 hover:text-primary-500 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Developers */}
          <div className="lg:col-span-2">
            <h4 className="font-heading font-semibold text-sm text-foreground-900 uppercase tracking-wider mb-4">
              Developers
            </h4>
            <ul className="space-y-2.5">
              {developerLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-foreground-600 hover:text-primary-500 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="lg:col-span-2">
            <h4 className="font-heading font-semibold text-sm text-foreground-900 uppercase tracking-wider mb-4">
              Company
            </h4>
            <ul className="space-y-2.5">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-foreground-600 hover:text-primary-500 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-background-200/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-foreground-500">
            &copy; 2026 ObPay. All rights reserved.
          </p>
          <Link to="/support" className="text-xs text-foreground-500 hover:text-primary">Customer support</Link>
        </div>
      </div>
    </footer>
  );
}