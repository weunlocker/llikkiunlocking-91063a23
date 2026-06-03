import { createContext, useContext, ReactNode, useMemo } from "react";

type CurrencyInfo = { code: "USD"; symbol: string; rate: number; name: string };

type Ctx = {
  currency: CurrencyInfo;
  setCurrency: (c: "USD") => void;
  format: (usd: number) => string;
  all: CurrencyInfo[];
};

const CurrencyCtx = createContext<Ctx | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const value = useMemo<Ctx>(() => {
    const currency: CurrencyInfo = { code: "USD", symbol: "$", rate: 1, name: "US Dollar" };
    const format = (usd: number) => {
      const v = Number(usd);
      return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v)}`;
    };
    return { currency, setCurrency: () => {}, format, all: [currency] };
  }, []);

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>;
}

export function useCurrency() {
  const c = useContext(CurrencyCtx);
  if (!c) throw new Error("useCurrency must be used within CurrencyProvider");
  return c;
}
