import React from "react";
import { ModuleLayout } from "@/shared/components/layout/ModuleLayout";
import { TabItem } from "@/shared/components/layout/NavTabs";

const tabs: TabItem[] = [
  { label: "Overview", href: "/command-center/overview" },
  { label: "Intelligence", href: "/command-center/intelligence" },
  { label: "Notifications", href: "/command-center/notifications" },
];

export default function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleLayout
      title="Command Center"
      description="Financial Overview & Intelligence"
      tabs={tabs}
    >
      {children}
    </ModuleLayout>
  );
}
