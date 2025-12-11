import { useState, useEffect } from 'react';
import FlashCard from './FlashCard';
import FlashCardExportOptions from './FlashCardExportOptions';
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
        <h2 className="text-2xl font-bold text-white">
          {props.flashcards.length} Flashcards
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={props.onDownloadAnki}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Anki Deck
          </button>
          <FlashCardExportOptions flashcards={props.flashcards} />
        </div>
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
