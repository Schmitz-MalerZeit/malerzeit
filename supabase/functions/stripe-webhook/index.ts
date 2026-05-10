import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17.5.0';
import {
  getStripeClient,
  getStripeWebhookSecret,
  ADDON_PRICE_IDS,
  SUBSCRIPTION_PRICE_IDS,
  PRICE_TO_PRODUCT,
  type StripeEnv,
} from '../_shared/stripe.ts';

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
  }
  return _supabase;
}

function lookupKeyFromItem(item: Stripe.SubscriptionItem | Stripe.LineItem): string | null {
  // For subscriptions, item.price.lookup_key is set when we created it via lookup_keys.
  const price = (item as any).price as Stripe.Price | undefined;
  return price?.lookup_key ?? null;
}

async function syncSubscriptionFromStripe(
  stripe: Stripe,
  env: StripeEnv,
  subscriptionId: string,
) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });
  const item = sub.items.data[0];
  const lookupKey = item?.price?.lookup_key ?? null;
  if (!lookupKey || !SUBSCRIPTION_PRICE_IDS.has(lookupKey)) {
    console.warn('Skipping subscription with unknown lookup_key', {
      subscriptionId,
      lookupKey,
    });
    return;
  }
  const productId = PRICE_TO_PRODUCT[lookupKey] ?? 'unknown_plan';

  // userId comes from metadata we set on the subscription / checkout session
  const userId =
    (sub.metadata?.user_id as string | undefined) ??
    (sub.metadata?.userId as string | undefined);
  if (!userId) {
    console.error('No user_id in subscription metadata', { subscriptionId });
    return;
  }

  const periodStart = sub.current_period_start
    ? new Date(sub.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  // Map Stripe statuses to our DB convention
  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    unpaid: 'past_due',
    paused: 'paused',
  };
  const status = statusMap[sub.status] ?? sub.status;

  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  await getSupabase()
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: sub.id,
        stripe_customer_id: customerId,
        product_id: productId,
        price_id: lookupKey,
        status,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: sub.cancel_at_period_end,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id' },
    );
}

async function handleCheckoutSessionCompleted(
  stripe: Stripe,
  env: StripeEnv,
  session: Stripe.Checkout.Session,
) {
  const userId = session.metadata?.user_id;
  if (!userId) {
    console.warn('checkout.session.completed without user_id metadata', { id: session.id });
    return;
  }

  if (session.mode === 'subscription' && session.subscription) {
    const subId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;
    // Make sure metadata.user_id is also on the subscription itself for future updates
    await stripe.subscriptions.update(subId, {
      metadata: { user_id: userId },
    });
    await syncSubscriptionFromStripe(stripe, env, subId);
    return;
  }

  if (session.mode === 'payment') {
    // One-time add-on purchase
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ['data.price'],
      limit: 10,
    });
    for (const li of lineItems.data) {
      const lookupKey = (li.price as Stripe.Price | undefined)?.lookup_key ?? null;
      if (!lookupKey || !ADDON_PRICE_IDS.has(lookupKey)) continue;
      const { error } = await getSupabase().rpc('grant_pdf_addon', {
        p_user_id: userId,
        p_price_id: lookupKey,
        p_paddle_transaction_id: session.id, // column was renamed to stripe_session_id; arg name is legacy
        p_environment: env,
      });
      if (error) {
        console.error('grant_pdf_addon failed', { error, sessionId: session.id, lookupKey });
      } else {
        console.log('Add-On granted', { userId, lookupKey, sessionId: session.id });
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const url = new URL(req.url);
  const env = (url.searchParams.get('env') || 'sandbox') as StripeEnv;

  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('Missing signature', { status: 400 });

  const body = await req.text();
  const stripe = getStripeClient(env);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      getStripeWebhookSecret(env),
    );
  } catch (e) {
    console.error('Webhook signature verification failed:', e);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          stripe,
          env,
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscriptionFromStripe(stripe, env, sub.id);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subId =
            typeof invoice.subscription === 'string'
              ? invoice.subscription
              : invoice.subscription.id;
          await syncSubscriptionFromStripe(stripe, env, subId);
        }
        break;
      }
      default:
        console.log('Unhandled event:', event.type);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Webhook handler error:', e);
    return new Response('Webhook error', { status: 500 });
  }
});
