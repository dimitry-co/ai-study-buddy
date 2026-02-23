# AI Study Buddy Architecture

## Overview

AI Study Buddy is a Next.js App Router application that generates study material (MCQs and flashcards) from text, images, and PDFs. The core flow is:

1. User uploads notes or enters text.
2. Client parses input into either plain text or image data URLs.
3. Client calls `POST /api/generate-questions`.
4. API enforces auth, access limits, file/image limits, and question limits.
5. API calls OpenAI and returns structured JSON questions/cards.
6. UI renders results and supports export workflows.

## Core Components

- `src/app/page.tsx`
  - Main authenticated experience.
  - Handles auth gating, generation request lifecycle, and display state.
- `src/app/components/InputSection.tsx`
  - Upload/text input UX.
  - Frontend guardrails for file count/type/size and direct image-file limits.
- `src/lib/fileParser.ts`
  - Input normalization layer.
  - Images: compress to JPEG data URLs.
  - PDFs: render pages to images (capped by page limit).
  - Text files: pass-through text extraction.
- `src/app/api/generate-questions/route.ts`
  - Server entrypoint for question/card generation.
  - Auth + subscription/free-tier checks.
  - Validation, batching, OpenAI call(s), response validation, and error mapping.
- `src/lib/constants.ts`
  - Centralized operational limits and batching configuration.

## Generation Pipeline

### Input Modes

- `text`: uses text-only prompts.
- `images`: uses Vision-style content payload with image data URLs (and optional text context).

### Batching Strategy

- Triggered when requested questions meet `BATCH_THRESHOLD`.
- Uses `NUM_BATCHES` parallel calls.
- Distributes requested count evenly using:
  - `base = floor(total / batches)`
  - `remainder = total % batches`
  - First `remainder` batches receive `base + 1`; others receive `base`.
- Applies one focus profile per batch (`BATCH_FOCUSES`) to improve diversity and reduce duplicate-style outputs.

### Response Validation

- Detects truncation (`finish_reason === "length"`).
- Detects suspicious low-output generations.
- Validates question/card schema before returning success.

## Guardrails and Limits

Defined in `src/lib/constants.ts` and enforced across UI + API:

- Question count range.
- Max file size and max file count.
- Max PDF pages processed per PDF.
- Max direct image files and max total images (post-parse).
- Free-tier usage checks and subscription checks server-side.

## Error Model

Common categories:

- `400`: validation failures (bad limits, missing content).
- `401`: unauthorized.
- `403`: subscription required / free tier exhausted.
- `413`: payload/response truncation constraints.
- `422`: generation completed but output unusable.
- `500`: server-side or provider errors.

Frontend surfaces API-provided messages in a single, consistent error panel.

## Testing Strategy

Current baseline includes component tests (`src/app/__tests__/page.test.tsx`).

Recommended target coverage:

1. Unit tests
   - Prompt builders, file validation helpers, batching split helper.
2. Integration tests
   - `POST /api/generate-questions` for:
     - auth failure
     - validation failures
     - batching path
     - truncation/low-output handling
3. E2E tests (Playwright)
   - login -> upload -> generate -> render/export.

## Operational Notes

- Keep limits in `constants.ts`; avoid scattering hardcoded numbers.
- Keep logs focused on debugging/ops events (batch sizing, token usage, truncation).
- Prefer comments that explain design intent ("why"), not obvious code behavior ("what").
