import { useEffect, useState } from "react";
import { getSiteSetting } from "@/lib/site-settings.functions";

const FALLBACK = "https://chat.whatsapp.com/HKBWYaui63M3mQxmu7ciLh";

export default function WhatsappFloatingButton() {
  const [url, setUrl] = useState(FALLBACK);

  useEffect(() => {
    getSiteSetting({ data: { key: "whatsapp_group_url" } })
      .then((r) => {
        if (r?.value) setUrl(r.value);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label="Get ObPay updates on WhatsApp"
        className="flex items-center gap-3 rounded-lg border border-inverse-accent/30 bg-inverse px-4 py-3 text-left shadow-md transition-colors hover:bg-inverse/95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-on-inverse/15">
          <i className="ri-whatsapp-fill text-xl text-on-inverse" />
        </span>
        <span className="hidden sm:block">
          <span className="block text-sm font-semibold leading-tight text-on-inverse">Get updates</span>
          <span className="block text-xs leading-tight text-on-inverse/80">ObPay on WhatsApp</span>
        </span>
        <i className="ri-arrow-right-up-line hidden text-on-inverse/80 sm:block" />
      </a>
    </div>
  );
}
