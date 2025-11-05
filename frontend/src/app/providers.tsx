"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { LoadingProvider } from "@/lib/hooks/useApiLoader";
import { GlobalLoadingSpinner } from "@/components/ui/GlobalLoadingSpinner";
import { ToastProvider } from "@/components/ui/Toast";

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
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <LoadingProvider>
          <AuthProvider>
            {children}
            <GlobalLoadingSpinner />
          </AuthProvider>
        </LoadingProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
