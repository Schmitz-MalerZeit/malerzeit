// Zentrale Plan-/Feature-Definition. Trial = volle Funktionen, damit Nutzer
// die App komplett ausprobieren können.

import type { SubscriptionState } from "@/hooks/useSubscription";

export type PlanTier = "none" | "trial" | "starter" | "profi" | "exklusiv";

export const TIER_LABEL: Record<PlanTier, string> = {
  none: "Kein Tarif",
  trial: "Test",
  starter: "Starter",
  profi: "Profi",
  exklusiv: "Exklusiv",
};

const STARTER_PRICES = new Set(["starter_monthly", "starter_yearly"]);
const PROFI_PRICES = new Set(["profi_monthly", "profi_yearly"]);
const EXKLUSIV_PRICES = new Set(["profiplus_monthly", "profiplus_yearly"]);

export function getTier(sub: Pick<SubscriptionState, "subscription" | "inTrial">): PlanTier {
  const pid = sub.subscription?.price_id;
  if (pid && EXKLUSIV_PRICES.has(pid)) return "exklusiv";
  if (pid && PROFI_PRICES.has(pid)) return "profi";
  if (pid && STARTER_PRICES.has(pid)) return "starter";
  if (sub.inTrial) return "trial";
  return "none";
}

// Feature-Gates – Trial bekommt Vollzugriff, damit der Test repräsentativ ist.
export function canDownloadPdf(tier: PlanTier): boolean {
  return tier === "trial" || tier === "profi" || tier === "exklusiv";
}

export function canUseLogoInPdf(tier: PlanTier): boolean {
  return tier === "trial" || tier === "profi" || tier === "exklusiv";
}

export function hasPrioritySupport(tier: PlanTier): boolean {
  return tier === "exklusiv";
}

export const REQUIRED_TIER_LABEL: Record<"pdf" | "logo", string> = {
  pdf: "Profi",
  logo: "Profi",
};
