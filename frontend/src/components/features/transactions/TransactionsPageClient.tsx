"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Download,
  Filter as FilterIcon,
  X,
  Upload,
  Mail,
  ExternalLink,
  Shield, 
  Zap, 
  AlertTriangle,
  Brain,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import {
  Button,
  Input,
  DataTable,
  Badge,
  Modal,
  type Column,
} from "@/components/ui";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  transactionApi,
  type TransactionFormData,
  type TransactionFilters,
  type Transaction,
} from "@/lib/api/transactions";
import { cardApi } from "@/lib/api/cards";
import { useToast } from "@/components/ui/feedback/Toast";
import { BulkImportModal } from "@/components/features/transactions/BulkImportModal";
import { TransactionDetailModal } from "@/components/features/transactions/TransactionDetailModal";
import { GmailUtils } from "@/lib/utils/gmailUtils";

interface TransactionModalData {
  id?: string;
  cardId: string;
  transactionDate: string;
  merchant: string;
  category: string;
  amount: number;
  transactionType: "debit" | "credit" | "refund";
  description: string;
}

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();

  // State
  const [searchValue, setSearchValue] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "debit" | "credit">("all");
  const [showModal, setShowModal] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionModalData | null>(null);
  const [selectedTransaction, setSelectedTransaction] = 
    useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Filters state
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [categoryFilter, setCategoryFilter] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Fetch cards for filter dropdown
  const { data: cards = [] } = useQuery({
    queryKey: ["cards"],
    queryFn: () => cardApi.getCards(),
  });

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [sortScope, setSortScope] = useState<"page" | "all">("page");

  // Build filters object
  const appliedFilters = useMemo(() => {
    const f: TransactionFilters = {
      merchant: searchValue || undefined,
      cardId: selectedCard || undefined,
      from: dateRange.start || undefined,
      to: dateRange.end || undefined,
      category: categoryFilter || undefined,
      page: currentPage,
      limit: pageSize,
    };

    if (activeTab === "debit") f.transactionType = "debit";
    else if (activeTab === "credit") f.transactionType = "credit";

    // Apply backend sorting if scope is 'all'
    if (sortScope === "all" && sortConfig) {
      f.sortBy = sortConfig.key;
      f.sortOrder = sortConfig.direction;
    }

    return f;
  }, [searchValue, selectedCard, dateRange, categoryFilter, activeTab, currentPage, pageSize, sortScope, sortConfig]);

  // Fetch transactions
  const {
    data: transactionsResponse,
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ["transactions", appliedFilters],
    queryFn: () => transactionApi.getTransactions(appliedFilters),
  });

  const transactions = transactionsResponse?.data || [];
  const pagination = transactionsResponse?.pagination;
  const aggregations = transactionsResponse?.aggregations;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: TransactionFormData) =>
      transactionApi.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] }); // If we had one
      window.dispatchEvent(new CustomEvent("transactions-updated"));
      success("Transaction added successfully");
      setShowModal(false);
      setEditingTransaction(null);
    },
    onError: (error: Error) => {
      errorToast((error as any)?.response?.data?.message || "Failed to add transaction");
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<TransactionFormData>;
    }) => transactionApi.updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      window.dispatchEvent(new CustomEvent("transactions-updated"));
      success("Transaction updated successfully");
      setShowModal(false);
      setEditingTransaction(null);
    },
    onError: (error: Error) => {
      errorToast(
        (error as any)?.response?.data?.message || "Failed to update transaction"
      );
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionApi.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      window.dispatchEvent(new CustomEvent("transactions-updated"));
      success("Transaction deleted successfully");
    },
    onError: (error: Error) => {
      errorToast(
        (error as any)?.response?.data?.message || "Failed to delete transaction"
      );
    },
  });

  // Form handling
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data: TransactionFormData = {
      cardId: formData.get("cardId") as string,
      transactionDate: formData.get("transactionDate") as string,
      merchant: formData.get("merchant") as string,
      category: formData.get("category") as string,
      amount: parseFloat(formData.get("amount") as string),
      transactionType: formData.get("transactionType") as
        | "debit"
        | "credit"
        | "refund",
      description: formData.get("description") as string,
    };

    if (editingTransaction?.id) {
      updateMutation.mutate({ id: editingTransaction.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction({
      id: transaction.id,
      cardId: transaction.card_id,
      transactionDate: transaction.transaction_date.split("T")[0],
      merchant: transaction.merchant,
      category: transaction.category,
      amount: Math.abs(transaction.amount),
      transactionType: transaction.transaction_type,
      description: transaction.description || "",
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleAddNew = () => {
    setEditingTransaction(null);
    setShowModal(true);
  };

  const applyFilters = () => {
    setCurrentPage(1);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setSelectedCard("");
    setDateRange({ start: "", end: "" });
    setCategoryFilter("");
    setSearchValue("");
    setActiveTab("all");
    setCurrentPage(1);
  };

  // Sort transactions (Client-side if scope is 'page')
  const sortedTransactions = useMemo(() => {
    // If sorting is handled by backend (scope 'all'), return as is
    if (sortScope === "all") return transactions;
    
    if (!sortConfig) return transactions;
    
    const sorted = [...transactions].sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof Transaction];
      let bValue: any = b[sortConfig.key as keyof Transaction];
      
      // Handle date sorting
      if (sortConfig.key === "transaction_date") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      // Handle amount sorting
      if (sortConfig.key === "amount") {
        aValue = Math.abs(Number(aValue));
        bValue = Math.abs(Number(bValue));
      }
      
      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
    
    return sorted;
  }, [transactions, sortConfig, sortScope]);

  const handleSort = (key: string, direction: "asc" | "desc") => {
    setSortConfig({ key, direction });
  };

  const handleRowClick = (row: Transaction) => {
    setSelectedTransaction(row);
    setShowDetailModal(true);
  };

  // Data table columns
  const columns: Column[] = [
    {
      key: "transaction_date",
      header: "Date",
      sortable: true,
      render: (value: unknown) => formatDate(value as string, "short"),
    },
    {
      key: "merchant",
      header: "Merchant",
      render: (value: unknown, row: unknown) => (
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary-green/20 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-primary-green">
              {(value as string)?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-medium">{value as string}</div>
            <div className="text-xs text-secondary-text">
              {(row as Transaction).description || ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (value: unknown, row: unknown) => {
        const type = (row as Transaction).transaction_type;
        const amount = Math.abs(value as number);
        return (
          <span
            className={cn(
              "font-semibold",
              type === "debit" ? "text-error" : "text-success"
            )}
          >
            {type === "debit" ? "-" : "+"}
            {formatCurrency(amount)}
          </span>
        );
      },
    },
    {
      key: "card",
      header: "Card",
      render: (_: unknown, row: unknown) => {
        const transaction = row as Transaction;
        const card = transaction.card;
        let cardLabel = "Unknown";
        
        if (card) {
          // Show bank name + last 4 digits if available
          if (card.bank_name && card.last_four) {
            cardLabel = `${card.bank_name} ${card.last_four}`;
          } else if (card.card_name && card.card_name !== "Unknown") {
            cardLabel = card.card_name;
          } else if (card.bank_name) {
            cardLabel = card.bank_name;
          }
        }
        
        return (
          <Badge
            label={cardLabel}
            variant="default"
            size="sm"
          />
        );
      },
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
      key: "status",
      header: "Status",
      render: (_: unknown, row: unknown) => {
        const tx = row as Transaction;
        return (
          <div className="flex flex-col gap-1 items-start">
            {tx.needs_review && (
              <Badge 
                label="Review" 
                variant="warning" 
                size="sm"
                icon={<AlertTriangle className="w-3 h-3" />}
              />
            )}
            {tx.detection_method === 'gpt' && (
              <div className="flex items-center gap-1 text-xs text-primary-green pixel-font" title="Extracted by AI">
                <Brain className="w-3 h-3" />
                <span>AI</span>
              </div>
            )}
            {tx.detection_method === 'regex' && (
              <div className="flex items-center gap-1 text-xs text-secondary-text" title="Extracted by Pattern">
                <Zap className="w-3 h-3" />
                <span>Rule</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "transaction_type",
      header: "Type",
      render: (value: unknown) => (
        <Badge
          label={((value as string) || "").toUpperCase()}
          variant={(value as string) === "credit" ? "success" : "warning"}
          size="sm"
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_: unknown, row: unknown) => (
        <div className="flex gap-2 text-nowrap">
          {(row as Transaction).gmail_message_id && (
             <Button
                variant="secondary"
                size="sm"
                title="View in Gmail"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(GmailUtils.getMailLink((row as Transaction).gmail_message_id!), "_blank");
                }}
             >
                <Mail className="w-4 h-4" />
             </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTransaction(row as unknown as Transaction);
              setShowDetailModal(true);
            }}
          >
            View Details
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(row as unknown as Transaction);
            }}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete((row as unknown as Transaction).id);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const tabs = [
    { key: "all" as const, label: "All" },
    { key: "debit" as const, label: "Expenses" },
    { key: "credit" as const, label: "Income" },
  ];

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

          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-secondary-text">Sort Scope:</span>
              <select
                value={sortScope}
                onChange={(e) => setSortScope(e.target.value as "page" | "all")}
                className="px-2 py-1 text-sm border rounded-lg bg-card-bg"
              >
                <option value="page">Current Page</option>
                <option value="all">All Data</option>
              </select>
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FilterIcon className="w-4 h-4 mr-2" />
              Filters
              {(selectedCard || dateRange.start || categoryFilter) && (
                <Badge label="•" variant="warning" size="sm" className="ml-1" />
              )}
            </Button>
            <Button variant="secondary" onClick={() => setShowBulkImport(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Bulk Import
            </Button>
            <Button variant="secondary">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button onClick={handleAddNew}>
              <Plus className="w-4 h-4 mr-2" />
              Add Transaction
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-card-bg rounded-lg p-6 space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Filters</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Card</label>
                <select
                  value={selectedCard}
                  onChange={(e) => setSelectedCard(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">All Cards</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.card_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, start: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  End Date
                </label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, end: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Category
                </label>
                <Input
                  placeholder="e.g., Shopping, Food"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={clearFilters}>
                Clear All
              </Button>
              <Button onClick={applyFilters}>Apply Filters</Button>
            </div>
          </div>
        )}

        {/* Stats Cards - Only show if aggregations are available */}
        {aggregations && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-card-bg rounded-lg p-6">
              <div className="text-sm text-secondary-text mb-1">
                Total Transactions
              </div>
              <div className="text-2xl font-bold text-primary-text">
                {aggregations.totalTransactions || 0}
              </div>
            </div>
            <div className="bg-card-bg rounded-lg p-6">
              <div className="text-sm text-secondary-text mb-1">Total Spent</div>
              <div className="text-2xl font-bold text-error">
                {formatCurrency(aggregations.totalSpent || 0)}
              </div>
            </div>
            {/* We don't have income/net in aggregations yet, so hiding or using placeholders */}
          </div>
        )}

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
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green mx-auto"></div>
            <p className="text-secondary-text mt-4">Loading transactions...</p>
          </div>
        )}

        {/* Error State */}
        {fetchError && (
          <div className="text-center py-12">
            <p className="text-error">Failed to load transactions</p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["transactions"] })
              }
            >
              Retry
            </Button>
          </div>
        )}

        {/* Transactions Table */}
        {!isLoading && !fetchError && (
          <>
            <DataTable
              columns={columns}
              data={sortedTransactions as unknown as Record<string, unknown>[]}
              onRowClick={(row) => handleRowClick(row as unknown as Transaction)}
              sortable={true}
              onSort={handleSort}
              emptyMessage="No transactions found"
            />

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <Button
                  variant="secondary"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-secondary-text">
                  Page {currentPage} of {pagination.totalPages}
                </span>
                <Button
                  variant="secondary"
                  disabled={currentPage === pagination.totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!isLoading && !fetchError && transactions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-secondary-text">
              {searchValue || selectedCard || dateRange.start
                ? "No transactions found matching your filters"
                : "No transactions yet. Add your first transaction!"}
            </p>
            {(searchValue || selectedCard || dateRange.start) && (
              <Button
                variant="secondary"
                className="mt-4"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Transaction Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingTransaction(null);
        }}
        title={editingTransaction?.id ? "Edit Transaction" : "Add Transaction"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Card *</label>
            <select
              name="cardId"
              required
              defaultValue={editingTransaction?.cardId || ""}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select a card</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.card_name} - {card.bank_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Date *</label>
            <Input
              type="date"
              name="transactionDate"
              required
              defaultValue={
                editingTransaction?.transactionDate ||
                new Date().toISOString().split("T")[0]
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Merchant Name *
            </label>
            <Input
              name="merchant"
              required
              placeholder="e.g., Amazon, Starbucks"
              defaultValue={editingTransaction?.merchant || ""}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Category *</label>
            <Input
              name="category"
              required
              placeholder="e.g., Shopping, Food & Dining"
              defaultValue={editingTransaction?.category || ""}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Amount *</label>
            <Input
              type="number"
              name="amount"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              defaultValue={editingTransaction?.amount || ""}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Type *</label>
            <select
              name="transactionType"
              required
              defaultValue={editingTransaction?.transactionType || "debit"}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="debit">Debit (Expense)</option>
              <option value="credit">Credit (Income)</option>
              <option value="refund">Refund</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Optional notes about this transaction"
              defaultValue={editingTransaction?.description || ""}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowModal(false);
                setEditingTransaction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingTransaction?.id
                  ? "Update Transaction"
                  : "Add Transaction"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        cards={cards}
      />

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
      />
    </AppLayout>
  );
}
