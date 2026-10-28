import { z } from "zod";

export const serviceReference = z.string().uuid();
export const ugPhone = z.string().transform((v) => {
  const digits = v.replace(/\D/g, "");
  return digits.startsWith("0") ? `256${digits.slice(1)}` : digits;
}).pipe(z.string().regex(/^2567\d{8}$/, "Enter a valid Uganda mobile number."));
export const airtimeInput = z.object({
  reference: serviceReference,
  purchase_type: z.enum(["airtime", "bundle"]),
  msisdn: ugPhone,
  amount: z.number().int().min(500).optional(),
  bundle_id: z.string().min(1).max(120).optional(),
}).superRefine((v, ctx) => {
  if (v.purchase_type === "airtime" && (v.amount == null || v.bundle_id)) ctx.addIssue({ code: "custom", message: "Airtime needs an amount, not a bundle." });
  if (v.purchase_type === "bundle" && (!v.bundle_id || v.amount != null)) ctx.addIssue({ code: "custom", message: "Data needs a bundle, not an entered amount." });
});
export const billInput = z.object({
  reference: serviceReference,
  utility_code: z.enum(["LIGHT", "UMEME", "NWSC", "DSTV", "GOTV"]),
  meter_number: z.string().trim().min(5).max(40),
  phone_number: ugPhone,
  amount: z.number().int().min(1000),
  area: z.string().trim().max(80).optional(),
  bouquet_code: z.string().trim().max(80).optional(),
  customer_name: z.string().trim().max(120).optional(),
  email: z.union([z.literal(""), z.string().email().max(254)]).optional(),
  expected_fee: z.number().int().nonnegative(),
}).superRefine((v, ctx) => {
  if (v.utility_code === "NWSC" && !v.area) ctx.addIssue({ code: "custom", message: "Choose a water service area." });
  if (["DSTV", "GOTV"].includes(v.utility_code) && !v.bouquet_code) ctx.addIssue({ code: "custom", message: "Choose a TV package." });
});
export const cardInput = z.object({ reference: serviceReference, amount: z.number().int().min(500).max(10000000), description: z.string().trim().min(1).max(500) });
export function moneyRaw(value: unknown): number | null {
  const raw = typeof value === "object" && value !== null ? (value as { raw?: unknown }).raw : value;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function serviceState(value: unknown): "success" | "failed" | "pending" {
  if (["completed", "successful"].includes(String(value))) return "success";
  if (["failed", "rejected", "cancelled"].includes(String(value))) return "failed";
  return "pending";
}