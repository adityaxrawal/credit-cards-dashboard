"use client";

import React from "react";
import { Plus, Calendar, Download, Filter as FilterIcon } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button, Input, DataTable, Badge, type Column } from "@/components/ui";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { Transaction } from "@/types";

// Mock data
const mockTransactions: Transaction[] = [
  {
    id: "1",
    amount: -125.5,
    transaction_date: "2024-01-15T10:30:00Z",
    merchant: "Amazon",
    category: "Shopping",
    card_id: "1",
    description: "Online purchase - Electronics",
    bill_month: 1,
    bill_year: 2024,
    is_settled: true,
    created_at: "2024-01-15T10:30:00Z",
    updated_at: "2024-01-15T10:30:00Z",
    card: {
      id: "1",
      card_name: "Shipping Card",
      bank_name: "Chase Bank",
      card_number_last4: "3040",
      bill_date: 15,
      due_date: 5,
      credit_limit: 10000,
      current_balance: 2500,
      is_active: true,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    },
  },
  {
    id: "2",
    amount: -45.0,
    transaction_date: "2024-01-14T08:15:00Z",
    merchant: "Starbucks",
    category: "Food & Dining",
    card_id: "2",
    description: "Coffee and breakfast",
    bill_month: 1,
    bill_year: 2024,
    is_settled: true,
    created_at: "2024-01-14T08:15:00Z",
    updated_at: "2024-01-14T08:15:00Z",
    card: {
      id: "2",
      card_name: "Transfer Card",
      bank_name: "Wells Fargo",
      card_number_last4: "4080",
      bill_date: 20,
      due_date: 10,
      credit_limit: 15000,
      current_balance: 3200,
      is_active: true,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    },
  },
  {
    id: "3",
    amount: 500.0,
    transaction_date: "2024-01-13T14:20:00Z",
    merchant: "Salary Deposit",
    category: "Income",
    card_id: "1",
    description: "Monthly salary",
    bill_month: 1,
    bill_year: 2024,
    is_settled: true,
    created_at: "2024-01-13T14:20:00Z",
    updated_at: "2024-01-13T14:20:00Z",
    card: {
      id: "1",
      card_name: "Shipping Card",
      bank_name: "Chase Bank",
      card_number_last4: "3040",
      bill_date: 15,
      due_date: 5,
      credit_limit: 10000,
      current_balance: 2500,
      is_active: true,
      created_at: "2024-01-01",
      updated_at: "2024-01-01",
    },
  },
];

export default function TransactionsPage() {
  const [searchValue, setSearchValue] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<
    "all" | "revenues" | "expense"
  >("all");

  const filteredTransactions = React.useMemo(() => {
    let filtered = mockTransactions;

    // Filter by tab
    if (activeTab === "revenues") {
      filtered = filtered.filter((t) => t.amount > 0);
    } else if (activeTab === "expense") {
      filtered = filtered.filter((t) => t.amount < 0);
    }

    // Filter by search
    if (searchValue) {
      filtered = filtered.filter(
        (t) =>
          t.merchant.toLowerCase().includes(searchValue.toLowerCase()) ||
          t.description?.toLowerCase().includes(searchValue.toLowerCase()) ||
          t.category?.toLowerCase().includes(searchValue.toLowerCase())
      );
    }

    return filtered;
  }, [activeTab, searchValue]);

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
          <div>
            <div className="font-medium">{value as string}</div>
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (value: unknown) => (
        <span
          className={cn(
            "font-semibold",
            (value as number) < 0 ? "text-error" : "text-success"
          )}
        >
          {(value as number) < 0 ? "-" : "+"}
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
    {
      key: "is_settled",
      header: "Status",
      render: (value: unknown) => (
        <Badge
          label={(value as boolean) ? "Settled" : "Pending"}
          variant={(value as boolean) ? "success" : "warning"}
          size="sm"
        />
      ),
    },
  ];

  const tabs = [
    { key: "all" as const, label: "All", count: mockTransactions.length },
    {
      key: "revenues" as const,
      label: "Revenues",
      count: mockTransactions.filter((t) => t.amount > 0).length,
    },
    {
      key: "expense" as const,
      label: "Expense",
      count: mockTransactions.filter((t) => t.amount < 0).length,
    },
  ];

  const totalAmount = filteredTransactions.reduce(
    (sum, t) => sum + t.amount,
    0
  );

  return (
    <AppLayout title="Transactions" showRightSidebar={false}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search transactions..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="secondary">
              <Calendar className="w-4 h-4 mr-2" />
              Date Range
            </Button>
            <Button variant="secondary">
              <FilterIcon className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button variant="secondary">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Transaction
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card-bg rounded-lg p-6">
            <div className="text-sm text-secondary-text mb-1">
              Total Transactions
            </div>
            <div className="text-2xl font-bold text-primary-text">
              {filteredTransactions.length}
            </div>
          </div>
          <div className="bg-card-bg rounded-lg p-6">
            <div className="text-sm text-secondary-text mb-1">Total Amount</div>
            <div
              className={cn(
                "text-2xl font-bold",
                totalAmount < 0 ? "text-error" : "text-success"
              )}
            >
              {totalAmount < 0 ? "-" : "+"}
              {formatCurrency(Math.abs(totalAmount))}
            </div>
          </div>
          <div className="bg-card-bg rounded-lg p-6">
            <div className="text-sm text-secondary-text mb-1">
              Average Transaction
            </div>
            <div className="text-2xl font-bold text-primary-text">
              {formatCurrency(
                filteredTransactions.length
                  ? Math.abs(totalAmount) / filteredTransactions.length
                  : 0
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-hover-bg p-1 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2",
                activeTab === tab.key
                  ? "bg-card-bg text-primary-text shadow-sm"
                  : "text-secondary-text hover:text-primary-text"
              )}
            >
              <span>{tab.label}</span>
              <Badge label={tab.count.toString()} variant="default" size="sm" />
            </button>
          ))}
        </div>

        {/* Transactions Table */}
        <DataTable
          columns={columns}
          data={filteredTransactions as unknown as Record<string, unknown>[]}
          onRowClick={(row) => console.log("Transaction clicked:", row)}
          emptyMessage="No transactions found"
        />

        {/* Empty State */}
        {filteredTransactions.length === 0 && searchValue && (
          <div className="text-center py-12">
            <p className="text-secondary-text">
              No transactions found matching &quot;{searchValue}&quot;
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setSearchValue("")}
            >
              Clear Search
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
