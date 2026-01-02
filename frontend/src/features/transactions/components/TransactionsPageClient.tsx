"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Filter as FilterIcon,
  X,
  Upload,
  AlertTriangle,
  Zap,
  Search,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/shared/components/layout";
import {
  Button,
  Input,
  DataTable,
  Badge,
  Modal,
  type Column,
} from "@/shared/components/ui";
import { formatCurrency, formatDate, cn } from "@/shared/utils";
import {
  transactionApi,
  type TransactionFormData,
  type TransactionFilters,
  type Transaction,
  type TransactionType,
} from "@/features/transactions/api";
import { cardApi } from "@/features/cards/api";
import { useToast } from "@/shared/components/ui/feedback/Toast";
import { BulkImportModal } from "@/features/transactions/components/BulkImportModal";
import { TransactionDetailModal } from "@/features/transactions/components/TransactionDetailModal";
import { TransactionActions } from "@/features/transactions/components/TransactionActions";
import { BulkActionToolbar } from "@/features/transactions/components/BulkActionToolbar";
import { BulkCategoryModal } from "@/features/transactions/components/BulkCategoryModal";
import { Checkbox } from "@/shared/components/ui/primitives/checkbox";
import { InlineEditCell } from "@/features/transactions/components/InlineEditCell";
import { GmailUtils } from "@/shared/utils/gmailUtils";
import { RuleSuggestionsPanel } from "@/features/rules/components/RuleSuggestionPanel";
import { MergeTransactionsModal } from "@/features/transactions/components/MergeTransactionsModal";

interface TransactionModalData {
  id?: string;
  cardId: string;
  transactionDate: string;
  merchant: string;
  category: string;
  amount: number;
  transactionType: TransactionType;
  description: string;
}

