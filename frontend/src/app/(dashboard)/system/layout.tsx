"use client";

import { ModuleLayout } from "@/shared/components/layout/ModuleLayout";

const systemTabs = [
  { label: "Ingestion Logs", href: "/system/ingestion" },
  { label: "Rules Engine", href: "/system/rules" },
  { label: "Settings", href: "/system/settings" },
];

export default function SystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleLayout
      title="System"
      description="Configure system preferences, rules, and integrations."
      tabs={systemTabs}
    >
      {children}
    </ModuleLayout>
  );
}
