"use client";

import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';

import Header from '@/app/components/Header';
import InputSection from '@/app/components/InputSection';
import QuestionsDisplay from '@/app/components/QuestionsDisplay';
import FlashCardsDisplay from '@/app/components/FlashCardsDisplay';
import { exportMCQToAnki, exportFlashCardsToAnki, downloadAnkiDeck } from '@/lib/exportUtils';
import { getCurrentUser, isAdmin, hasActiveSubscription, signOut, getFreeGenerationsUsed, hasAccessToGenerate } from '@/lib/auth';
import { Question, FlashCard } from '@/types';
import { FREE_GENERATION_LIMIT } from '@/lib/constants';
import { ParsedContent } from '@/lib/fileParser';

export default function Home() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [numberOfQuestions, setNumberOfQuestions] = useState(25);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [flashcards, setFlashcards] = useState<FlashCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [questionType, setQuestionType] = useState<'mcq' | 'flashcard'>('mcq');
  const [isFreeTier, setIsFreeTier] = useState(false);
  const [freeGenerationsLeft, setFreeGenerationsLeft] = useState(0);
  const [generationId, setGenerationId] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { user, error } = await getCurrentUser();
        console.log('1. User:', user?.email);

        if (!user || error) {
          router.push('/login');
          return;
        }

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

        const freeUsed = await getFreeGenerationsUsed(user.id);
        console.log('5. freeUsed:', freeUsed);

        setIsFreeTier(true);
        setFreeGenerationsLeft(FREE_GENERATION_LIMIT - freeUsed);
        console.log('6. freeGenerationsLeft:', freeGenerationsLeft);

      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthError('Connection error. Please try again.');
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleDownloadAnki = () => {
    let tsvContent = "";
    let fileName = "";
    if (questionType === 'mcq' && questions.length > 0) {
      tsvContent = exportMCQToAnki(questions);
      fileName = "mcq-anki-deck";
    } else if (questionType === 'flashcard' && flashcards.length > 0) {
      tsvContent = exportFlashCardsToAnki(flashcards);
      fileName = "flashcard-anki-deck";
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

  const generateQuestions = async (content: ParsedContent) => {
    setError("");
    setQuestions([]);
    setFlashcards([]);

    setLoading(true);
    try {
      const response = await fetch("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType: content.type,
          notes: content.text,
          images: content.images,
          numberOfQuestions,
          questionType,
        }),
      });

      if (response.status === 413) {
        setError("Files are too large. Try uploading fewer files or reducing image quality.");
        return;
      }

      const data = await response.json();

      if (response.ok) {
        if (questionType === 'flashcard') {
          setFlashcards(data.cards || []);
          setQuestions([]);
        } else {
          setQuestions(data.questions || []);
          setFlashcards([]);
        }
        setGenerationId(prev => prev + 1);

        if (isFreeTier) {
          setFreeGenerationsLeft(prev => {
            return prev - 1;
          });
        }
      } else {
        setError(data.error || "Failed to generate questions");
      }
    } catch (error: any) {
      console.error("Fetch error:", error);
      if (error.name === 'AbortError') {
        setError("Request timed out. The server may be starting up. Please try again.");
      } else if (error.message?.toLowerCase().includes('body') || error.message?.toLowerCase().includes('size')) {
        setError("Files are too large. Try uploading fewer files or reducing image quality.");
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white text-xl">Checking authentication...</p>
      </div>
    );
  }

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
        <Header onSignOut={handleSignout} />

        {isFreeTier && freeGenerationsLeft > 0 && (
          <div className="bg-blue-900/30 border border-blue-500 rounded-2xl p-4 mb-4">
            <p className="text-blue-300">
              Free trial: <strong>{freeGenerationsLeft}</strong> generation{freeGenerationsLeft !== 1 ? 's' : ''} remaining
            </p>
          </div>
        )}

        <InputSection
          numberOfQuestions={numberOfQuestions}
          setNumberOfQuestions={setNumberOfQuestions}
          questionType={questionType}
          setQuestionType={setQuestionType}
          onGenerate={generateQuestions}
          loading={loading}
          setLoading={setLoading}
          setError={setError}
        />

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-8">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {questions.length > 0 && (
          <QuestionsDisplay
            questions={questions}
            generationId={generationId}
            onDownloadAnki={handleDownloadAnki}
          />
        )}

        {flashcards.length > 0 && (
          <FlashCardsDisplay 
            flashcards={flashcards}
            generationId={generationId}
            onDownloadAnki={handleDownloadAnki}
          />
        )}
      </div>
    </div >
  );
}