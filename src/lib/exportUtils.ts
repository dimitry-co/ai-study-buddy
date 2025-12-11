/**
 * Export Utilities - Anki TSV and PDF exports
 * Consolidates all export functionality in one place
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Question, FlashCard } from '@/types';

// ========== ANKI TSV EXPORTS ==========

/**
 * Convert MCQ questions to Anki TSV format
 * Front: Question + Options
 * Back: Answer + Explanation
 */
const exportMCQToAnki = (questions: Question[]): string => {
  let tsvContent = "";
  questions.forEach(q => {
    const front = `${q.question}<br><br>${q.options.join('<br>')}`;
    const back = `<b>${q.correctAnswer}</b><br><br>${q.explanation}`;
    tsvContent += `${front}\t${back}\n`;
  });
  return tsvContent;
};

/**
 * Convert flashcards to Anki TSV format
 * Front: Question
 * Back: Answer (+ hint if available)
 */
const exportFlashCardsToAnki = (cards: FlashCard[]): string => {
  let tsvContent = "";
  cards.forEach(c => {
    const front = c.question;
    const back = c.hint ? `${c.answer}<br><br><i>Hint: ${c.hint}</i>` : c.answer;
    tsvContent += `${front}\t${back}\n`;
  });
  return tsvContent;
};

/**
 * Trigger browser download of TSV file
 */
