# AI Study Buddy - Complete Implementation Guide

## Project Structure
```
ai-study-buddy/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Main UI
│   │   ├── api/
│   │   │   ├── generate-questions/route.ts
│   │   │   └── parse-file/route.ts
│   │   └── components/
│   │       ├── FileUploader.tsx
│   │       ├── QuestionGenerator.tsx
│   │       ├── QuestionDisplay.tsx
│   │       ├── TSVExporter.tsx
│   │       └── PDFExporter.tsx
│   └── lib/
│       ├── openai.ts
│       ├── fileParser.ts
│       ├── exportUtils.ts
│       └── supabase.ts
├── public/                          # Static files (images, etc.)
├── package.json
├── tsconfig.json
└── [other config files]

## 1. Initial Setup Commands

```bash
npx create-next-app@latest ai-study-buddy --typescript --tailwind --app
cd ai-study-buddy
npm install openai pdf-parse mammoth xlsx papaparse
npm install @supabase/supabase-js
npm install react-hot-toast
npm install jspdf jspdf-autotable   # NEW - for PDF generation
npm install html2canvas              # NEW - optional, for advanced PDF layouts
```
## 1. Landing page UI component Structure (v1)
```
┌─────────────────────────────────────┐
│  🎓 AI Study Buddy                  │  ← Header
├─────────────────────────────────────┤
│  Your Study Notes                   │  ← Label
│  ┌─────────────────────────────┐   │
│  │ [Textarea for notes]         │   │  ← Input
│  └─────────────────────────────┘   │
│                                     │
│  Number of Questions: [5]           │  ← Number input
│                                     │
│  [✨ Generate Questions]            │  ← Button
├─────────────────────────────────────┤
│  ❌ Error message (if error)        │  ← Conditional
│  🔄 Loading... (if loading)         │  ← Conditional
│  📝 Questions list (if questions)   │  ← Conditional
└─────────────────────────────────────┘
```

## 2. Environment Variables (.env.local)

```env
OPENAI_API_KEY=your_openai_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. Core API Route - Generate Questions

**app/api/generate-questions/route.ts**
```typescript
import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { content, numberOfQuestions = 10 } = await request.json();

    const prompt = `Based on the following content, generate ${numberOfQuestions} multiple choice questions.

Content: ${content}

Format your response as a JSON array with this exact structure:
[
  {
    "question": "The question text",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
    "correctAnswer": "A",
    "explanation": "Brief explanation of why this is correct"
  }
]

Make questions that test understanding, not just memorization. Ensure all questions have exactly 4 options labeled A through D.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert educator who creates clear, challenging multiple choice questions for students."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;
    const questions = JSON.parse(response || '{"questions": []}');

    return NextResponse.json({ questions: questions.questions || questions });
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
```

## 4. Export Utilities Library

**lib/exportUtils.ts**
```typescript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

