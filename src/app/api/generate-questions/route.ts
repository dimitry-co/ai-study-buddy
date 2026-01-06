import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ADMIN_EMAILS, FREE_GENERATION_LIMIT } from '@/lib/constants';
import {
  mcqSystemPrompt,
  flashCardSystemPrompt,
  buildMCQUserPrompt,
  buildFlashCardUserPrompt,
  buildMCQVisionPrompt,
  buildFlashCardVisionPrompt,
  buildMCQVisionPromptWithText,
  buildFlashCardVisionPromptWithText,
} from '@/lib/prompts';

// Initialize OpenAI client with API key from env variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper: Build Vision API content array
const buildVisionContent = (images: string[], textPrompt: string): any[] => {
  const content: any[] = [
    { type: 'text', text: textPrompt }
  ];

  for (const image of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: image, // Already has "data:image/...;base64,..." format from fileParser
        detail: 'high' // high detail for better OCR (OCR = Optical Character Recognition. this helps with text recognition)
      }
    });
  }

  return content;
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
  const isAdmin = ADMIN_EMAILS.includes(user.email!); // '!' means we know user.email is not null (because we checked for authError above)
  let isSubscribed = false;
  let freeUsed = 0;

  if (!isAdmin) {
    // Check subscription in database
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })  // order where the lastest subscription record is first
      .limit(1)                                   // get only the lastest subscription record
      .single();                                  // return as single object (not an array)

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

      if (freeUsed >= FREE_GENERATION_LIMIT) {
        return NextResponse.json({
          error: 'Free trial ended. Please subscribe to continue studying.',
          requiresSubscription: true
        }, {status: 403});
      }
    }
  }

  try {
    const body = await request.json();
    const { 
      contentType,       // 'text' or 'images'
      notes,             // text content (if content type === 'text)
      images,            // base64 images array (if content type === 'images')
      numberOfQuestions = 50, 
      questionType = 'mcq'
    } = body;

    // Validate input - need either text or images
    if (contentType === 'text' && (!notes || notes.trim().length === 0)) {
      return NextResponse.json(
        { error: "Notes are required" },
        { status: 400 },
      );
    }
    if (contentType === 'images' && (!images || images.length === 0)) {
      return NextResponse.json(
        { error: "Images are required" },
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

    // Build prompts for OpenAI based on question type and content type. (Prompts for OpenAI - system prompt and user prompt (user prompt is the specific task with their data.  system prompt - Set the behavior and rule of the model))
    let systemPrompt = "";
    let userContent: any; // string for text-only, array of objects for Vision API

    if (questionType === 'mcq') {
      systemPrompt = mcqSystemPrompt;

      if (contentType == 'images') {
        // Vision API - send images with prompt (with or without text). (build content array with images and text prompt)
        const promptText = 
          notes && notes.trim().length > 0
            ? buildMCQVisionPromptWithText(numberOfQuestions, notes)      // images + text notes
            : buildMCQVisionPrompt(numberOfQuestions);                    // images only

        userContent = buildVisionContent(images, promptText);
      } else {
        // Text only - regular prompt
        userContent = buildMCQUserPrompt(notes, numberOfQuestions);
      }
    }

    if (questionType === 'flashcard') {
      systemPrompt = flashCardSystemPrompt;

      if (contentType === 'images') {
        const promptText =
          notes && notes.trim().length > 0
            ? buildFlashCardVisionPromptWithText(numberOfQuestions, notes)      // images + text notes
            : buildFlashCardVisionPrompt(numberOfQuestions);                    // images only

        userContent = buildVisionContent(images, promptText);  // array of objects
      } else {
        // Text-only mode
        userContent = buildFlashCardUserPrompt(notes, numberOfQuestions);
      }
    }

    // Call OpenAI API (works for both text and vision)
    // max_tokens scales with number of questions to prevent response cutoff
    // ~150 tokens per MCQ, ~80 tokens per flashcard, plus buffer
    const estimatedTokensNeeded = questionType === 'mcq' 
      ? numberOfQuestions * 200 + 500  // MCQ: ~200 tokens each + buffer
      : numberOfQuestions * 100 + 500; // Flashcard: ~100 tokens each + buffer
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.7,
      max_tokens: Math.min(estimatedTokensNeeded, 16000), // gpt-4o-mini max output is 16,384
      response_format: { type: "json_object" },
    });
    // Log token usage for debugging
    console.log('=== OpenAI Token Usage ===');
    console.log('Requested questions:', numberOfQuestions);
    console.log('Max tokens allowed:', Math.min(estimatedTokensNeeded, 16000));
    console.log('Prompt tokens:', completion.usage?.prompt_tokens);
    console.log('Completion tokens:', completion.usage?.completion_tokens);
    console.log('Total tokens:', completion.usage?.total_tokens);
    console.log('Finish reason:', completion.choices[0]?.finish_reason); // 'stop' = complete, 'length' = cut off!
    console.log('==========================');

    // Extract the generated questions from OpenAI response
    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    let result;
    try {
      const parsed = JSON.parse(responseContent);

      if (questionType === 'flashcard') {
        result = { cards: parsed.cards || parsed };
      } else {
        result = { questions: parsed.questions || parsed }; // Handle different possible response structures - Try to get questions from wrapper object, fallback to array if not found
      }
    } catch (parseError) {
      console.error("JSON Parse Error Details:", parseError); // Technical details
      throw new Error("Invalid response format from OpenAI"); // High-level message caught by outer catch block
    }

    // Log how many questions we actually got
    console.log('Questions received:', questionType === 'mcq' ? result.questions?.length : result.cards?.length);

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
    if (questionType === 'flashcard') {
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

// GET handler for health check and Supabase keep-alive
export async function GET() {
  try {
    // Create Supabase client to ping Supabase and keep it active
    // This doesn't require auth - just establishes a connection
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
            // No-op for keep-alive
          },
        },
      }
    );

    // Simple query to ping Supabase and keep it active
    // This is a lightweight query that doesn't require auth
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    // Even if it errors (no auth), the connection attempt keeps Supabase active
    // The query itself doesn't matter - just pinging Supabase keeps it active
    return NextResponse.json({
      status: "Api route is working",
      endpoint: "/api/generate-questions",
      method: "POST",
      description: "Generate study questions from notes using OpenAI",
      supabase: "keep-alive pinged",
    });
  } catch (error) {
    // Even if there's an error, Supabase was pinged, which is what we want
    return NextResponse.json({
      status: "Api route is working",
      endpoint: "/api/generate-questions",
      method: "POST",
      description: "Generate study questions from notes using OpenAI",
      supabase: "keep-alive pinged",
    });
  }
}