import { useState } from 'react';
import { validateFile, extractTextFromFile } from '@/lib/fileParser';

interface InputSectionProps {
  numberOfQuestions: number;
  setNumberOfQuestions: (num: number) => void;
  questionType: 'mcq' | 'flashcard';
  setQuestionType: (type: 'mcq' | 'flashcard') => void;
  onGenerate: (content: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
}

const InputSection = (props: InputSectionProps) => {
  // Local State - only this component needs to know about it.
  const [inputMode, setInputMode] = useState<'text' | 'file'>('file')
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Handle the generate button click - prepaer content for the API call and send up to parent for processing.
  const handleGenerateClick = async () => {
    let contentToSend = '';

    // Handle text mode input
    if (inputMode === 'text') {
      if (!notes.trim()) {
        props.setError("Please enter some notes");
        return;
      }
      contentToSend = notes
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
      // 2. Extract text from file
      try {
        props.setLoading(true);
        contentToSend = await extractTextFromFile(selectedFile);
      } catch (err: any) {
        props.setError(err.message || "Failed to parse file.");
        props.setLoading(false);
        return;
      }
    }
    
    props.onGenerate(contentToSend); // send content to parent for processing.
  }
  
  return (
    <div className="bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
      <div className="mb-6">
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-300 mb-2"
        >
          Upload Notes (PDF, PowerPoint, or Text)
        </label>

        {/* Input Method Selection Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setInputMode('file')}
            className={`flex-1 py-3 px-6 rounded-3xl font-semibold transition-all cursor-pointer ${
              inputMode === 'file'
                ? 'bg-white text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            Upload File
          </button>
          <button
            onClick={() => setInputMode('text')}
            className={`flex-1 py-3 px-6 rounded-3xl font-semibold transition-all cursor-pointer ${
              inputMode === 'text'
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
              type='file'
              accept='.pdf,.txt'
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
              }}
              className="hidden"
            />
            <div className="text-gray-400">
              <p className="mt-4">Click to browse files or drag and drop here</p>

            </div>
            {selectedFile && (
              <p className="text-blue-400 mt-2">
                Selected: {selectedFile.name}
              </p>
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
          Number of Questions
        </label>
        <input
          id="numQuestions"
          type="number"
          value={props.numberOfQuestions}
          onChange={(e) => props.setNumberOfQuestions(parseInt(e.target.value))}
          min="1"
          max="100"
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