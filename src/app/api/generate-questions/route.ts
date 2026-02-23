import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ADMIN_EMAILS, FREE_GENERATION_LIMIT, MAX_QUESTIONS, MIN_QUESTIONS, MAX_IMAGES, BATCH_THRESHOLD, NUM_BATCHES, BATCH_FOCUSES } from '@/lib/constants';
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const buildVisionContent = (images: string[], textPrompt: string): any[] => {
  const content: any[] = [
    { type: 'text', text: textPrompt }
  ];

  for (const image of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: image,
        detail: 'high'
      }
    });
  }

  return content;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = ADMIN_EMAILS.includes(user.email!);
  let isSubscribed = false;
  let freeUsed = 0;

  if (!isAdmin) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    isSubscribed = !!(subscription && 
      (subscription.status === 'active' || subscription.status === 'canceled') &&
      new Date(subscription.current_period_end) > new Date());

    if (!isSubscribed) {
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
      contentType,
      notes,
      images,
      numberOfQuestions = 30, 
      questionType = 'mcq'
    } = body;

    if (numberOfQuestions < MIN_QUESTIONS || numberOfQuestions > MAX_QUESTIONS) {
      return NextResponse.json(
        { error: `Number of questions must be between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}` },
        { status: 400 },
      );
    }

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
    
    // Guard Vision requests against runaway token usage.
    if (contentType === 'images' && images.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Too many images. Maximum ${MAX_IMAGES} total images allowed (from PDFs and image files combined). Try uploading fewer files or reducing PDF page count.` },
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

    const systemPrompt = questionType === 'mcq' ? mcqSystemPrompt : flashCardSystemPrompt;

    let result;
    let totalTokensUsed = 0;
    
    if (numberOfQuestions >= BATCH_THRESHOLD) {
      // ===== BATCHING MODE (10+ questions) =====
      console.log(`Using batching: ${numberOfQuestions} questions split into ${NUM_BATCHES} batches`);
      
      if (contentType === 'images' && images && images.length > 10) {
        console.warn(`Large image count (${images.length} images). Performance may be slower.`);
      }
      
      // Calculate balanced distribution across batches
      const baseSize = Math.floor(numberOfQuestions / NUM_BATCHES);
      const remainder = numberOfQuestions % NUM_BATCHES;
      
      // Create parallel batch requests
      const batchPromises = Array.from({ length: NUM_BATCHES }, (_, i) => {
        // First 'remainder' batches get +1 extra question
        const questionsInThisBatch = i < remainder ? baseSize + 1 : baseSize;
        
        // Add batch-specific focus to system prompt
        const batchFocus = BATCH_FOCUSES[i];
        const batchSystemPrompt = systemPrompt + `\n\nIMPORTANT: ${batchFocus.instruction}`;
        
        // Build user prompt with batch question count for this batch
        let batchUserContent: any;
        if (questionType === 'mcq') {
          if (contentType === 'images') {
            const promptText = 
              notes && notes.trim().length > 0
                ? buildMCQVisionPromptWithText(questionsInThisBatch, notes)
                : buildMCQVisionPrompt(questionsInThisBatch);
            batchUserContent = buildVisionContent(images, promptText);
          } else {
            batchUserContent = buildMCQUserPrompt(notes, questionsInThisBatch);
          }
        } else { // flashcard
          if (contentType === 'images') {
            const promptText =
              notes && notes.trim().length > 0
                ? buildFlashCardVisionPromptWithText(questionsInThisBatch, notes)
                : buildFlashCardVisionPrompt(questionsInThisBatch);
            batchUserContent = buildVisionContent(images, promptText);
          } else {
            batchUserContent = buildFlashCardUserPrompt(notes, questionsInThisBatch);
          }
        }
        
        // Keep a larger output budget for vision-heavy requests.
        const estimatedTokensNeeded = questionType === 'mcq' 
          ? questionsInThisBatch * 250 + 1000
          : questionsInThisBatch * 120 + 600;
        
        console.log(`  Batch ${i + 1} (${batchFocus.name}): ${questionsInThisBatch} questions, max_tokens: ${Math.min(estimatedTokensNeeded, 16000)}`);
        
        return openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: batchSystemPrompt },
            { role: "user", content: batchUserContent },
          ],
          temperature: 0.8,
          max_tokens: Math.min(estimatedTokensNeeded, 16000),
          response_format: { type: "json_object" },
        });
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      const allQuestions: any[] = [];
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;
      
      for (let i = 0; i < batchResults.length; i++) {
        const completion = batchResults[i];
        const finishReason = completion.choices[0]?.finish_reason;
        const batchCompletionTokens = completion.usage?.completion_tokens || 0;
        const responseContent = completion.choices[0]?.message?.content;
        
        if (finishReason === 'length') {
          console.error(`Batch ${i + 1} truncated! Finish reason: length`);
          return NextResponse.json(
            { 
              error: `Batch ${i + 1} exceeded token limit. The request is too large. Try requesting fewer questions or uploading smaller files.`,
            },
            { status: 413 }
          );
        }
        
        if (batchCompletionTokens < 50) {
          console.error(`Batch ${i + 1} returned suspiciously low tokens: ${batchCompletionTokens}`);
          return NextResponse.json(
            { 
              error: `Batch ${i + 1} failed to generate properly. The content may be too complex. Try reducing the number of questions.`,
            },
            { status: 422 }
          );
        }
        
        if (!responseContent) {
          throw new Error(`Batch ${i + 1} returned no response`);
        }
        
        try {
          const parsed = JSON.parse(responseContent);
          const batchQuestions = questionType === 'mcq' 
            ? (parsed.questions || parsed)
            : (parsed.cards || parsed);
          
          // Ensure IDs are sequential after merging batch outputs.
          const renumbered = batchQuestions.map((q: any, idx: number) => ({
            ...q,
            id: allQuestions.length + idx + 1
          }));
          
          allQuestions.push(...renumbered);
        } catch (parseError) {
          console.error(`Batch ${i + 1} parse error:`, parseError);
          console.error(`Batch ${i + 1} response preview:`, responseContent?.substring(0, 200));
          return NextResponse.json(
            { 
              error: `Batch ${i + 1} returned invalid response. The content may be too complex or the request too large. Try requesting fewer questions.`,
            },
            { status: 500 }
          );
        }
        
        totalPromptTokens += completion.usage?.prompt_tokens || 0;
        totalCompletionTokens += batchCompletionTokens;
      }
      
      totalTokensUsed = totalPromptTokens + totalCompletionTokens;
      console.log('=== Batched OpenAI Token Usage ===');
      console.log('Requested questions:', numberOfQuestions);
      console.log('Total batches:', NUM_BATCHES);
      console.log('Total prompt tokens:', totalPromptTokens);
      console.log('Total completion(output) tokens:', totalCompletionTokens);
      console.log('Total tokens:', totalTokensUsed);
      console.log('Questions received:', allQuestions.length);
      console.log('==================================');
      
      const trimmedQuestions = allQuestions.slice(0, numberOfQuestions);
      
      if (questionType === 'mcq') {
        result = { questions: trimmedQuestions };
      } else {
        result = { cards: trimmedQuestions };
      }
      
    } else {
      // ===== SINGLE REQUEST MODE (<10 questions) =====
      console.log(`📝 Using single request: ${numberOfQuestions} questions`);
      
      let userContent: any;
      if (questionType === 'mcq') {
        if (contentType === 'images') {
          const promptText = 
            notes && notes.trim().length > 0
              ? buildMCQVisionPromptWithText(numberOfQuestions, notes)
              : buildMCQVisionPrompt(numberOfQuestions);
          userContent = buildVisionContent(images, promptText);
        } else {
          userContent = buildMCQUserPrompt(notes, numberOfQuestions);
        }
      } else { // flashcard
        if (contentType === 'images') {
          const promptText =
            notes && notes.trim().length > 0
              ? buildFlashCardVisionPromptWithText(numberOfQuestions, notes)
              : buildFlashCardVisionPrompt(numberOfQuestions);
          userContent = buildVisionContent(images, promptText);
        } else {
          userContent = buildFlashCardUserPrompt(notes, numberOfQuestions);
        }
      }
      
      const estimatedTokensNeeded = questionType === 'mcq' 
        ? numberOfQuestions * 200 + 500
        : numberOfQuestions * 100 + 500;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.7,
        max_tokens: Math.min(estimatedTokensNeeded, 16000),
        response_format: { type: "json_object" },
      });
      
      totalTokensUsed = completion.usage?.total_tokens || 0;
      console.log('=== OpenAI Token Usage ===');
      console.log('Requested questions:', numberOfQuestions);
      console.log('Max tokens allowed:', Math.min(estimatedTokensNeeded, 16000));
      console.log('Prompt tokens:', completion.usage?.prompt_tokens);
      console.log('Completion(output) tokens:', completion.usage?.completion_tokens);
      console.log('Total tokens:', totalTokensUsed);
      console.log('Finish reason:', completion.choices[0]?.finish_reason);
      console.log('==========================');

      const responseContent = completion.choices[0]?.message?.content;

      if (!responseContent) {
        throw new Error("No response from OpenAI");
      }

      try {
        const parsed = JSON.parse(responseContent);

        if (questionType === 'flashcard') {
          result = { cards: parsed.cards || parsed };
        } else {
          result = { questions: parsed.questions || parsed };
        }
      } catch (parseError) {
        console.error("JSON Parse Error Details:", parseError);
        throw new Error("Invalid response format from OpenAI");
      }
      console.log('Questions received:', questionType === 'mcq' ? result.questions?.length : result.cards?.length);

      const finishReason = completion.choices[0]?.finish_reason;
      const completionTokens = completion.usage?.completion_tokens || 0;
      
      if (finishReason === 'length') {
        console.error('Response truncated due to token limit!');
        const receivedCount = questionType === 'mcq' ? result.questions?.length : result.cards?.length;
        return NextResponse.json(
          { 
            error: `Request exceeded token limit. Received ${receivedCount} of ${numberOfQuestions} questions. Try requesting fewer questions.`,
            truncated: true,
            received: receivedCount,
            requested: numberOfQuestions
          },
          { status: 413 }
        );
      }
      
      if (completionTokens < 100 && numberOfQuestions >= 5) {
        console.error(`Suspiciously low completion tokens: ${completionTokens}`);
        return NextResponse.json(
          { 
            error: `Failed to generate questions. The image may be too complex or unclear. Try a different image or reduce the number of questions.`,
          },
          { status: 422 }
        );
      }
    }

    if (questionType === 'mcq') {
      if (result.questions.length === 0) {
        throw new Error("OpenAI returned no questions");
      }

      for (let i = 0; i < result.questions.length; i++) {
        const q = result.questions[i];

        if (!q.id || !q.question || !q.options || !q.correctAnswer || !q.explanation) {
          throw new Error("Invalid question structure from OpenAI");
        }

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

    if (questionType === 'flashcard') {
      if (result.cards.length === 0) {
        throw new Error("OpenAI returned no cards");;
      }

      for (let i = 0; i < result.cards.length; i++) {
        const c = result.cards[i];

        if (!c.id || !c.question || !c.answer) {
          throw new Error("Invalid card structure from OpenAI");
        }

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

    if (!isAdmin && !isSubscribed) {
      await supabase
        .from('profiles')
        .update({ free_generations_used: freeUsed + 1 })
        .eq('id', user.id)
    }

    return NextResponse.json(
      {
        ...result,
        metadata: {
          numberOfQuestions: result.questions ? result.questions.length : result.cards ? result.cards.length : 0,
          model: "gpt-4o-mini",
          tokensUsed: totalTokensUsed,
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error generating questions:", error);

    if (error?.status === 401) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 500 });
    }

    if (error?.status === 429) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Failed to generate questions. Please try again." },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {
          },
        },
      }
    );

    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    return NextResponse.json({
      status: "Api route is working",
      endpoint: "/api/generate-questions",
      method: "POST",
      description: "Generate study questions from notes using OpenAI",
      supabase: "keep-alive pinged",
    });
  } catch (error) {
    return NextResponse.json({
      status: "Api route is working",
      endpoint: "/api/generate-questions",
      method: "POST",
      description: "Generate study questions from notes using OpenAI",
      supabase: "keep-alive pinged",
    });
  }
}