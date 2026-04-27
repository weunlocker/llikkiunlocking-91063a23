import { z } from "zod";

export const emailSchema = z.string().trim().email("Invalid email").max(255);
export const passwordSchema = z.string().min(8, "At least 8 characters").max(72);
export const displayNameSchema = z.string().trim().min(2, "At least 2 characters").max(50);
export const imeiSchema = z.string().trim().regex(/^[A-Za-z0-9]{8,20}$/, "IMEI must be 8-20 alphanumeric characters");

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
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  price: z.number().min(0).max(10000),
  delivery_time: z.string().trim().min(1).max(50),
  api_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  api_method: z.enum(["GET", "POST"]),
  category: z.string().trim().max(50).optional(),
  active: z.boolean(),
});

export const successRuleSchema = z.object({
  path: z.string().min(1).max(100),
  op: z.enum(["eq", "neq", "contains", "not_contains", "exists", "truthy"]),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const telegramChatIdSchema = z.string().trim().regex(/^-?\d{5,20}$/, "Telegram chat ID must be a number (5-20 digits)").or(z.literal(""));
