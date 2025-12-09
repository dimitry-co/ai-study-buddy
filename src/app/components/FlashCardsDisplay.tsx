import { useState, useEffect } from 'react';
import FlashCard from './FlashCard';
import { FlashCard as FlashCardType } from '@/types';

interface FlashCardsDisplayProps {
  flashcards: FlashCardType[];
  generationId: number;
  onDownloadAnki: () => void;
}

const FlashCardsDisplay = (props: FlashCardsDisplayProps) => {
  const [showAnswers, setShowAnswers] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    setShowAnswers({});
  }, [props.generationId]);

  if (props.flashcards.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white mb-4">
          {props.flashcards.length} Flashcards
        </h2>
        <button
          onClick={props.onDownloadAnki}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
        >
          Download Anki Deck
        </button>
      </div>
      {props.flashcards.map((card, index) => (
        <FlashCard
          key={card.id}
          question={card.question}
          answer={card.answer}
          hint={card.hint}
          cardNumber={index + 1}
          showAnswer={showAnswers[card.id] || false}
          onToggleAnswer={() => setShowAnswers(prev => ({ ...prev, [card.id]: !prev[card.id]}))}
        />
      ))}
    </div>
  )
};

export default FlashCardsDisplay;
