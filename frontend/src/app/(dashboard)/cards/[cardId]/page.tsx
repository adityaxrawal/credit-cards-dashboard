"use client";

import React, { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Download,
  Plus,
  Filter,
  Calendar,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button, ProgressBar, Modal, Input, Badge } from "@/components/ui";
import {
  SpendingTrendChart,
  CategoryBreakdownChart,
  WeeklySpendingChart,
} from "@/components/analytics";
import { formatCurrency, cn } from "@/lib/utils";
import type { CreditCard, Transaction } from "@/types";

// Mock data for card details
const mockCard: CreditCard = {
  id: "1",
  card_name: "Chase Sapphire Preferred",
  bank_name: "Chase",
  card_number_last4: "4080",
  bill_date: 15,
  due_date: 5,
  credit_limit: 10000,
  current_balance: 2500,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockExpiryDate = "08/28";

// Mock transactions data
const mockTransactions: Transaction[] = [
  {
    id: "1",
    amount: -85.5,
    transaction_date: "2024-01-15",
    merchant: "Amazon",
    description: "Online purchase",
    category: "Shopping",
    card_id: "1",
    bill_month: 1,
    bill_year: 2024,
    is_settled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    amount: -45.2,
    transaction_date: "2024-01-14",
    merchant: "Starbucks",
    description: "Coffee",
    category: "Food & Dining",
    card_id: "1",
    bill_month: 1,
    bill_year: 2024,
    is_settled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Mock analytics data
const spendingTrendData = [
  { month: "Jan", spending: 2800 },
  { month: "Feb", spending: 3200 },
  { month: "Mar", spending: 2100 },
  { month: "Apr", spending: 2900 },
  { month: "May", spending: 3500 },
  { month: "Jun", spending: 2400 },
];

const categoryData = [
  { category: "Shopping", amount: 1200, percentage: 48 },
  { category: "Food & Dining", amount: 800, percentage: 32 },
  { category: "Transportation", amount: 300, percentage: 12 },
  { category: "Entertainment", amount: 200, percentage: 8 },
];

const weeklyData = [
  { day: "Mon", amount: 45 },
  { day: "Tue", amount: 78 },
  { day: "Wed", amount: 32 },
  { day: "Thu", amount: 95 },
  { day: "Fri", amount: 120 },
  { day: "Sat", amount: 85 },
  { day: "Sun", amount: 40 },
];

const tabs = [
  { key: "transactions", label: "Transactions" },
  { key: "insights", label: "Insights" },
  { key: "statements", label: "Statements" },
];

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardId = params.cardId as string;

  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "transactions"
  );
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showEditCard, setShowEditCard] = useState(false);

  const creditLimit = mockCard.credit_limit || 0;
  const availableCredit = creditLimit - mockCard.current_balance;

  const transactionColumns = [
    { key: "date", label: "Date" },
    { key: "description", label: "Description" },
    { key: "category", label: "Category" },
    { key: "amount", label: "Amount" },
    { key: "status", label: "Status" },
  ];

  return (
    <AppLayout title={mockCard.card_name} showRightSidebar={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="secondary" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-primary-text">
                {mockCard.card_name}
              </h1>
              <p className="text-secondary-text">{mockCard.bank_name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowEditCard(true)}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="error" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Card Visual and Metrics */}
        <div className="bg-card-bg rounded-lg p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card Visual */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6 text-white min-h-[200px] flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="w-8 h-6 bg-yellow-400 rounded"></div>
                <div className="text-right">
                  <p className="text-sm opacity-80">{mockCard.bank_name}</p>
                  <p className="text-xs opacity-60">VISA</p>
                </div>
              </div>
              <div>
                <p className="text-lg tracking-wider mb-2">
                  •••• •••• •••• {mockCard.card_number_last4}
                </p>
                <div className="flex justify-between">
                  <p className="text-sm">{mockCard.card_name}</p>
                  <p className="text-sm">{mockExpiryDate}</p>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-secondary-text">Current Balance</p>
                <p className="text-2xl font-bold text-primary-text">
                  {formatCurrency(mockCard.current_balance)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-secondary-text">Credit Limit</p>
                <p className="text-2xl font-bold text-primary-text">
                  {formatCurrency(creditLimit)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-secondary-text">Available Credit</p>
                <p className="text-2xl font-bold text-success">
                  {formatCurrency(availableCredit)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-secondary-text">Utilization</p>
                <ProgressBar
                  value={mockCard.current_balance}
                  max={creditLimit}
                  showPercentage={true}
                  className="mt-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-muted-text/20">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                  activeTab === tab.key
                    ? "border-primary-green text-primary-green"
                    : "border-transparent text-secondary-text hover:text-primary-text hover:border-muted-text"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[500px]">
          {activeTab === "transactions" && (
            <TransactionsTab
              transactions={mockTransactions}
              columns={transactionColumns}
              onAddTransaction={() => setShowAddTransaction(true)}
            />
          )}
          {activeTab === "insights" && (
            <InsightsTab
              spendingTrend={spendingTrendData}
              categoryData={categoryData}
              weeklyData={weeklyData}
            />
          )}
          {activeTab === "statements" && <StatementsTab />}
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        cardId={cardId}
      />

      {/* Edit Card Modal */}
      <EditCardModal
        isOpen={showEditCard}
        onClose={() => setShowEditCard(false)}
        card={mockCard}
      />
    </AppLayout>
  );
}

// Transactions Tab Component
interface TransactionsTabProps {
  transactions: Transaction[];
  columns: Array<{ key: string; label: string }>;
  onAddTransaction: () => void;
}

function TransactionsTab({
  transactions,
  columns,
  onAddTransaction,
}: TransactionsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary-text">
          Transactions
        </h2>
        <div className="flex items-center space-x-2">
          <Button variant="secondary" size="sm">
            <Calendar className="w-4 h-4 mr-2" />
            Filter by Date
          </Button>
          <Button variant="secondary" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            More Filters
          </Button>
          <Button size="sm" onClick={onAddTransaction}>
            <Plus className="w-4 h-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      <div className="bg-card-bg rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-hover-bg">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="text-left p-4 font-medium text-secondary-text"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => (
              <tr
                key={item.id}
                className="border-t border-muted-text/20 hover:bg-hover-bg/50"
              >
                <td className="p-4 text-primary-text">
                  {new Date(item.transaction_date).toLocaleDateString()}
                </td>
                <td className="p-4 text-primary-text">{item.merchant}</td>
                <td className="p-4">
                  <span
                    className={cn(
                      "font-medium",
                      item.amount > 0 ? "text-success" : "text-error"
                    )}
                  >
                    {formatCurrency(Math.abs(item.amount))}
                  </span>
                </td>
                <td className="p-4">
                  <Badge label={item.category || ""} variant="default" />
                </td>
                <td className="p-4 text-primary-text">
                  {item.bill_month}/{item.bill_year}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Insights Tab Component
interface InsightsTabProps {
  spendingTrend: Array<{ month: string; spending: number }>;
  categoryData: Array<{ category: string; amount: number; percentage: number }>;
  weeklyData: Array<{ day: string; amount: number }>;
}

function InsightsTab({
  spendingTrend,
  categoryData,
  weeklyData,
}: InsightsTabProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-primary-text">Card Insights</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpendingTrendChart data={spendingTrend} height={250} />
        <CategoryBreakdownChart data={categoryData} height={250} />
        <WeeklySpendingChart data={weeklyData} height={250} />

        {/* Key Metrics */}
        <div className="bg-card-bg rounded-lg p-6">
          <h3 className="text-lg font-semibold text-primary-text mb-4">
            Key Metrics
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-secondary-text">Average Transaction</span>
              <span className="font-semibold text-primary-text">
                {formatCurrency(65.35)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary-text">Most Used Category</span>
              <Badge label="Shopping" variant="default" />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary-text">Peak Spending Day</span>
              <span className="font-semibold text-primary-text">Friday</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary-text">
                This Month&apos;s Spending
              </span>
              <span className="font-semibold text-primary-text">
                {formatCurrency(2500)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Statements Tab Component
function StatementsTab() {
  const statements = [
    { month: "December 2024", date: "2024-12-15", status: "Available" },
    { month: "November 2024", date: "2024-11-15", status: "Available" },
    { month: "October 2024", date: "2024-10-15", status: "Available" },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-primary-text">Statements</h2>

      <div className="grid gap-4">
        {statements.map((statement, index) => (
          <div
            key={index}
            className="bg-card-bg rounded-lg p-4 flex items-center justify-between"
          >
            <div>
              <h3 className="font-medium text-primary-text">
                {statement.month}
              </h3>
              <p className="text-sm text-secondary-text">
                Generated on {statement.date}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge label={statement.status} variant="success" />
              <Button variant="secondary" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Add Transaction Modal Component
interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
}

function AddTransactionModal({
  isOpen,
  onClose,
  cardId,
}: AddTransactionModalProps) {
  const [formData, setFormData] = useState({
    amount: "",
    date: "",
    merchant: "",
    category: "",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log("Adding transaction:", formData, "for card:", cardId);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          required
        />
        <Input
          label="Date"
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          required
        />
        <Input
          label="Merchant"
          value={formData.merchant}
          onChange={(e) =>
            setFormData({ ...formData, merchant: e.target.value })
          }
          required
        />
        <Input
          label="Category"
          value={formData.category}
          onChange={(e) =>
            setFormData({ ...formData, category: e.target.value })
          }
        />
        <Input
          label="Description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
        />
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add Transaction</Button>
        </div>
      </form>
    </Modal>
  );
}

// Edit Card Modal Component
interface EditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: CreditCard;
}

function EditCardModal({ isOpen, onClose, card }: EditCardModalProps) {
  const [formData, setFormData] = useState({
    card_name: card.card_name,
    bank_name: card.bank_name,
    credit_limit: (card.credit_limit || 0).toString(),
    bill_date: card.bill_date.toString(),
    due_date: card.due_date.toString(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log("Updating card:", formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Card">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Card Name"
          value={formData.card_name}
          onChange={(e) =>
            setFormData({ ...formData, card_name: e.target.value })
          }
          required
        />
        <Input
          label="Bank Name"
          value={formData.bank_name}
          onChange={(e) =>
            setFormData({ ...formData, bank_name: e.target.value })
          }
        />
        <Input
          label="Credit Limit"
          type="number"
          value={formData.credit_limit}
          onChange={(e) =>
            setFormData({ ...formData, credit_limit: e.target.value })
          }
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Bill Date"
            type="number"
            min="1"
            max="31"
            value={formData.bill_date}
            onChange={(e) =>
              setFormData({ ...formData, bill_date: e.target.value })
            }
          />
          <Input
            label="Due Date"
            type="number"
            min="1"
            max="31"
            value={formData.due_date}
            onChange={(e) =>
              setFormData({ ...formData, due_date: e.target.value })
            }
          />
        </div>
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}
