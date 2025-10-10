'use client';

import { useState } from 'react';

export default function Home() {
  const [notes, setNotes] = useState('');
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  return (
    <div>
      <h1>AI Study Buddy</h1>
    </div>
  );
}
