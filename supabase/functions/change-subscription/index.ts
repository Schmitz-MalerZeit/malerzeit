import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getStripeClient,
  resolvePrice,
  SUBSCRIPTION_PRICE_IDS,
  PRICE_TO_PRODUCT,
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'unauthenticated' }, 401);

    const body = await req.json();
    const action = (body?.action as string) || 'change';
    const newPriceId = body?.newPriceId as string | undefined;
    const env: StripeEnv = body?.environment === 'live' ? 'live' : 'sandbox';

    if ((action === 'change' || action === 'reactivate_and_change')
        && (!newPriceId || !SUBSCRIPTION_PRICE_IDS.has(newPriceId))) {
      return json({ error: 'invalid_price' }, 400);
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('environment', env)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) return json({ error: 'no_subscription' }, 404);

    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end as string) : null;
    const expired = periodEnd && periodEnd <= new Date();
    if (sub.status === 'canceled' && expired) {
      return json({ error: 'subscription_expired' }, 400);
    }

    if (String(sub.stripe_subscription_id).startsWith('manual_')) {
      return json({ error: 'manual_subscription_unsupported' }, 400);
    }

    const stripe = getStripeClient(env);
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id as string);
    const currentItemId = stripeSub.items.data[0].id;

    // -------- ACTION: reactivate (clear scheduled cancellation) --------
    if (action === 'reactivate') {
      const updated = await stripe.subscriptions.update(stripeSub.id, {
        cancel_at_period_end: false,
      });
      await supabase.from('subscriptions').update({
        status: updated.status,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', stripeSub.id);
      return json({ ok: true, action: 'reactivated' });
    }

    // -------- ACTION: change (and optionally also reactivate) --------
    const newPrice = await resolvePrice(env, newPriceId!);
    const updated = await stripe.subscriptions.update(stripeSub.id, {
      items: [{ id: currentItemId, price: newPrice.id, quantity: 1 }],
      proration_behavior: 'create_prorations',
      cancel_at_period_end: false,
      metadata: { user_id: user.id, lookup_key: newPriceId! },
    });

    await supabase.from('subscriptions').update({
      price_id: newPriceId!,
      product_id: PRICE_TO_PRODUCT[newPriceId!] ?? sub.product_id,
      status: updated.status,
      cancel_at_period_end: false,
      current_period_start: updated.current_period_start
        ? new Date(updated.current_period_start * 1000).toISOString()
        : sub.current_period_start,
      current_period_end: updated.current_period_end
        ? new Date(updated.current_period_end * 1000).toISOString()
        : sub.current_period_end,
      updated_at: new Date().toISOString(),
    }).eq('stripe_subscription_id', stripeSub.id);

    return json({ ok: true, action: 'changed' });
  } catch (e) {
    console.error('change-subscription error:', e);
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
