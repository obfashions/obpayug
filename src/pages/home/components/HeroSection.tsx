import { Link } from "@/lib/router-compat";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import businessImage from "@/assets/obpay-business.jpg";

export default function HeroSection() {
  return (
    <section className="payment-hero relative isolate overflow-hidden">
      <img src={businessImage} alt="Shop owner reviewing a payment at her counter" width={1920} height={1024} fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-right" />
      <div className="hero-shade absolute inset-0 -z-10" />
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-10 md:py-28">
        <div className="max-w-xl">
          <p className="mb-6 text-sm font-medium text-on-inverse/80">Business payments, across borders</p>
          <h1 className="text-5xl font-semibold leading-none text-on-inverse md:text-7xl">ObPay</h1>
          <p className="mt-5 text-3xl font-medium leading-tight text-on-inverse md:text-4xl">Payments for the way<br className="hidden sm:block" /> you do business.</p>
          <p className="mt-6 max-w-md text-base leading-7 text-on-inverse/85">Accept mobile-money payments, pay suppliers and manage your currency wallets. From your first sale to your daily operations.</p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="h-12 px-6"><Link to="/register">Create an account <ArrowRight /></Link></Button>
            <Button asChild variant="ghost" className="h-12 text-on-inverse hover:bg-on-inverse/10 hover:text-on-inverse"><Link to="/docs">Explore the API <ArrowRight /></Link></Button>
          </div>
        </div>
      </div>
      <div className="border-t border-on-inverse/20">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-x-10 gap-y-3 px-6 py-5 text-sm text-on-inverse/85 md:px-10"><span>Mobile-money collections</span><span>Merchant payouts</span><span>Payment links & API</span></div>
      </div>
    </section>
  );
}
