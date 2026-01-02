import React from "react";
import { Calendar, BarChart3, Filter } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/shared/utils";
import { Badge, Button, DataTable, type Column } from "@/shared/components/ui";
import type { Transaction } from "@/types";

export interface TransactionsPreviewProps {
  transactions: Transaction[];
  activeTab?: "all" | "revenues" | "expense";
  onTabChange?: (tab: "all" | "revenues" | "expense") => void;
  onTransactionClick?: (transaction: Transaction) => void;
  className?: string;
}

const tabs = [
  { key: "all" as const, label: "All" },
  { key: "revenues" as const, label: "Revenues" },
  { key: "expense" as const, label: "Expense" },
];

export function TransactionsPreview({
  transactions,
  activeTab = "all",
  onTabChange,
  onTransactionClick,
  className,
}: TransactionsPreviewProps) {
  const columns: Column[] = [
    {
      key: "transaction_date",
      header: "Date",
      render: (value: unknown) => formatDate(value as string, "short"),
    },
    {
      key: "merchant",
      header: "Merchant",
      render: (value: unknown) => (
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary-green/20 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-primary-green">
              {(value as string)?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <span>{value as string}</span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (value: unknown) => (
        <span
          className={cn(
            "font-medium",
            (value as number) < 0 ? "text-error" : "text-success"
          )}
        >
          {formatCurrency(Math.abs(value as number))}
        </span>
      ),
    },
    {
      key: "card",
      header: "Card",
      render: (_: unknown, row: unknown) => (
        <Badge
          label={(row as Transaction).card?.card_name || "Unknown"}
          variant="default"
          size="sm"
        />
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (value: unknown) => (
        <Badge
          label={(value as string) || "Uncategorized"}
          variant="info"
          size="sm"
        />
      ),
    },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-primary-text">
          Transactions
        </h3>
        <div className="flex items-center space-x-2">
          <Button variant="secondary" size="sm">
            <Calendar className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm">
            <BarChart3 className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-hover-bg p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange?.(tab.key)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-card-bg text-primary-text shadow-sm"
                : "text-secondary-text hover:text-primary-text"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Transactions Table */}
      <DataTable
        columns={columns}
        data={transactions as unknown as Record<string, unknown>[]}
        onRowClick={(row) =>
          onTransactionClick?.(row as unknown as Transaction)
        }
        emptyMessage="No transactions found"
      />

      {/* View All Button */}
      {transactions.length > 0 && (
        <div className="text-center">
          <Button variant="secondary">View All Transactions</Button>
        </div>
      )}
    </div>
  );
}
