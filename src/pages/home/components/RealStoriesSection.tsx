import { useEffect, useRef, useState } from "react";

const stories = [
  {
    image: "https://readdy.ai/api/search-image?query=East%20African%20market%20vendor%20in%20a%20bustling%20Kampala%20outdoor%20market%20counting%20Ugandan%20shilling%20banknotes%20with%20a%20smartphone%20on%20his%20wooden%20stall%20counter%20midday%20sunlight%20candid%20documentary%20photography%20realistic%20authentic%20not%20posed%20warm%20tones&width=800&height=600&seq=obpay-story-01&orientation=landscape",
    alt: "Market vendor counting earnings at his Kampala stall",
    name: "John Bosco",
    business: "Fresh Produce Vendor, Nakasero Market",
    quote: "Before ObPay, I lost sales because I could not take mobile money reliably. Now every customer pays me in seconds, and the money is in my account before they leave the stall.",
    stat: "UGX 12M",
    statLabel: "collected this quarter",
  },
  {
    image: "https://readdy.ai/api/search-image?query=Young%20African%20delivery%20driver%20on%20a%20motorcycle%20in%20Kampala%20wearing%20a%20branded%20jacket%20checking%20his%20smartphone%20for%20a%20payment%20confirmation%20on%20a%20busy%20street%20candid%20documentary%20photography%20natural%20daylight%20realistic%20authentic&width=800&height=600&seq=obpay-story-02&orientation=landscape",
    alt: "Delivery driver confirming a mobile payment on his phone",
    name: "Grace Auma",
    business: "Logistics Partner, Swift Deliveries",
    quote: "I used to chase clients for cash on delivery. Now I send them a payment link before I even leave the warehouse. Payment confirmed, package delivered, no stress.",
    stat: "98%",
    statLabel: "on-time payment rate",
  },
  {
    image: "https://readdy.ai/api/search-image?query=African%20female%20pharmacist%20in%20a%20white%20coat%20standing%20behind%20the%20counter%20of%20a%20small%20community%20pharmacy%20in%20Uganda%20holding%20a%20mobile%20phone%20showing%20a%20transaction%20screen%20warm%20interior%20lighting%20candid%20realistic%20documentary%20style&width=800&height=600&seq=obpay-story-03&orientation=landscape",
    alt: "Pharmacist accepting mobile payments at her community pharmacy",
    name: "Dr. Rebecca Nantale",
    business: "Nantale Community Pharmacy, Entebbe",
    quote: "Patients used to walk away when we did not have their preferred payment method. ObPay lets them pay with MTN, Airtel, or bank transfer. Our revenue went up 35% in two months.",
    stat: "35%",
    statLabel: "revenue increase",
  },
  {
    image: "https://readdy.ai/api/search-image?query=African%20taxi%20driver%20in%20a%20white%20Toyota%20sedan%20in%20Kampala%20receiving%20a%20mobile%20money%20payment%20from%20a%20passenger%20through%20the%20car%20window%20smiling%20naturally%20candid%20street%20photography%20natural%20daylight%20realistic%20authentic%20East%20African%20urban%20scene&width=800&height=600&seq=obpay-story-04&orientation=landscape",
    alt: "Taxi driver accepting a mobile money payment from a passenger",
    name: "Moses Okello",
    business: "Independent Transport Operator",
    quote: "No more fake mobile money messages. ObPay confirms the payment instantly on my phone. I have not been scammed once since I started using it six months ago.",
    stat: "6 months",
    statLabel: "zero fraud incidents",
  },
];

export default function RealStoriesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 md:py-28 bg-background-100">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-14 md:mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold uppercase tracking-wider mb-4">
              <i className="ri-user-smile-line" />
              Real Merchants, Real Results
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-foreground-900 mb-4">
              The People Behind{" "}
              <span className="text-primary-500">Every Transaction</span>
            </h2>
            <p className="text-base md:text-lg text-foreground-600 leading-relaxed">
              These are real business owners across Uganda who use ObPay every day to collect payments, pay suppliers, and grow their businesses.
            </p>
          </div>

          {/* Stories grid — alternating layout */}
          <div className="space-y-12 md:space-y-16">
            {stories.map((story, index) => {
              const isReversed = index % 2 === 1;
              return (
                <div
                  key={story.name}
                  className={`grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-center ${
                    isVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-6"
                  } transition-all duration-700`}
                  style={{ transitionDelay: `${index * 150}ms` }}
                >
                  {/* Image */}
                  <div className={`${isReversed ? "md:order-2" : ""}`}>
                    <div className="relative rounded-xl overflow-hidden bg-foreground-100">
                      <img
                        src={story.image}
                        alt={story.alt}
                        className="w-full aspect-[4/3] object-cover"
                        width="800"
                        height="600"
                        loading="lazy"
                      />
                      {/* Subtle bottom gradient */}
                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-foreground-900/30 to-transparent" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className={`${isReversed ? "md:order-1" : ""}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <i className="ri-user-3-line text-primary-600 text-lg" />
                      </div>
                      <div>
                        <p className="font-heading font-semibold text-foreground-900">
                          {story.name}
                        </p>
                        <p className="text-xs text-foreground-500">
                          {story.business}
                        </p>
                      </div>
                    </div>

                    <blockquote className="text-base md:text-lg text-foreground-700 leading-relaxed mb-6 italic border-l-2 border-primary-300 pl-5">
                      &ldquo;{story.quote}&rdquo;
                    </blockquote>

                    <div className="inline-flex items-center gap-2 bg-background-50 rounded-lg px-4 py-2.5 border border-background-200/70">
                      <span className="font-heading font-bold text-xl text-primary-500">
                        {story.stat}
                      </span>
                      <span className="text-sm text-foreground-600">
                        {story.statLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}