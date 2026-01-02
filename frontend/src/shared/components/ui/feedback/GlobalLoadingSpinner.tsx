"use client";

import React from "react";
import { useApiLoader } from "@/shared/hooks/useApiLoader";
import { Loader2 } from "lucide-react";

export function GlobalLoadingSpinner() {
  const { isLoading, loadingMessage } = useApiLoader();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl p-6 flex flex-col items-center gap-4 min-w-[300px]">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">
            {loadingMessage || "Loading..."}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Please wait while we process your request
          </p>
        </div>
      </div>
    </div>
  );
}
