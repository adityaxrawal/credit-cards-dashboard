"use client";

import { useEffect, useState } from "react";
import { dashboardApi, DashboardSummary } from "@/features/dashboard/api";
import { formatCurrency } from "@/shared/utils";
import { 
  Wallet, 
  CreditCard, 
  Landmark, 
  Banknote,
  TrendingUp,
  TrendingDown,
  PiggyBank
} from "lucide-react";

interface AccountHealthSummaryProps {
  summary?: DashboardSummary;
  loading?: boolean;
}

export function AccountHealthSummary({ summary: propsSummary, loading: propsLoading }: AccountHealthSummaryProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(propsSummary || null);
  const [loading, setLoading] = useState(propsLoading ?? !propsSummary);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propsSummary) {
      setSummary(propsSummary);
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        setLoading(true);
        const data = await dashboardApi.getSummary();
        setSummary(data);
      } catch (err) {
        console.error("Failed to fetch dashboard summary:", err);
        setError("Failed to load account summary");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [propsSummary]);

  if (loading) {
    return (
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-hover-bg rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-hover-bg rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <p className="text-error">{error || "No data available"}</p>
      </div>
    );
  }

  const isPositiveNetWorth = summary.netWorth >= 0;

  return (
    <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
      {/* Net Worth Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-text mb-1">Net Worth</p>
          <div className="flex items-center gap-2">
            <span className={`text-3xl font-bold ${isPositiveNetWorth ? 'text-primary-green' : 'text-error'}`}>
              {formatCurrency(summary.netWorth)}
            </span>
            {isPositiveNetWorth ? (
              <TrendingUp className="w-5 h-5 text-primary-green" />
            ) : (
              <TrendingDown className="w-5 h-5 text-error" />
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-text mb-1">This Month Savings</p>
          <div className="flex items-center gap-2 justify-end">
            <span className={`text-xl font-semibold ${summary.monthlySnapshot.savings >= 0 ? 'text-primary-green' : 'text-error'}`}>
              {formatCurrency(summary.monthlySnapshot.savings)}
            </span>
            <span className="text-sm text-muted-text">
              ({summary.monthlySnapshot.savingsRate}%)
            </span>
          </div>
        </div>
      </div>

      {/* Account Category Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Bank Accounts */}
        <div className="bg-hover-bg rounded-lg p-4 hover:bg-hover-bg/80 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-accent-blue/20">
              <Landmark className="w-4 h-4 text-accent-blue" />
            </div>
            <span className="text-xs text-muted-text">Bank Accounts</span>
          </div>
          <p className="text-lg font-semibold text-primary-text">
            {formatCurrency(summary.accountTotals.bankAccounts)}
          </p>
          <p className="text-xs text-muted-text mt-1">
            {summary.accountCounts.bankAccounts} account{summary.accountCounts.bankAccounts !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Wallets */}
        <div className="bg-hover-bg rounded-lg p-4 hover:bg-hover-bg/80 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-accent-purple/20">
              <Wallet className="w-4 h-4 text-accent-purple" />
            </div>
            <span className="text-xs text-muted-text">Wallets</span>
          </div>
          <p className="text-lg font-semibold text-primary-text">
            {formatCurrency(summary.accountTotals.wallets)}
          </p>
          <p className="text-xs text-muted-text mt-1">
            {summary.accountCounts.wallets} wallet{summary.accountCounts.wallets !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Cash */}
        <div className="bg-hover-bg rounded-lg p-4 hover:bg-hover-bg/80 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-primary-green/20">
              <Banknote className="w-4 h-4 text-primary-green" />
            </div>
            <span className="text-xs text-muted-text">Cash</span>
          </div>
          <p className="text-lg font-semibold text-primary-text">
            {formatCurrency(summary.accountTotals.cash)}
          </p>
        </div>

        {/* Credit Cards */}
        <div className="bg-hover-bg rounded-lg p-4 hover:bg-hover-bg/80 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-accent-orange/20">
              <CreditCard className="w-4 h-4 text-accent-orange" />
            </div>
            <span className="text-xs text-muted-text">Credit Cards</span>
          </div>
          <p className="text-lg font-semibold text-error">
            -{formatCurrency(summary.accountTotals.creditCardOutstanding)}
          </p>
          <p className="text-xs text-muted-text mt-1">
            {summary.accountCounts.creditCards} card{summary.accountCounts.creditCards !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Loans */}
        <div className="bg-hover-bg rounded-lg p-4 hover:bg-hover-bg/80 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-error/20">
              <PiggyBank className="w-4 h-4 text-error" />
            </div>
            <span className="text-xs text-muted-text">Loans</span>
          </div>
          <p className="text-lg font-semibold text-error">
            -{formatCurrency(summary.accountTotals.loansOutstanding)}
          </p>
        </div>
      </div>

      {/* Monthly Income/Expense Summary */}
      <div className="mt-6 pt-4 border-t border-muted-text/10">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-text">Income</p>
            <p className="text-lg font-semibold text-primary-green">
              +{formatCurrency(summary.monthlySnapshot.income)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-text">Expenses</p>
            <p className="text-lg font-semibold text-error">
              -{formatCurrency(summary.monthlySnapshot.expenses)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-text">Savings Rate</p>
            <p className={`text-lg font-semibold ${summary.monthlySnapshot.savingsRate >= 20 ? 'text-primary-green' : summary.monthlySnapshot.savingsRate >= 0 ? 'text-accent-orange' : 'text-error'}`}>
              {summary.monthlySnapshot.savingsRate}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccountHealthSummary;
