import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { LEGAL_AI_ADDON } from '@/lib/stripe-plans';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' });

  const body      = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ── Idempotency: skip if we've already processed this event ───────
  // Stripe retries events on failure (up to ~3 days). Without this check,
  // a retry would re-run the handler and could duplicate side effects
  // (notifications, double-enabling the add-on, etc.).
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub   = event.data.object as Stripe.Subscription;
      const tier  = (sub.metadata?.tier as 'pro' | 'premium') ?? 'pro';
      const email = sub.metadata?.email;
      if (!email) break;

      // ── Detect the Legal-AI add-on ──────────────────────────────
      // The add-on is its own Stripe subscription whose price matches
      // LEGAL_AI_ADDON.priceId, OR whose metadata.addon === 'legal_ai'.
      const items = sub.items?.data ?? [];
      const hasLegalAiAddOn = items.some(
        (it) =>
          (typeof it.price === 'object' && it.price?.id === LEGAL_AI_ADDON.priceId) ||
          sub.metadata?.addon === 'legal_ai',
      );

      const { data: user } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
      if (user) {
        await supabase.from('subscriptions').upsert({
          user_id:                user.id,
          stripe_subscription_id: sub.id,
          tier,
          status:                 sub.status,
          current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
          // Legal-AI add-on state (migration 20260342)
          legal_ai_enabled:           hasLegalAiAddOn,
          legal_ai_stripe_price_id:   hasLegalAiAddOn ? LEGAL_AI_ADDON.priceId : null,
          legal_ai_current_period_end: hasLegalAiAddOn
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        });
        await supabase.from('users').update({ subscription_tier: tier }).eq('id', user.id);

        // In-app notification
        await supabase.from('notifications').insert({
          user_id: user.id,
          type:    'subscription_updated',
          title:   event.type === 'customer.subscription.created'
            ? `Subscription activated — ${tier} plan`
            : `Subscription updated — ${tier} plan`,
          body:    hasLegalAiAddOn
            ? `Your ${tier} plan is now active, with the Legal-AI add-on enabled.`
            : `Your ${tier} plan is now active.`,
          action_url: '/billing',
        });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const items = sub.items?.data ?? [];
      const wasLegalAiAddOn = items.some(
        (it) =>
          (typeof it.price === 'object' && it.price?.id === LEGAL_AI_ADDON.priceId) ||
          sub.metadata?.addon === 'legal_ai',
      );

      if (wasLegalAiAddOn) {
        // Add-on canceled — disable Legal-AI but keep the base tier.
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('user_id, tier')
          .eq('stripe_subscription_id', sub.id)
          .maybeSingle();
        if (existingSub) {
          await supabase
            .from('subscriptions')
            .update({
              legal_ai_enabled: false,
              legal_ai_stripe_price_id: null,
              legal_ai_current_period_end: null,
            })
            .eq('stripe_subscription_id', sub.id);
          await supabase.from('notifications').insert({
            user_id: existingSub.user_id,
            type: 'subscription_updated',
            title: 'Legal-AI add-on canceled',
            body: 'The Legal-AI add-on has been disabled. Your base plan is unchanged.',
            action_url: '/billing',
          });
        }
        break;
      }

      await supabase.from('subscriptions')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', sub.id);

      // Downgrade user to basic
      const { data: existingSub } = await supabase.from('subscriptions')
        .select('user_id').eq('stripe_subscription_id', sub.id).maybeSingle();
      if (existingSub) {
        await supabase.from('users')
          .update({ subscription_tier: 'basic' })
          .eq('id', existingSub.user_id);
        await supabase.from('notifications').insert({
          user_id: existingSub.user_id,
          type:    'subscription_updated',
          title:   'Subscription canceled',
          body:    'Your account has been downgraded to the Basic plan.',
          action_url: '/billing',
        });
      }
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        const { data: user } = await supabase.from('users')
          .select('id').eq('stripe_customer_id', customerId).maybeSingle();
        if (user) {
          await supabase.from('notifications').insert({
            user_id: user.id,
            type:    'subscription_updated',
            title:   'Payment failed',
            body:    'Your subscription payment failed. Please update your billing details.',
            action_url: '/billing',
          });
        }
      }
      break;
    }
  }

  // ── Record successful processing for idempotency ──────────────────
  // Insert AFTER the switch completes. If the handler threw, the row
  // won't exist and Stripe's retry will re-run it — which is what we want.
  await supabase.from('webhook_events').upsert({
    id:          event.id,
    provider:    'stripe',
    event_type:  event.type,
    processed_at: new Date().toISOString(),
  }, { onConflict: 'id' });

  return NextResponse.json({ received: true });
}
