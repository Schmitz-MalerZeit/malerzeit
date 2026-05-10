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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

    const body = await req.json();
    const action = (body?.action as string) || 'change';
    const newPriceId = body?.newPriceId as string | undefined;
    const envFromClient = (body?.environment as PaddleEnv | undefined);
    const env: PaddleEnv = envFromClient === 'live' ? 'live' : 'sandbox';

    if ((action === 'change' || action === 'reactivate_and_change')
        && (!newPriceId || !ALLOWED_PRICE_IDS.has(newPriceId))) {
      return json({ error: 'invalid_price' }, 400);
    }

    // Latest sub *in the same environment* the client is in.
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('environment', env)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) return json({ error: 'no_subscription' }, 404);

    // A status='canceled' row whose period already ended cannot be revived.
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end as string) : null;
    const expired = periodEnd && periodEnd <= new Date();
    if (sub.status === 'canceled' && expired) {
      return json({ error: 'subscription_expired' }, 400);
    }

    const paddle = getPaddleClient(env);

    // ---------- ACTION: reactivate (clear scheduled cancel) ----------
    if (action === 'reactivate') {
      const updated = await paddle.subscriptions.update(sub.paddle_subscription_id, {
        scheduledChange: null,
      } as any);

      await supabase.from('subscriptions').update({
        status: (updated as any)?.status ?? 'active',
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      }).eq('paddle_subscription_id', sub.paddle_subscription_id);

      return json({ ok: true, action: 'reactivated' });
    }

    // ---------- ACTION: change (and optionally clear scheduled cancel) ----------
    if (sub.price_id === newPriceId && !sub.cancel_at_period_end && sub.status !== 'canceled') {
      return json({ error: 'same_plan' }, 400);
    }

    // Resolve newPriceId external_id -> paddle internal id
    const priceRes = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(newPriceId!)}`);
    const priceJson = await priceRes.json();
    const paddlePriceId = priceJson?.data?.[0]?.id;
    if (!paddlePriceId) return json({ error: 'price_not_found' }, 404);

    const updateBody: Record<string, unknown> = {
      items: [{ priceId: paddlePriceId, quantity: 1 }],
      prorationBillingMode: 'prorated_immediately',
    };
    // If a cancellation was scheduled, clear it as part of the same call.
    if (sub.cancel_at_period_end || sub.status === 'canceled') {
      (updateBody as any).scheduledChange = null;
    }

    const updated = await paddle.subscriptions.update(sub.paddle_subscription_id, updateBody as any);

    await supabase.from('subscriptions').update({
      price_id: newPriceId,
      product_id: (updated as any)?.items?.[0]?.product?.importMeta?.externalId
        ?? (updated as any)?.items?.[0]?.product?.import_meta?.external_id
        ?? sub.product_id,
      status: (updated as any)?.status ?? 'active',
      cancel_at_period_end: false,
      current_period_start: (updated as any)?.currentBillingPeriod?.startsAt
        ?? (updated as any)?.current_billing_period?.starts_at
        ?? sub.current_period_start,
      current_period_end: (updated as any)?.currentBillingPeriod?.endsAt
        ?? (updated as any)?.current_billing_period?.ends_at
        ?? sub.current_period_end,
      updated_at: new Date().toISOString(),
    }).eq('paddle_subscription_id', sub.paddle_subscription_id);

    return json({ ok: true, action: 'changed' });
  } catch (e) {
    console.error('change-subscription error', e);
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
