"use client";

import { ModuleLayout } from "@/shared/components/layout/ModuleLayout";

const operationsTabs = [
  { label: "Transactions", href: "/operations/transactions" },
  { label: "Cashflow", href: "/operations/cashflow" },
  { label: "Budget", href: "/operations/budget" },
  { label: "Reports", href: "/operations/reports" },
];

export default function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleLayout
      title="Operations"
      description="Manage daily financial activities, budgets, and reporting."
      tabs={operationsTabs}
    >
      {children}
    </ModuleLayout>
  );
}
