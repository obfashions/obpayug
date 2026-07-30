import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Footer() {
  const [supportEmail, setSupportEmail] = useState("support@obpay.com");
  const [supportPhone, setSupportPhone] = useState("+256762201984");
  const [supportWhatsApp, setSupportWhatsApp] = useState("+256745482977");

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
  }, []);

  const productLinks = [
    { label: "Collections", href: "#features" },
    { label: "Payouts", href: "#features" },
    { label: "Payment Links", href: "#features" },
    { label: "API Documentation", href: "/docs" },
    { label: "Pricing", href: "/pricing" },
  ];

  const developerLinks = [
    { label: "API Reference", href: "/docs" },
    { label: "SDKs", href: "/docs/sdk" },
    { label: "Webhooks", href: "/docs/webhooks" },
    { label: "Status Page", href: "#" },
    { label: "Changelog", href: "#" },
  ];

  const companyLinks = [
    { label: "About Us", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Contact", href: "#contact" },
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
  ];

  return (
    <footer className="bg-background-100 border-t border-background-200/70">
      <div className="w-full px-4 md:px-6 lg:px-8 py-12 md:py-16">
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
                ObPay
              </span>
            </Link>
            <p className="text-sm text-foreground-600 leading-relaxed max-w-xs">
              Powering business payments across East Africa. Collect payments, send payouts, and integrate secure APIs with a single platform.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <a
                href="https://twitter.com/obpay"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="w-9 h-9 rounded-full bg-background-200/70 flex items-center justify-center text-foreground-600 hover:text-primary-500 hover:bg-primary-100 transition-colors"
                aria-label="Twitter"
              >
                <i className="ri-twitter-x-line text-base" />
              </a>
              <a
                href="https://linkedin.com/company/obpay"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="w-9 h-9 rounded-full bg-background-200/70 flex items-center justify-center text-foreground-600 hover:text-primary-500 hover:bg-primary-100 transition-colors"
                aria-label="LinkedIn"
              >
                <i className="ri-linkedin-fill text-base" />
              </a>
              <a
                href="https://github.com/obpay"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="w-9 h-9 rounded-full bg-background-200/70 flex items-center justify-center text-foreground-600 hover:text-primary-500 hover:bg-primary-100 transition-colors"
                aria-label="GitHub"
              >
                <i className="ri-github-fill text-base" />
              </a>
            </div>
            {supportEmail && (
              <div className="mt-4 space-y-1">
                <a href={`mailto:${supportEmail}`} className="flex items-center gap-2 text-sm text-foreground-600 hover:text-primary-500 transition-colors">
                  <i className="ri-mail-line text-foreground-400" />
                  {supportEmail}
                </a>
                {supportWhatsApp && (
                  <a href={`https://wa.me/${supportWhatsApp.replace(/\+/g, "")}`} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 text-sm text-foreground-600 hover:text-emerald-500 transition-colors">
                    <i className="ri-whatsapp-line text-foreground-400" />
                    {supportWhatsApp}
                  </a>
                )}
                <a href="https://chat.whatsapp.com/HDHGlZLMsOsCGjKvjQyAx5?s=cl&p=a&mlu=1" target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 text-sm text-foreground-600 hover:text-emerald-500 transition-colors">
                  <i className="ri-group-line text-foreground-400" />
                  Join our WhatsApp Community
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
          <div className="flex items-center gap-4 text-xs text-foreground-500">
            <Link to="#" className="hover:text-foreground-700 transition-colors">
              Privacy
            </Link>
            <span className="text-foreground-300">|</span>
            <Link to="#" className="hover:text-foreground-700 transition-colors">
              Terms
            </Link>
            <span className="text-foreground-300">|</span>
            <Link to="#" className="hover:text-foreground-700 transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}