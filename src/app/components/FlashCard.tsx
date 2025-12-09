interface FlashCardProps {
  question: string;
  answer: string;
  hint?: string;
  cardNumber: number;
  showAnswer: boolean;
  onToggleAnswer: () => void;
}

const FlashCard = (props: FlashCardProps) => {
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <span className="text-blue-400 font-semibold"> Card {props.cardNumber}</span>
        <p className="text-white text-lg mt-2">{props.question}</p>
      </div>

      {props.showAnswer && (
        <div className="p-3 border-t border-gray-700 pt-4">
          <span className="text-green-400 font-semibold">Answer:</span>
          <p className="text-white mt-1">{props.answer}</p>
          {props.hint && (
            <p className="text-gray-400 text-sm mt-2">Hint: {props.hint}</p>
          )}
        </div>)}

      {/* Show Answer Button */}
      <button
        onClick={props.onToggleAnswer}
        className="bg-slate-700 hover:bg-slate-600 text-gray-200 font-semibold py-2 px-6 rounded-3xl transition-colors border border-slate-600 cursor-pointer"
      >
        {props.showAnswer ? "Hide Answer" : "Show Answer"}
      </button>
    </div>
  );
};

export default FlashCard;