"use client";

// Force dynamic rendering - prevents build-time prerendering (pdfjs-dist needs browser APIs)
export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import QuestionCard from "./components/QuestionCard";
import { validateFile, extractTextFromFile } from '@/lib/fileParser';
import { exportMCQToAnki, exportSimpleCardsToAnki, downloadAnkiDeck } from '@/lib/ankiExport';
import { getCurrentUser, isAdmin, hasActiveSubscription, signOut, getFreeGenerationsUsed, hasAccessToGenerate } from '@/lib/auth';

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface SimpleCard {
  id: number;
  question: string;
  answer: string;
  hint?: string;
}

export default function Home() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true); // Loading state for auth checks
  const [authError, setAuthError] = useState("");
  const [notes, setNotes] = useState("");
  const [numberOfQuestions, setNumberOfQuestions] = useState(25);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [simpleCards, setSimpleCards] = useState<SimpleCard[]>([]);
  const [loading, setLoading] = useState(false);  // Loading state for question generation
  const [error, setError] = useState("");
  const [score, setScore] = useState(0);
  const [userSelections, setUserSelections] = useState<{ [key: number]: string }>({});
  const [showAnswers, setShowAnswers] = useState<{ [key: number]: boolean }>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text'); // Track which input mode
  const [questionType, setQuestionType] = useState<'mcq' | 'simple'>('mcq');
  const [isFreeTier, setIsFreeTier] = useState(false);
  const [freeGenerationsLeft, setFreeGenerationsLeft] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { user, error } = await getCurrentUser();
        console.log('1. User:', user?.email);

        // Not logged in - redirect to login if not logged in
        if (!user || error) {
          router.push('/login');
          return;
        }

        // check if user has access to generate questions
        const canAccess = await hasAccessToGenerate(user.id, user.email!);
        console.log('2. canAccess:', canAccess);

        if (!canAccess) {
          router.push('/subscribe');
          return;
        }

        setIsAuthorized(true);

        const userIsAdmin = await isAdmin(user.email!);
        console.log('3. userIsAdmin:', userIsAdmin);
        if (userIsAdmin) {
          return;
        }

        const isSubscribed = await hasActiveSubscription(user.id);
        console.log('4. isSubscribed:', isSubscribed);
        if (isSubscribed) {
          return;
        }

        // Not admin, not subscribed -> free tier (check how many generations left)
        const freeUsed = await getFreeGenerationsUsed(user.id);
        console.log('5. freeUsed:', freeUsed);

        // User is on free tier with generations left
        setIsFreeTier(true);
        setFreeGenerationsLeft(2 - freeUsed);
        console.log('6. freeGenerationsLeft:', freeGenerationsLeft);

      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthError('Connection error. Please try again.'); // Network errors
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleOptionSelected = (questionId: number, selectedOption: string) => {
    setUserSelections(prev => ({
      ...prev,
      [questionId]: selectedOption
    }));
  };

  const showAnswersAndScore = () => {
    // calulate score 
    let correctCount = 0;

    questions.forEach(q => {
      const userAnswer = userSelections[q.id];
      if (userAnswer && userAnswer.startsWith(q.correctAnswer)) {
        correctCount++;
      }
    });

    setScore(correctCount);

    // Show all answers
    const allAnswers = questions.reduce((acc, q) => {
      acc[q.id] = true; // set all to true
      return acc;
    }, {} as { [key: number]: boolean });
    setShowAnswers(allAnswers);
  };

  // Download Anki Deck
  const handleDownloadAnki = () => {
    let tsvContent = "";
    let fileName = "";
    if (questionType === 'mcq' && questions.length > 0) {
      tsvContent = exportMCQToAnki(questions);
      fileName = "mcq-anki-deck";
    } else if (questionType === 'simple' && simpleCards.length > 0) {
      tsvContent = exportSimpleCardsToAnki(simpleCards);
      fileName = "simple-anki-deck";
    } else {
      setError("No questions to export");
      return;
    }
    downloadAnkiDeck(tsvContent, fileName);
  };

  const handleSignout = async () => {
    await signOut();
    router.push('/login');
  };

  const generateQuestions = async () => {
    // Clear previous state (errors, questions)
    setError("");
    setQuestions([]);
    setSimpleCards([]);
    setScore(0);
    setUserSelections({});
    setShowAnswers({});

    let contentToSend = "";

    // Handle text mode input
    if (inputMode === 'text') {
      if (!notes.trim()) {
        setError("Please enter some notes");
        return;
      }
      contentToSend = notes
    }

    // Handle file mode input
    if (inputMode === 'file') {
      if (!selectedFile) {
        setError("Please select a file");
        return;
      }

      // 1. Validate file
      const validation = validateFile(selectedFile);
      if (!validation.valid) {
        setError(validation.error || "Invalid file.");
        return;
      }
      // 2. Extract text from file
      try {
        setLoading(true);
        contentToSend = await extractTextFromFile(selectedFile);
      } catch (err: any) {
        setError(err.message || "Failed to parse file.");
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes: contentToSend,
          numberOfQuestions,
          questionType,
        }),
      });

      const data = await response.json(); // We don't receive all the data at once, we receive it in chunks. so we need to wait for the data to be fully received. this line uses await, receives the data and parses it into a JavaScript object.

      if (response.ok) {
        if (questionType === 'simple') {
          setSimpleCards(data.cards || []);
          setQuestions([]); // Clear MCQ questions
        } else { // MCQ
          setQuestions(data.questions || []);
          setSimpleCards([]);
        }
        console.log('Before decrement - isFreeTier:', isFreeTier);

        // Update free tier counter in UI
        if (isFreeTier) {
          //setFreeGenerationsLeft(prev => prev - 1);
          setFreeGenerationsLeft(prev => {
            console.log('Decrementing from', prev, 'to', prev - 1);
            return prev - 1;
          });
        }
      } else {
        setError(data.error || "Failed to generate questions");
      }
    } catch (error) {
      setError("Network error, Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Loading state for authentication 
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-xl">Checking authentication...</p>
      </div>
    );
  }

  //Error state if network failed (with retry option)
  if (authError && !isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Redirect to login if not authorized
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-xl">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900/70 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-white">AI Study Buddy</h1>
            <button
              onClick={handleSignout}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-3xl font-semibold transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>

        {isFreeTier && freeGenerationsLeft > 0 && (
          <div className="bg-blue-900/30 border border-blue-500 rounded-2xl p-4 mb-4">
            <p className="text-blue-300">
              Free trial: <strong>{freeGenerationsLeft}</strong> generation{freeGenerationsLeft !== 1 ? 's' : ''} remaining
            </p>
          </div>
        )}

        {/* Input Sections */}
        <div className="bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <div className="mb-6">
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Upload Notes (PDF, PowerPoint, or Text)
            </label>

            {/* Input Method Selection Buttons */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setInputMode('file')}
                className={`flex-1 py-3 px-6 rounded-3xl font-semibold transition-all cursor-pointer ${inputMode === 'file'
                  ? 'bg-white text-gray-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
              >
                Upload File
              </button>
              <button
                onClick={() => setInputMode('text')}
                className={`flex-1 py-3 px-6 rounded-3xl font-semibold transition-all cursor-pointer ${inputMode === 'text'
                  ? 'bg-white text-gray-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
              >
                Text
              </button>
            </div>

            {/* Conditionally render input based on mode */}
            {inputMode === 'text' && (
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste your notes here..."
                className="w-full h-40 p-4 border border-gray-700 bg-gray-800 text-white rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}

            {inputMode === 'file' && (
              <label
                htmlFor="file-upload"
                className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer block"
              >
                <input
                  id="file-upload"
                  type='file'
                  accept='.pdf,.txt'
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSelectedFile(file);
                  }}
                  className="hidden"
                />
                <div className="text-gray-400">
                  <p className="mt-4">Click to browse files or drag and drop here</p>

                </div>
                {selectedFile && (
                  <p className="text-blue-400 mt-2">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </label>
            )}
          </div>

          {/* Number of Question Selector */}
          <div className="mb-6">
            <label
              htmlFor="numQuestions"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Number of Questions
            </label>
            <input
              id="numQuestions"
              type="number"
              value={numberOfQuestions}
              onChange={(e) => setNumberOfQuestions(parseInt(e.target.value))}
              min="1"
              max="100"
              className="w-32 p-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Question Type Selector */}
          <div className="mb-6">
            <label
              htmlFor="questionType"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Question Type
            </label>
            <select
              id="questionType"
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value as 'mcq' | 'simple')}
              className="w-64 p-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
            >
              <option value="mcq">Multiple Choice Questions</option>
              <option value="simple">Anki Cards (Fill in the Blank)</option>
            </select>
          </div>

          <div className="flex justify-center">
            <button
              onClick={generateQuestions}
              disabled={loading || (inputMode === 'text' ? !notes.trim() : !selectedFile)}
              className="w-full max-w-sm bg-white hover:bg-gray-200 active:bg-gray-300 cursor-pointer disabled:bg-gray-500 disabled:cursor-not-allowed disabled:hover:bg-gray-500 text-gray-900 font-semibold py-3 rounded-3xl transition-colors"
            >
              {loading ? "Generating Questions..." : "Generate Questions"}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-8">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Questions Display */}
        {questions.length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">
                {questions.length} Questions
              </h2>
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold">
                Score: {score} / {questions.length}
              </div>
              <button
                onClick={showAnswersAndScore}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
              >
                Show Answers and Score
              </button>
              <button
                onClick={handleDownloadAnki}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
              >
                Download MCQ Anki Deck
              </button>
            </div>

            {questions.map((q, index) => (
              <QuestionCard
                key={q.id}
                question={q.question}
                options={q.options}
                correctAnswer={q.correctAnswer}
                explanation={q.explanation}
                questionNumber={index + 1}
                showAnswer={showAnswers[q.id] || false}
                onToggleAnswer={(show) => setShowAnswers(prev => ({ ...prev, [q.id]: show }))}
                onOptionSelected={(option) => handleOptionSelected(q.id, option)}
              />
            ))}
          </div>
        )}

        {/* Simple Cards Display  */}
        {simpleCards.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white mb-4">
                {simpleCards.length} Flashcards
              </h2>
              <button
                onClick={handleDownloadAnki}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
              >
                Download Anki Deck
              </button>
            </div>

            {simpleCards.map((card, index) => (
              <div
                key={card.id}
                className="bg-gray-800 rounded-lg shadow-lg p-6"
              >
                <div className="mb-4">
                  <span className="text-blue-400 font-semibold"> Card {index + 1}</span>
                  <p className="text-white text-lg mt-2">{card.question}</p>
                </div>

                {showAnswers[card.id] && (
                  <div className="p-3 border-t border-gray-700 pt-4">
                    <span className="text-green-400 font-semibold">Answer:</span>
                    <p className="text-white mt-1">{card.answer}</p>
                    {card.hint && (
                      <p className="text-gray-400 text-sm mt-2">Hint: {card.hint}</p>
                    )}
                  </div>)}

                {/* Show Answer Button */}
                <button
                  onClick={() => {
                    setShowAnswers(prev => ({ ...prev, [card.id]: !showAnswers[card.id] }))
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-gray-200 font-semibold py-2 px-6 rounded-3xl transition-colors border border-slate-600 cursor-pointer"
                >
                  {showAnswers[card.id] ? "Hide Answer" : "Show Answer"}
                </button>

              </div>
            ))}

          </div>
        )}
      </div>
    </div >
  );
}
