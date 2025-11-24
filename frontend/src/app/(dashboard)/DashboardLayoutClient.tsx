"use client";

import React from "react";

/**
 * Dashboard Layout Client Component
 * Simplified to just render children as AppLayout handles the sidebar/header structure per page.
 */
export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-primary-bg">
      {children}
    </div>
  );
}
