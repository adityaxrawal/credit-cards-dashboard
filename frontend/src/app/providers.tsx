"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { LoadingProvider } from "@/lib/hooks/useApiLoader";
import { GlobalLoadingSpinner } from "@/components/ui/GlobalLoadingSpinner";
import { GlobalLoadingOverlay } from "@/components/ui/LoadingOverlay";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <LoadingProvider>
            <AuthProvider>
              {children}
              <GlobalLoadingSpinner />
              <GlobalLoadingOverlay />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: "#363636",
                    color: "#fff",
                  },
                }}
              />
            </AuthProvider>
          </LoadingProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
