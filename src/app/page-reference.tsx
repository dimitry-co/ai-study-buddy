'use client';

import { useState } from 'react';

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export default function Home() {
  const [notes, setNotes] = useState('');
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateQuestions = async () => {
    // Clear previous results
    setError('');
    setQuestions([]);
    setLoading(true);

    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        setError(data.error || 'Failed to generate questions');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            🎓 AI Study Buddy
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Transform your notes into practice questions instantly
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <div className="mb-4">
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2"
            >
              Your Study Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste your study notes here..."
              className="w-full h-40 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="numberOfQuestions"
              className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2"
            >
              Number of Questions
            </label>
            <input
              id="numberOfQuestions"
              type="number"
              min="1"
              max="20"
              value={numberOfQuestions}
              onChange={(e) => setNumberOfQuestions(parseInt(e.target.value))}
              className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <button
            onClick={generateQuestions}
            disabled={loading || !notes.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
          >
            {loading ? '🔄 Generating Questions...' : '✨ Generate Questions'}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-8">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Questions Display */}
        {questions.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              📝 Generated Questions ({questions.length})
            </h2>

            {questions.map((q, index) => (
              <div
                key={q.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6"
              >
                <div className="mb-4">
                  <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-semibold px-3 py-1 rounded-full mb-2">
                    Question {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {q.question}
                  </h3>
                </div>

                <div className="space-y-2 mb-4">
                  {q.options.map((option, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        option.startsWith(q.correctAnswer)
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                          : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <span className="font-medium text-gray-900 dark:text-white">
                        {option}
                      </span>
                      {option.startsWith(q.correctAnswer) && (
                        <span className="ml-2 text-green-600 dark:text-green-400 text-sm">
                          ✓ Correct
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                    💡 Explanation:
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    {q.explanation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
