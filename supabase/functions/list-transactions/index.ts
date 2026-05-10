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

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, environment, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!subs || subs.length === 0) return json({ transactions: [] });

    const byEnv = new Map<StripeEnv, Set<string>>();
    for (const s of subs) {
      const env = (s.environment as StripeEnv) || 'sandbox';
      const cid = s.stripe_customer_id as string | null;
      if (!cid || cid.startsWith('manual_')) continue;
      if (!byEnv.has(env)) byEnv.set(env, new Set());
      byEnv.get(env)!.add(cid);
    }

    type Tx = {
      id: string;
      status: string;
      created_at: string;
      billed_at: string | null;
      amount: number;
      currency: string;
      invoice_url: string | null;
      environment: StripeEnv;
    };
    const all: Tx[] = [];

    for (const [env, customers] of byEnv) {
      const stripe = getStripeClient(env);

      for (const customerId of customers) {
        // Subscription invoices
        const invoices = await stripe.invoices.list({
          customer: customerId,
          limit: 20,
        });
        for (const inv of invoices.data) {
          all.push({
            id: inv.id,
            status: inv.status ?? 'unknown',
            created_at: new Date(inv.created * 1000).toISOString(),
            billed_at: inv.status_transitions?.paid_at
              ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
              : null,
            amount: (inv.amount_paid ?? inv.amount_due) / 100,
            currency: (inv.currency ?? 'eur').toUpperCase(),
            invoice_url: inv.hosted_invoice_url ?? inv.invoice_pdf ?? null,
            environment: env,
          });
        }

        // One-time add-on charges (no invoice)
        const charges = await stripe.charges.list({
          customer: customerId,
          limit: 20,
        });
        for (const ch of charges.data) {
          // Skip charges that came from an invoice (already covered above)
          if (ch.invoice) continue;
          if (!ch.paid) continue;
          all.push({
            id: ch.id,
            status: ch.status === 'succeeded' ? 'paid' : ch.status,
            created_at: new Date(ch.created * 1000).toISOString(),
            billed_at: new Date(ch.created * 1000).toISOString(),
            amount: ch.amount / 100,
            currency: (ch.currency ?? 'eur').toUpperCase(),
            invoice_url: ch.receipt_url,
            environment: env,
          });
        }
      }
    }

    all.sort((a, b) => (b.billed_at ?? b.created_at).localeCompare(a.billed_at ?? a.created_at));
    return json({ transactions: all.slice(0, 15) });
  } catch (e) {
    console.error('list-transactions error:', e);
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
