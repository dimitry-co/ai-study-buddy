"use client";

import { useState } from "react";
import QuestionCard from "./components/QuestionCard";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export default function Home() {
  const [notes, setNotes] = useState("");
  const [numberOfQuestions, setNumberOfQuestions] = useState(25);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState(0);
  const [userSelections, setUserSelections] = useState<{[key: number]: string}>({});

  const handleOptionSelected= (questionId: number, selectedOption: string) => {
    setUserSelections(prev => ({
      ...prev,
      [questionId]: selectedOption
    }));
  };

  const showAllAnswers = () => {
    // calulate score for all questions
    let correctCount = 0;

    questions.forEach(q => {
      const userAnswer = userSelections[q.id];
      if (userAnswer && userAnswer.startsWith(q.correctAnswer)) {
        correctCount++;
      }
    });
    console.log('correctCount:', correctCount); 
    setScore(correctCount);
  };

  const generateQuestions = async () => {
    // Clear previous state (errors, questions)
    setError("");
    setQuestions([]);
    setScore(0);
    setUserSelections({});

    // validate input (notes)
    if (!notes.trim()) {
      setError("Please enter some notes");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes,
          numberOfQuestions,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setQuestions(data.questions);
      } else {
        setError(data.error || "Failed to generate questions");
      }
    } catch (error) {
      setError("Network error, Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900/70 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">🎓 AI Study Buddy</h1>
        </div>

        {/* Input Sections */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <div className="mb-6">
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Your Study Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste your study notes here Thel..."
              className="w-full h-40 p-4 border border-gray-700 bg-gray-800 text-white rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

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

          <div className="flex justify-center">
            <button
              onClick={generateQuestions}
              disabled={loading || !notes.trim()}
              className="w-full max-w-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors"
            >
              {loading ? "Generating Questions..." : "✨ Generate Questions"}
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
                onClick={showAllAnswers}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                Show Answers and Score
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
                onOptionSelected={(option) => handleOptionSelected(q.id, option)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
