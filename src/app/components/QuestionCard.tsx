interface QuestionCardProps {
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    questionNumber: number;
}

const QuestionCard = (props: QuestionCardProps) => {
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
                {props.options.map((option, i) => (
                    <div
                        key={i}
                        className={`p-3 rounded-lg border ${option.startsWith(props.correctAnswer)
                                ? 'bg-green-900/30 border-green-500 text-green-200'
                                : 'bg-gray-700 border-gray-600 text-gray-300'
                            }`}
                    >
                        {option}
                        {option.startsWith(props.correctAnswer) && (
                            <span className="ml-2 text-green-400">
                                Correct
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* Explanation */}
            <div className="bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-sm font-medium text-blue-200 mb-1">
                    Explanation:
                </p>
                <p className="text-sm text-blue-300">
                    {props.explanation}
                </p>
            </div>
        </div>
    )
}

export default QuestionCard;