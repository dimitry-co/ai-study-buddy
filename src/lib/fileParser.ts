/**
 * File Parser - Handles PDF, Images, and Text files
 * PDFs and Images → converted to base64 images for Vision API
 * Text files → extracted as plain text
 */

import {
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_MB,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_TEXT_TYPES,
  SUPPORTED_PDF_TYPES,
  MAX_PDF_PAGES,
  MAX_FILES
} from '@/lib/constants';

// Return type for parsed content
interface ParsedContent {
  type: 'text' | 'images';
  text?: string;
  images?: string[]; // based64 data URLS
}

/**
 * Main entry point - detects file type and routes to correct parser
 */
const parseFile = async (file: File): Promise<ParsedContent> => {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  // IMAGE FILES -> convert to base64 images
  if (SUPPORTED_IMAGE_TYPES.includes(fileType) || /\.(jpg|jpeg|png|gif|webp)$/.test(fileName)) {
    const base64 = await fileToBase64(file);
    return { type: 'images', images: [base64] }; // return object with type and base64 image
  }

  // PDF FILES -> render pages as images
  if (SUPPORTED_PDF_TYPES.includes(fileType) || fileName.endsWith('.pdf')) {
    const images = await extractImagesFromPDF(file);
    return { type: 'images', images };
  }

  // TEXT FILES → extract text
  if (SUPPORTED_TEXT_TYPES.includes(fileType) || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
    const text = await file.text();
    return { type: 'text', text }; // return object with type and text
  }

  throw new Error('Unsupported file type.');
};

/**
 * Parse multiple files = combines images and text from all file
 * If both images and text are present, return images type with text included.
 */
const parseFiles = async (files: File[]): Promise<ParsedContent> => {
  if (files.length === 0) {
    throw new Error('No files provided.');
  }
  if (files.length > MAX_FILES) {
    throw new Error(`Maximum ${MAX_FILES} files allowed`);
  }

  const allImages: string[] = [];
  const allTexts: string[] = [];

  // Process each file
  for (const file of files) {
    const parsed = await parseFile(file);

    // Collect all images (from PDFs and images)
    if (parsed.type === 'images' && parsed.images) {
      allImages.push(...parsed.images);
    }
    else if (parsed.type === 'text' && parsed.text) {
      allTexts.push(parsed.text);
    }
  }


  // If we have images (even if we also have text), use Vision API
  // The text will be included in the prompr along with images
  if (allImages.length > 0) {
    const combinedText = allTexts.length > 0 
      ? allTexts.join('\n\n---\n\n') // Join multiple text files with separator
      : undefined;
    return {
      type: 'images',
      images: allImages,
      text: combinedText // Include text if available
    }
  }

  // Only text files = combine and return as text type
  if (allTexts.length > 0) {
    return { type: 'text', text: allTexts.join('\n\n---\n\n')}
  }

  throw new Error('No valid content extracted from files (text or images).');
};

/**
 * Convert any file to base64 data URL (its a string that represents the file in base64 format)
 * Uses async/await with arrayBuffer instead of callback-based FileReader
 */
const fileToBase64 = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer(); // Read file as binary data (1s and 0s)
  const bytes = new Uint8Array(arrayBuffer); // Converts to an array of numbers (0-255), where each number is one byte
  
  // Convert bytes to binary string
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  
  // Encode to base64 and build data URL
  const base64 = btoa(binary);
  const mimeType = file.type || 'application/octet-stream';
  
  return `data:${mimeType};base64,${base64}`; // Wrap it as a data URL that the OpenAI API understands
};


/**
 * Render PDF pages as images using pdfjs-dist
 */
const extractImagesFromPDF = async (file: File): Promise<string[]> => {
  // Dynamic import - only load pdfjs-dist when actually parsing PDF (client-side only)
  const pdfjsLib = await import('pdfjs-dist');

  // Set up the worker 
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer(); // Convert file to array buffer (binary data)
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer }); // Create a loading task to load the PDF document
  const pdf = await loadingTask.promise; // Wait for the loading task to complete and get the PDF document

  const images: string[] = []; // Will store base64 data URLs for each page (images of the pages). base64 is a string that represents the image in base64 format.
  const pagesToProcess = Math.min(pdf.numPages, MAX_PDF_PAGES); // Limit to MAX_PDF_PAGES to control cost

  // Extract text from each page. 
  for (let i = 1; i <= pagesToProcess; i++) {
    const page = await pdf.getPage(i);

    // Scale the page to 1.5x its original size to improve OCR accuracy (OCR = Optical Character Recognition. this helps with text recognition)
    const scale = 1.5;
    const viewport = page.getViewport({ scale }); // Get the viewport (the visible area of the page)

    // Create a canvas to render the page (A canvas is a HTML element that can be used to draw graphics on the screen.)
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d'); // Get the context (the object that allows you to draw on the canvas. its part of the canvas object. its a 2D context. it allows you to draw shapes, text, images, etc. on the canvas.)

    if (!context) {
      throw new Error('Failed to create canvas context.');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    // Convert canvas to base64 JPEG (smaller than PNG), because its smaller and faster to send to the server.
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    images.push(base64);
  }

  return images;
};

/**
 * Validate file before parsing
 */
const validateFile = (file: File): { valid: boolean; error?: string } => {
  const fileName = file.name.toLowerCase();

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size must be less than ${MAX_FILE_SIZE_MB}MB` };
  }

  // check file type
  const isValidType =
    SUPPORTED_IMAGE_TYPES.includes(file.type) ||
    SUPPORTED_TEXT_TYPES.includes(file.type) ||
    SUPPORTED_PDF_TYPES.includes(file.type) ||
    fileName.endsWith('.pdf') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md') ||
    /\.(jpg|jpeg|png|gif|webp)$/.test(fileName);


  return { valid: isValidType, error: isValidType ? undefined : 'Supported formats PDF, Images (JPG, PNG, GIF, WEBP), and Text (TXT, MD)' };
};

/**
  * Get human readable file type
*/
const getFileTypeLabel = (file: File): string => {
  const fileName = file.name.toLowerCase();

  if (SUPPORTED_IMAGE_TYPES.includes(file.type) || /\.(jpg|jpeg|png|gif|webp)$/.test(fileName)) {
    return 'Image';
  }
  if (SUPPORTED_PDF_TYPES.includes(file.type) || fileName.endsWith('.pdf')) {
    return 'PDF';
  }
  if (SUPPORTED_TEXT_TYPES.includes(file.type) || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
    return 'Text';
  }
  return 'Unknown';
};

export { parseFile, parseFiles, validateFile, getFileTypeLabel };
export type { ParsedContent };