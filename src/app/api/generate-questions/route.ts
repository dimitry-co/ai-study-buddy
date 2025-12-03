import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

interface Card {
  id: number;
  question: string;
  answer: string;
  hint?: string;
}

// POST handler - receives and logs the notes (for now)
export async function POST(request: NextRequest) {


  // Get Next.js cookies (browser sent auth cookies with request)
  const cookieStore = await cookies();

  // Create Supabase server-side client (can READ auth cookies/ has access to request cookies)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Tell supabase HOW to read cookies from Next.js (this function called by supabase to read all cookies from request)
        getAll() {
          return cookieStore.getAll(); // Provide this function to supabase (Gets all cookies from request)
        },
        // Tell supabase HOW to write new cookies (if needed)
        setAll(cookiesToSet) {      // This function called by supabase to set all cookies in response
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  // Check if user is logged in (has auth cookie)
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if admin
  const ADMIN_EMAILS = ['gallegodimitry@gmail.com', 'khinethandrazaw1998.ktz@gmail.com'];
  const isAdmin = ADMIN_EMAILS.includes(user.email!); // '!' means we know user.email is not null (because we checked for authError above)
  let isSubscribed = false;
  let freeUsed = 0;

  if (!isAdmin) {
    // Check subscription in database
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }) // order where the lastest subscription record is first
      .limit(1) // get only the lastest subscription record
      .single(); // return as single object (not an array)

    // Check if active and not expired (is subscribed). (!! converts any value to boolean so null -> false)
    isSubscribed = !!(subscription && 
      (subscription.status === 'active' || subscription.status === 'canceled') &&
      new Date(subscription.current_period_end) > new Date());

    if (!isSubscribed) {
      // Check free tier limit
      const { data: profile } = await supabase
        .from('profiles')
        .select('free_generations_used')
        .eq('id', user.id)
        .single();
      
      freeUsed = profile?.free_generations_used || 0;

      if (freeUsed >= 2) {
        return NextResponse.json({
          error: 'Free trial ended. Please subscribe to continue studying.',
          requiresSubscription: true
        }, {status: 403});
      }
    }
  }

  try {
    const body = await request.json();
    const { notes, numberOfQuestions = 50, questionType = 'mcq' } = body;

    // Validate input
    if (!notes || notes.trim().length === 0) {
      return NextResponse.json(
        { error: "Notes are required" },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    // Prompt for OpenAI - system prompt and user prompt
    // system prompt - Set the behavior and rule of the model
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

    const simpleCardSystemPrompt = `You are an expert educational assistant that creates simple, memorable flashcards for spaced repetition learning (like Anki).

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

    let userPrompt = ""; // User Prompt - The specific task with their data
    let systemPrompt = "";

    if (questionType === 'mcq') {
      systemPrompt = mcqSystemPrompt;
      userPrompt = `Generate ${numberOfQuestions} multiple-choice question based on these study notes:
        
${notes}

Remember to format your response as valid JSON with the structure I specified.`;
    }

    if (questionType === 'simple') {
      systemPrompt = simpleCardSystemPrompt;
      userPrompt = `Generate ${numberOfQuestions} simple flashcard questions based on these study notes:
${notes}


Make them concise and easy to remember. Use fill-in-the-blank style when appropriate.
Remeber to format your response as valid JSON with the structure I specified.`;
    }

    if (questionType === 'both') {
      // for 'both' we need to two API calls or a comnined prompt
      // Start w. simple approach: just do MCQ for now, expand later
      systemPrompt = mcqSystemPrompt;
      userPrompt = `Generate ${numberOfQuestions} multiple-choice question based on these study notes:
        
${notes}

Remember to format your response as valid JSON with the structure I specified.`;
    }

    // Call OpenAI API
    console.log("Calling OpenAI API...");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    // Extract the generated questions from OpenAI response
    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    let result;
    try {
      const parsed = JSON.parse(responseContent);

      if (questionType === 'simple') {
        result = { cards: parsed.cards || parsed };
      } else {
        result = { questions: parsed.questions || parsed }; // Handle different possible response structures - Try to get questions from wrapper object, fallback to array if not found
      }
    } catch (parseError) {
      console.error("JSON Parse Error Details:", parseError); // Technical details
      throw new Error("Invalid response format from OpenAI"); // High-level message caught by outer catch block
    }
    // Validate we got questions
    if (questionType === 'mcq') {
      if (result.questions.length === 0) {
        throw new Error("OpenAI returned no questions");
      }

      // Validate each question structure
      for (let i = 0; i < result.questions.length; i++) {
        const q = result.questions[i];

        // check all required fields exist
        if (!q.id || !q.question || !q.options || !q.correctAnswer || !q.explanation) {
          throw new Error("Invalid question structure from OpenAI");
        }

        // Check types
        if (typeof q.id !== "number") {
          throw new Error(`Question ${i + 1}: id must be a number`);
        }
        if (typeof q.question !== "string") {
          throw new Error(`Question ${i + 1}: question must be a string`);
        }
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          throw new Error(
            `Question ${i + 1}: options must be an array with exactly 4 items`,
          );
        }
        if (typeof q.correctAnswer !== "string") {
          throw new Error(`Question ${i + 1}: correctAnswer must be a string`);
        }
        if (typeof q.explanation !== "string") {
          throw new Error(`Question ${i + 1}: explanation must be a string`);
        }
      }
    }

    // Validate cards
    if (questionType === 'simple') {
      if (result.cards.length === 0) {
        throw new Error("OpenAI returned no cards");;
      }

      // Validate each card structure
      for (let i = 0; i < result.cards.length; i++) {
        const c = result.cards[i];

        // Check all required field exist
        if (!c.id || !c.question || !c.answer) {
          throw new Error("Invalid card structure from OpenAI");
        }

        // Check Types
        if (typeof c.id !== "number") {
          throw new Error(`Card ${i + 1}: id must be a number`);
        }
        if (typeof c.question !== "string") {
          throw new Error(`Card ${i + 1}: questions must be a string`);
        }
        if (typeof c.answer !== "string") {
          throw new Error(`Card ${i + 1}: answer must be a string`);
        }
        if (c.hint && typeof c.hint !== "string") {
          throw new Error(`Card ${i + 1}: hint must be a string if provided`);
        }
      }
    }

    // Increment free generations used (only for free tier)
    if (!isAdmin && !isSubscribed) {
      await supabase
        .from('profiles')
        .update({ free_generations_used: freeUsed + 1 })
        .eq('id', user.id)
    }

    // Return the questions to the frontend
    return NextResponse.json(
      {
        ...result,
        metadata: {
          numberOfQuestions: result.questions ? result.questions.length : result.cards ? result.cards.length : 0,
          model: "gpt-4o-mini",
          tokensUsed: completion.usage?.total_tokens || 0,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    // Log detailed error for YOU (server console)
    console.error("Error generating questions:", error);

    // OpenAI thew this (bad API key)
    if (error?.status === 401) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 500 });
    }

    // OpenAI thow this (rate limit exceeded)
    if (error?.status === 429) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 },
      );
    }

    // Generic error response
    return NextResponse.json(
      { error: "Failed to generate questions. Please try again." },
      { status: 500 },
    );
  }
}

// GET handler for health check
export async function GET() {
  return NextResponse.json({
    status: "Api route is working",
    endpoint: "/api/generate-questions",
    method: "POST",
    description: "Generate study questions from notes using OpenAI",
  });
}