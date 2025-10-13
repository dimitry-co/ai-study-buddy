'use client';

import { useState } from 'react';

export default function Home() {
  const [notes, setNotes] = useState('');
  const [numberOfQuestions, setNumberOfQuestions] = useState(25);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateQuestions = async () => {
    // Clear previous state (errors, questions)
    setError('');
    setQuestions([]);

    // validate input (notes)
    if (!notes.trim()) {
      setError('Please enter some notes');
      return;
    }

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

    } catch (error) {
      setError('Network error, Please try again.');

    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">
            🎓 AI Study Buddy
          </h1>
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
              {loading ? '🔄 Generating Questions...' : '✨ Generate Questions'}
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
            <h2 className="text-2xl font-bold text-white mb-4">
              Questions ({questions.length})
            </h2>

            {questions.map((q, index) => (
              <div key={index} className="bg-gray-800 rounded-lg shadow-lg p-6">
                 <span className="inline-block bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded-full mb-2">
                  Question {index + 1}
                 </span>

                 <h3 className="text-lg font-semibold text-white mb-4">
                  {q.question}
                 </h3>

                 <div>
                  {q.options.map(Option, i) => (
                    <div>
                      {option}
                    </div>
                  )}
                 </div> 
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
