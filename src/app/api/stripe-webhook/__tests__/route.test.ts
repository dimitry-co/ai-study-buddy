/** @jest-environment node */

import { NextRequest } from 'next/server';

const mockConstructEvent = jest.fn();
const mockRetrieveSubscription = jest.fn();

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: (...args: any[]) => mockConstructEvent(...args),
    },
    subscriptions: {
      retrieve: (...args: any[]) => mockRetrieveSubscription(...args),
    },
  })),
);

jest.mock('@supabase/supabase-js', () => {
  const from = jest.fn(() => ({
    upsert: jest.fn(async () => ({ error: null })),
    update: jest.fn(() => ({
      eq: jest.fn(async () => ({ error: null })),
    })),
  }));

  return {
    createClient: jest.fn(() => ({ from })),
  };
});

import { POST } from '../route';

describe('POST /api/stripe-webhook', () => {
  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_mock';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when stripe signature header is missing', async () => {
    const request = new NextRequest('http://localhost/api/stripe-webhook', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'No signature' });
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it('returns 400 when signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const request = new NextRequest('http://localhost/api/stripe-webhook', {
      method: 'POST',
      body: '{}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'sig_mock',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid signature' });
  });

  it('returns 200 for valid but unhandled event types', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_method.attached',
      data: { object: {} },
    });

    const request = new NextRequest('http://localhost/api/stripe-webhook', {
      method: 'POST',
      body: '{"id":"evt_123"}',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'sig_mock',
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
  });
});
