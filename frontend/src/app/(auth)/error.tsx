"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Auth error:", error);
  }, [error]);

  return (
    <div className="text-center p-6 bg-card-bg rounded-xl border border-border">
      <h2 className="text-xl font-semibold text-primary-text mb-2">
        Authentication Error
      </h2>
      <p className="text-secondary-text mb-6">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button onClick={reset} variant="primary">
        Try Again
      </Button>
    </div>
  );
}
