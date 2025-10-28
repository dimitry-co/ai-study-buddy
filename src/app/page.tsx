"use client";

import { useState } from "react";
import QuestionCard from "./components/QuestionCard";
import { validateFile, extractTextFromFile } from '@/lib/fileParser';
import { exportMCQToAnki, exportSimpleCardsToAnki, downloadAnkiDeck } from '@/lib/ankiExport';

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
  const [notes, setNotes] = useState("");
  const [numberOfQuestions, setNumberOfQuestions] = useState(25);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [simpleCards, setSimpleCards] = useState<SimpleCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState(0);
  const [userSelections, setUserSelections] = useState<{[key: number]: string}>({});
  const [showAnswers, setShowAnswers] = useState<{[key: number]: boolean}>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text'); // Track which input mode
  const [questionType, setQuestionType] = useState<'mcq' | 'simple' | 'both'>('mcq');



  const handleOptionSelected= (questionId: number, selectedOption: string) => {
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
      }, {} as {[key: number]: boolean});
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
  }

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

      const data = await response.json();

      if (response.ok) {
        if (questionType === 'simple') {
          setSimpleCards(data.cards || []);
          setQuestions([]); // Clear MCQ questions
        } else { // MCQ
          setQuestions(data.questions || []);
          setSimpleCards([]);
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

  return (
    <div className="min-h-screen bg-gray-900/70 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">AI Study Buddy</h1>
        </div>

        {/* Input Sections */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
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
                className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
                  inputMode === 'file'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Upload File
              </button>
              <button
                onClick={() => setInputMode('text')}
                className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
                  inputMode === 'text'
                  ? 'bg-blue-600 text-white'
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
              onChange={(e) => setQuestionType(e.target.value as 'mcq' | 'simple' | 'both')}
              className="w-64 p-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
            >
              <option value="mcq">Multiple Choice Questions (MCQ)</option>
              <option value="simple">Anki Cards (Fill in the Blank)</option>
              <option value="both">Both Types</option>
            </select>
          </div>

          <div className="flex justify-center">
            <button
              onClick={generateQuestions}
              disabled={loading || (inputMode === 'text' ? !notes.trim() : !selectedFile)}
              className="w-full max-w-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors"
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
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Show Answers and Score
              </button>
              <button
                onClick={handleDownloadAnki}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
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
                onToggleAnswer={(show) => setShowAnswers(prev => ({...prev, [q.id]: show}))}
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
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
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

                <div className="border-t border-gray-700 pt-4">
                  <span className="text-green-400 font-semibold">Answer:</span>
                  <p className="text-white mt-1">{card.answer}</p>
                  {card.hint && (
                    <p className="text-gray-400 text-sm mt-2">Hint: {card.hint}</p>
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
