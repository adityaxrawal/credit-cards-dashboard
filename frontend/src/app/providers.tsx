"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { LoadingProvider } from "@/shared/hooks/useApiLoader";
import { GlobalLoadingSpinner } from "@/shared/components/ui/feedback/GlobalLoadingSpinner";
import { GlobalLoadingOverlay } from "@/shared/components/ui/feedback/LoadingOverlay";
import { ToastProvider } from "@/shared/components/ui/feedback/Toast";
import { ErrorBoundary } from "@/shared/components/common/ErrorBoundary";
import { GmailWebSocketProvider } from "@/lib/contexts/GmailWebSocketContext";
import { CurrencyProvider } from "@/components/shared/CurrencySelector";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
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
              <CurrencyProvider>
                <GmailWebSocketProvider>
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
                </GmailWebSocketProvider>
              </CurrencyProvider>
            </AuthProvider>
          </LoadingProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
