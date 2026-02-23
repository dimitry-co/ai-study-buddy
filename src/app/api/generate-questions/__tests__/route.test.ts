/** @jest-environment node */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const mockCreateCompletion = jest.fn();

jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: (...args: any[]) => mockCreateCompletion(...args),
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
  subscription?: { status: string; current_period_end: string } | null;
  profile?: { free_generations_used: number } | null;
};

const makeSupabaseMock = (options: SupabaseMockOptions) => {
  const from = jest.fn((table: string) => {
    let isUpdate = false;
    const chain: any = {
      select: jest.fn(() => chain),
      order: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      update: jest.fn(() => {
        isUpdate = true;
        return chain;
      }),
      eq: jest.fn(() => {
        if (isUpdate) {
          return Promise.resolve({ error: null });
        }
        return chain;
      }),
      single: jest.fn(async () => {
        if (table === 'subscriptions') {
          return { data: options.subscription ?? null, error: null };
        }
        if (table === 'profiles') {
          return { data: options.profile ?? null, error: null };
        }
        return { data: null, error: null };
      }),
    };

    return chain;
  });

  return {
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: options.user ?? null },
        error: options.authError ?? null,
      })),
    },
    from,
  };
};

const makeRequest = (body: Record<string, any>) =>
  new NextRequest('http://localhost/api/generate-questions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/generate-questions', () => {
  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    (createServerClient as jest.Mock).mockReturnValue(
      makeSupabaseMock({ user: null, authError: new Error('Unauthorized') }),
    );

    const response = await POST(
      makeRequest({
        contentType: 'text',
        notes: 'notes',
        numberOfQuestions: 3,
        questionType: 'mcq',
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(mockCreateCompletion).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid question count', async () => {
    (createServerClient as jest.Mock).mockReturnValue(
      makeSupabaseMock({
        user: { id: 'u1', email: 'user@example.com' },
        subscription: {
          status: 'active',
          current_period_end: '2099-01-01T00:00:00.000Z',
        },
      }),
    );

    const response = await POST(
      makeRequest({
        contentType: 'text',
        notes: 'notes',
        numberOfQuestions: 0,
        questionType: 'mcq',
      }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('between');
    expect(mockCreateCompletion).not.toHaveBeenCalled();
  });

  it('returns 403 when free generation limit is exhausted', async () => {
    (createServerClient as jest.Mock).mockReturnValue(
      makeSupabaseMock({
        user: { id: 'u1', email: 'user@example.com' },
        subscription: null,
        profile: { free_generations_used: 4 },
      }),
    );

    const response = await POST(
      makeRequest({
        contentType: 'text',
        notes: 'notes',
        numberOfQuestions: 3,
        questionType: 'mcq',
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      requiresSubscription: true,
    });
    expect(mockCreateCompletion).not.toHaveBeenCalled();
  });

  it('returns generated questions for valid authenticated requests', async () => {
    (createServerClient as jest.Mock).mockReturnValue(
      makeSupabaseMock({
        user: { id: 'u1', email: 'user@example.com' },
        subscription: {
          status: 'active',
          current_period_end: '2099-01-01T00:00:00.000Z',
        },
      }),
    );

    mockCreateCompletion.mockResolvedValue({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              questions: [
                {
                  id: 1,
                  question: 'What is React?',
                  options: ['A) Library', 'B) Database', 'C) Language', 'D) Browser'],
                  correctAnswer: 'A',
                  explanation: 'React is a UI library.',
                },
              ],
            }),
          },
        },
      ],
      usage: {
        prompt_tokens: 40,
        completion_tokens: 70,
        total_tokens: 110,
      },
    });

    const response = await POST(
      makeRequest({
        contentType: 'text',
        notes: 'React notes',
        numberOfQuestions: 3,
        questionType: 'mcq',
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.questions).toHaveLength(1);
    expect(body.metadata).toMatchObject({
      model: 'gpt-4o-mini',
    });
    expect(mockCreateCompletion).toHaveBeenCalledTimes(1);
  });
});
