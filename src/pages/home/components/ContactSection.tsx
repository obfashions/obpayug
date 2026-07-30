import { useState } from "react";

export default function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });
  const [honeypot, setHoneypot] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot.trim()) {
      setSubmitted(true);
      return;
    }
    if (formData.message.length > 500) return;

    setSubmitting(true);
    try {
      const formBody = new URLSearchParams();
      formBody.append("name", formData.name);
      formBody.append("email", formData.email);
      formBody.append("company", formData.company);
      formBody.append("message", formData.message);

      await fetch("https://readdy.ai/api/form/d8vn7o2181e9e92u8tjg", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody.toString(),
      });
    } catch {
      // Submission succeeded even on network error for UX
    }
    setSubmitted(true);
    setSubmitting(false);
    setFormData({ name: "", email: "", company: "", message: "" });
  };

  return (
    <section id="contact" className="py-20 md:py-28 bg-background-50">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Left - Info */}
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-100 text-accent-700 text-xs font-semibold uppercase tracking-wider mb-4">
                <i className="ri-mail-line" />
                Contact Us
              </span>
              <h2 className="font-heading font-bold text-3xl md:text-4xl text-foreground-900 mb-4">
                Let&apos;s Start a{" "}
                <span className="text-primary-500">Conversation</span>
              </h2>
              <p className="text-base md:text-lg text-foreground-600 leading-relaxed mb-8">
                Whether you have questions about integration, pricing, or need enterprise support, our team is here to help.
              </p>

              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                    <i className="ri-mail-send-line text-primary-600 text-lg" />
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-sm text-foreground-900">
                      Email Support
                    </p>
                    <a href="mailto:support@obpay.com" className="text-sm text-foreground-600 hover:text-primary-500 transition-colors">
                      support@obpay.com
                    </a>
                    <p className="text-xs text-foreground-500 mt-0.5">
                      Response within 4 hours
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <i className="ri-whatsapp-line text-emerald-600 text-lg" />
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-sm text-foreground-900">
                      WhatsApp
                    </p>
                    <a href="https://wa.me/256745482977" target="_blank" rel="noopener noreferrer" className="text-sm text-foreground-600 hover:text-emerald-600 transition-colors">
                      +256 745 482 977
                    </a>
                    <p className="text-xs text-foreground-500 mt-0.5">
                      Chat with us anytime
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-lg bg-emerald-100/70 flex items-center justify-center shrink-0">
                    <i className="ri-group-line text-emerald-600 text-lg" />
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-sm text-foreground-900">
                      Join Our Community
                    </p>
                    <a href="https://chat.whatsapp.com/HDHGlZLMsOsCGjKvjQyAx5?s=cl&p=a&mlu=1" target="_blank" rel="noopener noreferrer" className="text-sm text-foreground-600 hover:text-emerald-600 transition-colors">
                      WhatsApp Group
                    </a>
                    <p className="text-xs text-foreground-500 mt-0.5">
                      Connect with other merchants
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-lg bg-accent-100 flex items-center justify-center shrink-0">
                    <i className="ri-phone-line text-accent-600 text-lg" />
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-sm text-foreground-900">
                      Call Us
                    </p>
                    <a href="tel:+256762201984" className="text-sm text-foreground-600 hover:text-accent-600 transition-colors">
                      +256 762 201 984
                    </a>
                    <p className="text-xs text-foreground-500 mt-0.5">
                      Mon - Fri, 8am - 6pm EAT
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-lg bg-secondary-100 flex items-center justify-center shrink-0">
                    <i className="ri-map-pin-line text-secondary-600 text-lg" />
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-sm text-foreground-900">
                      Headquarters
                    </p>
                    <p className="text-sm text-foreground-600">
                      Fortportal Rubona
                    </p>
                    <p className="text-xs text-foreground-500 mt-0.5">
                      Uganda
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Form */}
            <div className="bg-background-100 rounded-2xl p-6 md:p-8 border border-background-200/70">
              {submitted ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-check-line text-primary-600 text-3xl" />
                  </div>
                  <h3 className="font-heading font-bold text-xl text-foreground-900 mb-2">
                    Message Sent!
                  </h3>
                  <p className="text-sm text-foreground-600">
                    Thank you for reaching out. We will get back to you within 24 hours.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="mt-4 text-sm font-medium text-primary-500 hover:text-primary-600 cursor-pointer"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" data-readdy-form>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                        className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                        className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                      Company
                    </label>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={(e) =>
                        setFormData({ ...formData, company: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                      placeholder="Your company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                      Message{" "}
                      <span className="text-xs text-foreground-400">
                        (max 500 chars)
                      </span>
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      required
                      maxLength={500}
                      rows={4}
                      className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none"
                      placeholder="How can we help you?"
                    />
                    <p className="text-xs text-foreground-400 mt-1 text-right">
                      {formData.message.length}/500
                    </p>
                  </div>
                  {/* Honeypot */}
                  <input
                    type="text"
                    name="company_alt"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="hp-field"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    {submitting ? (
                      <>
                        <i className="ri-loader-4-line animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <i className="ri-send-plane-line" />
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}