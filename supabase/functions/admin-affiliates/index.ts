import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getStripeClient,
  resolvePrice,
  corsHeaders,
  json,
  type StripeEnv,
} from '../_shared/stripe.ts';

interface CreateBody {
  name: string;
  email?: string;
  notes?: string;
  commission_percent: number;
  discount_code: string;
  discount_percent: number;
  restrict_to_external?: string[];
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
    const { data: u } = await supabase.auth.getUser();
    const user = u?.user;
    if (!user) return json({ error: 'unauthenticated' }, 401);

    const { data: roleRow } = await supabase
      .from('user_roles').select('role')
      .eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) return json({ error: 'forbidden' }, 403);

    const body = await req.json();
    const action = body?.action as string;
    const env: StripeEnv = body?.environment === 'live' ? 'live' : 'sandbox';

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const stripe = getStripeClient(env);

    if (action === 'list') {
      const { data, error } = await admin
        .from('affiliates').select('*')
        .eq('environment', env)
        .order('created_at', { ascending: false });
      if (error) return json({ error: error.message }, 500);

      const enriched = await Promise.all((data ?? []).map(async (a: any) => {
        try {
          const pc = await stripe.promotionCodes.retrieve(a.stripe_promotion_code_id);
          const coupon = await stripe.coupons.retrieve(
            typeof pc.coupon === 'string' ? pc.coupon : pc.coupon.id,
          );
          return {
            ...a,
            paddle_status: pc.active ? 'active' : 'archived',
            times_used: pc.times_redeemed ?? 0,
            usage_limit: pc.max_redemptions ?? null,
            discount_percent: coupon.percent_off ?? null,
          };
        } catch {
          return { ...a, paddle_status: null, times_used: 0 };
        }
      }));
      return json({ data: enriched });
    }

    if (action === 'stats') {
      const id = body?.id as string;
      const { data: aff } = await admin.from('affiliates').select('*').eq('id', id).maybeSingle();
      if (!aff) return json({ error: 'not_found' }, 404);

      // Count successful charges via promotion code metadata is not directly possible;
      // use coupon's times_redeemed and sum the charges that referenced this promo via
      // checkout sessions. Simpler: list checkout sessions in last year and filter.
      let totalGross = 0;
      let txCount = 0;
      // Iterate completed sessions paginated
      let starting_after: string | undefined;
      for (let page = 0; page < 4; page++) {
        const list = await stripe.checkout.sessions.list({
          limit: 100,
          starting_after,
          expand: ['data.total_details'],
        });
        for (const s of list.data) {
          if (s.status !== 'complete') continue;
          // promo code resolution: discounts → promotion_code id
          const usedPromo = s.discounts?.some((d: any) =>
            (typeof d.promotion_code === 'string' ? d.promotion_code : d.promotion_code?.id) === aff.stripe_promotion_code_id,
          );
          if (!usedPromo) continue;
          totalGross += s.amount_total ?? 0;
          txCount += 1;
        }
        if (!list.has_more) break;
        starting_after = list.data[list.data.length - 1]?.id;
      }
      const commissionDue = (totalGross * Number(aff.commission_percent)) / 100;
      return json({
        transactions: txCount,
        gross_total_cents: totalGross,
        commission_cents: Math.round(commissionDue),
        commission_percent: aff.commission_percent,
      });
    }

    if (action === 'create') {
      const p = body as CreateBody;
      if (!p.name?.trim()) return json({ error: 'name_required' }, 400);
      if (!p.discount_code?.trim()) return json({ error: 'code_required' }, 400);
      const commission = Number(p.commission_percent);
      const discountPct = Number(p.discount_percent);
      if (!(commission > 0 && commission <= 100)) return json({ error: 'invalid_commission' }, 400);
      if (!(discountPct > 0 && discountPct <= 100)) return json({ error: 'invalid_discount_percent' }, 400);

      const code = p.discount_code.trim().toUpperCase();

      // Optional restrict_to: map our internal lookup keys → Stripe product IDs
      const productIds: string[] = [];
      if (p.restrict_to_external?.length) {
        for (const lookup of p.restrict_to_external) {
          try {
            const price = await resolvePrice(env, lookup);
            const pid = typeof price.product === 'string' ? price.product : price.product.id;
            if (pid && !productIds.includes(pid)) productIds.push(pid);
          } catch (e) {
            console.warn('cannot resolve restrict_to lookup', lookup, e);
          }
        }
      }

      // 1. Create coupon (one-time, percentage off)
      const coupon = await stripe.coupons.create({
        percent_off: discountPct,
        duration: 'once',
        name: `Affiliate ${p.name}`,
        ...(productIds.length ? { applies_to: { products: productIds } } : {}),
        metadata: { affiliate_name: p.name, commission_percent: String(commission) },
      });

      // 2. Create promotion code (the human-readable code customers type)
      const pc = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code,
        active: true,
        metadata: { affiliate_name: p.name },
      });

      const { data: row, error: insErr } = await admin.from('affiliates').insert({
        name: p.name.trim(),
        email: p.email?.trim() || null,
        notes: p.notes?.trim() || null,
        commission_percent: commission,
        discount_code: code,
        stripe_promotion_code_id: pc.id,
        environment: env,
      }).select('*').maybeSingle();

      if (insErr) return json({ error: insErr.message }, 500);
      return json({ data: row });
    }

    if (action === 'archive') {
      const id = body?.id as string;
      const { data: aff } = await admin.from('affiliates').select('*').eq('id', id).maybeSingle();
      if (!aff) return json({ error: 'not_found' }, 404);
      try {
        await stripe.promotionCodes.update(aff.stripe_promotion_code_id, { active: false });
      } catch (e) {
        console.warn('promotion code deactivate failed', e);
      }
      await admin.from('affiliates').update({ archived: true }).eq('id', id);
      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('admin-affiliates error', e);
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
