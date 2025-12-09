// Define the structure of a question
interface Question {
    id: number;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
}

interface FlashCard {
    id: number;
    question: string;
    answer: string;
    hint?: string;
}

export type { Question, FlashCard };