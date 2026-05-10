import { createClient } from 'npm:@supabase/supabase-js@2';
import { getStripeClient, corsHeaders, json, type StripeEnv } from '../_shared/stripe.ts';

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

    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id, _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const { action, environment, payload } = body as {
      action: 'list' | 'create' | 'update' | 'archive';
      environment: StripeEnv;
      payload?: any;
    };
    const env: StripeEnv = environment === 'live' ? 'live' : 'sandbox';
    const stripe = getStripeClient(env);

    if (action === 'list') {
      // Return promotion codes with their coupons inlined
      const promos = await stripe.promotionCodes.list({ limit: 100 });
      const data = await Promise.all(promos.data.map(async (pc) => {
        const cid = typeof pc.coupon === 'string' ? pc.coupon : pc.coupon.id;
        const coupon = await stripe.coupons.retrieve(cid);
        return {
          id: pc.id,
          code: pc.code,
          status: pc.active ? 'active' : 'archived',
          times_used: pc.times_redeemed,
          usage_limit: pc.max_redemptions,
          percent_off: coupon.percent_off,
          amount_off: coupon.amount_off,
          currency: coupon.currency,
          duration: coupon.duration,
          name: coupon.name,
          created_at: new Date(pc.created * 1000).toISOString(),
        };
      }));
      return json({ data });
    }

    if (action === 'create') {
      const p = payload || {};
      const code = String(p.code || '').trim().toUpperCase();
      const percent = p.percent_off ? Number(p.percent_off) : null;
      const amount = p.amount_off ? Number(p.amount_off) : null; // cents
      if (!code) return json({ error: 'missing_code' }, 400);
      if (!percent && !amount) return json({ error: 'missing_amount' }, 400);

      const coupon = await stripe.coupons.create({
        ...(percent ? { percent_off: percent } : {}),
        ...(amount ? { amount_off: amount, currency: p.currency || 'eur' } : {}),
        duration: p.duration || 'once',
        name: p.name || `Code ${code}`,
        ...(p.max_redemptions ? { max_redemptions: Number(p.max_redemptions) } : {}),
      });
      const pc = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code,
        active: true,
        ...(p.max_redemptions ? { max_redemptions: Number(p.max_redemptions) } : {}),
      });
      return json({ data: pc });
    }

    if (action === 'update') {
      const { id, active } = payload || {};
      if (!id) return json({ error: 'missing_id' }, 400);
      const pc = await stripe.promotionCodes.update(id, { active: !!active });
      return json({ data: pc });
    }

    if (action === 'archive') {
      const { id } = payload || {};
      if (!id) return json({ error: 'missing_id' }, 400);
      const pc = await stripe.promotionCodes.update(id, { active: false });
      return json({ data: pc });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('admin-discounts error', e);
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
