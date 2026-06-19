import { useSiteSettings } from "@/hooks/useSiteSettings";
import { MessageCircle, Send } from "lucide-react";
import { useLocation } from "react-router-dom";

export default function FloatingContact() {
  const { settings } = useSiteSettings();
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return null;
  const tg = settings.telegram_url?.trim();
  const wa = settings.whatsapp_number?.trim();
  if (!tg && !wa) return null;

  const brand = settings.brand_name || "LIKKI UNLOCKING";
  const waMsg = `Hello ${brand} Team 👋,\n\nI visited your website and I'm interested in your unlocking / IMEI check services. Could you please share your current offers and how to get started?\n\nThank you!`;
  const waHref = (() => {
    if (!wa) return null;
    const digits = wa.replace(/[^\d]/g, "");
    if (!digits) return null;
    const url = new URL(`https://wa.me/${digits}`);
    url.searchParams.set("text", waMsg);
    return url.toString();
  })();
  const tgUser = tg ? (tg.startsWith("http") ? tg.replace(/^https?:\/\/t\.me\//, "").replace(/^@/, "") : tg.replace(/^@/, "")) : "";
  const tgHref = tg ? `https://t.me/${tgUser}` : null;

  return (
    <div className="fixed right-3 bottom-3 sm:right-4 sm:bottom-4 z-40 flex flex-col gap-2 sm:gap-3">
      {tgHref && (
        <a
          href={tgHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contact on Telegram"
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg bg-[#229ED9] text-white hover:scale-110 transition-transform"
        >
          <Send className="w-5 h-5" />
        </a>
      )}
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contact on WhatsApp"
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg bg-[#25D366] text-white hover:scale-110 transition-transform"
        >
          <MessageCircle className="w-5 h-5" />
        </a>
      )}
    </div>
  );
}
