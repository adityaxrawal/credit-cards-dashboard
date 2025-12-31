"use client";

import React from "react";
import { useUser } from "@/lib/auth/user-context";
import { OnboardingWizard } from "@/components/features/onboarding/OnboardingWizard";

/**
 * Dashboard Layout Client Component
 * Simplified to just render children as AppLayout handles the sidebar/header structure per page.
 */
export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const [showOnboarding, setShowOnboarding] = React.useState(false);

  React.useEffect(() => {
    // Check if onboarding is completed in localStorage
    const isCompleted = localStorage.getItem("onboarding_completed");
    if (!isCompleted) {
      setShowOnboarding(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("onboarding_completed", "true");
    setShowOnboarding(false);
  };

  return (
    <div className="min-h-screen bg-primary-bg">
      {children}
      <OnboardingWizard 
        isOpen={showOnboarding} 
        onClose={handleOnboardingComplete} 
        userName={user?.name}
      />
    </div>
  );
}