// TSV Export for Anki
export const exportToTSV = (questions: Question[]): void => {
  if (questions.length === 0) {
    throw new Error('No questions to export');
  }

  const tsvContent = questions.map(q => {
    // Front of card: Question with all options
    const front = `${q.question}<br><br>${q.options.join('<br>')}`;
    
    // Back of card: Answer with explanation
    const back = `Answer: ${q.correctAnswer}<br><br>${q.explanation}`;
    
    // Tab-separated values
    return `${front}\t${back}`;
  }).join('\n');

  // Create and download the file
  const blob = new Blob([tsvContent], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `anki-cards-${Date.now()}.tsv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// PDF Export - Multiple Formats
export const exportToPDF = (
  questions: Question[], 
  format: 'detailed' | 'quiz' | 'flashcards' | 'compact' = 'detailed',
  title: string = 'Study Questions'
): void => {
  const pdf = new jsPDF();
  const pageHeight = pdf.internal.pageSize.height;
  const pageWidth = pdf.internal.pageSize.width;
  
  // Add metadata
  pdf.setProperties({
    title: title,
    creator: 'AI Study Buddy'
  });

  switch (format) {
    case 'detailed':
      generateDetailedPDF(pdf, questions, title);
      break;
    case 'quiz':
      generateQuizPDF(pdf, questions, title);
      break;
    case 'flashcards':
      generateFlashcardsPDF(pdf, questions, title);
      break;
    case 'compact':
      generateCompactPDF(pdf, questions, title);
      break;
  }

  pdf.save(`study-questions-${format}-${Date.now()}.pdf`);
};

// Detailed format with answers inline
function generateDetailedPDF(pdf: jsPDF, questions: Question[], title: string) {
  let yPosition = 20;
  const pageHeight = pdf.internal.pageSize.height;

  // Title
  pdf.setFontSize(20);
  pdf.text(title, pdf.internal.pageSize.width / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Date
  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pdf.internal.pageSize.width / 2, yPosition, { align: 'center' });
  pdf.setTextColor(0);
  yPosition += 15;

  pdf.setFontSize(12);

  questions.forEach((q, index) => {
    // Check for page break
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = 20;
    }

    // Question number and text
    pdf.setFont(undefined, 'bold');
    const questionText = `${index + 1}. ${q.question}`;
    const questionLines = pdf.splitTextToSize(questionText, 170);
    pdf.text(questionLines, 20, yPosition);
    yPosition += questionLines.length * 7;

    // Options
    pdf.setFont(undefined, 'normal');
    q.options.forEach(option => {
      const isCorrect = option.startsWith(q.correctAnswer);
      if (isCorrect) {
        pdf.setTextColor(0, 128, 0);
        pdf.setFont(undefined, 'bold');
      }
      const optionLines = pdf.splitTextToSize(`   ${option}`, 165);
      pdf.text(optionLines, 20, yPosition);
      if (isCorrect) {
        pdf.setTextColor(0);
        pdf.setFont(undefined, 'normal');
      }
      yPosition += optionLines.length * 6;
    });

    // Explanation box
    pdf.setFillColor(245, 245, 245);
    const explHeight = pdf.splitTextToSize(q.explanation, 160).length * 5 + 5;
    pdf.rect(20, yPosition, 170, explHeight, 'F');
    
    pdf.setFont(undefined, 'italic');
    pdf.setTextColor(60, 60, 60);
    pdf.setFontSize(10);
    const explanationLines = pdf.splitTextToSize(`💡 ${q.explanation}`, 160);
    pdf.text(explanationLines, 25, yPosition + 5);
    pdf.setFontSize(12);
    yPosition += explHeight + 10;

    pdf.setTextColor(0);
  });
}

// Quiz format - questions only, answer key at end
function generateQuizPDF(pdf: jsPDF, questions: Question[], title: string) {
  let yPosition = 20;
  const pageHeight = pdf.internal.pageSize.height;

  // Cover page
  pdf.setFontSize(24);
  pdf.text(title, pdf.internal.pageSize.width / 2, 50, { align: 'center' });
  pdf.setFontSize(14);
  pdf.text('Practice Quiz', pdf.internal.pageSize.width / 2, 65, { align: 'center' });
  pdf.setFontSize(12);
  pdf.text(`${questions.length} Questions`, pdf.internal.pageSize.width / 2, 80, { align: 'center' });
  pdf.text(`Name: _______________________`, 20, 120);
  pdf.text(`Date: _______________________`, 20, 130);
  pdf.text(`Score: _______ / ${questions.length}`, 20, 140);
  
  // Questions
  pdf.addPage();
  yPosition = 20;
  
  pdf.setFontSize(16);
  pdf.text('Questions', pdf.internal.pageSize.width / 2, yPosition, { align: 'center' });
  yPosition += 15;
  pdf.setFontSize(12);

  questions.forEach((q, index) => {
    if (yPosition > pageHeight - 50) {
      pdf.addPage();
      yPosition = 20;
    }

    // Question
    pdf.setFont(undefined, 'bold');
    const questionText = `${index + 1}. ${q.question}`;
    const questionLines = pdf.splitTextToSize(questionText, 170);
    pdf.text(questionLines, 20, yPosition);
    yPosition += questionLines.length * 7;

    // Options
    pdf.setFont(undefined, 'normal');
    q.options.forEach(option => {
      const optionLines = pdf.splitTextToSize(`   ${option}`, 165);
      pdf.text(optionLines, 20, yPosition);
      yPosition += optionLines.length * 6;
    });

    // Answer space
    pdf.text('Answer: _____', 20, yPosition);
    yPosition += 15;
  });

  // Answer Key Page
  pdf.addPage();
  pdf.setFontSize(16);
  pdf.text('Answer Key', pdf.internal.pageSize.width / 2, 20, { align: 'center' });
  yPosition = 40;

  // Create answer key table
  const answerData = questions.map((q, index) => [
    `${index + 1}`,
    q.correctAnswer,
    q.explanation.substring(0, 60) + (q.explanation.length > 60 ? '...' : '')
  ]);

  autoTable(pdf, {
    head: [['Question', 'Answer', 'Explanation']],
    body: answerData,
    startY: yPosition,
    styles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 20 },
      2: { cellWidth: 130 }
    }
  });
}

// Flashcard format - one question per page
function generateFlashcardsPDF(pdf: jsPDF, questions: Question[], title: string) {
  questions.forEach((q, index) => {
    // Front of card (new page for each)
    if (index > 0) pdf.addPage();
    
    // Card border
    pdf.setDrawColor(200);
    pdf.setLineWidth(1);
    pdf.rect(10, 10, 190, 277, 'S');
    
    // Question number
    pdf.setFontSize(10);
    pdf.setTextColor(150);
    pdf.text(`Card ${index + 1} of ${questions.length}`, 105, 20, { align: 'center' });
    pdf.setTextColor(0);
    
    // FRONT label
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('QUESTION', 105, 35, { align: 'center' });
    
    // Question text
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'normal');
    const questionLines = pdf.splitTextToSize(q.question, 160);
    let yPos = 60;
    questionLines.forEach(line => {
      pdf.text(line, 105, yPos, { align: 'center' });
      yPos += 10;
    });
    
    // Options
    yPos += 20;
    pdf.setFontSize(12);
    q.options.forEach(option => {
      pdf.text(option, 30, yPos);
      yPos += 10;
    });
    
    // Flip indicator
    pdf.setFontSize(10);
    pdf.setTextColor(150);
    pdf.text('→ Flip for answer', 105, 270, { align: 'center' });
    pdf.setTextColor(0);
    
    // Back of card (new page)
    pdf.addPage();
    
    // Card border
    pdf.setDrawColor(200);
    pdf.rect(10, 10, 190, 277, 'S');
    
    // BACK label
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('ANSWER', 105, 35, { align: 'center' });
    
    // Correct answer (large and centered)
    pdf.setFontSize(36);
    pdf.setTextColor(0, 128, 0);
    pdf.text(q.correctAnswer, 105, 80, { align: 'center' });
    
    // Full correct option
    pdf.setFontSize(14);
    pdf.setTextColor(0);
    const correctOption = q.options.find(opt => opt.startsWith(q.correctAnswer));
    if (correctOption) {
      pdf.text(correctOption, 105, 100, { align: 'center' });
    }
    
    // Explanation
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    pdf.text('Explanation:', 105, 130, { align: 'center' });
    
    const explainLines = pdf.splitTextToSize(q.explanation, 160);
    yPos = 145;
    explainLines.forEach(line => {
      pdf.text(line, 105, yPos, { align: 'center' });
      yPos += 8;
    });
  });
}

// Compact format - maximum questions per page
function generateCompactPDF(pdf: jsPDF, questions: Question[], title: string) {
  // Title page
  pdf.setFontSize(18);
  pdf.text(title, pdf.internal.pageSize.width / 2, 20, { align: 'center' });
  pdf.setFontSize(10);
  pdf.text(`${questions.length} Questions - Compact Format`, pdf.internal.pageSize.width / 2, 30, { align: 'center' });
  
  // Questions in table format
  const tableData = questions.map((q, index) => [
    `${index + 1}`,
    q.question.substring(0, 50) + (q.question.length > 50 ? '...' : ''),
    q.options.join(' '),
    q.correctAnswer,
    q.explanation.substring(0, 30) + '...'
  ]);

  autoTable(pdf, {
    head: [['#', 'Question', 'Options', 'Ans', 'Explanation']],
    body: tableData,
    startY: 40,
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 50 },
      2: { cellWidth: 70 },
      3: { cellWidth: 10 },
      4: { cellWidth: 40 }
    }
  });
}
```

## 5. PDF Exporter Component

**app/components/PDFExporter.tsx**
```typescript
'use client';

import { useState } from 'react';
import { exportToPDF } from '@/lib/exportUtils';
import toast from 'react-hot-toast';

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface PDFExporterProps {
  questions: Question[];
  studySetTitle?: string;
}

export default function PDFExporter({ questions, studySetTitle = 'Study Questions' }: PDFExporterProps) {
  const [selectedFormat, setSelectedFormat] = useState<'detailed' | 'quiz' | 'flashcards' | 'compact'>('detailed');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (questions.length === 0) {
      toast.error('No questions to export');
      return;
    }

    setIsExporting(true);
    try {
      exportToPDF(questions, selectedFormat, studySetTitle);
      toast.success(`PDF exported successfully!`);
    } catch (error) {
      toast.error('Failed to export PDF');
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const formatDescriptions = {
    detailed: 'Complete study guide with questions, answers, and explanations inline',
    quiz: 'Practice test format with answer key on separate page',
    flashcards: 'One question per page, designed for printing and cutting',
    compact: 'Maximum questions per page in table format'
  };

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        📄 PDF Export
      </h3>
      
      <div className="space-y-3">
        {/* Format Selection */}
        <div className="space-y-2">
          {Object.entries(formatDescriptions).map(([format, description]) => (
            <label key={format} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="pdfFormat"
                value={format}
                checked={selectedFormat === format}
                onChange={(e) => setSelectedFormat(e.target.value as any)}
                className="mt-1"
              />
              <div>
                <div className="font-medium capitalize">{format}</div>
                <div className="text-sm text-gray-600">{description}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isExporting ? 'Generating PDF...' : `Export as ${selectedFormat} PDF`}
        </button>
      </div>
    </div>
  );
}
```

## 6. Updated Main Page with Export Options

**app/page.tsx**
```typescript
'use client';

import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import PDFExporter from '@/components/PDFExporter';
import { exportToTSV } from '@/lib/exportUtils';

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export default function Home() {
  const [content, setContent] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);
  const [studySetTitle, setStudySetTitle] = useState('');

  const generateQuestions = async () => {
    if (!content.trim()) {
      toast.error('Please enter some content first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, numberOfQuestions }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setQuestions(data.questions);
      toast.success(`Generated ${data.questions.length} questions!`);
    } catch (error) {
      toast.error('Failed to generate questions');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleTSVExport = () => {
    try {
      exportToTSV(questions);
      toast.success('TSV file exported for Anki!');
    } catch (error) {
      toast.error('Failed to export TSV');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <Toaster position="top-right" />
      
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8">
          AI Study Buddy for Anki
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Study Material</h2>
          
          {/* Title Input */}
          <input
            type="text"
            value={studySetTitle}
            onChange={(e) => setStudySetTitle(e.target.value)}
            placeholder="Study Set Title (optional)"
            className="w-full p-3 mb-4 border border-gray-300 rounded-md"
          />
          
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your study material here (PowerPoint text, notes, etc.)"
            className="w-full h-48 p-3 border border-gray-300 rounded-md"
          />

          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center gap-2">
              Number of questions:
              <input
                type="number"
                min="1"
                max="100"
                value={numberOfQuestions}
                onChange={(e) => setNumberOfQuestions(Number(e.target.value))}
                className="w-20 p-2 border border-gray-300 rounded"
              />
            </label>

            <button
              onClick={generateQuestions}
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Questions'}
            </button>
          </div>
        </div>

        {questions.length > 0 && (
          <>
            {/* Export Options */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Export Options</h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                {/* Anki TSV Export */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    📇 Anki Export
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    TSV format ready for Anki import. Front has question & options, back has answer & explanation.
                  </p>
                  <button
                    onClick={handleTSVExport}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Export as TSV
                  </button>
                </div>

                {/* PDF Export */}
                <PDFExporter 
                  questions={questions} 
                  studySetTitle={studySetTitle || 'Study Questions'}
                />
              </div>
            </div>

            {/* Questions Display */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">
                Generated Questions ({questions.length})
              </h2>

              <div className="space-y-4">
                {questions.map((q, index) => (
                  <div key={index} className="border-b pb-4">
                    <p className="font-medium mb-2">
                      {index + 1}. {q.question}
                    </p>
                    <div className="ml-4 space-y-1">
                      {q.options.map((option, optIndex) => (
                        <p
                          key={optIndex}
                          className={
                            option.startsWith(q.correctAnswer)
                              ? 'text-green-600 font-medium'
                              : ''
                          }
                        >
                          {option}
                        </p>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-gray-600 ml-4">
                      <strong>Explanation:</strong> {q.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
```

## 7. File Upload Support (Next Enhancement)

**app/components/FileUploader.tsx**
```typescript
import { useState } from 'react';
import toast from 'react-hot-toast';

interface FileUploaderProps {
  onContentExtracted: (content: string, fileName: string) => void;
}

export default function FileUploader({ onContentExtracted }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (e.g., 10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/parse-file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse file');
      }

      const data = await response.json();
      onContentExtracted(data.content, file.name);
      toast.success(`File "${file.name}" uploaded successfully!`);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to process file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Upload study material
      </label>
      <div className="flex items-center justify-center w-full">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-8 h-8 mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mb-2 text-sm text-gray-500">
              {uploading ? 'Processing...' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-gray-500">PDF, DOCX, PPTX, TXT (MAX. 10MB)</p>
          </div>
          <input
            type="file"
            onChange={handleFileUpload}
            accept=".pdf,.docx,.pptx,.txt"
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}
```

## 8. Database Schema (Supabase)

```sql
-- Study sets table
CREATE TABLE study_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Questions table
CREATE TABLE questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  study_set_id UUID REFERENCES study_sets(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  difficulty TEXT DEFAULT 'medium',
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Export history table (track what was exported)
CREATE TABLE export_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  study_set_id UUID REFERENCES study_sets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  export_type TEXT NOT NULL, -- 'tsv', 'pdf-detailed', 'pdf-quiz', etc.
  exported_at TIMESTAMP DEFAULT NOW()
);
```

## 9. Prompts for Cursor

### For file parsing API route:
```
Create an API route at app/api/parse-file/route.ts that:
1. Accepts multipart form data file uploads
2. Detects file type from extension
3. For PDFs: use pdf-parse to extract text
4. For DOCX: use mammoth to extract text
5. For PPTX: extract text from slides
6. For TXT: read directly
7. Returns extracted content as JSON
8. Handles errors gracefully
```

### For Supabase integration:
```
Create a Supabase service in lib/supabase.ts that:
1. Initializes the Supabase client with environment variables
2. Has a saveStudySet function that saves the title, content, and questions
3. Has a getStudySets function to retrieve user's past study sets
4. Has a deleteStudySet function
5. Handles authentication state
```

### For improved question generation:
```
Update the generate-questions API to:
1. Accept additional parameters like difficulty level (easy/medium/hard)
2. Accept question type preferences (conceptual vs factual)
3. Allow specifying topics to focus on
4. Add option to generate true/false questions
5. Add option to generate fill-in-the-blank questions
```

### For study session tracking:
```
Create a StudySession component that:
1. Presents questions one at a time
2. Allows user to answer before revealing correct answer
3. Tracks which questions were answered correctly/incorrectly
4. Saves session results to database
5. Shows progress bar and score
```

## 10. Advanced Features to Add Later

### A. Smart Review System
```typescript
// Algorithm for spaced repetition
interface ReviewSchedule {
  questionId: string;
  nextReviewDate: Date;
  interval: number; // days
  easeFactor: number; // difficulty multiplier
  repetitions: number;
}

// Track performance and adjust review schedule
function updateReviewSchedule(
  schedule: ReviewSchedule,
  performance: 'forgot' | 'hard' | 'good' | 'easy'
): ReviewSchedule {
  // Implement SM-2 algorithm or similar
  // Adjust interval based on performance
  // Return updated schedule
}
```

### B. Multiple Export Formats
```typescript
// Add more export options
export const exportToExcel = (questions: Question[]) => {
  // Use xlsx library to create Excel file
  // Multiple sheets for different categories
  // Formatting and colors
};

export const exportToJSON = (questions: Question[]) => {
  // Export in various JSON formats
  // Compatible with other study apps
};

export const exportToMarkdown = (questions: Question[]) => {
  // Export as markdown for note-taking apps
  // Compatible with Obsidian, Notion, etc.
};

export const exportToQuizlet = (questions: Question[]) => {
  // Format for Quizlet import
  // Handle their specific requirements
};
```

### C. AI-Powered Features
```typescript
// Generate questions with specific focus
interface AdvancedGenerationOptions {
  numberOfQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  questionTypes: ('multiple-choice' | 'true-false' | 'fill-blank')[];
  focusTopics?: string[];
  avoidTopics?: string[];
  bloomsLevel?: ('remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create')[];
}

// Generate study notes from questions
async function generateStudyNotes(questions: Question[]): Promise<string> {
  // Use AI to create comprehensive study notes
  // Organize by topic
  // Include key concepts and relationships
}

// Generate practice essays/short answer questions
async function generateEssayQuestions(content: string): Promise<EssayQuestion[]> {
  // Create open-ended questions
  // Provide grading rubrics
  // Sample answers
}
```

### D. Collaboration Features
```typescript
// Share study sets with others
interface ShareSettings {
  studySetId: string;
  shareType: 'view' | 'copy' | 'collaborate';
  expiresAt?: Date;
  password?: string;
}

// Study groups
interface StudyGroup {
  id: string;
  name: string;
  members: string[];
  sharedSets: string[];
  chatEnabled: boolean;
}
```

## 11. Performance Optimizations

### Caching Strategy
```typescript
// Cache generated questions
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function getCachedQuestions(contentHash: string) {
  const cached = await redis.get(`questions:${contentHash}`);
  return cached ? JSON.parse(cached) : null;
}

async function cacheQuestions(contentHash: string, questions: Question[]) {
  await redis.set(
    `questions:${contentHash}`,
    JSON.stringify(questions),
    { ex: 3600 } // Expire after 1 hour
  );
}
```

### Rate Limiting
```typescript
// Implement rate limiting for API calls
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
});

// In API route
const identifier = userId || ip;
const { success } = await ratelimit.limit(identifier);

if (!success) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429 }
  );
}
```

## 12. Testing Strategy

### Unit Tests
```typescript
// __tests__/exportUtils.test.ts
import { exportToTSV, exportToPDF } from '@/lib/exportUtils';

describe('Export Utils', () => {
  test('TSV export formats correctly for Anki', () => {
    const questions = [{
      question: 'Test question?',
      options: ['A) Option 1', 'B) Option 2'],
      correctAnswer: 'A',
      explanation: 'Test explanation'
    }];
    
    // Test TSV format
    // Verify tab separation
    // Check HTML formatting
  });
  
  test('PDF export generates valid document', () => {
    // Test PDF generation
    // Verify no errors thrown
    // Check file is created
  });
});
```

### Integration Tests
```typescript
// Test full flow from input to export
describe('Study Buddy Integration', () => {
  test('Generate and export questions flow', async () => {
    // 1. Submit content
    // 2. Generate questions
    // 3. Export as TSV
    // 4. Verify file download
  });
});
```

## 13. Deployment Checklist

### Environment Setup
- [ ] Set up Supabase project
- [ ] Configure authentication
- [ ] Set up database tables
- [ ] Get OpenAI API key
- [ ] Configure environment variables

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add OPENAI_API_KEY
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Production Considerations
- [ ] Add error monitoring (Sentry)
- [ ] Set up analytics
- [ ] Implement rate limiting
- [ ] Add loading states
- [ ] Test on mobile devices
- [ ] Add PWA support for offline use
- [ ] Set up backup system for study sets

## 14. Cost Optimization

### OpenAI API Cost Management
```typescript
// Use GPT-3.5-turbo for lower cost
const model = isPremiumUser ? 'gpt-4-turbo-preview' : 'gpt-3.5-turbo';

// Implement token counting
function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

// Warn users about large requests
if (estimateTokens(content) > 3000) {
  // Show warning about potential cost/time
}
```

### Database Optimization
```sql
-- Add indexes for common queries
CREATE INDEX idx_study_sets_user_id ON study_sets(user_id);
CREATE INDEX idx_questions_study_set_id ON questions(study_set_id);
CREATE INDEX idx_export_history_user_id ON export_history(user_id);

-- Implement soft delete for data recovery
ALTER TABLE study_sets ADD COLUMN deleted_at TIMESTAMP;
```

## 15. User Experience Enhancements

### Progressive Enhancement
```typescript
// Start with basic functionality
// Add features as they load
const [features, setFeatures] = useState({
  basicExport: true,
  advancedPDF: false,
  collaboration: false,
  analytics: false
});

// Load advanced features after initial render
useEffect(() => {
  loadAdvancedFeatures().then(setFeatures);
}, []);
```

### Accessibility
```typescript
// Ensure all interactive elements are keyboard accessible
// Add ARIA labels
// Support screen readers
// High contrast mode support

<button
  aria-label="Export questions as PDF"
  aria-busy={isExporting}
  aria-disabled={questions.length === 0}
>
  {/* ... */}
</button>
```

## Next Steps to Build

1. **Start Simple**: Build the basic version with text input → questions → TSV export
2. **Test with Your Wife**: Get real user feedback early
3. **Add PDF Export**: Implement the multiple PDF formats
4. **File Upload**: Add support for PowerPoint and other files
5. **Save to Database**: Allow saving and retrieving study sets
6. **Polish UI**: Make it beautiful and user-friendly
7. **Deploy**: Get it online so your wife can use it anywhere

Remember: Start with the MVP (Minimum Viable Product) and iterate based on actual usage!