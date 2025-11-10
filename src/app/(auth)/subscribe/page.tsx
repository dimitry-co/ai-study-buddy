"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";

export default function SubscribePage() {
    const router = useRouter();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubscrube = async () => {
      setLoading(true);
      setError('');

      try {
        // TODO: Add stripe checkout here later
        // For now, just show a message
        alert('payment integration coming soon! For now, contact admin.');

        // Later this will redirect to Strip checkout:
        // const response = aweait fetch('/api/create-checkout', { method: 'POST' });
        // const url = await response.json();
        // window.location.href = url;

      } catch (err) {
        setError('Unable to process. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
          {/* Header */}
          <h1 className="text-3xl font-bold text-white mb-2 text-center">
            Subscribe to AI Study Buddy
          </h1>
          <p className="text-gray-400 text-center mb-8">
            Unlock unlimited question generation and AI-powered study assistance.
          </p>

          {/* Pricing Card */}
          <div className="bg-gray-700 rounded-lg shadow-lg p-6 mb-6">
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-white mb-2">
                $5.99
                <span className="text-xl text-gray-400 font-normal">/month</span>
              </div>
              <p className="text-gray-300">Monthly Subscription</p>
            </div>

            {/* Feature List */}
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                Unlimited question generation
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                Multiple choice & flashcards
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                PDF & text file support
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                Anki deck export functionality
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                Cancel anytime
              </li>
            </ul>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded mb-4">
              {error}
            </div>
          )}

          {/* Subscribe Button */}
          <button
            onClick={handleSubscrube}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-semibold mb-4"
          >
            {loading ? 'Processing...' : 'Subscribe Now'}
          </button>

          {/* Back to Login */}
          <button
            onClick={() => router.push('/login')}
            className="w-full text-gray-400 hover:text-gray-300 text-center"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    );

}