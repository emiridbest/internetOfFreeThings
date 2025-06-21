"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

function NotFoundContent() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-yellow-50 to-white dark:from-black/90 dark:to-black py-16 px-4">
      <div className="bg-white dark:bg-black border-2 border-yellow-400 dark:border-yellow-500 shadow-2xl shadow-yellow-500/20 dark:shadow-yellow-500/30 rounded-lg p-8 max-w-md w-full text-center">
        <h1 className="text-6xl font-bold text-yellow-500 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-black dark:text-yellow-200 mb-6">Page Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link href="/" passHref>
          <Button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-200">
            Go Back Home
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-yellow-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-yellow-700 dark:text-yellow-400">
            Loading...
          </p>
        </div>
      </div>
    }>
      <NotFoundContent />
    </Suspense>
  );
}