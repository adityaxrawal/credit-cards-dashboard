"use client";

import React from "react";
import { cn } from "@/shared/utils";
import { NavTabs, TabItem } from "./NavTabs";
import { Sidebar, MobileSidebar } from "./Sidebar";
import { GlobalSearch } from "@/shared/components/GlobalSearch";

interface ModuleLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  tabs?: TabItem[];
  actions?: React.ReactNode; // Top right stats or buttons
  className?: string;
  showSidebar?: boolean;
}

export function ModuleLayout({
  title,
  description,
  children,
  tabs,
  actions,
  className,
  showSidebar = true
}: ModuleLayoutProps) {
  return (
    <div className="flex min-h-screen bg-primary-bg text-primary-text font-sans selection:bg-primary-green/20">
      {/* Sidebars */}
      <GlobalSearch />
      {showSidebar && (
        <>
          <Sidebar />
          <MobileSidebar />
        </>
      )}

      {/* Main Content Area */}
      <main 
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out",
          showSidebar ? "md:pl-20" : ""
        )}
      >
        {/* Header Section */}
        <header className="glass-header z-40">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
              {description && (
                <p className="text-sm text-muted-text mt-0.5">{description}</p>
              )}
            </div>
            
            {/* Right side actions (Date pickers, Sync buttons, etc) */}
            {actions && (
              <div className="flex items-center gap-3">
                {actions}
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          {tabs && tabs.length > 0 && (
            <NavTabs tabs={tabs} />
          )}
        </header>

        {/* Page Content */}
        <div className={cn("p-6 flex-1 animate-fade-in", className)}>
          {children}
        </div>
      </main>
    </div>
  );
}
