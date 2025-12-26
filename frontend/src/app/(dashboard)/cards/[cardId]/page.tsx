"use client";

import React, { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit3, Trash2, Plus, Filter, Calendar } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button, ProgressBar, Modal, Input, Badge, CardVisual } from "@/components/ui";
import { useToast } from "@/components/ui/feedback/Toast";
import {
  CategoryBreakdownChart,
} from "@/components/features/analytics/Charts";
import { formatCurrency, cn, getCardGradient, calculateUtilization } from "@/lib/utils";
import { cardApi, type Card, type CardFormData } from "@/lib/api/cards";
import { transactionApi, type Transaction, type TransactionFormData } from "@/lib/api/transactions";

const tabs = [
  { key: "transactions", label: "Transactions" },
  { key: "insights", label: "Insights" },
];

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();
  const cardId = params.cardId as string;

  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "transactions"
  );
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showEditCard, setShowEditCard] = useState(false);

  // Fetch Card Details
  const { data: card, isLoading: isCardLoading } = useQuery({
    queryKey: ["card", cardId],
    queryFn: () => cardApi.getCard(cardId),
  });

  // Fetch Transactions
  const { data: transactionResponse, isLoading: isTransactionsLoading } = useQuery({
    queryKey: ["transactions", cardId],
    queryFn: () => transactionApi.getTransactions({ cardId, limit: 50 }),
  });

  const transactions = transactionResponse?.data || [];

  // Fetch Current Statement (replaces statistics)
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const { data: statement, isLoading: isStatsLoading } = useQuery({
    queryKey: ["card-statement", cardId, currentMonth, currentYear],
    queryFn: () => cardApi.getCardStatement(cardId, currentMonth, currentYear),
  });

  // Delete Card Mutation
  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => cardApi.deleteCard(id),
    onSuccess: () => {
      success("Card deleted successfully");
      router.push("/cards");
    },
    onError: (error: unknown) => {
      const err = error as unknown as { response?: { data?: { message?: string } } };
      errorToast(err.response?.data?.message || "Failed to delete transaction");
    },
  });

  // Update Card Mutation
  const updateCardMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CardFormData> }) =>
      cardApi.updateCard(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      success("Card updated successfully");
      setShowEditCard(false);
    },
    onError: (error: unknown) => {
      const err = error as unknown as { response?: { data?: { message?: string } } };
      errorToast(err.response?.data?.message || "Failed to update transaction");
    },
  });

  // Add Transaction Mutation
  const addTransactionMutation = useMutation({
    mutationFn: (data: TransactionFormData) => transactionApi.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", cardId] });
      queryClient.invalidateQueries({ queryKey: ["card", cardId] }); // Balance might change
      queryClient.invalidateQueries({ queryKey: ["card-statement", cardId] });
      success("Transaction added successfully");
      setShowAddTransaction(false);
    },
    onError: (error: unknown) => {
      const err = error as unknown as { response?: { data?: { message?: string } } };
      errorToast(err.response?.data?.message || "Failed to add transaction");
    },
  });

  if (isCardLoading) {
    return (
      <AppLayout title="Card Details" showRightSidebar={false}>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading card details...</div>
        </div>
      </AppLayout>
    );
  }

  if (!card) {
    return (
      <AppLayout title="Card Not Found" showRightSidebar={false}>
        <div className="text-center py-12">
          <p className="text-secondary-text mb-4">Card not found</p>
          <Button onClick={() => router.push("/cards")}>Back to Cards</Button>
        </div>
      </AppLayout>
    );
  }

  const creditLimit = card.credit_limit || 0;
  const currentBalance = card.current_balance || 0;
  const availableCredit = creditLimit - currentBalance;
  const utilization = calculateUtilization(currentBalance, creditLimit);
  const gradient = getCardGradient(card.card_name || card.bank_name || "default");

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${card.card_name}?`)) {
      deleteCardMutation.mutate(card.id);
    }
  };

  return (
    <AppLayout title={card.card_name} showRightSidebar={false}>
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
                {card.card_name}
              </h1>
              <p className="text-secondary-text">{card.bank_name}</p>
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
            <Button variant="error" size="sm" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Card Visual and Metrics */}
        <div className="bg-card-bg rounded-lg p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card Visual */}
            <div className="flex justify-center lg:justify-start">
               <CardVisual
                  cardName={card.card_name}
                  cardNumber={card.card_number_last4}
                  gradient={gradient}
                  className="w-full max-w-md aspect-[1.586/1]"
                />
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-secondary-text">Current Balance</p>
                <p className="text-2xl font-bold text-primary-text">
                  {formatCurrency(currentBalance)}
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
                  value={currentBalance}
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
              transactions={transactions}
              isLoading={isTransactionsLoading}
              onAddTransaction={() => setShowAddTransaction(true)}
            />
          )}
          {activeTab === "insights" && (
            <InsightsTab
              statement={statement}
              isLoading={isStatsLoading}
            />
          )}
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        cardId={cardId}
        onSubmit={(data) => addTransactionMutation.mutate(data)}
        isSubmitting={addTransactionMutation.isPending}
      />

      {/* Edit Card Modal */}
      <EditCardModal
        isOpen={showEditCard}
        onClose={() => setShowEditCard(false)}
        card={card}
        onSubmit={(data) => updateCardMutation.mutate({ id: card.id, data })}
        isSubmitting={updateCardMutation.isPending}
      />
    </AppLayout>
  );
}

// Transactions Tab Component
interface TransactionsTabProps {
  transactions: Transaction[];
  isLoading: boolean;
  onAddTransaction: () => void;
}

function TransactionsTab({
  transactions,
  isLoading,
  onAddTransaction,
}: TransactionsTabProps) {
  if (isLoading) {
    return <div className="text-center py-8">Loading transactions...</div>;
  }

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
        {transactions.length === 0 ? (
            <div className="text-center py-12 text-secondary-text">
                No transactions found. Add one to get started.
            </div>
        ) : (
        <table className="w-full">
          <thead className="bg-hover-bg">
            <tr>
              <th className="text-left p-4 font-medium text-secondary-text">Date</th>
              <th className="text-left p-4 font-medium text-secondary-text">Description</th>
              <th className="text-left p-4 font-medium text-secondary-text">Category</th>
              <th className="text-left p-4 font-medium text-secondary-text">Amount</th>
              <th className="text-left p-4 font-medium text-secondary-text">Cycle</th>
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
                <td className="p-4 text-primary-text">
                    <div className="font-medium">{item.merchant}</div>
                    <div className="text-xs text-secondary-text">{item.description}</div>
                </td>
                <td className="p-4">
                  <Badge label={item.category || "Uncategorized"} variant="default" />
                </td>
                <td className="p-4">
                  <span
                    className={cn(
                      "font-medium",
                      item.transaction_type === "credit" ? "text-success" : "text-primary-text"
                    )}
                  >
                    {item.transaction_type === "credit" ? "+" : ""}
                    {formatCurrency(item.amount)}
                  </span>
                </td>
                <td className="p-4 text-primary-text">
                  {item.bill_month}/{item.bill_year}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

// Insights Tab Component
interface InsightsTabProps {
  statement?: unknown; // Replace with proper type
  isLoading: boolean;
}

function InsightsTab({
  statement,
  isLoading,
}: InsightsTabProps) {
    if (isLoading) {
        return <div className="text-center py-8">Loading insights...</div>;
    }

    if (!statement) {
        return <div className="text-center py-8">No data available for insights.</div>;
    }

    // Transform stats for charts
    // Using statement summary
    const categoryData: unknown[] = []; // Statement doesn't have category breakdown yet, would need to aggregate transactions

    return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-primary-text">Current Statement Insights</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charts would go here */}
        {/* <CategoryBreakdownChart data={categoryData} height={250} /> */}
        
        {/* Key Metrics */}
        <div className="bg-card-bg rounded-lg p-6">
          <h3 className="text-lg font-semibold text-primary-text mb-4">
            Statement Summary
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-secondary-text">Total Debits</span>
              <span className="font-semibold text-primary-text">
                {formatCurrency((statement as any)?.summary?.total_spends || 0)}
              </span>
            </div>
             <div className="flex justify-between items-center">
              <span className="text-secondary-text">Total Credits</span>
              <span className="font-semibold text-success">
                {formatCurrency((statement as any)?.summary?.total_payments || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary-text">Net Amount</span>
              <span className="font-semibold text-primary-text">
                {formatCurrency((statement as any)?.summary?.min_due || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary-text">Transaction Count</span>
              <span className="font-semibold text-primary-text">
                {(statement as any)?.summary?.transactionCount || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add Transaction Modal Component
interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  onSubmit: (data: TransactionFormData) => void;
  isSubmitting: boolean;
}

function AddTransactionModal({
  isOpen,
  onClose,
  cardId,
  onSubmit,
  isSubmitting,
}: AddTransactionModalProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    cardId: cardId,
    amount: 0,
    transactionDate: new Date().toISOString().split('T')[0],
    merchant: "",
    category: "",
    transactionType: "debit",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          value={formData.amount.toString()}
          onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
          required
        />
        <Input
          label="Date"
          type="date"
          value={formData.transactionDate}
          onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
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
          placeholder="e.g. Food, Travel"
          required
        />
        <Input
          label="Description"
          value={formData.description || ""}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
        />
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Add Transaction"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Edit Card Modal Component
interface EditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Card;
  onSubmit: (data: Partial<CardFormData>) => void;
  isSubmitting: boolean;
}

function EditCardModal({ isOpen, onClose, card, onSubmit, isSubmitting }: EditCardModalProps) {
  const [formData, setFormData] = useState({
    cardName: card.card_name,
    bankName: card.bank_name,
    creditLimit: (card.credit_limit || 0).toString(),
    billDate: card.bill_date.toString(),
    dueDate: card.due_date.toString(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
        cardName: formData.cardName,
        bankName: formData.bankName,
        creditLimit: parseFloat(formData.creditLimit),
        billDate: parseInt(formData.billDate),
        dueDate: parseInt(formData.dueDate),
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Card">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Card Name"
          value={formData.cardName}
          onChange={(e) =>
            setFormData({ ...formData, cardName: e.target.value })
          }
          required
        />
        <Input
          label="Bank Name"
          value={formData.bankName}
          onChange={(e) =>
            setFormData({ ...formData, bankName: e.target.value })
          }
        />
        <Input
          label="Credit Limit"
          type="number"
          value={formData.creditLimit}
          onChange={(e) =>
            setFormData({ ...formData, creditLimit: e.target.value })
          }
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Bill Date"
            type="number"
            min="1"
            max="31"
            value={formData.billDate}
            onChange={(e) =>
              setFormData({ ...formData, billDate: e.target.value })
            }
          />
          <Input
            label="Due Date"
            type="number"
            min="1"
            max="31"
            value={formData.dueDate}
            onChange={(e) =>
              setFormData({ ...formData, dueDate: e.target.value })
            }
          />
        </div>
        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
             {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
