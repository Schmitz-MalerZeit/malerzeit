import { createClient } from 'npm:@supabase/supabase-js@2';
import { getPaddleClient, gatewayFetch, type PaddleEnv } from '../_shared/paddle.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_PRICE_IDS = new Set([
  'starter_monthly', 'starter_yearly',
  'profi_monthly', 'profi_yearly',
  'profiplus_monthly', 'profiplus_yearly',
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'unauthenticated' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'unauthenticated' }, 401);

    const { newPriceId } = await req.json();
    if (!newPriceId || !ALLOWED_PRICE_IDS.has(newPriceId)) {
      return json({ error: 'invalid_price' }, 400);
    }

    // Find active subscription
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) return json({ error: 'no_subscription' }, 404);
    if (sub.status === 'canceled') return json({ error: 'subscription_canceled' }, 400);
    if (sub.price_id === newPriceId) return json({ error: 'same_plan' }, 400);

    const env = sub.environment as PaddleEnv;

    // Resolve newPriceId external_id -> paddle internal id
    const priceRes = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(newPriceId)}`);
    const priceJson = await priceRes.json();
    const paddlePriceId = priceJson?.data?.[0]?.id;
    if (!paddlePriceId) return json({ error: 'price_not_found' }, 404);

    const paddle = getPaddleClient(env);
    const updated = await paddle.subscriptions.update(sub.paddle_subscription_id, {
      items: [{ priceId: paddlePriceId, quantity: 1 }],
      prorationBillingMode: 'prorated_immediately',
    });

    // Reflect immediately in DB (webhook will also reconcile)
    await supabase.from('subscriptions').update({
      price_id: newPriceId,
      product_id: (updated as any)?.items?.[0]?.product?.importMeta?.externalId
        ?? (updated as any)?.items?.[0]?.product?.import_meta?.external_id
        ?? sub.product_id,
      status: (updated as any)?.status ?? sub.status,
      current_period_start: (updated as any)?.currentBillingPeriod?.startsAt
        ?? (updated as any)?.current_billing_period?.starts_at
        ?? sub.current_period_start,
      current_period_end: (updated as any)?.currentBillingPeriod?.endsAt
        ?? (updated as any)?.current_billing_period?.ends_at
        ?? sub.current_period_end,
      updated_at: new Date().toISOString(),
    }).eq('paddle_subscription_id', sub.paddle_subscription_id);

    return json({ ok: true });
  } catch (e) {
    console.error('change-subscription error', e);
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