const downloadAnkiDeck = (tsvContent: string, filename: string = 'anki-deck') => {
  const blob = new Blob([tsvContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ========== PDF EXPORTS ==========

type PDFFormat = 'detailed' | 'quiz' | 'flashcards' | 'compact';

/**
 * Export questions to PDF with multiple format options
 */
const exportToPDF = (
  questions: Question[],
  format: PDFFormat = 'detailed',
  title: string = 'Study Questions'
): void => {
  if (questions.length === 0) {
    throw new Error('No questions to export');
  }

  const pdf = new jsPDF();

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

  pdf.save(`study-questions-${format}-${Date.now()}.pdf`); // Save the PDF file to the browser's download manager
};

/**
 * Detailed format - Questions with answers and explanations inline
 */
const generateDetailedPDF = (pdf: jsPDF, questions: Question[], title: string) => {
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
    pdf.setFont('helvetica', 'bold');
    const questionText = `${index + 1}. ${q.question}`;
    const questionLines = pdf.splitTextToSize(questionText, 170);
    pdf.text(questionLines, 20, yPosition);
    yPosition += questionLines.length * 7;

    // Options
    pdf.setFont('helvetica', 'normal');
    q.options.forEach(option => {
      const isCorrect = option.startsWith(q.correctAnswer);
      if (isCorrect) {
        pdf.setTextColor(0, 128, 0);
        pdf.setFont('helvetica', 'bold');
      }
      const optionLines = pdf.splitTextToSize(`   ${option}`, 165);
      pdf.text(optionLines, 20, yPosition);
      if (isCorrect) {
        pdf.setTextColor(0);
        pdf.setFont('helvetica', 'normal');
      }
      yPosition += optionLines.length * 6;
    });

    // Explanation box
    pdf.setFillColor(245, 245, 245);
    const explHeight = pdf.splitTextToSize(q.explanation, 160).length * 5 + 8;
    pdf.rect(20, yPosition, 170, explHeight, 'F');

    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(60, 60, 60);
    pdf.setFontSize(10);
    const explanationLines = pdf.splitTextToSize(`Explanation: ${q.explanation}`, 160);
    pdf.text(explanationLines, 25, yPosition + 5);
    pdf.setFontSize(12);
    yPosition += explHeight + 10;

    pdf.setTextColor(0);
  });
};

/**
 * Quiz format - Questions only, answer key at the end
 */
const generateQuizPDF = (pdf: jsPDF, questions: Question[], title: string) => {
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
    pdf.setFont('helvetica', 'bold');
    const questionText = `${index + 1}. ${q.question}`;
    const questionLines = pdf.splitTextToSize(questionText, 170);
    pdf.text(questionLines, 20, yPosition);
    yPosition += questionLines.length * 7;

    // Options
    pdf.setFont('helvetica', 'normal');
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
};

/**
 * Flashcard format - One question per page (front/back)
 */
const generateFlashcardsPDF = (pdf: jsPDF, questions: Question[], title: string) => {
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
    pdf.setFont('helvetica', 'bold');
    pdf.text('QUESTION', 105, 35, { align: 'center' });

    // Question text
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    const questionLines = pdf.splitTextToSize(q.question, 160);
    let yPos = 60;
    questionLines.forEach((line: string) => {
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
    pdf.setFont('helvetica', 'bold');
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
    pdf.setFont('helvetica', 'normal');
    pdf.text('Explanation:', 105, 130, { align: 'center' });

    const explainLines = pdf.splitTextToSize(q.explanation, 160);
    yPos = 145;
    explainLines.forEach((line: string) => {
      pdf.text(line, 105, yPos, { align: 'center' });
      yPos += 8;
    });
  });
};

/**
 * Compact format - Maximum questions per page (table format)
 */
const generateCompactPDF = (pdf: jsPDF, questions: Question[], title: string) => {
  // Title
  pdf.setFontSize(18);
  pdf.text(title, pdf.internal.pageSize.width / 2, 20, { align: 'center' });
  pdf.setFontSize(10);
  pdf.text(`${questions.length} Questions - Compact Format`, pdf.internal.pageSize.width / 2, 30, { align: 'center' });

  // Questions in table format
  const tableData = questions.map((q, index) => [
    `${index + 1}`,
    q.question.substring(0, 50) + (q.question.length > 50 ? '...' : ''),
    q.options.join(' | '),
    q.correctAnswer,
    q.explanation.substring(0, 30) + (q.explanation.length > 30 ? '...' : '')
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
};

/**
 * Trigger browser download of PDF file
 */
const downloadPDF = (pdf: jsPDF, filename: string = 'study-questions') => {
  pdf.save(`${filename}.pdf`);
};

// ========== FLASHCARD PDF EXPORTS ==========

type FlashCardPDFFormat = 'printable' | 'list' | 'study';

/**
 * Export flashcards to PDF with multiple format options
 */
const exportFlashCardsToPDF = (
  cards: FlashCard[],
  format: FlashCardPDFFormat = 'printable',
  title: string = 'Flashcards'
): void => {
  if (cards.length === 0) {
    throw new Error('No flashcards to export');
  }

  const pdf = new jsPDF();

  pdf.setProperties({
    title: title,
    creator: 'AI Study Buddy'
  });

  switch (format) {
    case 'printable':
      generatePrintableFlashcardsPDF(pdf, cards, title);
      break;
    case 'list':
      generateListFlashcardsPDF(pdf, cards, title);
      break;
    case 'study':
      generateStudyFlashcardsPDF(pdf, cards, title);
      break;
  }

  pdf.save(`flashcards-${format}-${Date.now()}.pdf`);
};

/**
 * Printable format - Front and back on separate pages (for cutting)
 */
const generatePrintableFlashcardsPDF = (pdf: jsPDF, cards: FlashCard[], title: string) => {
  cards.forEach((card, index) => {
    if (index > 0) pdf.addPage();

    // Card border
    pdf.setDrawColor(200);
    pdf.setLineWidth(1);
    pdf.rect(10, 10, 190, 130, 'S');

    // FRONT label
    pdf.setFontSize(10);
    pdf.setTextColor(150);
    pdf.text(`Card ${index + 1} of ${cards.length} - FRONT`, 105, 20, { align: 'center' });
    pdf.setTextColor(0);

    // Question
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    const questionLines = pdf.splitTextToSize(card.question, 170);
    let yPos = 50;
    questionLines.forEach((line: string) => {
      pdf.text(line, 105, yPos, { align: 'center' });
      yPos += 10;
    });

    // Hint (if available)
    if (card.hint) {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100);
      pdf.text(`Hint: ${card.hint}`, 105, 120, { align: 'center' });
      pdf.setTextColor(0);
    }

    // Cut line
    pdf.setDrawColor(200);
    pdf.setLineDashPattern([3, 3], 0);
    pdf.line(10, 145, 200, 145);
    pdf.setLineDashPattern([], 0);

    // BACK section (same page, below cut line)
    pdf.rect(10, 155, 190, 130, 'S');

    pdf.setFontSize(10);
    pdf.setTextColor(150);
    pdf.text(`Card ${index + 1} of ${cards.length} - BACK`, 105, 165, { align: 'center' });
    pdf.setTextColor(0);

    // Answer
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'normal');
    const answerLines = pdf.splitTextToSize(card.answer, 170);
    yPos = 200;
    answerLines.forEach((line: string) => {
      pdf.text(line, 105, yPos, { align: 'center' });
      yPos += 10;
    });
  });
};

/**
 * List format - All cards in a compact table
 */
const generateListFlashcardsPDF = (pdf: jsPDF, cards: FlashCard[], title: string) => {
  // Title
  pdf.setFontSize(18);
  pdf.text(title, pdf.internal.pageSize.width / 2, 20, { align: 'center' });
  pdf.setFontSize(10);
  pdf.text(`${cards.length} Flashcards`, pdf.internal.pageSize.width / 2, 30, { align: 'center' });

  const tableData = cards.map((card, index) => [
    `${index + 1}`,
    card.question.length > 50 ? card.question.substring(0, 50) + '...' : card.question,
    card.answer.length > 50 ? card.answer.substring(0, 50) + '...' : card.answer,
    card.hint || '-'
  ]);

  autoTable(pdf, {
    head: [['#', 'Question', 'Answer', 'Hint']],
    body: tableData,
    startY: 40,
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 65 },
      2: { cellWidth: 65 },
      3: { cellWidth: 40 }
    }
  });
};

