"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = isSignUpMode
        ? await signUp(email, password)
        : await signIn(email, password);

      if (error) {
        setError(error.message); // Auth errors
        return;
      }

      // Redirect to main app
      router.push('/');

    } catch (err) {
      setError('Unable to connect. Please try again.'); // Network errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">
          {isSignUpMode ? 'Sign Up' : 'Sign In'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 bg-gray-700 text-white rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full p-3 bg-gray-700 text-white rounded-lg"
            />
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-semibold"
          >
            {loading ? 'Loading...' : isSignUpMode ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={() => setIsSignUpMode(!isSignUpMode)}
          className="mt-4 text-blue-400 hover:text-blue-300 w-full text-center"
        >
          {isSignUpMode ? 'Already have an acoount ? Sign In' : 'Don\'t have an account ? Sign up'}
        </button>
      </div>
    </div>
  );
}