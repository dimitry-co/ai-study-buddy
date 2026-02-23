import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Home from '../page';
import {
  getCurrentUser,
  getFreeGenerationsUsed,
  hasAccessToGenerate,
  hasActiveSubscription,
  isAdmin,
} from '@/lib/auth';

const pushMock = jest.fn();
const routerMock = { push: pushMock };

jest.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

jest.mock('@/lib/auth', () => ({
  getCurrentUser: jest.fn(),
  getFreeGenerationsUsed: jest.fn(),
  hasAccessToGenerate: jest.fn(),
  hasActiveSubscription: jest.fn(),
  isAdmin: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@/lib/exportUtils', () => ({
  exportMCQToAnki: jest.fn(() => 'anki-content'),
  exportFlashCardsToAnki: jest.fn(() => 'anki-content'),
  downloadAnkiDeck: jest.fn(),
}));

jest.mock('@/app/components/InputSection', () => {
  function MockInputSection(props: any) {
    return (
      <button onClick={() => props.onGenerate({ type: 'text', text: 'sample notes' })}>
        Trigger Generate
      </button>
    );
  }

  return MockInputSection;
});

jest.mock('@/app/components/QuestionsDisplay', () => {
  function MockQuestionsDisplay(props: any) {
    return <div>Questions: {props.questions.length}</div>;
  }

  return MockQuestionsDisplay;
});

jest.mock('@/app/components/FlashCardsDisplay', () => {
  function MockFlashCardsDisplay(props: any) {
    return <div>Flashcards: {props.flashcards.length}</div>;
  }

  return MockFlashCardsDisplay;
});

const mockedGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockedHasAccessToGenerate = hasAccessToGenerate as jest.MockedFunction<typeof hasAccessToGenerate>;
const mockedIsAdmin = isAdmin as jest.MockedFunction<typeof isAdmin>;
const mockedHasActiveSubscription = hasActiveSubscription as jest.MockedFunction<typeof hasActiveSubscription>;
const mockedGetFreeGenerationsUsed = getFreeGenerationsUsed as jest.MockedFunction<typeof getFreeGenerationsUsed>;

describe('Home page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as any;
    jest.spyOn(console, 'log').mockImplementation(() => {});

    mockedGetCurrentUser.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com' } as any,
      error: null,
    });
    mockedHasAccessToGenerate.mockResolvedValue(true);
    mockedIsAdmin.mockResolvedValue(false);
    mockedHasActiveSubscription.mockResolvedValue(true);
    mockedGetFreeGenerationsUsed.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('redirects to login when not authenticated', async () => {
    mockedGetCurrentUser.mockResolvedValue({
      user: null as any,
      error: new Error('Unauthorized') as any,
    });

    render(<Home />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  it('redirects to subscribe when user has no access', async () => {
    mockedHasAccessToGenerate.mockResolvedValue(false);

    render(<Home />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/subscribe');
    });
  });

  it('renders the main app for subscribed users', async () => {
    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('AI Study Buddy')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Free trial:/)).not.toBeInTheDocument();
  });

  it('shows and decrements free-trial generations after successful generation', async () => {
    mockedHasActiveSubscription.mockResolvedValue(false);
    mockedGetFreeGenerationsUsed.mockResolvedValue(1); // 3 left out of 4.
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        questions: [
          {
            id: 1,
            question: 'What is React?',
            options: ['A) lib', 'B) db', 'C) tool', 'D) lang'],
            correctAnswer: 'A',
            explanation: 'React is a library.',
          },
        ],
      }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText(/Free trial:/)).toBeInTheDocument();
      expect(screen.getByText(/3/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Trigger Generate'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Questions: 1')).toBeInTheDocument();
    });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body as string);
    expect(requestBody).toMatchObject({
      contentType: 'text',
      notes: 'sample notes',
      numberOfQuestions: 25,
      questionType: 'mcq',
    });

    await waitFor(() => {
      expect(screen.getByText(/Free trial:/)).toBeInTheDocument();
      expect(screen.getByText('2', { selector: 'strong' })).toBeInTheDocument();
      expect(screen.getByText(/generations remaining/i)).toBeInTheDocument();
    });
  });

  it('shows API errors to the user', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Failed to generate questions' }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Trigger Generate')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Trigger Generate'));

    await waitFor(() => {
      expect(screen.getByText('Failed to generate questions')).toBeInTheDocument();
    });
  });
});
