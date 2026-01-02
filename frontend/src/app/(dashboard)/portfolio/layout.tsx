import React from "react";
import { ModuleLayout } from "@/shared/components/layout/ModuleLayout";
import { TabItem } from "@/shared/components/layout/NavTabs";

const tabs: TabItem[] = [
  { label: "Net Worth", href: "/portfolio/net-worth" },
  { label: "Accounts", href: "/portfolio/accounts" },
  { label: "Cards", href: "/portfolio/cards" },
  { label: "Loans", href: "/portfolio/loans" },
  { label: "Assets", href: "/portfolio/assets" },
];

export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ModuleLayout
      title="Portfolio"
      description="Assets, Liabilities & Net Worth"
      tabs={tabs}
    >
      {children}
    </ModuleLayout>
  );
}
