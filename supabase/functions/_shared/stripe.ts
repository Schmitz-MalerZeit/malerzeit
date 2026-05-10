import Stripe from 'npm:stripe@17.5.0';

export type StripeEnv = 'sandbox' | 'live';

const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export function getStripeSecretKey(env: StripeEnv): string {
  return env === 'sandbox'
    ? getEnv('STRIPE_SECRET_KEY_TEST')
    : getEnv('STRIPE_SECRET_KEY_LIVE');
}

export function getStripeWebhookSecret(env: StripeEnv): string {
  return env === 'sandbox'
    ? getEnv('STRIPE_WEBHOOK_SECRET_TEST')
    : getEnv('STRIPE_WEBHOOK_SECRET_LIVE');
}

export function getStripeClient(env: StripeEnv): Stripe {
  return new Stripe(getStripeSecretKey(env), {
    apiVersion: '2024-10-28.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export const ALLOWED_PRICE_IDS = new Set([
  'starter_monthly', 'starter_yearly',
  'profi_monthly', 'profi_yearly',
  'profiplus_monthly', 'profiplus_yearly',
  'addon_10_pdfs', 'addon_20_pdfs',
]);

export const SUBSCRIPTION_PRICE_IDS = new Set([
  'starter_monthly', 'starter_yearly',
  'profi_monthly', 'profi_yearly',
  'profiplus_monthly', 'profiplus_yearly',
]);

export const ADDON_PRICE_IDS = new Set(['addon_10_pdfs', 'addon_20_pdfs']);

export const PRICE_TO_PRODUCT: Record<string, string> = {
  starter_monthly: 'starter_plan',
  starter_yearly: 'starter_plan',
  profi_monthly: 'profi_plan',
  profi_yearly: 'profi_plan',
  profiplus_monthly: 'profiplus_plan',
  profiplus_yearly: 'profiplus_plan',
};

/**
 * Resolve our internal lookup key (e.g. "starter_monthly") → live Stripe Price object.
 * Caches in module-scope per env to save round trips.
 */
const priceCache = new Map<string, Stripe.Price>();
export async function resolvePrice(env: StripeEnv, lookupKey: string): Promise<Stripe.Price> {
  const cacheKey = `${env}:${lookupKey}`;
  const cached = priceCache.get(cacheKey);
  if (cached) return cached;

  const stripe = getStripeClient(env);
  const list = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
    expand: ['data.product'],
  });
  const price = list.data[0];
  if (!price) throw new Error(`No active Stripe price with lookup_key=${lookupKey}`);
  priceCache.set(cacheKey, price);
  return price;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
