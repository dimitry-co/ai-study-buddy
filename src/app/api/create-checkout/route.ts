import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover', // Pin to specific Stripe API version for stability
});

export async function POST(request: NextRequest) {
  try {
    // Get cookies from request and create Supabase server-side client(to read auth cookies from request)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {    // This function called by supabase to read all cookies from request
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {      // This function called by supabase to set all cookies in response
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Check if user is logged in (has auth cookie)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .single();
    
    if (existingSubscription?.status === 'active') {
      return NextResponse.json(
        { error: 'User already has an active subscription' },
        { status: 400 },
      );
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      // Payment settings
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!, // The price ID from Stripe dashboard
          quantity: 1,
        },
      ],

      // URLs - where to send user after payment
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/subscribe?canceled=true`,

      // Customer info = prefill email from user
      customer_email: user.email,

      // Metadata - attach user ID so webhook knows who subscribed 
      metadata: {
        user_id: user.id,
      },
    });

    // Return the checkout URL to frontend
    return NextResponse.json({ url: session.url }, { status: 200 });

  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' }, 
      { status: 500 }
    );
  } 
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'Stripe checkout API is working',
    endpoint: '/api/create-checkout',
  });
}