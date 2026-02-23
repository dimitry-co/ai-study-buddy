import { getFileTypeLabel, validateFile } from '../fileParser';

describe('fileParser - validateFile', () => {
  const createMockFile = (options: {
    size?: number;
    type?: string;
    name?: string;
  }): File =>
    ({
      size: options.size ?? 1024,
      type: options.type ?? 'application/pdf',
      name: options.name ?? 'test.pdf',
    }) as File;

  describe('file size validation', () => {
    it('accepts files under 10MB', () => {
      const file = createMockFile({ size: 5 * 1024 * 1024 });
      const result = validateFile(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects files over 10MB', () => {
      const file = createMockFile({ size: 11 * 1024 * 1024 });
      const result = validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('File size must be less than 10MB');
    });
  });

  describe('supported types', () => {
    it('accepts PDF files by MIME type', () => {
      const file = createMockFile({ type: 'application/pdf', name: 'notes.pdf' });
      expect(validateFile(file).valid).toBe(true);
    });

    it('accepts TXT files by MIME type', () => {
      const file = createMockFile({ type: 'text/plain', name: 'notes.txt' });
      expect(validateFile(file).valid).toBe(true);
    });

    it('accepts markdown files by extension', () => {
      const file = createMockFile({ type: '', name: 'notes.md' });
      expect(validateFile(file).valid).toBe(true);
    });

    it('accepts image files by MIME type', () => {
      const file = createMockFile({ type: 'image/jpeg', name: 'photo.jpg' });
      expect(validateFile(file).valid).toBe(true);
    });

    it('accepts image files by extension', () => {
      const file = createMockFile({ type: '', name: 'diagram.webp' });
      expect(validateFile(file).valid).toBe(true);
    });

    it('rejects unsupported file types', () => {
      const file = createMockFile({ type: 'application/msword', name: 'notes.doc' });
      const result = validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Supported formats PDF, Images (JPG, PNG, GIF, WEBP), and Text (TXT, MD)',
      );
    });
  });
});

describe('fileParser - getFileTypeLabel', () => {
  const createMockFile = (options: { type?: string; name?: string }): File =>
    ({
      size: 1000,
      type: options.type ?? '',
      name: options.name ?? 'file',
    }) as File;

  it('returns Image for image files', () => {
    const file = createMockFile({ type: 'image/png', name: 'img.png' });
    expect(getFileTypeLabel(file)).toBe('Image');
  });

  it('returns PDF for pdf files', () => {
    const file = createMockFile({ type: 'application/pdf', name: 'doc.pdf' });
    expect(getFileTypeLabel(file)).toBe('PDF');
  });

  it('returns Text for text/markdown files', () => {
    const txt = createMockFile({ type: 'text/plain', name: 'doc.txt' });
    const md = createMockFile({ type: '', name: 'notes.md' });
    expect(getFileTypeLabel(txt)).toBe('Text');
    expect(getFileTypeLabel(md)).toBe('Text');
  });

  it('returns Unknown for unsupported files', () => {
    const file = createMockFile({ type: 'application/zip', name: 'archive.zip' });
    expect(getFileTypeLabel(file)).toBe('Unknown');
  });
});
