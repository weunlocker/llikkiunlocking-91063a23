import { useSiteSettings } from "@/hooks/useSiteSettings";
import { MessageCircle, Send } from "lucide-react";

export default function FloatingContact() {
  const { settings } = useSiteSettings();
  const tg = settings.telegram_url?.trim();
  const wa = settings.whatsapp_number?.trim();
  if (!tg && !wa) return null;

  const waHref = wa ? `https://wa.me/${wa.replace(/[^\d]/g, "")}` : null;
  const tgHref = tg ? (tg.startsWith("http") ? tg : `https://t.me/${tg.replace(/^@/, "")}`) : null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-3">
      {tgHref && (
        <a
          href={tgHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contact on Telegram"
          className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-[#229ED9] text-white hover:scale-110 transition-transform"
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
          className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-[#25D366] text-white hover:scale-110 transition-transform"
        >
          <MessageCircle className="w-5 h-5" />
        </a>
      )}
    </div>
  );
}
