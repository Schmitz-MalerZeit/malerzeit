import { createClient } from 'npm:@supabase/supabase-js@2';
import { gatewayFetch, type PaddleEnv } from '../_shared/paddle.ts';

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

    // Admin check
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const { action, environment, payload } = body as {
      action: 'list' | 'create' | 'update' | 'archive';
      environment: PaddleEnv;
      payload?: any;
    };
    const env: PaddleEnv = environment === 'live' ? 'live' : 'sandbox';

    if (action === 'list') {
      const params = new URLSearchParams({
        per_page: '100',
        status: 'active,archived,expired,used',
      });
      const res = await gatewayFetch(env, `/discounts?${params.toString()}`);
      const data = await res.json();
      return json(data, res.status);
    }

    if (action === 'create') {
      const res = await gatewayFetch(env, `/discounts`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return json(data, res.status);
    }

    if (action === 'update') {
      const { id, ...rest } = payload || {};
      if (!id) return json({ error: 'missing_id' }, 400);
      const res = await gatewayFetch(env, `/discounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(rest),
      });
      const data = await res.json();
      return json(data, res.status);
    }

    if (action === 'archive') {
      const { id } = payload || {};
      if (!id) return json({ error: 'missing_id' }, 400);
      const res = await gatewayFetch(env, `/discounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      });
      const data = await res.json();
      return json(data, res.status);
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('admin-discounts error', e);
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
