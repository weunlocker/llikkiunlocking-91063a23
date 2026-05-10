import { useEffect, useState } from "react";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Pure language list (no country flags) — selection is by LANGUAGE only.
const LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "fr", label: "French", native: "Français" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "it", label: "Italian", native: "Italiano" },
  { code: "ru", label: "Russian", native: "Русский" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "ur", label: "Urdu", native: "اردو" },
  { code: "zh-CN", label: "Chinese (Simplified)", native: "简体中文" },
  { code: "zh-TW", label: "Chinese (Traditional)", native: "繁體中文" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { code: "th", label: "Thai", native: "ไทย" },
  { code: "id", label: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ms", label: "Malay", native: "Bahasa Melayu" },
  { code: "tr", label: "Turkish", native: "Türkçe" },
  { code: "fa", label: "Persian", native: "فارسی" },
  { code: "nl", label: "Dutch", native: "Nederlands" },
  { code: "pl", label: "Polish", native: "Polski" },
  { code: "uk", label: "Ukrainian", native: "Українська" },
  { code: "fil", label: "Filipino", native: "Filipino" },
  { code: "sw", label: "Swahili", native: "Kiswahili" },
];

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

let scriptLoaded = false;
let scriptReady: Promise<void> | null = null;

function loadGoogleTranslate(): Promise<void> {
  if (scriptReady) return scriptReady;
  scriptReady = new Promise((resolve) => {
    window.googleTranslateElementInit = () => {
      try {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            includedLanguages: LANGUAGES.map((l) => l.code).join(","),
            autoDisplay: false,
          },
          "google_translate_element"
        );
        scriptLoaded = true;
        // Wait for the hidden <select> to mount
        const wait = setInterval(() => {
          if (document.querySelector(".goog-te-combo")) {
            clearInterval(wait);
            resolve();
          }
        }, 100);
      } catch (e) {
        console.error("Google Translate init error", e);
        resolve();
      }
    };

    if (!document.getElementById("google-translate-script")) {
      const s = document.createElement("script");
      s.id = "google-translate-script";
      s.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      s.async = true;
      document.body.appendChild(s);
    }
  });
  return scriptReady;
}

function triggerTranslate(code: string) {
  const select = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;
  if (!select) return false;
  select.value = code;
  select.dispatchEvent(new Event("change"));
  return true;
}

async function applyLanguage(code: string) {
  localStorage.setItem("preferred_lang", code);
  await loadGoogleTranslate();

  if (code === "en") {
    // Restore original by clearing translation
    if (!triggerTranslate("")) triggerTranslate("en");
    return;
  }

  // Retry a few times in case the combo isn't fully ready
  for (let i = 0; i < 20; i++) {
    if (triggerTranslate(code)) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

export default function LanguageSwitcher() {
  const [current, setCurrent] = useState<string>("en");

  useEffect(() => {
    const saved = localStorage.getItem("preferred_lang");
    if (saved) {
      setCurrent(saved);
      applyLanguage(saved);
    } else {
      loadGoogleTranslate();
    }
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
            <span className="ml-1 text-xs hidden sm:inline uppercase">{active.code.split("-")[0]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto w-60 bg-popover">
          {LANGUAGES.map((l) => (
            <DropdownMenuItem
              key={l.code}
              onClick={() => {
                setCurrent(l.code);
                applyLanguage(l.code);
              }}
              className="cursor-pointer notranslate flex items-center gap-2"
            >
              <span className="flex-1">
                <span className="font-medium">{l.native}</span>
                <span className="text-muted-foreground text-xs ml-2">{l.label}</span>
              </span>
              {l.code === current && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
