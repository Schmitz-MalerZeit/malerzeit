import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getStripeClient,
  resolvePrice,
  ALLOWED_PRICE_IDS,
  ADDON_PRICE_IDS,
  SUBSCRIPTION_PRICE_IDS,
  corsHeaders,
  json,
  type StripeEnv,
} from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'unauthenticated' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'unauthenticated' }, 401);

    const body = await req.json();
    const priceId = body?.priceId as string | undefined;
    const env: StripeEnv = body?.environment === 'live' ? 'live' : 'sandbox';
    const successUrl = (body?.successUrl as string | undefined) ||
      `${new URL(req.url).origin}/billing?checkout=success`;
    const cancelUrl = (body?.cancelUrl as string | undefined) ||
      `${new URL(req.url).origin}/pricing?checkout=cancelled`;
    const promotionCode = (body?.discountCode as string | undefined)?.trim() || null;

    if (!priceId || !ALLOWED_PRICE_IDS.has(priceId)) {
      return json({ error: 'invalid_price' }, 400);
    }

    const stripe = getStripeClient(env);
    const price = await resolvePrice(env, priceId);

    // Re-use existing customer if user has any subscription on file
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id, environment')
      .eq('user_id', user.id)
      .eq('environment', env)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let customerId: string | undefined =
      existingSub?.stripe_customer_id && !String(existingSub.stripe_customer_id).startsWith('manual_')
        ? (existingSub.stripe_customer_id as string)
        : undefined;

    if (!customerId) {
      // Try to find a Stripe customer by email to avoid duplicates
      const search = await stripe.customers.list({ email: user.email!, limit: 1 });
      customerId = search.data[0]?.id;
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
    }

    const isSubscription = SUBSCRIPTION_PRICE_IDS.has(priceId);
    const isAddon = ADDON_PRICE_IDS.has(priceId);

    // Resolve promotion code (Stripe expects the promotion_code ID, not the code string)
    let discounts: Array<{ promotion_code: string }> | undefined;
    if (promotionCode) {
      const pcList = await stripe.promotionCodes.list({
        code: promotionCode,
        active: true,
        limit: 1,
      });
      if (pcList.data[0]) {
        discounts = [{ promotion_code: pcList.data[0].id }];
      }
    }

    // Payment methods:
    // - For subscriptions (EUR/DE) Stripe supports: card, link, sepa_debit, paypal.
    // - For one-off addons we additionally allow common EU methods.
    // Omitting payment_method_types would fall back to Dashboard settings; we list
    // them explicitly so SEPA & co. show up regardless of dashboard config.
    const paymentMethodTypes: string[] = isSubscription
      ? ['card', 'link', 'sepa_debit', 'paypal']
      : ['card', 'link', 'sepa_debit', 'paypal', 'sofort', 'giropay', 'eps', 'bancontact'];

    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: 'de',
      payment_method_types: paymentMethodTypes as any,
      allow_promotion_codes: discounts ? undefined : true,
      discounts,
      metadata: { user_id: user.id, lookup_key: priceId },
      ...(isSubscription
        ? {
            subscription_data: {
              metadata: { user_id: user.id, lookup_key: priceId },
            },
          }
        : {}),
      ...(isAddon
        ? {
            payment_intent_data: {
              metadata: { user_id: user.id, lookup_key: priceId },
            },
          }
        : {}),
    });

    return json({ url: session.url, id: session.id });
  } catch (e) {
    console.error('create-checkout-session error:', e);
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
