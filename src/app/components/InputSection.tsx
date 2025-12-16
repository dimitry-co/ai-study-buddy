import { useState, useEffect } from 'react';
import { validateFile, parseFile, getFileTypeLabel, ParsedContent } from '@/lib/fileParser';
import { MAX_QUESTIONS, MIN_QUESTIONS } from '@/lib/constants';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
      if (!selectedFile) {
        props.setError("Please select a file");
        return;
      }

      // 1. Validate file
      const validation = validateFile(selectedFile);
      if (!validation.valid) {
        props.setError(validation.error || "Invalid file.");
        return;
      }
      // 2. Parse file (extract text or convert to images)
      try {
        props.setLoading(true);
        const parsedContent = await parseFile(selectedFile);
        props.onGenerate(parsedContent); // send content to parent for processing.
      } catch (err: any) {
        props.setError(err.message || "Failed to parse file.");
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
            onClick={() => setInputMode('text')}
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
              accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.gif,.webp,image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
              }}
              className="hidden"
            />
            <div className="text-gray-400">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p>Click to browse or drag and drop</p>
              <p className="text-sm mt-2 text-gray-500">PDF, Images (JPG, PNG), or Text files</p>
            </div>
            {selectedFile && (
              <div className="mt-4 p-3 bg-gray-700 rounded-lg inline-block">
                <p className="text-blue-400 font-medium">{selectedFile.name}</p>
                <p className="text-gray-400 text-sm">
                  {getFileTypeLabel(selectedFile)} • {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
          </label>
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
          disabled={props.loading || (inputMode === 'text' ? !notes.trim() : !selectedFile)}
          className="w-full max-w-sm bg-white hover:bg-gray-200 active:bg-gray-300 cursor-pointer disabled:bg-gray-500 disabled:cursor-not-allowed disabled:hover:bg-gray-500 text-gray-900 font-semibold py-3 rounded-3xl transition-colors"
        >
          {props.loading ? "Generating Questions..." : "Generate Questions"}
        </button>
      </div>
    </div>
  );
};

export default InputSection;