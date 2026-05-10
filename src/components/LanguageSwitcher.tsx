import { useEffect, useState } from "react";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANGUAGES: { code: string; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "te", label: "తెలుగు", flag: "🇮🇳" },
  { code: "ta", label: "தமிழ்", flag: "🇮🇳" },
  { code: "bn", label: "বাংলা", flag: "🇧🇩" },
  { code: "ur", label: "اردو", flag: "🇵🇰" },
  { code: "zh-CN", label: "中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "th", label: "ไทย", flag: "🇹🇭" },
  { code: "id", label: "Indonesia", flag: "🇮🇩" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "fa", label: "فارسی", flag: "🇮🇷" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "uk", label: "Українська", flag: "🇺🇦" },
  { code: "fil", label: "Filipino", flag: "🇵🇭" },
];

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

function setCookie(name: string, value: string) {
  const host = window.location.hostname;
  const root = host.split(".").slice(-2).join(".");
  document.cookie = `${name}=${value};path=/;max-age=31536000`;
  document.cookie = `${name}=${value};path=/;domain=.${root};max-age=31536000`;
  document.cookie = `${name}=${value};path=/;domain=${host};max-age=31536000`;
}

function applyLanguage(code: string) {
  // googtrans cookie format: /<source>/<target>
  setCookie("googtrans", `/en/${code}`);
  localStorage.setItem("preferred_lang", code);
  // Reload so Google Translate reads the new cookie and re-translates
  window.location.reload();
}

export default function LanguageSwitcher() {
  const [current, setCurrent] = useState<string>("en");

  useEffect(() => {
    const saved = localStorage.getItem("preferred_lang");
    if (saved) setCurrent(saved);

    if (document.getElementById("google-translate-script")) return;

    window.googleTranslateElementInit = () => {
      try {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            includedLanguages: LANGUAGES.map((l) => l.code).join(","),
            autoDisplay: false,
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          },
          "google_translate_element"
        );
      } catch (e) {
        console.error("Google Translate init error", e);
      }
    };

    const s = document.createElement("script");
    s.id = "google-translate-script";
    s.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  const active = LANGUAGES.find((l) => l.code === current) || LANGUAGES[0];

  return (
    <>
      {/* Hidden host element required by Google Translate widget */}
      <div id="google_translate_element" style={{ display: "none" }} aria-hidden />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="px-2 notranslate"
            title="Change language"
            aria-label="Change language"
          >
            <Globe className="w-4 h-4" />
            <span className="ml-1 text-xs hidden sm:inline">{active.flag}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto w-52 bg-popover">
          {LANGUAGES.map((l) => (
            <DropdownMenuItem
              key={l.code}
              onClick={() => applyLanguage(l.code)}
              className="cursor-pointer notranslate flex items-center gap-2"
            >
              <span className="text-base">{l.flag}</span>
              <span className="flex-1">{l.label}</span>
              {l.code === current && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
