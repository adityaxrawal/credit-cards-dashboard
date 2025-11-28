"use client";

import { useLoadingStore } from "@/store/useLoadingStore";
import { Loader2 } from "lucide-react";

/**
 * Global Loading Overlay
 * Displays a loading spinner when any loading task is active
 */
export function GlobalLoadingOverlay() {
  const { isLoading, loadingMessage } = useLoadingStore();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-lg bg-white p-8 shadow-xl dark:bg-gray-800">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        {loadingMessage && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {loadingMessage}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Inline Loading Spinner
 * Smaller loading indicator for use within components
 */
export function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      {message && (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {message}
        </span>
      )}
    </div>
  );
}

export default GlobalLoadingOverlay;
