export default function TrustSection() {
  const certifications = [
    {
      icon: "ri-shield-check-line",
      title: "PCI DSS Compliant",
      desc: "Your customers' payment data is protected under the highest industry security standards for payment card processing.",
    },
    {
      icon: "ri-lock-2-line",
      title: "AES-256 Encryption",
      desc: "All data is encrypted at rest and in transit using bank-grade AES-256 encryption protocols.",
    },
    {
      icon: "ri-fingerprint-line",
      title: "Two-Factor Auth",
      desc: "Mandatory 2FA for all merchant accounts. Your business funds are protected with an additional security layer.",
    },
    {
      icon: "ri-shield-flash-line",
      title: "Fraud Detection",
      desc: "Real-time AI-powered fraud monitoring on every transaction. Suspicious activity is flagged and blocked instantly.",
    },
    {
      icon: "ri-database-2-line",
      title: "Data Residency",
      desc: "All customer data is stored on secure servers within East Africa, complying with regional data protection regulations.",
    },
    {
      icon: "ri-24-hours-line",
      title: "24/7 Monitoring",
      desc: "Round-the-clock security operations center monitoring for threats. Incident response within minutes, not hours.",
    },
  ];

  const trustStats = [
    { value: "2,500+", label: "Active Merchants" },
    { value: "UGX 85B+", label: "Processed Annually" },
    { value: "99.99%", label: "Uptime SLA" },
    { value: "4", label: "Countries" },
  ];

  return (
    <section className="py-20 md:py-28 bg-background-100">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-14 md:mb-18">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-100 text-secondary-700 text-xs font-semibold uppercase tracking-wider mb-4">
              <i className="ri-shield-star-line" />
              Security &amp; Trust
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-foreground-900 mb-4">
              Your Money Is{" "}
              <span className="text-primary-500">Safe With Us</span>
            </h2>
            <p className="text-base md:text-lg text-foreground-600 leading-relaxed">
              ObPay is built on enterprise-grade security infrastructure. We protect your business and your customers with the same standards used by major global banks.
            </p>
          </div>

          {/* Trust Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-4 mb-14">
            {trustStats.map((stat, i) => (
              <div key={i} className="text-center p-5 bg-background-50 rounded-xl border border-background-200/70">
                <div className="font-heading font-bold text-2xl md:text-3xl text-primary-500 mb-1">
                  {stat.value}
                </div>
                <p className="text-sm text-foreground-600">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Certifications Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {certifications.map((cert) => (
              <div
                key={cert.title}
                className="flex items-start gap-4 p-5 bg-background-50 rounded-xl border border-background-200/70 hover:border-primary-300/60 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                  <i className={`${cert.icon} text-primary-600 text-lg`} />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-1">
                    {cert.title}
                  </h3>
                  <p className="text-xs text-foreground-600 leading-relaxed">
                    {cert.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Compliance Badge Row */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 md:gap-10">
            <div className="flex items-center gap-2 text-sm text-foreground-600">
              <i className="ri-verified-badge-line text-primary-500 text-xl" />
              <span>PCI DSS Level 1</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground-600">
              <i className="ri-verified-badge-line text-primary-500 text-xl" />
              <span>GDPR Ready</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground-600">
              <i className="ri-verified-badge-line text-primary-500 text-xl" />
              <span>ISO 27001</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground-600">
              <i className="ri-verified-badge-line text-primary-500 text-xl" />
              <span>SSL/TLS 1.3</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground-600">
              <i className="ri-verified-badge-line text-primary-500 text-xl" />
              <span>Bank of Uganda</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}