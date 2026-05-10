import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const VALID_PRICES: Record<string, string> = {
  starter_monthly: 'starter_plan',
  starter_yearly: 'starter_plan',
  profi_monthly: 'profi_plan',
  profi_yearly: 'profi_plan',
  profiplus_monthly: 'profiplus_plan',
  profiplus_yearly: 'profiplus_plan',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'unauthenticated' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(url, serviceKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const caller = userData?.user;
    if (!caller) return json({ error: 'unauthenticated' }, 401);

    const { data: isAdmin } = await userClient.rpc('has_role', {
      _user_id: caller.id,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as 'grant' | 'revoke' | 'list';
    const environment = (body.environment === 'live' ? 'live' : 'sandbox') as 'live' | 'sandbox';
    const admin = createClient(url, serviceKey);

    if (action === 'list') {
      const { data, error } = await admin
        .from('subscriptions')
        .select('*')
        .eq('environment', environment)
        .like('stripe_subscription_id', 'manual_%')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) return json({ error: error.message }, 500);
      // Resolve emails
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id)));
      const emailMap: Record<string, string> = {};
      for (const id of ids) {
        const { data: u } = await admin.auth.admin.getUserById(id);
        if (u?.user?.email) emailMap[id] = u.user.email;
      }
      return json({ data: (data ?? []).map((r: any) => ({ ...r, email: emailMap[r.user_id] ?? null })) });
    }

    if (action === 'revoke') {
      const id = body.id as string;
      if (!id) return json({ error: 'missing_id' }, 400);
      const { error } = await admin.from('subscriptions').delete().eq('id', id).like('stripe_subscription_id', 'manual_%');
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === 'grant') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const priceId = String(body.priceId ?? '');
      const days = Math.max(1, Math.min(3650, Number(body.days ?? 30)));

      if (!email || !priceId) return json({ error: 'missing_fields' }, 400);
      if (!VALID_PRICES[priceId]) return json({ error: 'invalid_price' }, 400);

      // Find user by email (paginate)
      let targetId: string | null = null;
      let page = 1;
      while (page <= 20 && !targetId) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) return json({ error: error.message }, 500);
        const found = data.users.find((u: any) => (u.email ?? '').toLowerCase() === email);
        if (found) targetId = found.id;
        if (data.users.length < 200) break;
        page++;
      }
      if (!targetId) return json({ error: 'user_not_found' }, 404);

      const now = new Date();
      const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      const subId = `manual_${crypto.randomUUID()}`;
      const { error } = await admin.from('subscriptions').insert({
        user_id: targetId,
        paddle_subscription_id: subId,
        paddle_customer_id: `manual_${targetId}`,
        product_id: VALID_PRICES[priceId],
        price_id: priceId,
        status: 'active',
        environment,
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        cancel_at_period_end: true,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, user_id: targetId, current_period_end: end.toISOString() });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('admin-grant-access error', e);
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
