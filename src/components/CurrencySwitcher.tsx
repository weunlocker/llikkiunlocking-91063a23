import { useCurrency, type CurrencyCode } from "@/hooks/useCurrency";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe2 } from "lucide-react";

export default function CurrencySwitcher() {
  const { currency, setCurrency, all } = useCurrency();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2 text-xs font-mono">
          <Globe2 className="w-3.5 h-3.5" />
          {currency.code}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {all.map((c) => (
          <DropdownMenuItem key={c.code} onClick={() => setCurrency(c.code as CurrencyCode)} className="gap-2">
            <span className="font-mono w-10">{c.code}</span>
            <span className="text-muted-foreground text-xs">{c.symbol} {c.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
