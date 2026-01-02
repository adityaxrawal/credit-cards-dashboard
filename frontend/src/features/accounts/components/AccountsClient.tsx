"use client";

import { useState, useEffect } from "react";
import { accountsApi, Account, AccountsSummary } from "@/features/accounts/api";
import { formatCurrency } from "@/shared/utils";
import {
  Plus,
  Landmark,
  Wallet,
  Banknote,
  CreditCard as CreditCardIcon,
  Search,
} from "lucide-react";
import { AddAccountModal } from "@/features/accounts/components/AddAccountModal";
import { AssetCard } from "@/shared/components/ui/AssetCard";
import { Button, Input } from "@/shared/components/ui";

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
  investment: "Investment",
};

export default function AccountsClient() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<AccountsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

  const filteredAccounts = accounts.filter(a => {
      const matchesFilter = filter === "all" || a.type === filter;
      const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || 
                            a.bank_name?.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
  });

  const accountTypes = [...new Set(accounts.map(a => a.type))];

  const getThemeForType = (type: string) => {
      if (type.includes('credit')) return 'black';
      if (type.includes('wallet')) return 'purple';
      if (type.includes('cash')) return 'green';
      if (type.includes('investment')) return 'orange';
      return 'blue'; // default bank
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Add Button */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
         <div className="flex items-center gap-2 w-full md:w-auto">
             <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text" />
                <Input 
                    placeholder="Search accounts..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
             </div>
             
             <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-card-bg border border-border text-primary-text text-sm rounded-lg p-2.5 h-[42px] focus:ring-primary-green focus:border-primary-green"
              >
                <option value="all">All Types</option>
                {accountTypes.map(type => (
                  <option key={type} value={type}>
                    {accountTypeLabels[type] || type}
                  </option>
                ))}
              </select>
         </div>

        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAccounts.map((account) => (
          <AssetCard
            key={account.id}
            type={account.type === 'credit_card' ? 'credit' : 
                  account.type === 'wallet' ? 'wallet' : 
                  account.type === 'cash' ? 'cash' : 'bank'}
            name={account.name}
            balance={account.balance}
            provider={account.bank_name || accountTypeLabels[account.type]}
            accountNumber={account.mask_account_number || account.last4}
            colorTheme={getThemeForType(account.type) as any}
            onMenuClick={() => {}} // Placeholder for edit/delete menu
            onClick={() => {}} // Placeholder for drill-down
          />
        ))}

        {/* Add New Card Slot */}
        <div 
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl border-2 border-dashed border-muted-text/20 flex flex-col items-center justify-center min-h-[180px] cursor-pointer hover:border-primary-green/50 hover:bg-primary-green/5 transition-all text-muted-text hover:text-primary-green"
        >
            <Plus className="w-8 h-8 mb-2" />
            <span className="font-medium">Add New Account</span>
        </div>
      </div>

      {filteredAccounts.length === 0 && search && (
        <div className="text-center py-12 text-muted-text">
          <p>No accounts found matching "{search}"</p>
        </div>
      )}

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
