import { useState, useEffect } from "react";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { JsonLd } from "@/components/base/JsonLd";
import HeroSection from "./components/HeroSection";
import QuickActionsSection from "./components/QuickActionsSection";
import PaymentMethodsSection from "./components/PaymentMethodsSection";
import FeaturesSection from "./components/FeaturesSection";
import HowItWorksSection from "./components/HowItWorksSection";
import RealStoriesSection from "./components/RealStoriesSection";
import StatsSection from "./components/StatsSection";
import TestimonialsSection from "./components/TestimonialsSection";
import FAQSection from "./components/FAQSection";
import CTASection from "./components/CTASection";
import ContactSection from "./components/ContactSection";
import TrustSection from "./components/TrustSection";
import PartnersSection from "./components/PartnersSection";
import InstallPWA from "./components/InstallPWA";
import ComplianceSection from "./components/ComplianceSection";
import WhatsappFloatingButton from "@/components/feature/WhatsappFloatingButton";
import CountriesSection from "./components/CountriesSection";

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("obpay-theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle("dark", saved === "dark");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    localStorage.setItem("obpay-theme", newTheme);
  };

  return (
    <div className="min-h-screen bg-background-50">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "ObPay",
          url: import.meta.env.VITE_SITE_URL,
          description: "ObPay operates internationally with separate currency wallets and country-specific payment methods.",
          logo: "https://storage.readdy-site.link/project_files/f591f50b-9b67-4c2e-91b2-e9cd02864c7f/c3af3d6a-4922-444f-b121-d8c41e1841fc_compressed_file_000000001c7471f4988719b77b5ed56d.webp",
          telephone: ["+256-762-201-984", "+256-745-482-977"],
          email: "support@obpay.com",
          address: {
            "@type": "PostalAddress",
            streetAddress: "Fortportal Rubona",
            addressLocality: "Fortportal",
            addressRegion: "Western Region",
            addressCountry: "UG",
          },
          geo: {
            "@type": "GeoCoordinates",
            latitude: "0.6716",
            longitude: "30.2750",
          },
          contactPoint: [
            {
              "@type": "ContactPoint",
              telephone: "+256-762-201-984",
              contactType: "customer support",
              availableLanguage: ["English"],
              areaServed: "UG",
            },
            {
              "@type": "ContactPoint",
              telephone: "+256-745-482-977",
              contactType: "WhatsApp support",
              availableLanguage: ["English"],
              areaServed: "UG",
            },
          ],
          sameAs: [
            "https://twitter.com/obpay",
            "https://linkedin.com/company/obpay",
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What payment methods does ObPay support?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "ObPay supports MTN Mobile Money, Airtel Money, and direct bank transfers across East Africa. We are connected to major banks including GTBank, Stanbic Bank, Equity Bank, Absa, DFCU Bank, Centenary Bank, PostBank, and Housing Finance Bank.",
              },
            },
            {
              "@type": "Question",
              name: "How long does it take to integrate the ObPay API?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Most developers complete a basic integration within 2 hours. We provide SDKs for PHP, Laravel, Node.js, JavaScript, and Python, along with comprehensive documentation and a sandbox environment for testing.",
              },
            },
            {
              "@type": "Question",
              name: "What are the transaction fees?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "ObPay uses simple tiered pricing on payouts and withdrawals: a flat 2,000 UGX for amounts 500–70,000 UGX, and 3% for 70,001–5M UGX. Receiving payments has a small platform fee shown before each payment. No setup fees or monthly minimums.",
              },
            },
            {
              "@type": "Question",
              name: "How do I get verified as a merchant?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "After registration, you will be redirected to the KYC page where you provide your company name, country, business address, and national ID number. Our team reviews applications within 24-48 hours.",
              },
            },
            {
              "@type": "Question",
              name: "Is my data and my customers' data secure?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Absolutely. ObPay uses bank-level AES-256 encryption for all data in transit and at rest. We are PCI DSS compliant, implement two-factor authentication, advanced fraud detection, and regular security audits.",
              },
            },
            {
              "@type": "Question",
              name: "Can I create payment links without writing code?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes! Our Payment Links feature lets you create secure payment URLs directly from your dashboard in seconds. Simply enter the amount, currency, description, and optional redirect URL. Share the link via WhatsApp, email, SMS, or social media. No coding required.",
              },
            },
            {
              "@type": "Question",
              name: "How do webhooks work on ObPay?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Webhooks allow your application to receive real-time notifications when events occur, such as successful payments, failed transactions, or completed payouts. You configure a webhook URL in your dashboard, and we send signed POST requests with event data.",
              },
            },
            {
              "@type": "Question",
              name: "How does ObPay handle compliance and anti-money laundering (AML)?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "ObPay has a comprehensive compliance framework. Every merchant must complete mandatory KYC verification — including national ID upload and business address confirmation — before processing any transactions. All documents are manually reviewed by our compliance team. We run automated AML monitoring on every transaction to detect suspicious patterns, maintain complete audit trails of all financial activity, and operate in alignment with Bank of Uganda AML/CFT guidelines and FATF recommendations for payment service providers.",
              },
            },
            {
              "@type": "Question",
              name: "What currencies does ObPay support?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "ObPay supports UGX, KES, RWF, NGN, XOF, USD, ZMW, SLE and CDF and XAF wallets. Payment methods and availability vary by country.",
              },
            },
          ],
        }}
      />
      <Navbar onToggleTheme={toggleTheme} theme={theme} />
      <main>
        <HeroSection />
        <CountriesSection />
        <QuickActionsSection />
        <PaymentMethodsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <RealStoriesSection />
        <StatsSection />
        <TrustSection />
        <ComplianceSection />
        <PartnersSection />
        <TestimonialsSection />
        <CTASection />
        <FAQSection />
        <ContactSection />
      </main>
      <Footer />
      <InstallPWA />
      <WhatsappFloatingButton />
    </div>
  );
}