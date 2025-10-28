import { useState } from "react";
interface QuestionCardProps {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  questionNumber: number;
  showAnswer: boolean;
  onToggleAnswer: (show: boolean) => void;
  onOptionSelected: (option: string) => void;
}

const QuestionCard = (props: QuestionCardProps) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Question Number badge */}
      <span className="inline-block bg-blue-600 text-white text-sm font-semibold px-3 py-1 rounded-full mb-2">
        Question {props.questionNumber}
      </span>

      {/* Question Text */}
      <h3 className="text-lg font-semibold text-white mb-4">
        {props.question}
      </h3>

      {/* Options */}
      <div className="space-y-2 mb-4">
        {props.options.map((option, i) => {
          const isCorrect = option.startsWith(props.correctAnswer);
          const isSelected = selectedOption === option;
          const isUserWrong = props.showAnswer && isSelected && !isCorrect;
          const isUserCorrect = props.showAnswer && isSelected && isCorrect;
          const isRevealedAnswer = isCorrect && props.showAnswer

          return (
            <div
              key={i}
              onClick={() => {
                setSelectedOption(option)
                props.onOptionSelected(option)
              }}
              className={`p-3 rounded-lg border cursor-pointer ${
                isUserWrong // selected AND wrong AND answer shown -> red highlight
                  ? "bg-red-900/50 border-red-400 text-red-200"
                  :// selected AND correct AND answer shown -> special highlight
                    isUserCorrect
                      ? "bg-gradient-to-r from-blue-900/50 to-green-900/50 border-green-400 text-white"
                      : // If the option is selected (not shown yet) -> blue highlight
                        isSelected
                        ? "bg-blue-900/50 border-blue-400 text-blue-200"
                        : // correct AND shown(not selected) -> green
                          isRevealedAnswer
                          ? "bg-green-900/30 border-green-500 text-green-200"
                          : // Default: gray
                            "bg-gray-700 border-gray-600 text-gray-300"
              }`}
            >
              {option}
              {props.showAnswer && option.startsWith(props.correctAnswer) && (
                <span className="ml-2 text-green-400">Correct</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Show Answer Button */}
      <button
        onClick={() => {
          props.onToggleAnswer(!props.showAnswer);
        }}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
      >
        {props.showAnswer ? "Hide Answer" : "Show Answer"}
      </button>

      {/* Explanation */}
      {props.showAnswer && (
        <div className="bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded">
          <p className="text-sm font-medium text-blue-200 mb-1">Explanation:</p>
          <p className="text-sm text-blue-300">{props.explanation}</p>
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
