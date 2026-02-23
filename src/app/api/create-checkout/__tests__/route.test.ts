/** @jest-environment node */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const mockCheckoutCreate = jest.fn();

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: (...args: any[]) => mockCheckoutCreate(...args),
      },
    },
  })),
);

const mockCookies = {
  getAll: jest.fn(() => []),
  set: jest.fn(),
};

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => mockCookies),
}));

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

import { POST } from '../route';

type SupabaseMockOptions = {
  user?: { id: string; email: string } | null;
  authError?: Error | null;
  subscriptionStatus?: string | null;
};

const makeSupabaseMock = (options: SupabaseMockOptions) => ({
  auth: {
    getUser: jest.fn(async () => ({
      data: { user: options.user ?? null },
      error: options.authError ?? null,
    })),
  },
  from: jest.fn(() => {
    const chain: any = {
      select: jest.fn(() => chain),
      eq: jest.fn(() => chain),
      order: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      single: jest.fn(async () => ({
        data: options.subscriptionStatus
          ? { status: options.subscriptionStatus }
          : null,
        error: null,
      })),
    };
    return chain;
  }),
});

const makeRequest = () =>
  new NextRequest('http://localhost/api/create-checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });

describe('POST /api/create-checkout', () => {
  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.STRIPE_PRICE_ID = 'price_mock';
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    (createServerClient as jest.Mock).mockReturnValue(
      makeSupabaseMock({ user: null, authError: new Error('Unauthorized') }),
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when user already has active subscription', async () => {
    (createServerClient as jest.Mock).mockReturnValue(
      makeSupabaseMock({
        user: { id: 'u1', email: 'user@example.com' },
        subscriptionStatus: 'active',
      }),
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'User already has an active subscription',
    });
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it('creates and returns a checkout URL for eligible users', async () => {
    (createServerClient as jest.Mock).mockReturnValue(
      makeSupabaseMock({
        user: { id: 'u1', email: 'user@example.com' },
        subscriptionStatus: null,
      }),
    );

    mockCheckoutCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/c/session_123',
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: 'https://checkout.stripe.com/c/session_123',
    });

    expect(mockCheckoutCreate).toHaveBeenCalledTimes(1);
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer_email: 'user@example.com',
        metadata: { user_id: 'u1' },
      }),
    );
  });
});