import { queryKeys } from "@/lib/react-query/keys";

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();

  // State
  const [searchValue, setSearchValue] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "spends" | "income" | "bills" | "review">("all");
  const [showModal, setShowModal] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionModalData | null>(null);
  const [selectedTransaction, setSelectedTransaction] = 
    useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Split transaction state
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splits, setSplits] = useState<Array<{category: string, amount: number, description: string}>>([{ category: "", amount: 0, description: "" }]);

  // Filters state
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [categoryFilter, setCategoryFilter] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Fetch cards for filter dropdown
  const { data: cards = [] } = useQuery({
    queryKey: queryKeys.cards.all,
    queryFn: () => cardApi.getCards(),
  });

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [sortScope] = useState<"page" | "all">("page");

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

    if (activeTab === "spends") f.transactionType = "debit";
    else if (activeTab === "income") f.transactionType = "credit"; 
    else if (activeTab === "bills") f.transactionType = "bill_payment";
    else if (activeTab === "review") {
        (f as unknown as { needsReview: boolean }).needsReview = true;
    }

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
    queryKey: queryKeys.transactions.list(appliedFilters as unknown as Record<string, unknown>),
    queryFn: () => transactionApi.getTransactions(appliedFilters),
  });

  const transactions = useMemo(() => transactionsResponse?.data || [], [transactionsResponse]);
  const pagination = transactionsResponse?.pagination;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: TransactionFormData) =>
      transactionApi.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
      window.dispatchEvent(new CustomEvent("transactions-updated"));
      success("Transaction added successfully");
      setShowModal(false);
      setEditingTransaction(null);
    },
    onError: (error: Error) => {
      const err = error as unknown as { response?: { data?: { message?: string } } };
      errorToast(err.response?.data?.message || "Failed to add transaction");
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
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      window.dispatchEvent(new CustomEvent("transactions-updated"));
      success("Transaction updated successfully");
      setShowModal(false);
      setEditingTransaction(null);
    },
    onError: (error: Error) => {
      const err = error as unknown as { response?: { data?: { message?: string } } };
      errorToast(
        err.response?.data?.message || "Failed to update transaction"
      );
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionApi.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });

      window.dispatchEvent(new CustomEvent("transactions-updated"));
      success("Transaction deleted successfully");
    },
    onError: (error: Error) => {
      const err = error as unknown as { response?: { data?: { message?: string } } };
      errorToast(
        err.response?.data?.message || "Failed to delete transaction"
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
      transactionType: formData.get("transactionType") as TransactionType,
      description: formData.get("description") as string,
    };

    if (editingTransaction?.id) {
      updateMutation.mutate({ id: editingTransaction.id, data });
    } else {
      if (isSplitMode) {
         // Handle Split Transaction Creation
         const parentAmount = data.amount;
         const splitTotal = splits.reduce((sum, s) => sum + Number(s.amount), 0);
         
         if (Math.abs(parentAmount - splitTotal) > 0.01) {
             errorToast(`Split total (${splitTotal}) must match transaction amount (${parentAmount})`);
             return;
         }

         // 1. Create Parent
         createMutation.mutateAsync({
             ...data,
             description: data.description || "Split Transaction Parent"
         }).then((parentTx) => {
             // 2. Create Children
             const childPromises = splits.map(split => 
                 createMutation.mutateAsync({
                     ...data,
                     category: split.category,
                     amount: Number(split.amount),
                     description: split.description,
                     parentTransactionId: parentTx.id
                 })
             );
             
             return Promise.all(childPromises);
         }).catch(err => {
             console.error("Failed to create split transactions", err);
         });

      } else {
         createMutation.mutate(data);
      }
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction({
      id: transaction.id,
      cardId: transaction.card_id || "",
      transactionDate: (transaction.transaction_date || "").split("T")[0],
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

  // Inline Edit Handler
  const handleInlineUpdate = async (id: string, field: keyof TransactionFormData, value: string | number) => {
    try {
      await updateMutation.mutateAsync({
        id,
        data: { [field]: value },
      });
    } catch (error) {
       // Error handled by mutation
    }
  };

  // Bulk Actions
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const ids = new Set(transactions.map((t) => t.id));
      setSelectedTransactionIds(ids);
    } else {
      setSelectedTransactionIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedTransactionIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedTransactionIds(newSelected);
  };

  const handleBulkDelete = async () => {
     if (!confirm(`Are you sure you want to delete ${selectedTransactionIds.size} transactions?`)) return;
     
     setIsBulkProcessing(true);
     try {
       await transactionApi.bulkDelete(Array.from(selectedTransactionIds));
       queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
       queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
       success(`Deleted ${selectedTransactionIds.size} transactions`);
       setSelectedTransactionIds(new Set());
     } catch (error) {
       errorToast("Failed to delete transactions");
     } finally {
       setIsBulkProcessing(false);
     }
  };

  const handleBulkCategorize = async (category: string) => {
    setIsBulkProcessing(true);
    try {
      await transactionApi.bulkUpdate(Array.from(selectedTransactionIds), { category });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      success(`Updated ${selectedTransactionIds.size} transactions`);
      setSelectedTransactionIds(new Set());
      setShowBulkCategoryModal(false);
    } catch (error) {
      errorToast("Failed to update transactions");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const uniqueCategories = useMemo(() => {
    const cats = new Set(transactions.map((t) => t.category).filter((c): c is string => !!c));
    return Array.from(cats).sort();
  }, [transactions]);


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
    if (sortScope === "all") return transactions;
    
    if (!sortConfig) return transactions;
    
    const sorted = [...transactions].sort((a, b) => {
      let aValue: string | number = a[sortConfig.key as keyof Transaction] as string | number;
      let bValue: string | number = b[sortConfig.key as keyof Transaction] as string | number;
      
      if (sortConfig.key === "transaction_date") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
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
      key: "select",
      header: (
        <Checkbox
          checked={transactions.length > 0 && selectedTransactionIds.size === transactions.length}
          onChange={(e) => handleSelectAll(e.target.checked)}
          className="translate-y-[2px]"
        />
      ) as any,
      render: (_: unknown, row: unknown) => (
        <Checkbox
          checked={selectedTransactionIds.has((row as Transaction).id)}
          onChange={(e) => handleSelectRow((row as Transaction).id, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="translate-y-[2px]"
        />
      ),
    },
    {
      key: "transaction_date",
      header: "Date",
      sortable: true,
      render: (value: unknown) => (
         <span className="text-secondary-text text-sm whitespace-nowrap">
            {formatDate(value as string, "short")}
         </span>
      ),
    },
    {
      key: "merchant",
      header: "Details",
      render: (value: unknown, row: unknown) => {
        const tx = row as Transaction;
        return (
            <div className="flex items-center space-x-3 min-w-[200px]" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-10 bg-primary-green/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-primary-green">
                {(value as string)?.charAt(0)?.toUpperCase()}
                </span>
            </div>
            <div className="flex flex-col flex-1">
                <span className="font-semibold text-primary-text">
                   {value as string}
                </span>
                <div className="flex items-center gap-2 text-xs text-secondary-text mt-1">
                   <div className="w-32">
                     <InlineEditCell 
                        value={tx.category || "Uncategorized"} 
                        onSave={(val) => handleInlineUpdate(tx.id, 'category', val)}
                        className="text-xs py-0 px-1 hover:bg-hover-bg rounded border border-transparent hover:border-border"
                     />
                   </div>
                   {tx.description && (
                     <>
                       <span>•</span>
                       <span className="max-w-[150px] truncate" title={tx.description}>
                         {tx.description}
                       </span>
                     </>
                   )}
                </div>
            </div>
            </div>
        );
      },
    },
    {
      key: "card",
      header: "Card",
      render: (_: unknown, row: unknown) => {
        const transaction = row as Transaction;
        const card = transaction.card;
        
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-primary-text">
               {card?.card_name || "Unknown Card"}
            </span>
            <span className="text-xs text-secondary-text">
               {card?.bank_name || ""} {card?.last_four ? `••${card.last_four}` : ""}
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Info",
      render: (_: unknown, row: unknown) => {
        const tx = row as Transaction;
        return (
          <div className="flex items-center gap-2">
            {tx.needs_review && (
                <div title="Needs Review" className="text-warning">
                   <AlertTriangle className="w-4 h-4" />
                </div>
            )}

            {tx.classification_method === 'regex' && (
                <div title="Extracted by Pattern" className="text-secondary-text">
                   <Zap className="w-4 h-4" />
                </div>
            )}
            {tx.email_message_id && (
                <div title="From Email" className="text-blue-400">
                    <span className="sr-only">Email</span>
                   {/* We can put an icon here if needed, but mail is in actions */}
                </div>
            )}
          </div>
        );
      },
    },
    {
       key: "amount",
       header: "Amount",
       sortable: true,
       render: (value: unknown, row: unknown) => {
         const type = (row as Transaction).transaction_type;
         const amount = Math.abs(value as number);
         
         if (type === "bill_payment") {
           return (
             <div className="flex flex-col items-end">
                <span className="font-bold text-primary-text">
                  {formatCurrency(amount)}
                </span>
                <Badge label="Bill Payment" variant="info" size="sm" className="mt-1 origin-right scale-90" />
             </div>
           );
         }
 
         const isCredit = type === "credit" || type === "refund";
         
         return (
             <div className="flex flex-col items-end">
                <span
                    className={cn(
                    "font-bold",
                    isCredit ? "text-success" : "text-error"
                    )}
                >
                    {isCredit ? "+" : "-"} {formatCurrency(amount)}
                </span>
                <span className="text-xs text-secondary-text capitalize mt-0.5">
                   {type}
                </span>
             </div>
         );
       },
    },
    {
      key: "actions",
      header: "",
      render: (_: unknown, row: unknown) => (
        <div className="flex justify-end">
            <TransactionActions 
                onViewDetails={() => {
                    setSelectedTransaction(row as unknown as Transaction);
                    setShowDetailModal(true);
                }}
                onEdit={() => handleEdit(row as unknown as Transaction)}
                onDelete={() => handleDelete((row as unknown as Transaction).id)}
                onViewGmail={(row as Transaction).email_message_id ? () => {
                    window.open(GmailUtils.getMailLink((row as Transaction).email_message_id!), "_blank");
                } : undefined}
            />
        </div>
      ),
    },
  ];

  const tabs = [
    { key: "all" as const, label: "All" },
    { key: "spends" as const, label: "Spends" },
    { key: "income" as const, label: "Income" },
    { key: "bills" as const, label: "Bill Payments" },
    { key: "review" as const, label: "Needs Review" },
  ];

  return (
    <AppLayout title="Transactions" showRightSidebar={false}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-4">
                {/* Tabs */}
                <div className="flex space-x-1 bg-card-bg p-1 rounded-lg border border-border">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        "px-4 py-2 rounded-md text-sm font-medium transition-all",
                        activeTab === tab.key
                          ? "bg-primary-green/10 text-primary-green shadow-sm"
                          : "text-secondary-text hover:text-primary-text hover:bg-hover-bg"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
             </div>

             <div className="flex gap-2">
                <Button 
                    variant="secondary"
                    onClick={() => {
                        // Export Logic
                        const headers = ["Date", "Merchant", "Amount", "Type", "Category", "Card", "Description"];
                        const rows = transactions.map(t => [
                            t.transaction_date.split('T')[0],
                            `"${t.merchant.replace(/"/g, '""')}"`, // Escape quotes
                            t.transaction_type === 'debit' ? -Math.abs(t.amount) : Math.abs(t.amount),
                            t.transaction_type,
                            `"${(t.category || "").replace(/"/g, '""')}"`,
                            `"${(t.card?.card_name || 'Unknown').replace(/"/g, '""')}"`,
                            `"${(t.description || '').replace(/"/g, '""')}"`
                        ]);
                        
                        const csvContent = [
                            headers.join(','),
                            ...rows.map(r => r.join(','))
                        ].join('\n');
                        
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                >
                    <Upload className="w-4 h-4 mr-2 rotate-180" /> {/* Re-using upload icon rotated for download look */}
                    Export
                </Button>
                <Button onClick={handleAddNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Transaction
                </Button>
             </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
            <div className="flex-1 w-full lg:max-w-md relative">
               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-text" />
               <Input
                  placeholder="Search transactions..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full pl-10"
               />
            </div>
            
            <div className="flex gap-2 flex-wrap items-center">
               <Button
                  variant="secondary"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(showFilters && "bg-hover-bg")}
               >
                  <FilterIcon className="w-4 h-4 mr-2" />
                  Filter
                  {(selectedCard || dateRange.start || categoryFilter) && (
                    <div className="h-2 w-2 rounded-full bg-primary-green ml-2" />
                  )}
               </Button>
               
               <div className="flex items-center gap-2">
                 <Button 
                    variant="ghost" 
                    onClick={() => setShowBulkImport(true)}
                    className="text-primary-green hover:text-primary-green/80 flex items-center gap-2"
                 >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">Import</span>
                 </Button>
               </div>
            </div>
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-secondary-text uppercase tracking-wider pl-1">Card</label>
                <div className="relative">
                    <select
                        value={selectedCard}
                        onChange={(e) => setSelectedCard(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-primary-bg text-primary-text appearance-none hover:border-primary-green/50 focus:border-primary-green focus:ring-1 focus:ring-primary-green transition-all outline-none"
                        >
                        <option value="">All Cards</option>
                        {cards.map((card) => (
                            <option key={card.id} value={card.id}>
                            {card.card_name}
                            </option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary-text">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-secondary-text uppercase tracking-wider pl-1">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, start: e.target.value })
                  }
                  className="rounded-xl border-border bg-primary-bg h-[42px]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-secondary-text uppercase tracking-wider pl-1">
                  End Date
                </label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, end: e.target.value })
                  }
                  className="rounded-xl border-border bg-primary-bg h-[42px]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-secondary-text uppercase tracking-wider pl-1">
                  Category
                </label>
                <Input
                  placeholder="e.g., Shopping"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-xl border-border bg-primary-bg h-[42px]"
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
            <div className="overflow-x-auto -mx-6 px-6 pb-4">
              <RuleSuggestionsPanel />
              <DataTable
              columns={columns}
              data={sortedTransactions as unknown as Record<string, unknown>[]}
              onRowClick={(row) => handleRowClick(row as unknown as Transaction)}
              sortable={true}
              onSort={handleSort}
              emptyMessage="No transactions found"
            />
            </div>

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

      <BulkActionToolbar 
        selectedCount={selectedTransactionIds.size}
        onClearSelection={() => setSelectedTransactionIds(new Set())}
        onBulkDelete={handleBulkDelete}
        onBulkCategorize={() => setShowBulkCategoryModal(true)}
        onBulkMerge={() => setShowMergeModal(true)}
        isDeleting={isBulkProcessing}
      />

      <BulkCategoryModal
        isOpen={showBulkCategoryModal}
        onClose={() => setShowBulkCategoryModal(false)}
        onConfirm={handleBulkCategorize}
        selectedCount={selectedTransactionIds.size}
        categories={uniqueCategories as string[]}
        isLoading={isBulkProcessing}
      />

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
            {/* Split Transaction UI */}
            <div className="flex items-center mt-2 mb-2">
                <input 
                    type="checkbox" 
                    id="split-toggle"
                    checked={isSplitMode}
                    onChange={(e) => setIsSplitMode(e.target.checked)}
                    className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="split-toggle" className="text-sm font-medium text-gray-700 cursor-pointer">Split this transaction</label>
            </div>
            
            {isSplitMode && (
                <div className="mt-2 border p-3 rounded-md bg-gray-50 mb-4">
                    <div className="flex justify-between mb-2 items-center">
                        <span className="font-medium text-sm text-gray-700">Split Items</span>
                        <span className="text-sm font-medium text-gray-600">
                            Total: <span className="text-indigo-600">{splits.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0).toFixed(2)}</span>
                        </span>
                    </div>
                    {splits.map((split, idx) => (
                        <div key={idx} className="flex gap-2 mb-2 items-start">
                            <div className="flex-1">
                                <Input 
                                    placeholder="Category" 
                                    value={split.category} 
                                    onChange={(e) => {
                                        const newSplits = [...splits];
                                        newSplits[idx].category = e.target.value;
                                        setSplits(newSplits);
                                    }}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="w-24">
                                <Input 
                                    type="number" 
                                    placeholder="Amt" 
                                    value={split.amount} 
                                    onChange={(e) => {
                                        const newSplits = [...splits];
                                        newSplits[idx].amount = parseFloat(e.target.value);
                                        setSplits(newSplits);
                                    }}
                                    className="h-9 text-sm"
                                />
                            </div>
                             <div className="flex-1">
                                <Input 
                                    placeholder="Description" 
                                    value={split.description} 
                                    onChange={(e) => {
                                        const newSplits = [...splits];
                                        newSplits[idx].description = e.target.value;
                                        setSplits(newSplits);
                                    }}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={() => {
                                    const newSplits = [...splits];
                                    newSplits.splice(idx, 1);
                                    setSplits(newSplits);
                                }}
                                className="h-9 w-9 p-0 text-gray-500 hover:text-red-600"
                            >
                                <X size={16} />
                            </Button>
                        </div>
                    ))}
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSplits([...splits, { category: '', amount: 0, description: '' }])}
                        className="w-full mt-2 border-dashed border-gray-300 text-gray-600 hover:text-indigo-600 hover:border-indigo-300"
                    >
                        <Plus size={14} className="mr-1" /> Add Split
                    </Button>
                </div>
            )}
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
              <option value="bill_payment">Bill Payment</option>
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

      {/* Merge Transactions Modal */}
      <MergeTransactionsModal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        selectedTransactions={transactions.filter(t => selectedTransactionIds.has(t.id))}
        onSuccess={() => setSelectedTransactionIds(new Set())}
      />
    </AppLayout>
  );
}
