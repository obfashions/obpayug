import { useState, useEffect } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowRight, ArrowDownLeft, ArrowUpRight, Link2, Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import WhatsappFloatingButton from "@/components/feature/WhatsappFloatingButton";
import HeroSection from "./components/HeroSection";
import CountriesSection from "./components/CountriesSection";
import { ServiceDirectory } from "@/pages/services/page";

const products = [
  { number: "01", name: "Accept payments", icon: ArrowDownLeft, detail: "Request payment from a customer's mobile-money account. Track each collection by reference, amount and status.", link: "/docs", label: "Collections" },
  { number: "02", name: "Send payouts", icon: ArrowUpRight, detail: "Pay recipients on supported networks. Review the recipient amount, charges and wallet deduction before confirming.", link: "/docs", label: "Payouts" },
  { number: "03", name: "Share a payment link", icon: Link2, detail: "Create a checkout link from your account and send it to your customer. Keep the payment alongside your other transactions.", link: "/register", label: "Payment links" },
];

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = localStorage.getItem("obpay-theme");
    const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(dark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", dark);
  }, []);
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next); document.documentElement.classList.toggle("dark", next === "dark"); localStorage.setItem("obpay-theme", next);
  };
  return <div className="min-h-screen bg-background">
    <Navbar onToggleTheme={toggleTheme} theme={theme} />
    <main className="pt-[72px]">
      <HeroSection />
      <section id="features" className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-24">
        <div className="mb-12 grid gap-5 md:grid-cols-2"><h2 className="max-w-lg text-3xl font-semibold leading-tight md:text-4xl">Your payments.<br />One operational account.</h2><p className="max-w-lg self-end text-base leading-7 text-muted-foreground">Collections, payouts and payment links with a record of every transaction. Manage payments from your account or connect ObPay to your own application.</p></div>
        <div className="grid md:grid-cols-3">{products.map(p => <article key={p.number} className="border-t border-border py-8 md:pr-10"><div className="mb-7 flex items-center gap-4"><p.icon className="h-6 w-6 text-primary" /><span className="font-mono text-xs text-muted-foreground">{p.number}</span></div><h3 className="text-xl font-semibold">{p.name}</h3><p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">{p.detail}</p><Link to={p.link} className="mt-6 inline-flex items-center gap-3 text-sm font-medium text-primary">{p.label}<ArrowRight className="h-4 w-4" /></Link></article>)}</div>
      </section>
      <CountriesSection />
      <section className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-24"><div className="mb-10 flex flex-wrap items-end justify-between gap-6"><div><p className="mb-3 text-sm font-medium text-primary">Day-to-day operations</p><h2 className="text-3xl font-semibold md:text-4xl">More than a payment.</h2><p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">Airtime, data and bill payments for Uganda, alongside card collections. Bank transfers are arranged through customer service.</p></div><Link to="/services" className="inline-flex items-center gap-3 text-sm font-medium text-primary">All services <ArrowRight className="h-4 w-4" /></Link></div><ServiceDirectory /></section>
      <section className="bg-inverse text-on-inverse"><div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-2 md:px-10 md:py-20"><div><Braces className="mb-6 h-8 w-8 text-inverse-accent" /><p className="mb-3 text-sm text-inverse-accent">For developers</p><h2 className="text-3xl font-semibold leading-tight md:text-4xl">Payments inside<br />your application.</h2><p className="mt-5 max-w-md text-base leading-7 text-on-inverse/75">Use the API to initiate collections, submit payouts and retrieve balances by currency. Follow a payment from request to confirmed outcome.</p><Button asChild variant="outline" className="mt-8 border-on-inverse/30 bg-transparent text-on-inverse hover:bg-on-inverse/10 hover:text-on-inverse"><Link to="/docs">Read the documentation <ArrowRight /></Link></Button></div><div className="self-center border-y border-on-inverse/20 font-mono text-sm"><div className="border-b border-on-inverse/20 py-4 text-on-inverse/60">API reference</div>{[{ method:"POST",path:"/v1/collect",desc:"Request a collection"},{method:"POST",path:"/v1/payouts",desc:"Submit a payout"},{method:"GET",path:"/v1/balance?currency=UGX",desc:"Read a currency balance"}].map(r=><div key={r.path} className="py-5"><div className="flex flex-wrap gap-4"><span className="text-inverse-accent">{r.method}</span><span className="break-all">{r.path}</span></div><p className="mt-2 font-sans text-xs text-on-inverse/60">{r.desc}</p></div>)}</div></div></section>
      <section id="contact" className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-6 py-16 md:flex-row md:items-center md:px-10 md:py-20"><div><h2 className="text-3xl font-semibold">Put ObPay to work.</h2><p className="mt-4 text-muted-foreground">Create an account or speak with our team about your business.</p></div><div className="flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/register">Create an account <ArrowRight /></Link></Button><Button asChild variant="outline" size="lg"><Link to="/support">Contact support</Link></Button></div></section>
    </main><Footer /><WhatsappFloatingButton />
  </div>;
}
