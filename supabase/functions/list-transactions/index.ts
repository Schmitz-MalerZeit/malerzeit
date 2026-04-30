import { createClient } from 'npm:@supabase/supabase-js@2';
import { gatewayFetch, type PaddleEnv } from '../_shared/paddle.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find any subscription row for this user to determine env + customer id
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('paddle_customer_id, environment, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ transactions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group customer ids by env (a user may have rows in both sandbox and live)
    const byEnv = new Map<PaddleEnv, Set<string>>();
    for (const s of subs) {
      const env = (s.environment as PaddleEnv) || 'sandbox';
      if (!byEnv.has(env)) byEnv.set(env, new Set());
      byEnv.get(env)!.add(s.paddle_customer_id as string);
    }

    type Tx = {
      id: string;
      status: string;
      created_at: string;
      billed_at: string | null;
      amount: number;          // in major units
      currency: string;
      invoice_url: string | null;
      environment: PaddleEnv;
    };
    const all: Tx[] = [];

    for (const [env, customers] of byEnv) {
      for (const customerId of customers) {
        const qs = new URLSearchParams({
          customer_id: customerId,
          per_page: '20',
          order_by: 'created_at[DESC]',
        });
        const r = await gatewayFetch(env, `/transactions?${qs.toString()}`);
        if (!r.ok) {
          console.error('paddle list tx failed', env, customerId, r.status, await r.text());
          continue;
        }
        const j = await r.json();
        for (const t of j.data ?? []) {
          const totalMinor = Number(t.details?.totals?.grand_total ?? t.details?.totals?.total ?? 0);
          const currency = t.currency_code ?? 'EUR';
          all.push({
            id: t.id,
            status: t.status,
            created_at: t.created_at,
            billed_at: t.billed_at ?? null,
            amount: totalMinor / 100,
            currency,
            invoice_url: null, // fetched on demand below for completed only
            environment: env,
          });
        }
      }
    }

    all.sort((a, b) => (b.billed_at ?? b.created_at).localeCompare(a.billed_at ?? a.created_at));
    const top = all.slice(0, 15);

    // Fetch invoice PDFs only for completed transactions (others have no invoice yet)
    await Promise.all(top.map(async (t) => {
      if (t.status !== 'completed' && t.status !== 'paid') return;
      try {
        const r = await gatewayFetch(t.environment, `/transactions/${t.id}/invoice`);
        if (!r.ok) return;
        const j = await r.json();
        t.invoice_url = j.data?.url ?? null;
      } catch (e) {
        console.warn('invoice fetch failed', t.id, e);
      }
    }));

    return new Response(JSON.stringify({ transactions: top }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('list-transactions error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
