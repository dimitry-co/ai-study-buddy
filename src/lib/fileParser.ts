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

interface ParsedContent {
  type: 'text' | 'images';
  text?: string;
  images?: string[];
}

/**
 * Main entry point - detects file type and routes to correct parser
 */
const parseFile = async (file: File): Promise<ParsedContent> => {
  try {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    if (SUPPORTED_IMAGE_TYPES.includes(fileType) || /\.(jpg|jpeg|png|gif|webp)$/.test(fileName)) {
      const base64 = await compressAndEncodeImage(file);
      return { type: 'images', images: [base64] };
    }

    if (SUPPORTED_PDF_TYPES.includes(fileType) || fileName.endsWith('.pdf')) {
      const images = await extractImagesFromPDF(file);
      return { type: 'images', images };
    }

    if (SUPPORTED_TEXT_TYPES.includes(fileType) || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      const text = await file.text();
      return { type: 'text', text };
    }

    throw new Error('Unsupported file type.');
  } catch (error: any) {
    console.error('File parsing failed:', error);
    throw new Error(error.message || 'Failed to process file. Please try a different file.');
  }
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

  for (const file of files) {
    const parsed = await parseFile(file);

    if (parsed.type === 'images' && parsed.images) {
      allImages.push(...parsed.images);
    }
    else if (parsed.type === 'text' && parsed.text) {
      allTexts.push(parsed.text);
    }
  }

  if (allImages.length > 0) {
    const combinedText = allTexts.length > 0 
      ? allTexts.join('\n\n---\n\n')
      : undefined;
    return {
      type: 'images',
      images: allImages,
      text: combinedText
    }
  }

  if (allTexts.length > 0) {
    return { type: 'text', text: allTexts.join('\n\n---\n\n')}
  }

  throw new Error('No valid content extracted from files (text or images).');
};

/**
 * Compress and convert image to base64 data URL
 * Resizes large images and applies JPEG compression (same as PDF processing)
 */
const compressAndEncodeImage = async (file: File): Promise<string> => {
  try {
    console.log(`Compressing image: ${file.name}`);
    console.log(`   Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    const MAX_DIMENSION = 1920;
    let width = img.width;
    let height = img.height;

    if (width > height && width > MAX_DIMENSION) {
      height = Math.round((height / width) * MAX_DIMENSION);
      width = MAX_DIMENSION;
    } else if (height > MAX_DIMENSION) {
      width = Math.round((width / height) * MAX_DIMENSION);
      height = MAX_DIMENSION;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to create canvas context');
    }

    context.drawImage(img, 0, 0, width, height);

    // 0.85 keeps text readable while reducing payload size.
    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
    
    const compressedSize = compressedBase64.length / 1024 / 1024;
    console.log(`   New dimensions: ${width}×${height}`);
    console.log(`   Compressed size: ${compressedSize.toFixed(2)} MB`);
    console.log(`   Reduction: ${((1 - compressedSize / (file.size / 1024 / 1024)) * 100).toFixed(1)}%`);
    
    return compressedBase64;
  } catch (error) {
    console.error('Image compression failed:', error);
    throw new Error('Failed to process image. Please try a different file.');
  }
};

/**
 * Render PDF pages as images using pdfjs-dist
 */
const extractImagesFromPDF = async (file: File): Promise<string[]> => {
  try {
    console.log(`📄 Extracting PDF: ${file.name}`);
    console.log(`   Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    
    const pdfjsLib = await import('pdfjs-dist');

    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const images: string[] = [];
    const pagesToProcess = Math.min(pdf.numPages, MAX_PDF_PAGES);
    
    console.log(`   Total pages: ${pdf.numPages}`);
    if (pdf.numPages > MAX_PDF_PAGES) {
      console.warn(`   ⚠️  PDF truncated! Using first ${pagesToProcess} of ${pdf.numPages} pages`);
    } else {
      console.log(`   Processing: ${pagesToProcess} pages`);
    }

    for (let i = 1; i <= pagesToProcess; i++) {
      const page = await pdf.getPage(i);

      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Failed to create canvas context.');
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      }).promise;

      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      images.push(base64);
    }
    
    const totalSizeMB = images.reduce((sum, img) => sum + img.length, 0) / (1024 * 1024);
    const avgPageSizeMB = totalSizeMB / images.length;
    console.log(`   Generated ${images.length} page images`);
    console.log(`   Total compressed size: ${totalSizeMB.toFixed(2)} MB`);
    console.log(`   Avg per page: ${avgPageSizeMB.toFixed(2)} MB`);

    return images;
  } catch (error) {
    console.error('PDF extraction failed:', error);
    throw new Error('Failed to process PDF. The file may be corrupted or password-protected.');
  }
};

/**
 * Validate file before parsing
 */
const validateFile = (file: File): { valid: boolean; error?: string } => {
  const fileName = file.name.toLowerCase();

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size must be less than ${MAX_FILE_SIZE_MB}MB` };
  }

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