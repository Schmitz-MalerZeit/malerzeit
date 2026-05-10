import { createClient } from 'npm:@supabase/supabase-js@2';
import { getStripeClient, corsHeaders, json, type StripeEnv } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'unauthenticated' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'unauthenticated' }, 401);

    const body = await req.json().catch(() => ({}));
    const env: StripeEnv = body?.environment === 'live' ? 'live' : 'sandbox';
    const returnUrl = (body?.returnUrl as string | undefined) ||
      `${new URL(req.url).origin}/billing`;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: sub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id, environment')
      .eq('user_id', user.id)
      .eq('environment', env)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub || !sub.stripe_customer_id || String(sub.stripe_customer_id).startsWith('manual_')) {
      return json({ error: 'no_subscription' }, 404);
    }

    const stripe = getStripeClient(env);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id as string,
      return_url: returnUrl,
      locale: 'de',
    });

    return json({ url: portal.url });
  } catch (e) {
    console.error('customer-portal error:', e);
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
