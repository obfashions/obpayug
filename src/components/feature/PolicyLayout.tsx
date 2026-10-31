import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";

export type PolicySection = { id: string; title: string; content: ReactNode };

export default function PolicyLayout({ title, introduction, sections }: {
  title: string;
  introduction: string;
  sections: PolicySection[];
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-28 md:px-10 md:pt-36">
        <header className="max-w-3xl border-b border-border pb-8">
          <nav aria-label="Policy pages" className="mb-6 flex flex-wrap gap-5 text-sm">
            <Link to="/terms" activeProps={{ className: "font-semibold underline underline-offset-4" }} className="text-primary">Terms of Service</Link>
            <Link to="/privacy" activeProps={{ className: "font-semibold underline underline-offset-4" }} className="text-primary">Privacy Policy</Link>
          </nav>
          <h1 className="font-heading text-3xl font-semibold md:text-4xl">{title}</h1>
          <p className="mt-4 text-sm text-muted-foreground">Last updated: 31 October 2026</p>
          <p className="mt-5 leading-7 text-muted-foreground">{introduction}</p>
        </header>
        <div className="mt-9 grid min-w-0 gap-10 md:grid-cols-[200px_minmax(0,1fr)]">
          <aside>
            <nav aria-label="On this page" className="space-y-3 md:sticky md:top-28">
              <h2 className="mb-4 text-sm font-semibold">On this page</h2>
              {sections.map((section, index) => (
                <a key={section.id} href={`#${section.id}`} className="block text-sm leading-6 text-muted-foreground hover:text-primary">
                  {index + 1}. {section.title}
                </a>
              ))}
            </nav>
          </aside>
          <article className="min-w-0 max-w-3xl space-y-9">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-28 border-b border-border pb-8">
                <h2 className="mb-4 text-xl font-semibold">{index + 1}. {section.title}</h2>
                <div className="space-y-4 break-words text-sm leading-7 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                  {section.content}
                </div>
              </section>
            ))}
            <Link to="/register" className="inline-flex text-sm font-medium text-primary underline underline-offset-4">Return to account registration</Link>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function PolicyContact() {
  return (
    <address className="not-italic">
      ObPay<br />
      Fort Portal, Uganda<br />
      <a href="mailto:obsfashions@zohomail.com">obsfashions@zohomail.com</a><br />
      <a href="tel:+256745482977">+256 745 482977</a>
    </address>
  );
}