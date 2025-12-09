import { useState, useEffect } from 'react';
import QuestionCard from './QuestionCard';
import { Question } from '@/types';

interface QuestionsDisplayProps {
  questions: Question[];
  generationId: number;
  onDownloadAnki: () => void;
}

const QuestionsDisplay = (props: QuestionsDisplayProps) => {
  const [userSelections, setUserSelections] = useState<{ [key: number]: string }>({});
  const [showAnswers, setShowAnswers] = useState<{ [key: number]: boolean }>({});
  const [score, setScore] = useState(0);

  // Reset state when generationId changes
  useEffect(() => {
    setShowAnswers({});
    setUserSelections({});
    setScore(0);
  }, [props.generationId]);

  const handleOptionSelected = (questionId: number, selectedOption: string) => {
    setUserSelections(prev => ({
      ...prev,
      [questionId]: selectedOption
    }));
  };

  const showAnswersAndScore = () => {
    // calulate score 
    let correctCount = 0;
    props.questions.forEach(q => {
      const userAnswer = userSelections[q.id];
      if (userAnswer && userAnswer.startsWith(q.correctAnswer)) {
        correctCount++;
      }
    });
    setScore(correctCount);

    // Show all answers
    const allAnswers = props.questions.reduce((acc, q) => {
      acc[q.id] = true; // set all to true
      return acc;
    }, {} as { [key: number]: boolean });
    setShowAnswers(allAnswers);
  };

  if (props.questions.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">
          {props.questions.length} Questions
        </h2>
        <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold">
          Score: {score} / {props.questions.length}
        </div>
        <button
          onClick={showAnswersAndScore}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
        >
          Show Answers and Score
        </button>
        <button
          onClick={props.onDownloadAnki}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
        >
          Download MCQ Anki Deck
        </button>
      </div>

      {props.questions.map((q, index) => (
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
  )
};

export default QuestionsDisplay;