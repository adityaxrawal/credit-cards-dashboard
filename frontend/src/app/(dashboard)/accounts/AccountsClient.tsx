"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { accountsApi, Account, AccountsSummary } from "@/lib/api/accounts";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  Landmark,
  Wallet,
  Banknote,
  CreditCard,
  MoreVertical,
  TrendingUp,
  Lock,
  Unlock,
} from "lucide-react";
import { AddAccountModal } from "@/components/features/accounts/AddAccountModal";

const accountTypeLabels: Record<string, string> = {
  bank_account: "Bank Account",
  savings_account: "Savings Account",
  current_account: "Current Account",
  nre_account: "NRE Account",
  nro_account: "NRO Account",
  wallet: "Wallet",
  cash: "Cash",
  prepaid_card: "Prepaid Card",
  credit_card: "Credit Card",
};

const accountTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  bank_account: Landmark,
  savings_account: Landmark,
  current_account: Landmark,
  nre_account: Landmark,
  nro_account: Landmark,
  wallet: Wallet,
  cash: Banknote,
  prepaid_card: CreditCard,
  credit_card: CreditCard,
};

export default function AccountsClient() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<AccountsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accountsData, summaryData] = await Promise.all([
        accountsApi.getAll(),
        accountsApi.getSummary(),
      ]);
      setAccounts(accountsData);
      setSummary(summaryData);
    } catch (error) {
      console.error("Failed to load accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAccounts = filter === "all" 
    ? accounts 
    : accounts.filter(a => a.type === filter);

  const accountTypes = [...new Set(accounts.map(a => a.type))];

  if (loading) {
    return (
      <AppLayout title="Accounts" showRightSidebar={false}>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Accounts" showRightSidebar={false}>
      <div className="space-y-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card-bg rounded-xl p-4 border border-muted-text/10">
              <p className="text-sm text-muted-text mb-1">Total Balance</p>
              <p className="text-2xl font-bold text-primary-green">
                {formatCurrency(summary.totalBalance)}
              </p>
            </div>
            <div className="bg-card-bg rounded-xl p-4 border border-muted-text/10">
              <p className="text-sm text-muted-text mb-1">Liabilities</p>
              <p className="text-2xl font-bold text-error">
                {formatCurrency(summary.totalLiabilities)}
              </p>
            </div>
            <div className="bg-card-bg rounded-xl p-4 border border-muted-text/10">
              <p className="text-sm text-muted-text mb-1">Net Worth</p>
              <p className={`text-2xl font-bold ${summary.netWorth >= 0 ? 'text-primary-green' : 'text-error'}`}>
                {formatCurrency(summary.netWorth)}
              </p>
            </div>
            <div className="bg-card-bg rounded-xl p-4 border border-muted-text/10">
              <p className="text-sm text-muted-text mb-1">Accounts</p>
              <p className="text-2xl font-bold text-primary-text">
                {summary.totalAccounts}
              </p>
            </div>
          </div>
        )}

        {/* Header with Add Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-card-bg border border-muted-text/10 rounded-lg px-3 py-2 text-sm text-primary-text"
            >
              <option value="all">All Accounts</option>
              {accountTypes.map(type => (
                <option key={type} value={type}>
                  {accountTypeLabels[type] || type}
                </option>
              ))}
            </select>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary-green text-white px-4 py-2 rounded-lg hover:bg-primary-green/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>

        {/* Accounts List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => {
            const IconComponent = accountTypeIcons[account.type] || Landmark;
            const isLiability = account.type === 'credit_card';

            return (
              <div
                key={account.id}
                className="bg-card-bg rounded-xl p-5 border border-muted-text/10 hover:border-primary-green/30 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-green/10">
                      <IconComponent className="w-5 h-5 text-primary-green" />
                    </div>
                    <div>
                      <h3 className="font-medium text-primary-text">{account.name}</h3>
                      <p className="text-xs text-muted-text">
                        {accountTypeLabels[account.type] || account.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.isFrozen && (
                      <Lock className="w-4 h-4 text-muted-text" />
                    )}
                    <button className="p-1 text-muted-text hover:text-primary-text opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-muted-text mb-1">Current Balance</p>
                  <p className={`text-2xl font-bold ${isLiability ? 'text-error' : 'text-primary-text'}`}>
                    {isLiability ? '-' : ''}{formatCurrency(Math.abs(account.balance))}
                  </p>
                </div>

                {account.last4 && (
                  <p className="text-xs text-muted-text">
                    •••• {account.last4}
                  </p>
                )}

                {account.providerName && (
                  <p className="text-xs text-muted-text mt-1">
                    {account.providerName}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {filteredAccounts.length === 0 && (
          <div className="text-center py-12 text-muted-text">
            <Landmark className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No accounts found</p>
            <p className="text-sm mt-1">Add your first account to get started</p>
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
      />
    </AppLayout>
  );
}
