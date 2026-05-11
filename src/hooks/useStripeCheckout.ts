import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

const isEmbeddedPreview = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

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
    const checkoutWindow = isEmbeddedPreview()
      ? window.open("about:blank", "_blank", "noopener,noreferrer")
      : null;
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
        checkoutWindow?.close();
        throw new Error(error?.message || data?.error || "checkout_failed");
      }
      const checkoutUrl = data.url as string;
      if (checkoutWindow) {
        checkoutWindow.location.href = checkoutUrl;
      } else {
        window.location.assign(checkoutUrl);
      }
    } catch (error) {
      checkoutWindow?.close();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
