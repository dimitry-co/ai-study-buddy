// App-wide constants

const ADMIN_EMAILS = [
    'gallegodimitry@gmail.com',
    'khinethandrazaw1998.ktz@gmail.com'
  ];
  
const FREE_GENERATION_LIMIT = 4;

// Question generation limits
const MAX_QUESTIONS = 60;  // Keeps API response time reasonable (~30 seconds)
const MIN_QUESTIONS = 1;

// File size limits (in bytes)
// Conservative limit - even small files can generate large token counts with Vision API
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024; // 10MB

// Supported file types
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const SUPPORTED_TEXT_TYPES = ['text/plain'];
const SUPPORTED_PDF_TYPES = ['application/pdf'];

// Max pages to process from PDF (cost control & API token limits)
// 15 pages = ~550K-1.6M tokens (safe for batching, fast response times)
const MAX_PDF_PAGES = 15;

// Max number of files that can be uploaded at once
const MAX_FILES = 10;

// Max total images that can be sent to Vision API (includes PDF pages)
// Each image can use 15K-40K tokens depending on complexity
// 15 images balances speed, stability, and cost (~35s for 30 questions)
const MAX_IMAGES = 15;

// Max regular image files (not PDFs) that can be uploaded
// Stricter limit for direct image uploads
const MAX_IMAGE_FILES = 5;

// Batching configuration
const BATCH_THRESHOLD = 10; // Start batching if requesting 10+ questions
const NUM_BATCHES = 3;      // Always use 3 batches for maximum diversity

// Batch focuses for diverse question generation
const BATCH_FOCUSES = [
  {
    name: "Fundamentals",
    instruction: "Focus on definitions, key terms, basic concepts, and foundational knowledge. Ask questions about 'what' things are and 'when' they apply."
  },
  {
    name: "Application", 
    instruction: "Focus on practical applications, real-world examples, use cases, and how concepts are applied. Ask questions about 'how' to use concepts and 'in what situations' they apply."
  },
  {
    name: "Analysis",
    instruction: "Focus on comparisons, relationships between concepts, cause-and-effect, and critical analysis. Ask questions about 'why' things work, 'compare and contrast', and 'what would happen if'."
  }
];

export { 
  ADMIN_EMAILS, 
  FREE_GENERATION_LIMIT,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  MAX_FILE_SIZE, 
  MAX_FILE_SIZE_MB, 
  SUPPORTED_IMAGE_TYPES, 
  SUPPORTED_TEXT_TYPES, 
  SUPPORTED_PDF_TYPES, 
  MAX_PDF_PAGES,
  MAX_FILES,
  MAX_IMAGES,
  MAX_IMAGE_FILES,
  BATCH_THRESHOLD,
  NUM_BATCHES,
  BATCH_FOCUSES
};