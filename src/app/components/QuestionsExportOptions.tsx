import { useState } from 'react';
import { exportToPDF, PDFFormat } from '@/lib/exportUtils';
import { Question } from '@/types';

interface QuestionsExportOptionsProps {
  questions: Question[];
  title?: string;
}

const QuestionsExportOptions = ({ questions, title = 'Study Questions' }: QuestionsExportOptionsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const formats: { value: PDFFormat; label: string; description: string }[] = [
    { value: 'detailed', label: 'Detailed', description: 'Full study guide with answers' },
    { value: 'quiz', label: 'Quiz', description: 'Practice test + answer key' },
    { value: 'flashcards', label: 'Flashcards', description: 'One per page, front/back' },
    { value: 'compact', label: 'Compact', description: 'Table format, max per page' },
  ];

  const handleExport = async (format: PDFFormat) => {
    if (questions.length === 0) return;

    setIsExporting(true);
    try {
      exportToPDF(questions, format, title);
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      {/* Dropdown Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting || questions.length === 0}
        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
      >
        {isExporting ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Exporting...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
            <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
            <div className="p-2 border-b border-gray-700">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Select PDF Format</p>
            </div>

            {formats.map((format) => (
              <button
                key={format.value}
                onClick={() => handleExport(format.value)}
                className="w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-b-0"
              >
                <p className="text-white font-medium">{format.label}</p>
                <p className="text-gray-400 text-sm">{format.description}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default QuestionsExportOptions;

