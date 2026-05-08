import { createClient } from 'npm:@supabase/supabase-js@2';
import { getPaddleClient, type PaddleEnv } from '../_shared/paddle.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'unauthenticated' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'unauthenticated' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1) Cancel all active Paddle subscriptions
    const { data: subs } = await admin.from('subscriptions')
      .select('paddle_subscription_id, environment, status')
      .eq('user_id', user.id);
    for (const s of subs ?? []) {
      if (s.status === 'canceled') continue;
      try {
        const paddle = getPaddleClient((s.environment as PaddleEnv) || 'sandbox');
        await paddle.subscriptions.cancel(s.paddle_subscription_id as string, { effectiveFrom: 'immediately' });
      } catch (e) {
        console.warn('cancel sub failed', s.paddle_subscription_id, e);
      }
    }

    // 2) Delete storage objects (logos + quote PDFs)
    try {
      const { data: logos } = await admin.storage.from('company-logos').list(user.id);
      if (logos?.length) {
        await admin.storage.from('company-logos').remove(logos.map((f) => `${user.id}/${f.name}`));
      }
    } catch (e) { console.warn('logo cleanup failed', e); }
    try {
      const { data: pdfs } = await admin.storage.from('quote-pdfs').list(user.id);
      if (pdfs?.length) {
        await admin.storage.from('quote-pdfs').remove(pdfs.map((f) => `${user.id}/${f.name}`));
      }
    } catch (e) { console.warn('pdf cleanup failed', e); }

    // 3) Delete app data (most has FK cascade via auth.users delete, but be explicit)
    await admin.from('quotes').delete().eq('user_id', user.id);
    await admin.from('pdf_addons').delete().eq('user_id', user.id);
    await admin.from('pdf_usage').delete().eq('user_id', user.id);
    await admin.from('hourly_rates').delete().eq('user_id', user.id);
    await admin.from('user_settings').delete().eq('user_id', user.id);
    await admin.from('subscriptions').delete().eq('user_id', user.id);
    await admin.from('profiles').delete().eq('id', user.id);

    // 4) Delete the auth user
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) throw delErr;

    return json({ ok: true });
  } catch (e) {
    console.error('delete-account error', e);
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
