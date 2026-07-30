import { useEffect, useRef, useState } from "react";

const stats = [
  {
    value: 2500,
    suffix: "+",
    label: "Active Merchants",
    prefix: "",
  },
  {
    value: 12,
    suffix: "M+",
    label: "Transactions Processed",
    prefix: "UGX ",
  },
  {
    value: 99.9,
    suffix: "%",
    label: "Uptime Guarantee",
    prefix: "",
  },
  {
    value: 4,
    suffix: "",
    label: "Countries Supported",
    prefix: "",
  },
];

function AnimatedCounter({
  value,
  prefix,
  suffix,
  decimals = 0,
}: {
  value: number;
  prefix: string;
  suffix: string;
  decimals?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            const duration = 2000;
            const startTime = performance.now();

            const animate = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const easeOut = 1 - Math.pow(1 - progress, 3);
              setCount(easeOut * value);

              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            };

            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  const formatted = decimals > 0 ? count.toFixed(decimals) : Math.floor(count);

  return (
    <span ref={ref}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

export default function StatsSection() {
  return (
    <section className="py-20 md:py-24 bg-background-100 border-y border-background-200/70">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-0">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`text-center ${
                  index < stats.length - 1
                    ? "lg:border-r lg:border-background-200/70"
                    : ""
                }`}
              >
                <div className="font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-primary-500 mb-2">
                  <AnimatedCounter
                    value={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    decimals={stat.value % 1 !== 0 ? 1 : 0}
                  />
                </div>
                <p className="text-sm md:text-base text-foreground-600">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}