/**
 * Study format - Full details, one card per section
 */
const generateStudyFlashcardsPDF = (pdf: jsPDF, cards: FlashCard[], title: string) => {
  let yPosition = 20;
  const pageHeight = pdf.internal.pageSize.height;

  // Title
  pdf.setFontSize(20);
  pdf.text(title, pdf.internal.pageSize.width / 2, yPosition, { align: 'center' });
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pdf.internal.pageSize.width / 2, yPosition, { align: 'center' });
  pdf.setTextColor(0);
  yPosition += 15;

  cards.forEach((card, index) => {
    // Check for page break
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = 20;
    }

    // Card number
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100);
    pdf.text(`Card ${index + 1}`, 20, yPosition);
    pdf.setTextColor(0);
    yPosition += 8;

    // Question
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    const questionLines = pdf.splitTextToSize(`Q: ${card.question}`, 170);
    pdf.text(questionLines, 20, yPosition);
    yPosition += questionLines.length * 6 + 4;

    // Answer
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 100, 0);
    const answerLines = pdf.splitTextToSize(`A: ${card.answer}`, 170);
    pdf.text(answerLines, 20, yPosition);
    pdf.setTextColor(0);
    yPosition += answerLines.length * 6 + 4;

    // Hint
    if (card.hint) {
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100);
      pdf.text(`Hint: ${card.hint}`, 20, yPosition);
      pdf.setTextColor(0);
      yPosition += 8;
    }

    // Divider
    pdf.setDrawColor(220);
    pdf.line(20, yPosition, 190, yPosition);
    yPosition += 10;
  });
};

export {
  // Anki exports
  exportMCQToAnki,
  exportFlashCardsToAnki,
  downloadAnkiDeck,
  // PDF exports (MCQ)
  exportToPDF,
  downloadPDF,
  // PDF exports (Flashcards)
  exportFlashCardsToPDF
};

export type { PDFFormat, FlashCardPDFFormat };

/**
 * Notes:
 *  - Anki expects a txt file with TSV (Tab Separated Values) format
 *  - MCQ PDF formats:
 *    - detailed: Full study guide with answers inline
 *    - quiz: Practice test with answer key at end
 *    - flashcards: One question per page (front/back)
 *    - compact: Table format, max questions per page
 *  - Flashcard PDF formats:
 *    - printable: Front/back on same page for cutting
 *    - list: Compact table format
 *    - study: Full details, one card per section
 */

