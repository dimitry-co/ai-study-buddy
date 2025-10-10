import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize OpenAI client with API key from env variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Define the structure of a question
interface Question {
    id: number;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
}

// POST handler - receives and logs the notes (for now)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('📥 Received body:', body); // DEBUG
        const { notes, numberOfQuestions = 10 } = body;
        console.log('📝 Extracted notes:', notes); // DEBUG
        console.log('🔢 Number of questions:', numberOfQuestions); // DEBUG

        // Validate input
        if (!notes || notes.trim().length === 0) {
            return NextResponse.json(
                { error: 'Notes are required'},
                { status: 400 }
            );
        }

        if (!process.env.OPENAI_API_KEY) {
            console.error('OpenAI API key is not configured');
            return NextResponse.json(
                { error: 'Server configuration error'},
                { status: 500}
            );
        }

        // Prompt for OpenAI - system prompt and user prompt
        // system prompt - Set the behavior and rule of the model
        const systemPrompt = `You are an expert educational assistant that creates high-quality multiple-choice study questions.

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
        // User Prompt - The specific task with their data
        const userPrompt = `Generate ${numberOfQuestions} multiple-choice question based on these study notes:
        
${notes}

Remember to format your response as valid JSON with the structure I specified.`;

        // Call OpenAI API
        console.log('Calling OpenAI API...');
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            response_format: { type: "json_object"},
        });
        // Extract the generated questions from OpenAI response
        const responseContent = completion.choices[0]?.message?.content;

        if (!responseContent) {
            throw new Error('No response from OpenAI');
        }

        // Parse the JSON response
        let questions: Question[];
        try {
            const parsed = JSON.parse(responseContent);
            // Handle different possible response structures - Try to get questions from wrapper object, fallback to array if not found
            questions = parsed.questions || parsed;

            if (!Array.isArray(questions)) {
                questions = [questions];
            }
        } catch (parseError) {
            console.error('JSON Parse Error Details:', parseError);  // Technical details
            throw new Error('Invalid response format from OpenAI');   // High-level message caught by outer catch block
        }

        // Return the questions to the frontend
        return NextResponse.json(
            {
                questions, 
                metadata: {
                    numberOfQuestions: questions.length,
                    model: 'gpt-4o-mini',
                    tokensUsed: completion.usage?.total_tokens || 0,
                }
            },
            { status: 200 }
        );


    } catch (error: any ) {
        // Log detailed error for YOU (server console)
        console.error('Error generating questions:', error);

        // OpenAI thew this (bad API key)
        if (error?.status === 401) {
            return NextResponse.json({ error: 'Invalid API key'}, { status: 500 });
        }

        // OpenAI thow this (rate limit exceeded)
        if (error?.status === 429) {
            return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.'}, { status: 429 });
        }

        // Generic error response
        return NextResponse.json(
            { 
                error: 'Failed to generate questions'
            },
            { status: 500 }
        );
    }
}

// GET handler for health check
export async function GET() {
    return NextResponse.json({
        status: 'Api route is working',
        endpoint: '/api/generate-questions',
        method: 'POST',
        description: 'Generate study questions from notes using OpenAI'
    });
}











// // 2. Lines 10-28: TypeScript interfaces (defines data structure)
// // Define the structure of incoming request
// interface GenerateQuestionsRequest {
//   notes: string;
//   numberOfQuestions?: number;
//   difficulty?: 'easy' | 'medium' | 'hard';
//   questionType?: 'multiple-choice' | 'short-answer' | 'true-false' | 'mixed';
// }

// // Define the structure of a question
// interface Question {
//   id: number;
//   question: string;
//   type: string;
//   options?: string[];
//   correctAnswer: string;
//   explanation?: string;
// }

// // Lines 38-60: Request handling and validation
// // POST handler - receives notes from frontend and returns generated questions
// export async function POST(request: NextRequest) {
//   try {
//     // Parse the request body
//     const body: GenerateQuestionsRequest = await request.json();
//     const { 
//       notes, 
//       numberOfQuestions = 5, 
//       difficulty = 'medium',
//       questionType = 'mixed'
//     } = body;

//     // Validate input
//     if (!notes || notes.trim().length === 0) {
//       return NextResponse.json(
//         { error: 'Notes are required' },
//         { status: 400 }
//       );
//     }

//     if (!process.env.OPENAI_API_KEY) {
//       console.error('OpenAI API key is not configured');
//       return NextResponse.json(
//         { error: 'Server configuration error' },
//         { status: 500 }
//       );
//     }

// // Lines 62-86: Prompt creation for OpenAI
//     const systemPrompt = `You are an expert educational assistant that creates high-quality study questions based on provided notes. 
// Generate ${numberOfQuestions} ${difficulty} difficulty ${questionType} questions based on the provided notes.

