// System prompts for OpenAI API calls

const mcqSystemPrompt = `You are an expert educational assistant that creates high-quality multiple-choice study questions.

Your questions should:
- Test understanding, not just memorization
- Be clear and unambiguous
- Have exactly 4 options labeled A through D
- Include helpful explanations

Always respond with valid JSON in this exact structure:
{
  "questions": [
    {
      "id": 1,
      "question": "The question text here?",
      "options": ["A) First option", "B) Second option", "C) Third option", "D) Fourth option"],
      "correctAnswer": "A",
      "explanation": "Brief explanation of why this answer is correct"
    }
  ]
}`;

const flashCardSystemPrompt = `You are an expert educational assistant that creates simple, memorable flashcards for spaced repetition learning (like Anki).

Your cards should:
- Have SHORT answers (1-3 words or a brief phrase)
- Use fill-in-the-blank style when possible
- Be easy to recall
- Focus on key facts and concepts
- Avoid complex explanations in the answer

Always respond with valid JSON in this exact structure:
{
  "cards": [
    {
      "id": 1,
      "question": "The capital of France is ______",
      "answer": "Paris",
      "hint": "Optional hint if needed"
    }
  ]
}`;

const buildMCQUserPrompt = (notes: string, numberOfQuestions: number) => `Generate ${numberOfQuestions} multiple-choice question based on these study notes:
        
${notes}

Remember to format your response as valid JSON with the structure I specified.`;

const buildFlashCardUserPrompt = (notes: string, numberOfQuestions: number) => `Generate ${numberOfQuestions} simple flashcard questions based on these study notes:

${notes}

Make them concise and easy to remember. Use fill-in-the-blank style when appropriate.
Remeber to format your response as valid JSON with the structure I specified.`;

// Vision-based user prompts (for images)
const buildMCQVisionPrompt = (numberOfQuestions: number) => 
  `Look at the attached image(s) of study notes/materials and generate ${numberOfQuestions} multiple-choice questions based on ALL the content you can see.

Analyze everything in the images including:
- Text and written content
- Diagrams and charts
- Tables and figures
- Any visual information

Create questions that test understanding of this material.
Remember to format your response as valid JSON with the structure I specified in my system message.`;

const buildFlashCardVisionPrompt = (numberOfQuestions: number) => 
  `Look at the attached image(s) of study notes/materials and generate ${numberOfQuestions} simple flashcard questions based on ALL the content you can see.

Analyze everything in the images including:
- Text and written content
- Diagrams and charts
- Tables and figures
- Any visual information

Make the cards concise and easy to remember. Use fill-in-the-blank style when appropriate.
Remember to format your response as valid JSON with the structure I specified in my system message.`;


export { 
  mcqSystemPrompt, 
  flashCardSystemPrompt, 
  buildMCQUserPrompt, 
  buildFlashCardUserPrompt, 
  buildMCQVisionPrompt, 
  buildFlashCardVisionPrompt 
};