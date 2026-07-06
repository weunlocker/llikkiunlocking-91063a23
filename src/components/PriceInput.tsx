import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  className?: string;
};

/**
 * Text input for prices that preserves what the user is typing.
 * Fixes "0.0" losing the trailing decimal because Number("0.0") === 0.
 */
export function PriceInput({ value, onChange, placeholder, allowEmpty, className }: Props) {
  const initial = value == null || Number.isNaN(Number(value)) ? "" : String(value);
  const [str, setStr] = useState<string>(initial);

  // Re-sync when parent value changes and doesn't match what user typed
  useEffect(() => {
    const external = value == null || Number.isNaN(Number(value)) ? "" : String(value);
    if (Number(str) !== Number(external) || (str === "" && external !== "") || (external === "" && str !== "" && !/^[-]?\d*\.?\d*$/.test(str))) {
      setStr(external);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      className={className}
      value={str}
      onChange={(e) => {
        const raw = e.target.value;
        // Allow empty, digits, one dot, optional leading minus
        if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
        setStr(raw);
        if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
          if (allowEmpty) onChange(null);
          else onChange(0);
          return;
        }
        const n = Number(raw);
        if (!Number.isNaN(n)) onChange(n);
      }}
      onBlur={() => {
        // Normalize display on blur (e.g. "0." -> "0")
        if (str === "" || str === "-" || str === "." || str === "-.") {
          setStr(allowEmpty ? "" : "0");
          return;
        }
        const n = Number(str);
        if (!Number.isNaN(n)) setStr(String(n));
      }}
    />
  );
}
