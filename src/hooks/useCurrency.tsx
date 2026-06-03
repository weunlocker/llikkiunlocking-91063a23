import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";

export type CurrencyCode = "USD" | "EUR" | "INR" | "AED" | "BRL" | "GBP";

type CurrencyInfo = { code: CurrencyCode; symbol: string; rate: number; name: string };

// Approximate static fallback rates (USD -> X). Updated periodically.
const FALLBACK_RATES: Record<CurrencyCode, CurrencyInfo> = {
  USD: { code: "USD", symbol: "$", rate: 1, name: "US Dollar" },
  EUR: { code: "EUR", symbol: "€", rate: 0.92, name: "Euro" },
  GBP: { code: "GBP", symbol: "£", rate: 0.79, name: "British Pound" },
  INR: { code: "INR", symbol: "₹", rate: 84, name: "Indian Rupee" },
  AED: { code: "AED", symbol: "د.إ", rate: 3.67, name: "UAE Dirham" },
  BRL: { code: "BRL", symbol: "R$", rate: 5.4, name: "Brazilian Real" },
};

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  IN: "INR", US: "USD", GB: "GBP", AE: "AED", SA: "AED", BR: "BRL",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", PT: "EUR", BE: "EUR", IE: "EUR", AT: "EUR", FI: "EUR", GR: "EUR",
};

type Ctx = {
  currency: CurrencyInfo;
  setCurrency: (c: CurrencyCode) => void;
  format: (usd: number) => string;
  all: CurrencyInfo[];
};

const CurrencyCtx = createContext<Ctx | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<CurrencyCode>(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("likki_currency")) as CurrencyCode | null;
    return saved && FALLBACK_RATES[saved] ? saved : "USD";
  });
  const [rates, setRates] = useState<Record<CurrencyCode, CurrencyInfo>>(FALLBACK_RATES);

  // Auto-detect country once if no saved preference
  useEffect(() => {
    if (localStorage.getItem("likki_currency")) return;
    (async () => {
      try {
        const r = await fetch("https://ipapi.co/json/", { cache: "force-cache" });
        if (!r.ok) return;
        const j = await r.json();
        const country: string = (j?.country_code || "").toUpperCase();
        const detected = COUNTRY_TO_CURRENCY[country];
        if (detected) setCode(detected);
      } catch { /* ignore */ }
    })();
  }, []);

  // Try to refresh live rates (best-effort, free endpoint)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "force-cache" });
        if (!r.ok) return;
        const j = await r.json();
        const live = j?.rates || {};
        const next = { ...FALLBACK_RATES };
        (Object.keys(next) as CurrencyCode[]).forEach((k) => {
          if (typeof live[k] === "number") next[k] = { ...next[k], rate: live[k] };
        });
        setRates(next);
      } catch { /* keep fallback */ }
    })();
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCode(c);
    try { localStorage.setItem("likki_currency", c); } catch { /* ignore */ }
  }, []);

  const value = useMemo<Ctx>(() => {
    const currency = rates[code];
    const format = (usd: number) => {
      const v = Number(usd) * currency.rate;
      const opts: Intl.NumberFormatOptions =
        currency.code === "INR" || currency.code === "BRL"
          ? { maximumFractionDigits: 0 }
          : { maximumFractionDigits: 2, minimumFractionDigits: 2 };
      return `${currency.symbol}${new Intl.NumberFormat("en-US", opts).format(v)}`;
    };
    return { currency, setCurrency, format, all: Object.values(rates) };
  }, [code, rates, setCurrency]);

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

export function useCurrency() {
  const c = useContext(CurrencyCtx);
  if (!c) throw new Error("useCurrency must be used within CurrencyProvider");
  return c;
}
