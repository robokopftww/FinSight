export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly" | "annually";
export type EmploymentStatus = "employed" | "unemployed" | "unknown";

export type UserFinancialProfile = {
  employmentStatus: EmploymentStatus;
  jobTitle: string | null;
  grossPay: number | null;
  payFrequency: PayFrequency | null;
};

const monthlyMultiplier: Record<PayFrequency, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  semimonthly: 2,
  monthly: 1,
  annually: 1 / 12,
};

export function normalizeMonthlyPay(grossPay: number | null | undefined, payFrequency: string | null | undefined) {
  if (!grossPay || grossPay <= 0) {
    return 0;
  }

  const multiplier = monthlyMultiplier[(payFrequency ?? "") as PayFrequency];
  return multiplier ? Math.round(grossPay * multiplier * 100) / 100 : 0;
}

export function hasDeclaredIncome(profile: UserFinancialProfile | undefined) {
  return Boolean(
    profile &&
      profile.employmentStatus === "employed" &&
      profile.grossPay &&
      profile.grossPay > 0 &&
      profile.payFrequency,
  );
}

export const profileUpdateSchema = z
  .object({
    employmentStatus: z.enum(["employed", "unemployed", "unknown"]),
    jobTitle: z.string().trim().max(120).optional().nullable(),
    grossPay: z.number().positive().max(100_000_000).optional().nullable(),
    payFrequency: z.enum(["weekly", "biweekly", "semimonthly", "monthly", "annually"]).optional().nullable(),
  })
  .superRefine((value, context) => {
    if (value.employmentStatus === "employed" && !value.grossPay) {
      context.addIssue({ code: "custom", message: "grossPay is required when employed", path: ["grossPay"] });
    }
    if (value.employmentStatus === "employed" && !value.payFrequency) {
      context.addIssue({ code: "custom", message: "payFrequency is required when employed", path: ["payFrequency"] });
    }
  });
import { z } from "zod";
