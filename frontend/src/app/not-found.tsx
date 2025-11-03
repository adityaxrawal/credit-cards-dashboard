"use client";

import React from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui";
import { Home, ArrowLeft, Search } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <AppLayout title="Page Not Found" showRightSidebar={false}>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="text-[#6ECB8E] text-8xl font-bold mb-4">404</div>
          <div className="w-24 h-1 bg-[#6ECB8E] mx-auto rounded mb-6"></div>

          <h1 className="text-3xl font-bold text-white mb-4">Page Not Found</h1>

          <p className="text-gray-400 mb-8 leading-relaxed max-w-md mx-auto">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. The
            page might have been moved, deleted, or you entered the wrong URL.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <div className="flex gap-3 justify-center">
            <Link href="/">
              <Button className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>

            <Button
              variant="secondary"
              onClick={() => window.history.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
          </div>

          {/* Quick Links */}
          <div className="pt-8 border-t border-gray-700">
            <p className="text-gray-500 text-sm mb-4">
              Or try these popular pages:
            </p>

            <div className="flex flex-wrap gap-2 justify-center">
              <Link href="/cards">
                <Button variant="secondary" size="sm">
                  View Cards
                </Button>
              </Link>

              <Link href="/transactions">
                <Button variant="secondary" size="sm">
                  Transactions
                </Button>
              </Link>

              <Link href="/settings">
                <Button variant="secondary" size="sm">
                  Settings
                </Button>
              </Link>
            </div>
          </div>

          {/* Search Suggestion */}
          <div className="pt-6">
            <div className="bg-[#25282E] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Search className="w-4 h-4" />
                <span>
                  Can&apos;t find what you&apos;re looking for? Try using the
                  search feature in the dashboard.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
