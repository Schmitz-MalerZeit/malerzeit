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
          duration_in_months: coupon.duration_in_months,
          name: coupon.name,
          expires_at: pc.expires_at ? new Date(pc.expires_at * 1000).toISOString() : null,
          restrict_to_products: coupon.applies_to?.products ?? null,
          created_at: new Date(pc.created * 1000).toISOString(),
        };
      }));
      return json({ data });
    }

    if (action === 'create') {
      const p = payload || {};
      const code = String(p.code || '').trim().toUpperCase();
      const percent = p.percent_off ? Number(p.percent_off) : null;
      const amount = p.amount_off ? Number(p.amount_off) : null;
      if (!code) return json({ error: 'missing_code' }, 400);
      if (!percent && !amount) return json({ error: 'missing_amount' }, 400);

      // Resolve restrict_to lookup keys → Stripe product IDs
      let appliesToProducts: string[] | undefined;
      if (Array.isArray(p.restrict_to_lookups) && p.restrict_to_lookups.length) {
        const productIds = new Set<string>();
        for (const lookup of p.restrict_to_lookups as string[]) {
          try {
            const list = await stripe.prices.list({
              lookup_keys: [lookup], active: true, limit: 1, expand: ['data.product'],
            });
            const price = list.data[0];
            if (!price) continue;
            const pid = typeof price.product === 'string' ? price.product : price.product.id;
            if (pid) productIds.add(pid);
          } catch (e) { console.warn('lookup failed', lookup, e); }
        }
        if (productIds.size) appliesToProducts = Array.from(productIds);
      }

      // Translate recur flag to Stripe coupon duration
      let duration: 'once' | 'repeating' | 'forever' = 'once';
      let duration_in_months: number | undefined;
      if (p.recur) {
        if (p.maximum_recurring_intervals) {
          duration = 'repeating';
          duration_in_months = Number(p.maximum_recurring_intervals);
        } else {
          duration = 'forever';
        }
      }

      const coupon = await stripe.coupons.create({
        ...(percent ? { percent_off: percent } : {}),
        ...(amount ? { amount_off: amount, currency: p.currency || 'eur' } : {}),
        duration,
        ...(duration_in_months ? { duration_in_months } : {}),
        name: p.name || `Code ${code}`,
        ...(appliesToProducts ? { applies_to: { products: appliesToProducts } } : {}),
      });

      const expiresAt = p.expires_at
        ? Math.floor(new Date(p.expires_at).getTime() / 1000)
        : undefined;

      const pc = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code,
        active: true,
        ...(p.max_redemptions ? { max_redemptions: Number(p.max_redemptions) } : {}),
        ...(expiresAt ? { expires_at: expiresAt } : {}),
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
