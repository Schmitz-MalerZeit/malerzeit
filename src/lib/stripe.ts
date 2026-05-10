/**
 * Detect whether the app should talk to Stripe in test or live mode.
 *
 * Strategy: hostname-based. The custom production domain (malerzeit-ai.de)
 * uses LIVE; everything else (Lovable preview, *.lovable.app, localhost)
 * stays in TEST. This keeps test cards working in preview while real cards
 * only ever hit the production domain.
 */
export type StripeEnv = "sandbox" | "live";

const LIVE_HOSTS = new Set(["malerzeit-ai.de", "www.malerzeit-ai.de"]);

export function getStripeEnvironment(): StripeEnv {
  if (typeof window === "undefined") return "sandbox";
  const host = window.location.hostname.toLowerCase();
  return LIVE_HOSTS.has(host) ? "live" : "sandbox";
}

// Backwards-compat shim so legacy callers keep working during migration.
export const getPaddleEnvironment = getStripeEnvironment;
