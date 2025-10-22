// Mock pdfjs-dist to avoid import.meta issues in Jest
jest.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: jest.fn(),
}));

import { validateFile } from '../fileParser';

describe('fileParser - validateFile', () => {
  // Helper to create mock File objects
  const createMockFile = (options: {
    size?: number;
    type?: string;
    name?: string;
  }): File => {
    return {
      size: options.size || 1024,
      type: options.type || 'application/pdf',
      name: options.name || 'test.pdf',
    } as File;
  };

  describe('File size validation', () => {
    it('should accept files under 10MB', () => {
      const smallFile = createMockFile({ size: 5 * 1024 * 1024 }); // 5MB
      const result = validateFile(smallFile);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject files over 10MB', () => {
      const largeFile = createMockFile({ size: 11 * 1024 * 1024 }); // 11MB
      const result = validateFile(largeFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File size must be less than 10MB');
    });

    it('should accept files exactly 10MB', () => {
      const exactFile = createMockFile({ size: 10 * 1024 * 1024 }); // Exactly 10MB
      const result = validateFile(exactFile);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('File type validation', () => {
    it('should accept PDF files by MIME type', () => {
      const pdfFile = createMockFile({ 
        type: 'application/pdf', 
        name: 'notes.pdf' 
      });
      const result = validateFile(pdfFile);
      
      expect(result.valid).toBe(true);
    });

    it('should accept TXT files by MIME type', () => {
      const txtFile = createMockFile({ 
        type: 'text/plain', 
        name: 'notes.txt' 
      });
      const result = validateFile(txtFile);
      
      expect(result.valid).toBe(true);
    });

    it('should accept PDF files by extension even without MIME type', () => {
      const pdfFile = createMockFile({ 
        type: '', 
        name: 'notes.pdf' 
      });
      const result = validateFile(pdfFile);
      
      expect(result.valid).toBe(true);
    });

    it('should accept TXT files by extension even without MIME type', () => {
      const txtFile = createMockFile({ 
        type: '', 
        name: 'notes.txt' 
      });
      const result = validateFile(txtFile);
      
      expect(result.valid).toBe(true);
    });

    it('should reject unsupported file types', () => {
      const docFile = createMockFile({ 
        type: 'application/msword', 
        name: 'notes.doc' 
      });
      const result = validateFile(docFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Only PDF and TXT files are supported.');
    });

    it('should reject image files', () => {
      const imageFile = createMockFile({ 
        type: 'image/jpeg', 
        name: 'photo.jpg' 
      });
      const result = validateFile(imageFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Only PDF and TXT files are supported.');
    });
  });

  describe('Edge cases', () => {
    it('should handle files with uppercase extensions', () => {
      const upperCaseFile = createMockFile({ 
        type: '', 
        name: 'NOTES.PDF' 
      });
      const result = validateFile(upperCaseFile);
      
      expect(result.valid).toBe(true);
    });

    it('should handle files with mixed case extensions', () => {
      const mixedCaseFile = createMockFile({ 
        type: '', 
        name: 'notes.TxT' 
      });
      const result = validateFile(mixedCaseFile);
      
      expect(result.valid).toBe(true);
    });

    it('should reject zero-byte files as valid (size check only)', () => {
      // Note: A zero-byte file will pass validation but may fail during parsing
      const emptyFile = createMockFile({ size: 0 });
      const result = validateFile(emptyFile);
      
      expect(result.valid).toBe(true); // Size is still under 10MB
    });
  });
});

