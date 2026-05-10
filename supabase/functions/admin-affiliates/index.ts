import { createClient } from 'npm:@supabase/supabase-js@2';
import { gatewayFetch, type PaddleEnv } from '../_shared/paddle.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface CreateBody {
  name: string;
  email?: string;
  notes?: string;
  commission_percent: number;
  discount_code: string;
  discount_percent: number;
  restrict_to_external?: string[];
}

async function resolveExternalIds(env: PaddleEnv, externalIds: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const ext of externalIds) {
    const r = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(ext)}`);
    const j = await r.json();
    const id = j?.data?.[0]?.id;
    if (id) out.push(id);
  }
  return out;
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
    const env = (body?.environment ?? 'sandbox') as PaddleEnv;
    if (env !== 'sandbox' && env !== 'live') return json({ error: 'invalid_environment' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (action === 'list') {
      const { data, error } = await admin
        .from('affiliates')
        .select('*')
        .eq('environment', env)
        .order('created_at', { ascending: false });
      if (error) return json({ error: error.message }, 500);

      // Enrich with current Paddle stats per discount
      const enriched = await Promise.all((data ?? []).map(async (a: any) => {
        try {
          const dr = await gatewayFetch(env, `/discounts/${a.paddle_discount_id}`);
          const dj = await dr.json();
          const d = dj?.data;
          return {
            ...a,
            paddle_status: d?.status ?? null,
            times_used: d?.times_used ?? 0,
            usage_limit: d?.usage_limit ?? null,
            discount_percent: d?.amount ?? null,
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

      // List completed transactions that used this discount (paginate up to 200)
      let after: string | undefined;
      let totalGross = 0;
      let txCount = 0;
      for (let page = 0; page < 5; page++) {
        const qs = new URLSearchParams({
          status: 'completed',
          per_page: '50',
          'discount_id': aff.paddle_discount_id,
        });
        if (after) qs.set('after', after);
        const r = await gatewayFetch(env, `/transactions?${qs.toString()}`);
        const j = await r.json();
        const items = j?.data ?? [];
        for (const t of items) {
          // total in lowest denomination, before tax+fees? use details.totals.total
          const total = Number(t?.details?.totals?.total ?? t?.totals?.total ?? 0);
          totalGross += total;
          txCount += 1;
        }
        after = j?.meta?.pagination?.next ? new URL(j.meta.pagination.next).searchParams.get('after') ?? undefined : undefined;
        if (!after) break;
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

      // Resolve restrict_to externals → Paddle price IDs
      let restrict_to: string[] | undefined;
      if (p.restrict_to_external?.length) {
        restrict_to = await resolveExternalIds(env, p.restrict_to_external);
      }

      // Create Paddle discount: percentage, NOT recurring (one-time on first purchase)
      const discountBody: Record<string, unknown> = {
        description: `Affiliate ${p.name}`,
        type: 'percentage',
        amount: String(discountPct),
        code,
        enabled_for_checkout: true,
        recur: false,
        custom_data: { affiliate_name: p.name, commission_percent: commission },
      };
      if (restrict_to?.length) discountBody.restrict_to = restrict_to;

      const dr = await gatewayFetch(env, '/discounts', {
        method: 'POST',
        body: JSON.stringify(discountBody),
      });
      const dj = await dr.json();
      if (!dr.ok || !dj?.data?.id) {
        return json({ error: 'paddle_create_failed', detail: dj }, 500);
      }
      const paddleId = dj.data.id as string;

      const { data: row, error: insErr } = await admin.from('affiliates').insert({
        name: p.name.trim(),
        email: p.email?.trim() || null,
        notes: p.notes?.trim() || null,
        commission_percent: commission,
        discount_code: code,
        paddle_discount_id: paddleId,
        environment: env,
      }).select('*').maybeSingle();

      if (insErr) return json({ error: insErr.message }, 500);
      return json({ data: row });
    }

    if (action === 'archive') {
      const id = body?.id as string;
      const { data: aff } = await admin.from('affiliates').select('*').eq('id', id).maybeSingle();
      if (!aff) return json({ error: 'not_found' }, 404);
      // Archive Paddle discount too
      await gatewayFetch(env, `/discounts/${aff.paddle_discount_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      });
      await admin.from('affiliates').update({ archived: true }).eq('id', id);
      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('admin-affiliates error', e);
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
