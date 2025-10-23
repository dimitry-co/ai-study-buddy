interface Question {
    id: number;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
}

interface simpleCard {
    id: number;
    question: string;
    answer: string;
}

/**
 * Convert MCQ questions to Anki TSV format
 * Front: Question + Options
 * Back: Answer + Explanation`
 */
const exportMCQToAnki = (questions: Question[]): string => {
    let tsvContent = "";
    questions.forEach(q => {
        const front = `${q.question}<br><br>${q.options.join('<br>')}`;
        const back = `<b>${q.correctAnswer}</b><br><br>${q.explanation}`;

        // TSV format: Front \t Back \n
        tsvContent += `${front}\t${back}\n`;
    });
    return tsvContent;
};

/**
 * Convert simple cards to Anki TSV format
 * Front: Question/Statement
 * Back: Short answer
 */
const exportSimpleCardsToAnki = (cards: simpleCard[]): string => {
    let tsvContent = "";

    cards.forEach(c => {
        const front = c.question;
        const back = c.answer;
        tsvContent += `${front}\t${back}\n`;
    });
    return tsvContent;
};

/**
 * Trigger browser download of TSV file. (Browser downloads the file automatically.)
 */
const downloadAnkiDeck = (tsvContent: string, filename: string = 'anki-deck') => {
    const blob = new Blob([tsvContent], { type: 'text/plain;charset=utf-8' }); // 1. Convert text to downloadable data. (Blob = Binary large Object. wraps text so browser can download it.)
    const url = URL.createObjectURL(blob); // 2. Create a temporary URL for the blob.
    const link = document.createElement('a'); // 3. Create a link element to trigger the download.
    link.href = url; // 4. Set the link's href to the temporary URL.
    link.download = `${filename}.txt`; // 5. Set the link's download attribute to the desired filename.
    document.body.appendChild(link);  // 6. Add the link to the page.
    link.click();                     // 7. Trigger the download.
    document.body.removeChild(link);  // 8. Remove the link from the page. (Clean up)
    URL.revokeObjectURL(url); // 9. Clean up the temporary URL.
};

export { exportMCQToAnki, exportSimpleCardsToAnki, downloadAnkiDeck };


/**
 * Notes:
 *  - anki expects a txt file with TSV (Tab Separated Values) format.
 * 
 */