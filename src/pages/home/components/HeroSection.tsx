import { Link } from "@/lib/router-compat";
import { useEffect, useRef, useState } from "react";

const slides = [
  {
    image: "https://readdy.ai/api/search-image?query=Candid%20photo%20of%20an%20African%20businessman%20in%20a%20light%20blue%20dress%20shirt%20working%20on%20a%20laptop%20at%20a%20modern%20bank%20office%20with%20large%20windows%20natural%20afternoon%20light%20shallow%20depth%20of%20field%20editorial%20photography%20warm%20skin%20tones%20realistic%20authentic%20not%20posed&width=1400&height=900&seq=obpay-hero-real-01&orientation=landscape",
    alt: "Business professional working in a modern East African bank office",
    headline: "Payments Built for East African Businesses",
    subline: "Accept Mobile Money, bank transfers, and card payments. Same-day settlements to your account.",
    cta: "Open a Business Account",
    ctaLink: "/register",
  },
  {
    image: "https://readdy.ai/api/search-image?query=Close%20up%20of%20African%20hands%20holding%20Ugandan%20shilling%20banknotes%20and%20a%20smartphone%20displaying%20mobile%20money%20transaction%20confirmation%20on%20a%20wooden%20market%20stall%20counter%20natural%20daylight%20documentary%20photography%20authentic%20East%20African%20market%20scene%20realistic%20detail&width=1400&height=900&seq=obpay-hero-real-02&orientation=landscape",
    alt: "Merchant receiving mobile money payment at a market stall",
    headline: "Every Sale Counts. Every Payment Lands.",
    subline: "From street vendors to enterprise chains — collect payments from any phone or bank account instantly.",
    cta: "Start Collecting Payments",
    ctaLink: "/register",
  },
  {
    image: "https://readdy.ai/api/search-image?query=African%20female%20entrepreneur%20in%20a%20bright%20kitenge%20dress%20standing%20behind%20her%20small%20shop%20counter%20in%20Kampala%20smiling%20naturally%20while%20holding%20a%20mobile%20phone%20warm%20interior%20lighting%20candid%20documentary%20photography%20realistic%20believable%20not%20stock%20photo&width=1400&height=900&seq=obpay-hero-real-03&orientation=landscape",
    alt: "Female shop owner accepting mobile payments in her Kampala store",
    headline: "Your Shop. Your Rules. Your Money.",
    subline: "Create payment links, share on WhatsApp, and watch the money hit your account in seconds.",
    cta: "Create Payment Links",
    ctaLink: "/register",
  },
  {
    image: "https://readdy.ai/api/search-image?query=Professional%20African%20woman%20using%20an%20ATM%20machine%20at%20a%20modern%20bank%20in%20East%20Africa%20wearing%20business%20casual%20attire%20natural%20candid%20moment%20soft%20interior%20lighting%20photojournalistic%20style%20realistic%20detail%20warm%20tones&width=1400&height=900&seq=obpay-hero-real-04&orientation=landscape",
    alt: "Professional woman using a bank ATM in East Africa",
    headline: "Withdraw, Pay Out, and Scale",
    subline: "Send bulk payouts to staff and suppliers, track every transfer, and manage your money from one dashboard.",
    cta: "Explore Payouts",
    ctaLink: "/register",
  },
];

export default function HeroSection() {
  const [current, setCurrent] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const goTo = (index: number) => {
    if (index === current) return;
    setCurrent(index);
  };

  const next = () => goTo((current + 1) % slides.length);

  useEffect(() => {
    timerRef.current = setInterval(next, 6000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [current]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.changedTouches[0].screenX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].screenX;
    if (diff > 50) next();
    if (diff < -50) goTo((current - 1 + slides.length) % slides.length);
    setTouchStart(null);
  };

  return (
    <section
      className="relative w-full overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Full-bleed image stack */}
      <div className="relative w-full h-[520px] md:h-[700px] lg:h-[780px]">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === current ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            <img
              src={slide.image}
              alt={slide.alt}
              className="w-full h-full object-cover"
              width="1400"
              height="900"
              loading={index === 0 ? "eager" : "lazy"}
            />
            {/* Dark gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground-900/80 via-foreground-900/40 to-foreground-900/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-foreground-900/60 via-transparent to-transparent" />
          </div>
        ))}

        {/* Text content — overlaid directly on image */}
        <div className="absolute inset-0 z-20 flex items-end md:items-center">
          <div className="w-full px-5 md:px-8 lg:px-12 pb-16 md:pb-0 max-w-7xl mx-auto">
            <div className="max-w-2xl">
              {/* Small label */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-50/20 backdrop-blur-sm text-background-50 text-xs font-medium mb-4 md:mb-5 border border-background-50/20">
                <i className="ri-shield-check-line" />
                ObPay (PawaPay Ptn)
              </div>

              {/* Headline */}
              <h1 className="font-heading font-bold text-3xl md:text-5xl lg:text-6xl text-background-50 leading-tight mb-4 md:mb-5">
                {slides[current].headline}
              </h1>

              {/* Subline */}
              <p className="text-base md:text-lg text-background-200 leading-relaxed mb-6 md:mb-8 max-w-lg">
                {slides[current].subline}
              </p>

              {/* CTA */}
              <Link
                to={slides[current].ctaLink}
                className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold text-sm md:text-base px-7 md:px-9 py-3.5 md:py-4 rounded-lg transition-all whitespace-nowrap cursor-pointer w-full sm:w-auto"
              >
                {slides[current].cta}
                <i className="ri-arrow-right-line" />
              </Link>

              {/* Secondary link */}
              <Link
                to="/docs"
                className="ml-0 sm:ml-4 mt-3 sm:mt-0 inline-flex items-center justify-center gap-2 text-background-50/90 hover:text-background-50 font-medium text-sm px-5 py-3.5 transition-all whitespace-nowrap cursor-pointer"
              >
                <i className="ri-play-circle-line" />
                See how it works
              </Link>
            </div>
          </div>
        </div>

        {/* Carousel arrows — desktop only */}
        <button
          onClick={() => goTo((current - 1 + slides.length) % slides.length)}
          className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 items-center justify-center rounded-full bg-background-50/15 hover:bg-background-50/30 backdrop-blur-sm border border-background-50/20 text-background-50 transition-all cursor-pointer"
          aria-label="Previous slide"
        >
          <i className="ri-arrow-left-s-line text-xl" />
        </button>
        <button
          onClick={next}
          className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 items-center justify-center rounded-full bg-background-50/15 hover:bg-background-50/30 backdrop-blur-sm border border-background-50/20 text-background-50 transition-all cursor-pointer"
          aria-label="Next slide"
        >
          <i className="ri-arrow-right-s-line text-xl" />
        </button>

        {/* Line-style carousel indicators — bottom */}
        <div className="absolute bottom-6 md:bottom-8 left-5 md:left-8 lg:left-12 z-30 flex items-center gap-3">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              className={`h-[3px] rounded-full transition-all duration-500 cursor-pointer ${
                index === current
                  ? "w-10 bg-primary-500"
                  : "w-6 bg-background-50/40 hover:bg-background-50/60"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Slide counter — bottom right */}
        <div className="absolute bottom-6 md:bottom-8 right-5 md:right-8 z-30 text-background-50/60 text-xs font-medium tracking-wider">
          {String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </div>
      </div>
    </section>
  );
}