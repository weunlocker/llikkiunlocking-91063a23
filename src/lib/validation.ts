import { z } from "zod";

export const emailSchema = z.string().trim().email("Invalid email").max(255);
export const passwordSchema = z.string().min(8, "At least 8 characters").max(72);
export const displayNameSchema = z.string().trim().min(2, "At least 2 characters").max(50);
export const imeiSchema = z.string().trim().regex(/^[A-Za-z0-9]{8,20}$/, "IMEI must be 8-20 alphanumeric characters");

// Per-service input validation. Mirrors the `input_mode` column on `services`.
export type ServiceInputMode = "imei" | "imei_sn" | "custom";
export type ServiceInputConfig = {
  input_mode?: ServiceInputMode | string | null;
  input_label?: string | null;
  input_min_length?: number | null;
  input_max_length?: number | null;
  input_regex?: string | null;
  input_info?: string | null;
  input_allow_alpha?: boolean | null;
  input_allow_bulk?: boolean | null;
};

export function getInputLabel(cfg: ServiceInputConfig): string {
  if (cfg.input_label && cfg.input_label.trim()) return cfg.input_label.trim();
  switch (cfg.input_mode) {
    case "imei_sn": return "IMEI / Serial";
    case "custom": return "Reference";
    default: return "IMEI";
  }
}

export function validateServiceInput(value: string, cfg: ServiceInputConfig): { ok: true; value: string } | { ok: false; error: string } {
  const v = value.trim();
  if (!v) return { ok: false, error: "Required" };

  // Custom regex overrides everything else when provided.
  const rx = (cfg.input_regex ?? "").trim();
  if (rx) {
    try {
      const re = new RegExp(`^(?:${rx})$`);
      if (!re.test(v)) return { ok: false, error: "Invalid format" };
      return { ok: true, value: v };
    } catch {
      // fall through to default validation if regex is broken
    }
  }

  const mode = (cfg.input_mode ?? "imei") as ServiceInputMode;
  const allowAlpha = cfg.input_allow_alpha !== false;
  const charClass = allowAlpha ? "[A-Za-z0-9]" : "\\d";
  const charError = allowAlpha ? "Only letters and numbers are allowed" : "Only digits are allowed";

  if (mode === "imei") {
    const min = Math.max(1, Number(cfg.input_min_length ?? 14));
    const max = Math.max(min, Number(cfg.input_max_length ?? 17));
    if (!new RegExp(`^${charClass}+$`).test(v)) return { ok: false, error: charError };
    if (v.length < min || v.length > max) return { ok: false, error: `Must be ${min}-${max} characters` };
    return { ok: true, value: v };
  }
  if (mode === "imei_sn") {
    const min = Math.max(1, Number(cfg.input_min_length ?? 6));
    const max = Math.max(min, Number(cfg.input_max_length ?? 20));
    if (!new RegExp(`^${charClass}+$`).test(v)) return { ok: false, error: charError };
    if (v.length < min || v.length > max) return { ok: false, error: `Must be ${min}-${max} characters` };
    return { ok: true, value: v };
  }
  // custom
  const min = Math.max(1, Number(cfg.input_min_length ?? 1));
  const max = Math.max(min, Number(cfg.input_max_length ?? 20));
  if (!new RegExp(`^${charClass}+$`).test(v)) return { ok: false, error: charError };
  if (v.length < min || v.length > max) return { ok: false, error: `Must be ${min}-${max} characters` };
  return { ok: true, value: v };
}

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password required").max(72),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(250),
  description: z.string().trim().max(500).optional(),
  price: z.number().min(0).max(10000),
  delivery_time: z.string().trim().min(1).max(50),
  api_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  api_method: z.enum(["GET", "POST"]),
  category: z.string().trim().max(50).optional(),
  active: z.boolean(),
  is_free: z.boolean().optional(),
});

export const successRuleSchema = z.object({
  path: z.string().min(1).max(100),
  op: z.enum(["eq", "neq", "contains", "not_contains", "exists", "truthy"]),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const telegramChatIdSchema = z.string().trim().regex(/^-?\d{5,20}$/, "Telegram chat ID must be a number (5-20 digits)").or(z.literal(""));
