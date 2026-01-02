import React from "react";
import { cn } from "@/shared/utils";
import { Sidebar, MobileSidebar } from "./Sidebar";
import { Header } from "./Header";
import { RightSidebar } from "./RightSidebar";
import type { CreditCard, SpendingLimit } from "@/types";

export interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  showRightSidebar?: boolean;
  selectedCard?: CreditCard;
  spendingLimit?: SpendingLimit & { currentSpending: number };
  className?: string;
}

export function AppLayout({
  children,
  title,
  showRightSidebar = true,
  selectedCard,
  spendingLimit,
  className,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-primary-bg">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar />

      {/* Main Content Area */}
      <div
        className={cn(
          "flex-1 flex flex-col",
          "md:ml-20", // Account for desktop sidebar
          showRightSidebar ? "md:mr-80" : "", // Account for right sidebar
          className
        )}
      >
        {/* Header */}
        <Header title={title} />

        {/* Main Content */}
        <main className="flex-1 px-6 pb-6">{children}</main>
      </div>

      {/* Right Sidebar */}
      {showRightSidebar && (
        <div className="hidden lg:block fixed right-0 top-0 h-full">
          <RightSidebar
            selectedCard={selectedCard}
            spendingLimit={spendingLimit}
          />
        </div>
      )}
    </div>
  );
}
