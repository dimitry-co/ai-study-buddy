import { useState, useEffect } from 'react';
import { validateFile, parseFiles, getFileTypeLabel, ParsedContent } from '@/lib/fileParser';
import { MAX_QUESTIONS, MIN_QUESTIONS, MAX_FILES, MAX_PDF_PAGES, MAX_FILE_SIZE_MB, MAX_IMAGES, MAX_IMAGE_FILES } from '@/lib/constants';

interface InputSectionProps {
  numberOfQuestions: number;
  setNumberOfQuestions: (num: number) => void;
  questionType: 'mcq' | 'flashcard';
  setQuestionType: (type: 'mcq' | 'flashcard') => void;
  onGenerate: (content: ParsedContent) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
}

const InputSection = (props: InputSectionProps) => {
  const [inputMode, setInputMode] = useState<'text' | 'file'>('file')
  const [notes, setNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [questionInput, setQuestionInput] = useState<string>(String(props.numberOfQuestions));

  // Keep local input in sync if parent changes the number (e.g., clamped)
  useEffect(() => {
    setQuestionInput(String(props.numberOfQuestions));
  }, [props.numberOfQuestions]);

  // Handle the generate button click - prepare content for the API call and send up to parent for processing.
  const handleGenerateClick = async () => {
    // Handle text mode input
    if (inputMode === 'text') {
      if (!notes.trim()) {
        props.setError("Please enter some notes");
        return;
      }
      // Text mode - send tas textt type and text to parent for processing.
      props.onGenerate({ type: 'text', text: notes });
      return;
    }

    // Handle file mode input
    if (inputMode === 'file') {
      if (selectedFiles.length === 0) {
        props.setError("Please select at least one file");
        return;
      }

      // 1. Validate all files
      for (const file of selectedFiles) {
        const validation = validateFile(file);
        if (!validation.valid) {
          props.setError(validation.error || `Invalid file: ${file.name}`);
          return;
        }
      }
      
      // 2. Check image file count (before parsing, PDFs excluded)
      const imageFiles = selectedFiles.filter(f => 
        f.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name)
      );
      if (imageFiles.length > MAX_IMAGE_FILES) {
        props.setError(`Maximum ${MAX_IMAGE_FILES} image files allowed. PDFs can have up to ${MAX_PDF_PAGES} pages each.`);
        return;
      }
      
      // 3. Parse all files (extract text or convert to images)
      try {
        props.setLoading(true);
        const parsedContent = await parseFiles(selectedFiles);
        props.onGenerate(parsedContent); // send content to parent for processing.
      } catch (err: any) {
        props.setError(err.message || "Failed to parse files.");
        props.setLoading(false);
      }
    }
  };

  return (
    <div className="bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
      <div className="mb-6">
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          Upload Notes (PDF, Images, or Text)
        </label>

        {/* Input Method Selection Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setInputMode('file')}
            className={`flex-1 py-3 px-6 rounded-3xl font-semibold transition-all cursor-pointer ${inputMode === 'file'
              ? 'bg-white text-gray-900'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            Upload File
          </button>
          <button
            onClick={() => {
              setInputMode('text');
              setSelectedFiles([]); // Clear files when switching to text mode
            }}
            className={`flex-1 py-3 px-6 rounded-3xl font-semibold transition-all cursor-pointer ${inputMode === 'text'
              ? 'bg-white text-gray-900'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            Text
          </button>
        </div>

        {/* Conditionally render input based on mode */}
        {inputMode === 'text' && (
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste your notes here..."
            className="w-full h-40 p-4 border border-gray-700 bg-gray-800 text-white rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )}

        {inputMode === 'file' && (
          <label
            htmlFor="file-upload"
            className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer block"
          >
            <input
              id="file-upload"
              type="file"
              multiple
              accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.gif,.webp,image/*"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > MAX_FILES) {
                  props.setError(`Maximum ${MAX_FILES} files allowed`);
                  return;
                }
                setSelectedFiles(files);
              }}
              className="hidden"
            />
            {selectedFiles.length === 0 && (
              <div className="text-gray-400">
                <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p>Click to browse or drag and drop</p>
                <p className="text-sm mt-2 text-gray-500">PDF, Images (JPG, PNG), or Text files</p>
              </div>
            )}
            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-gray-400 mb-2">
                  {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="p-3 bg-gray-700 rounded-lg flex items-center justify-between">
                      <div className="flex-1"> 
                        <p className="text-blue-400 font-medium">{file.name}</p>
                        <p className="text-gray-400 text-sm">
                          {getFileTypeLabel(file)} • {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedFiles(selectedFiles.filter((_, i) => i !== index))
                        }}
                        className="ml-4 text-gray-400 hover:text-red-800 transition-colors cursor-pointer"
                        aria-label={`Remove ${file.name}`}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </label>
        )}
        
        {/* File Upload Limits Info */}
        {inputMode === 'file' && (
          <div className="mt-4 bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
            <p className="text-blue-300 text-sm font-medium mb-1">Upload Limits:</p>
            <ul className="text-blue-200 text-xs space-y-1 ml-4">
              <li>• Max {MAX_FILES} files per request</li>
              <li>• Max {MAX_FILE_SIZE_MB} MB per file</li>
              <li>• Images: Max {MAX_IMAGE_FILES} image files</li>
              <li>• PDFs: Max {MAX_PDF_PAGES} pages per PDF</li>
            </ul>
          </div>
        )}
      </div>

      {/* Number of Question Selector */}
      <div className="mb-6">
        <label
          htmlFor="numQuestions"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          Number of Questions (Max {MAX_QUESTIONS})
        </label>
        <input
          id="numQuestions"
          type="number"
          value={questionInput}
          onChange={(e) => {
            // Let the user type freely (including clearing the field)
            setQuestionInput(e.target.value);
          }}
          onBlur={() => {
            // Clamp to valid range on blur
            const parsed = parseInt(questionInput);
            const clamped = Math.min(
              Math.max(isNaN(parsed) ? MIN_QUESTIONS : parsed, MIN_QUESTIONS),
              MAX_QUESTIONS
            );
            props.setNumberOfQuestions(clamped);
            setQuestionInput(String(clamped));
          }}
          className="w-32 p-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Question Type Selector */}
      <div className="mb-6">
        <label
          htmlFor="questionType"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          Question Type
        </label>
        <select
          id="questionType"
          value={props.questionType}
          onChange={(e) => props.setQuestionType(e.target.value as 'mcq' | 'flashcard')}
          className="w-64 p-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
        >
          <option value="mcq">Multiple Choice Questions</option>
          <option value="flashcard">Anki Cards (Fill in the Blank)</option>
        </select>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleGenerateClick}
          disabled={props.loading || (inputMode === 'text' ? !notes.trim() : selectedFiles.length === 0)}
          className="w-full max-w-sm bg-white hover:bg-gray-200 active:bg-gray-300 cursor-pointer disabled:bg-gray-500 disabled:cursor-not-allowed disabled:hover:bg-gray-500 text-gray-900 font-semibold py-3 rounded-3xl transition-colors"
        >
          {props.loading ? "Generating Questions..." : "Generate Questions"}
        </button>
      </div>
    </div>
  );
};

export default InputSection;


// Questions
// 1 - explain the classnames css for the uploaded file user wants to genreate questions with. 
//     Also the svg icons used for the remove button.
// 2 - explain disabled logic on generate button.
