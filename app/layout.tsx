import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { Toaster } from "react-hot-toast";
import { LoadingProvider } from "@/contexts/LoadingContext";
import LoadingOverlay from "@/components/shared/feedback/LoadingOverlay";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CreditDash - Smart Credit Card Management",
  description: "The most intelligent way to manage your credit cards, track spending, and maximize rewards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LoadingProvider>
          <ErrorBoundary>
            {children}
            <LoadingOverlay />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'rgba(17, 24, 39, 0.95)',
                  color: '#fff',
                  border: '1px solid rgba(75, 85, 99, 0.3)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(16px)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                },
                success: {
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
            {/* Portal root for overlays */}
            <div id="portal-root" className="fixed inset-0 pointer-events-none z-[10000]" />
          </ErrorBoundary>
        </LoadingProvider>
      </body>
    </html>
  );
}
