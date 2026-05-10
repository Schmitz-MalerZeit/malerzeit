import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

/**
 * Opens a Stripe Checkout session by calling the create-checkout-session
 * edge function and redirecting the browser to the returned hosted page.
 */
export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: {
    priceId: string;
    customerEmail?: string; // unused by Stripe (server resolves from auth user) — kept for API parity
    userId?: string;        // unused — server uses authenticated user — kept for API parity
    successUrl?: string;
    discountCode?: string;
  }) => {
    setLoading(true);
    try {
      const successUrl =
        options.successUrl || `${window.location.origin}/billing?checkout=success`;
      const cancelUrl = `${window.location.origin}/pricing?checkout=cancelled`;

      const { data, error } = await supabase.functions.invoke(
        "create-checkout-session",
        {
          body: {
            priceId: options.priceId,
            environment: getStripeEnvironment(),
            successUrl,
            cancelUrl,
            discountCode: options.discountCode,
          },
        },
      );
      if (error || !data?.url) {
        throw new Error(error?.message || data?.error || "checkout_failed");
      }
      window.location.href = data.url as string;
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
