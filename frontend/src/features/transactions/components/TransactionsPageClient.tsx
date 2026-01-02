"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Filter as FilterIcon,
  X,
  Search,
  CheckSquare,
  Square,
  MoreVertical,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CreditCard,
  Tag,
  Trash2,
  Edit2,
  Check
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Badge } from "@/shared/components/ui";
import { formatCurrency, formatDate, cn } from "@/shared/utils";
import {
  transactionApi,
  type TransactionFilters,
  type Transaction,
  type TransactionFormData
} from "@/features/transactions/api";
import { cardApi } from "@/features/cards/api";
import { useToast } from "@/shared/utils/toast";
import { queryKeys } from "@/lib/react-query/keys";

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();

  // --- State ---
  const [searchValue, setSearchValue] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "spends" | "income">("all");
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [filterCardId, setFilterCardId] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDate, setFilterDate] = useState({ start: "", end: "" });

  // Bulk Edit State
  const [bulkCategory, setBulkCategory] = useState("");
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  // --- Data Fetching ---
  const { data: cards = [] } = useQuery({
    queryKey: queryKeys.cards.all,
    queryFn: () => cardApi.getCards(),
  });

  const filters: TransactionFilters = useMemo(() => ({
    merchant: searchValue || undefined,
    cardId: filterCardId || undefined,
    category: filterCategory || undefined,
    from: filterDate.start || undefined,
    to: filterDate.end || undefined,
    // Add strict typing for transactionType if needed, casting for now
    transactionType: activeTab === 'spends' ? 'debit' : activeTab === 'income' ? 'credit' : undefined,
    page: 1,
    limit: 100, // Load more for list view
  }), [searchValue, filterCardId, filterCategory, filterDate, activeTab]);

  const { data: txResponse, isLoading } = useQuery({
    queryKey: queryKeys.transactions.list(filters as any),
    queryFn: () => transactionApi.getTransactions(filters),
  });

  const transactions = txResponse?.data || [];
  
  const selectedTransaction = useMemo(() => 
    transactions.find(t => t.id === selectedTxId), 
  [transactions, selectedTxId]);

  // --- Mutations ---
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TransactionFormData> }) =>
      transactionApi.updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      success("Transaction updated");
    },
    onError: () => errorToast("Failed to update"),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, category }: { ids: string[]; category: string }) => 
        transactionApi.bulkUpdate(ids, { category }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
        success("Bulk update successful");
        setSelectedIds(new Set());
        setShowBulkEdit(false);
    }
  });

  const deleteMutation = useMutation({
      mutationFn: (id: string) => transactionApi.deleteTransaction(id),
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
          if(selectedTxId) setSelectedTxId(null);
          success("Deleted transaction");
      }
  });

  // --- Handlers ---
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkCategorize = () => {
      if(!bulkCategory) return;
      bulkUpdateMutation.mutate({
          ids: Array.from(selectedIds),
          category: bulkCategory
      });
  };

  // --- Render ---
  return (
    <div className="flex h-[calc(100vh-100px)] -mt-4 gap-4 overflow-hidden">
        
      {/* LEFT PANEL: LIST (35%) */}
      <div className="w-[400px] flex flex-col bg-card-bg border border-border rounded-xl">
        {/* Header */}
        <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text" />
                    <input 
                        className="w-full bg-primary-bg border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-primary-text focus:outline-none focus:border-primary-green"
                        placeholder="Search transactions..."
                        value={searchValue}
                        onChange={e => setSearchValue(e.target.value)}
                    />
                </div>
                <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn("p-2 rounded-lg border border-border hover:bg-hover-bg transition-colors", showFilters ? "bg-primary-green/10 border-primary-green text-primary-green" : "text-muted-text")}
                >
                    <FilterIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Filters Dropdown */}
            {showFilters && (
                <div className="space-y-2 p-3 bg-primary-bg/50 rounded-lg border border-border/50 text-sm animate-in slide-in-from-top-2">
                    <select 
                        className="w-full bg-card-bg border border-border rounded p-1.5 text-secondary-text"
                        value={filterCardId}
                        onChange={e => setFilterCardId(e.target.value)}
                    >
                        <option value="">All Cards</option>
                        {cards.map(c => <option key={c.id} value={c.id}>{c.card_name}</option>)}
                    </select>
                    <input 
                        className="w-full bg-card-bg border border-border rounded p-1.5 text-secondary-text"
                        placeholder="Category..."
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                    />
                </div>
            )}

            {/* Quick Tabs */}
            <div className="flex p-1 bg-primary-bg rounded-lg">
                {(['all', 'spends', 'income'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-all",
                            activeTab === tab ? "bg-card-bg text-primary-text shadow-sm" : "text-muted-text hover:text-secondary-text"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
            {isLoading ? (
                <div className="p-8 text-center text-muted-text text-sm">Loading...</div>
            ) : transactions.length === 0 ? (
                <div className="p-8 text-center text-muted-text text-sm">No transactions found</div>
            ) : (
                <div className="divide-y divide-border">
                    {transactions.map(tx => {
                        const isSelected = selectedIds.has(tx.id);
                        const isActive = selectedTxId === tx.id;
                        const isCredit = tx.transaction_type === 'credit' || tx.transaction_type === 'refund';

                        return (
                            <div 
                                key={tx.id}
                                onClick={() => setSelectedTxId(tx.id)}
                                className={cn(
                                    "group relative flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-hover-bg",
                                    isActive && "bg-primary-green/5 border-l-2 border-primary-green pl-[10px]"
                                )}
                            >
                                {/* Selection Checkbox */}
                                <div 
                                    className="p-1 -ml-1 text-muted-text hover:text-primary-text cursor-pointer"
                                    onClick={(e) => toggleSelect(tx.id, e)}
                                >
                                    {isSelected ? <CheckSquare className="w-4 h-4 text-primary-green" /> : <Square className="w-4 h-4 opacity-50 group-hover:opacity-100" />}
                                </div>

                                {/* Icon */}
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                                    isCredit ? "bg-success/10 text-success" : "bg-primary-bg text-secondary-text"
                                )}>
                                    {tx.merchant[0].toUpperCase()}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <h4 className="text-sm font-medium text-primary-text truncate pr-2">{tx.merchant}</h4>
                                        <span className={cn(
                                            "text-xs font-mono font-medium whitespace-nowrap",
                                            isCredit ? "text-success" : "text-primary-text"
                                        )}>
                                            {isCredit ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px] text-muted-text">
                                        <span className="truncate">{tx.category || "Uncategorized"}</span>
                                        <span>{formatDate(tx.transaction_date, 'short')}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        {/* Bulk Action Bar (Floating) */}
        {selectedIds.size > 0 && (
            <div className="absolute bottom-4 left-4 w-[368px] bg-primary-text text-primary-bg p-3 rounded-lg shadow-xl flex items-center justify-between z-20 animate-in slide-in-from-bottom-2">
                <span className="text-sm font-medium pl-1">{selectedIds.size} selected</span>
                <div className="flex items-center gap-2">
                    {showBulkEdit ? (
                         <div className="flex items-center bg-white/10 rounded px-1">
                             <input 
                                autoFocus
                                className="bg-transparent border-none text-white text-xs py-1 px-1 w-24 focus:ring-0 placeholder-white/50"
                                placeholder="New Category"
                                value={bulkCategory}
                                onChange={e => setBulkCategory(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleBulkCategorize()}
                             />
                             <button onClick={handleBulkCategorize} className="p-1 hover:text-green-300"><Check className="w-3 h-3" /></button>
                         </div>
                    ) : (
                        <button 
                            onClick={() => setShowBulkEdit(true)} 
                            className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors"
                        >
                            Categorize
                        </button>
                    )}
                    <button 
                        onClick={() => setSelectedIds(new Set())}
                        className="p-1.5 hover:bg-white/10 rounded text-white/60 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* RIGHT PANEL: DETAILS (65%) */}
      <div className="flex-1 bg-card-bg border border-border rounded-xl p-8 flex flex-col justify-center">
          {selectedTransaction ? (
              <div className="max-w-2xl mx-auto w-full h-full flex flex-col animate-in fade-in duration-300">
                  {/* Tx Header */}
                  <div className="flex items-start justify-between mb-8">
                       <div>
                           <div className="flex items-center gap-2 mb-2">
                               <Badge label={selectedTransaction.transaction_type} variant={selectedTransaction.transaction_type === "credit" ? "success" : "default"} size="sm" />
                               <span className="text-sm text-secondary-text font-mono">{formatDate(selectedTransaction.transaction_date)}</span>
                           </div>
                           <h1 className="text-3xl font-bold text-primary-text mb-1">{selectedTransaction.merchant}</h1>
                           <div className="flex items-center gap-2 text-secondary-text">
                                <CreditCard className="w-4 h-4" />
                                <span className="text-sm">{selectedTransaction.card?.card_name || "Unknown Card"}</span>
                           </div>
                       </div>
                       <div className="text-right">
                           <div className={cn(
                               "text-4xl font-mono font-bold tracking-tight mb-2",
                               selectedTransaction.transaction_type === 'credit' ? "text-success" : "text-primary-text"
                           )}>
                                {formatCurrency(Math.abs(selectedTransaction.amount))}
                           </div>
                           <button className="text-xs text-muted-text hover:text-error flex items-center gap-1 ml-auto transition-colors" onClick={() => deleteMutation.mutate(selectedTransaction.id)}>
                               <Trash2 className="w-3 h-3" /> Delete
                           </button>
                       </div>
                  </div>

                  {/* Edit Form */}
                  <div className="space-y-6 flex-1">
                      <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-secondary-text uppercase tracking-wider flex items-center gap-2">
                                    <Tag className="w-3 h-3" /> Category
                                </label>
                                <Input 
                                    value={selectedTransaction.category || ""} 
                                    onChange={(e) => updateMutation.mutate({ id: selectedTransaction.id, data: { category: e.target.value }})}
                                    className="h-10 text-lg border-transparent hover:border-border focus:border-primary-green bg-transparent hover:bg-primary-bg transition-all px-0"
                                    placeholder="Add category..."
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-secondary-text uppercase tracking-wider">
                                    Description
                                </label>
                                <Input 
                                    value={selectedTransaction.description || ""} 
                                    onChange={(e) => updateMutation.mutate({ id: selectedTransaction.id, data: { description: e.target.value }})}
                                    className="h-10 border-transparent hover:border-border focus:border-primary-green bg-transparent hover:bg-primary-bg transition-all px-0"
                                    placeholder="Add notes..."
                                />
                            </div>
                      </div>

                      {/* AI Insights / Splits Placeholder */}
                      <div className="mt-8 pt-8 border-t border-border">
                          <h3 className="text-sm font-semibold text-primary-text mb-4">Breakdown & Insights</h3>
                          <div className="p-4 rounded-lg bg-primary-bg border border-border/50 text-sm text-secondary-text">
                              <p className="flex items-center gap-2">
                                  <ArrowUpRight className="w-4 h-4" /> 
                                  Spending for this merchant is <span className="text-primary-text font-medium">15% higher</span> than average.
                              </p>
                          </div>
                      </div>

                      {/* Similar Transactions */}
                      <div className="mt-4">
                          <h3 className="text-sm font-semibold text-primary-text mb-4">History</h3>
                          <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                              {transactions
                                  .filter(t => t.merchant === selectedTransaction.merchant && t.id !== selectedTransaction.id)
                                  .slice(0, 3)
                                  .map(t => (
                                      <div key={t.id} className="flex justify-between text-xs py-2 border-b border-border last:border-0 cursor-pointer hover:text-primary-text" onClick={() => setSelectedTxId(t.id)}>
                                          <span>{formatDate(t.transaction_date)}</span>
                                          <span className="font-mono">{formatCurrency(Math.abs(t.amount))}</span>
                                      </div>
                                  ))
                              }
                          </div>
                      </div>
                  </div>
              </div>
          ) : (
              <div className="text-center text-muted-text">
                  <div className="w-16 h-16 bg-primary-bg rounded-full flex items-center justify-center mx-auto mb-4">
                      <ArrowDownLeft className="w-8 h-8 opacity-20" />
                  </div>
                  <h2 className="text-lg font-medium text-primary-text mb-1">Select a Transaction</h2>
                  <p className="text-sm max-w-xs mx-auto">Click on any transaction from the list to view details, edit, or split.</p>
              </div>
          )}
      </div>
    </div>
  );
}
