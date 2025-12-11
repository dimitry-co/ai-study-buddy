// App-wide constants

const ADMIN_EMAILS = [
    'gallegodimitry@gmail.com',
    'khinethandrazaw1998.ktz@gmail.com'
  ];
  
const FREE_GENERATION_LIMIT = 4;

// Question generation limits
const MAX_QUESTIONS = 60;  // Keeps API response time reasonable (~30 seconds)
const MIN_QUESTIONS = 0;

// File size limits (in bytes)
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024; // 20MB

// Supported file types
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const SUPPORTED_TEXT_TYPES = ['text/plain'];
const SUPPORTED_PDF_TYPES = ['application/pdf'];

// Max pages to process from PDF (cost control)
const MAX_PDF_PAGES = 15;

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
  MAX_PDF_PAGES 
};