import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker - required for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Parse a file and extract its text content
 * Supports: PDF and TXT files (for now)
 */
const extractTextFromFile = async(file: File): Promise<string> => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    // Handle text files
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
        return await file.text();
    }

    // Handle PDF files
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({data: arrayBuffer});
        const pdf = await loadingTask.promise;
        
        let fullText = '';

        // Extract text from each page
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            fullText += pageText + '\n'; // Add newline between pages
        }

        return fullText.trim(); // Remove trailing newlines
    }

    throw new Error('Unsupported file type. Please upload a PDF or TXT file.');
};

/**
 * Validate file before parsing
 */
const validateFile = (file: File): { valid: boolean; error?: string } => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['text/plain', 'application/pdf'];
    const fileName = file.name.toLowerCase();

    if (file.size > maxSize) {
        return { valid: false, error: 'File size must be less than 10MB'};
    }

    const isValidType = 
        allowedTypes.includes(file.type) ||
        fileName.endsWith('.pdf') || 
        fileName.endsWith('.txt');
    
        if (!isValidType) {
            return { valid: false, error: 'Only PDF and TXT files are supported.'};
        }

        return { valid: true };
};
 
export { extractTextFromFile, validateFile };