import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe. 
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// Supabase admin client (bypasses RLS - Row Level Security)
// We need admin bc webhook doesn't have user auth cookies (this is called by Stripe not our app/frontend from browser)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Admin key
  {
    auth: { // Supabase auth config - we don't want auto-refresh token or persist session (We handle auth in our app/frontend, not here)
      autoRefreshToken: false, 
      persistSession: false,
    },
  }
);

// Helper function to get current_period_end from subscription (handles different API versions)
const getCurrentPeriodEnd = (subscription: any): number | null => {
  // Try root level first (older API versions)
  if (subscription.current_period_end) {
    return subscription.current_period_end;
  }
  
  // Try items array (newer API versions like 2025-10-29.clover)
  if (subscription.items?.data?.[0]?.current_period_end) {
    return subscription.items.data[0].current_period_end;
  }
  
  return null;
};

export async function POST(request: NextRequest) {
  // Get raw body of the reuest (The payload from Stripe), and the signature from the headers (signature is used to verify the payload)
  const body  = await request.text(); 
  const signature = request.headers.get('stripe-signature');

  if (!signature) { 
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event; // event object to parse the payload from Stripe.

  try {
    // Verify this request actually came from Stripe (security measure)
    event = stripe.webhooks.constructEvent( // this function verifies the signature and returns the event object
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET! // Webhook secret from Stripe dashboard (NEW env var)
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({error: 'Invalid signature'}, { status: 400 });
  }

  // Handle different event types. 
  try {
    switch (event.type) {
      case 'checkout.session.completed': { // User completed payment (first time OR auto-renewal)
        const session = event.data.object  as Stripe.Checkout.Session; // Type assertion to get the session object

        // Get subscription details from Stripe. (we use subscriptions.retrieve to get the subscription details from Stripe using the subscription id from the session object)
        const subscriptionId = session.subscription as string; 
        const subscription: any = await stripe.subscriptions.retrieve(subscriptionId);

        // Extract user ID property from metadata object (we set this in create-checkout.ts)
        const userId = session.metadata?.user_id as string;
   
        if (!userId) {
          console.error('User ID not found in session metadata');
          break;
        }

        // Validate subscription data
        const periodEnd = getCurrentPeriodEnd(subscription);
        if (!periodEnd) {
          console.error('Subscription missing current_period_end in both root and items');
          break;
        }

        console.log('Creating subscription for user:', userId);
        console.log('Period end:', periodEnd);
        
        // Create subscription record in Supabase database. (upsert is used to create or update a record)
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .upsert({
            user_id: userId,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: session.customer as string,
            status: 'active',
            current_period_end: new Date(periodEnd * 1000).toISOString(), // calcaulted new end date for the subcription. isostring is used to convert the timestamp to a string.
          });
        
        if (error) {
          console.error('Failed to create subscription:', error);
          throw new Error('Database error: ' + error.message); // ← Throw to retry!
        }

        console.log('Subscription created for user:', userId);
        break;
      }

      case 'customer.subscription.updated': { // Subscription is updated (changed plan or canceled)
        const subscription: any = await stripe.subscriptions.retrieve(
          (event.data.object as Stripe.Subscription).id
        );

        // Determine actual status:
        // If user canceled but still in paid period, Stripe status is 'active' but cancel_at_period_end is true
        // We want to show 'canceled' to user so they know they won't be charged again
        let actualStatus = subscription.status;
        if (subscription.cancel_at_period_end) {
          actualStatus = 'canceled'; // User canceled, will expire at period end
        }

        const periodEnd = getCurrentPeriodEnd(subscription);
        if (!periodEnd) {
          console.error('Subscription missing current_period_end in update event');
          break;
        }

        // Update subscription record in Supabase database.
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({
            status: actualStatus,
            current_period_end: new Date(periodEnd * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
        
        if (error) {
          console.error('Failed to update subscription:', error);
          throw new Error('Database error: ' + error.message);
        }

        console.log('Subscription updated:', subscription.id);
        break;
      }

      case 'customer.subscription.deleted': { // Subscription expired or fully deleted
        const subscription: any = event.data.object;

        const periodEnd = getCurrentPeriodEnd(subscription);
        if (!periodEnd) {
          console.error('Subscription missing current_period_end in delete event');
          break;
        }

        // Update subscription record in Supabase database to 'expired' status.
        // This event fires when subscription actually ends (after cancel or natural expiration)
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({ 
            status: 'expired',
            current_period_end: new Date(periodEnd * 1000).toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);
        
        if (error) {
          console.error('Failed to cancel subscription:', error);
          throw new Error('Database error: ' + error.message);
        }
        
        console.log('Subscription canceled:', subscription.id);
        break;
      }

      default:
        console.log('unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true }, { status: 200 }); // return success response to Stripe
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'webhook handler failed' },
      { status: 500 }
    );
  }
}