// Format your response as a JSON array of questions. Each question should have:
// - id: a unique number
// - question: the question text
// - type: the type of question (multiple-choice, short-answer, true-false)
// - options: array of answer choices (for multiple-choice and true-false)
// - correctAnswer: the correct answer
// - explanation: a brief explanation of why this is the correct answer

// Make sure the questions:
// 1. Test understanding of key concepts from the notes
// 2. Are clear and unambiguous
// 3. Have appropriate difficulty level
// 4. Cover different aspects of the material
// 5. Include helpful explanations`;

//     const userPrompt = `Here are the study notes:\n\n${notes}\n\nPlease generate ${numberOfQuestions} ${difficulty} difficulty ${questionType} questions.`;

// // Lines 85-94: The actual OpenAI API call
    // Call OpenAI API
    // console.log('Calling OpenAI API...');
    // const completion = await openai.chat.completions.create({
    //   model: 'gpt-4o-mini', // Using gpt-4o-mini for cost efficiency, you can change to 'gpt-4' for better quality
    //   messages: [
    //     { role: 'system', content: systemPrompt },
    //     { role: 'user', content: userPrompt }
    //   ],
    //   temperature: 0.7,
    //   response_format: { type: "json_object" },
    // });

// // Lines 96-106: Extracting and parsing the response
//     // Extract the generated questions from OpenAI response
//     const responseContent = completion.choices[0]?.message?.content;
    
//     if (!responseContent) {
//       throw new Error('No response from OpenAI');
//     }

    // // Parse the JSON response
    // let questions: Question[];
    // try {
    //   const parsed = JSON.parse(responseContent);
    //   // Handle different possible response structures
    //   questions = parsed.questions || parsed;
      
    //   // Ensure questions is an array
    //   if (!Array.isArray(questions)) {
    //     questions = [questions];
    //   }
    // } catch (parseError) {
    //   console.error('Failed to parse OpenAI response:', parseError);
    //   throw new Error('Invalid response format from OpenAI');
    // }

    // Return the questions to the frontend
    // return NextResponse.json({
    //   success: true,
    //   questions,
    //   metadata: {
    //     numberOfQuestions: questions.length,
    //     difficulty,
    //     questionType,
    //     model: 'gpt-4o-mini',
    //     tokensUsed: completion.usage?.total_tokens || 0,
    //   }
    // }, { status: 200 });

// // Lines 136-158: Error handling
//   } catch (error: any) {
//     console.error('Error generating questions:', error);

//     // Handle specific OpenAI errors
//     if (error?.status === 401) {
//       return NextResponse.json(
//         { error: 'Invalid API key' },
//         { status: 500 }
//       );
//     }

//     if (error?.status === 429) {
//       return NextResponse.json(
//         { error: 'Rate limit exceeded. Please try again later.' },
//         { status: 429 }
//       );
//     }

//     // Generic error response
//     return NextResponse.json(
//       { 
//         error: 'Failed to generate questions',
//         message: error?.message || 'Unknown error occurred'
//       },
//       { status: 500 }
//     );
//   }
// }

// // Optional: GET handler for health check
// export async function GET() {
//   return NextResponse.json({ 
//     status: 'API route is working',
//     endpoint: '/api/generate-questions',
//     method: 'POST',
//     description: 'Generates study questions from notes using OpenAI'
//   });
// }

