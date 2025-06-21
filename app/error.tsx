"use client";

import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-yellow-50 to-white dark:from-black/90 dark:to-black py-16 px-4">
      <div className="bg-white dark:bg-black border-2 border-yellow-400 dark:border-yellow-500 shadow-2xl shadow-yellow-500/20 dark:shadow-yellow-500/30 rounded-lg p-8 max-w-md w-full text-center">
        <h2 className="text-2xl font-semibold text-black dark:text-yellow-200 mb-6">Something went wrong!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          An error occurred while loading this page. Please try again.
        </p>
        <Button 
          onClick={reset}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}