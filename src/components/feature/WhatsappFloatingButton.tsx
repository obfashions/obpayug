import { useState } from "react";

export default function WhatsappFloatingButton() {
  const [tooltipVisible, setTooltipVisible] = useState(true);

  const handleClick = () => {
    window.open(
      "https://chat.whatsapp.com/HKBWYaui63M3mQxmu7ciLh?s=cl&p=a&ilr=0",
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {/* Tooltip */}
      {tooltipVisible && (
        <div className="absolute bottom-full left-0 mb-3 bg-foreground-900 text-background-50 text-xs font-medium px-3 py-2 rounded-xl whitespace-nowrap">
          Join our WhatsApp group for updates!
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTooltipVisible(false);
            }}
            className="ml-2 text-background-50/60 hover:text-background-50 transition-colors cursor-pointer"
          >
            <i className="ri-close-line" />
          </button>
          {/* Arrow */}
          <div className="absolute top-full left-5 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-foreground-900" />
        </div>
      )}

      {/* Main button with pulse ring */}
      <button
        onClick={handleClick}
        className="relative flex items-center gap-3 px-4 py-3 bg-[#25D366] hover:bg-[#22c35e] text-white rounded-full font-semibold text-sm tracking-tight transition-all hover:scale-105 active:scale-95 cursor-pointer group whitespace-nowrap"
        aria-label="Join ObPay WhatsApp group"
      >
        {/* Outer pulse ring */}
        <span className="absolute inset-0 rounded-full bg-[#25D366]/40 animate-ping pointer-events-none" style={{ animationDuration: "2.5s" }} />
        {/* Inner pulse ring */}
        <span className="absolute inset-0 rounded-full bg-[#25D366]/30 animate-ping pointer-events-none" style={{ animationDuration: "2.5s", animationDelay: "0.8s" }} />

        <span className="relative w-5 h-5 flex items-center justify-center shrink-0">
          <i className="ri-whatsapp-fill text-xl" />
        </span>
        <span className="relative hidden sm:inline">Join WhatsApp Group</span>
        <span className="relative inline sm:hidden">WhatsApp</span>
      </button>
    </div>
  );
}