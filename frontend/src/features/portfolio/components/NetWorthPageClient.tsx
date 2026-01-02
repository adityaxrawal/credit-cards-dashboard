"use client";

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { accountsApi } from "@/features/accounts/api";
import { formatCurrency } from "@/shared/utils";
import FinancialHealthChart from "@/features/analytics/components/FinancialHealthChart";
import { AssetCard } from "@/shared/components/ui/AssetCard";
import { Card } from "@/shared/components/ui";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

export default function NetWorthPageClient() {
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: accountsApi.getAll,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["accounts-summary"],
    queryFn: accountsApi.getSummary,
  });

  // Mock Trend Data for Chart (since we don't have historical API yet)
  const healthData = useMemo(() => {
     return [
        { month: 'Aug', assets: 42000, liabilities: -4500, netWorth: 37500 },
        { month: 'Sep', assets: 43500, liabilities: -4200, netWorth: 39300 },
        { month: 'Oct', assets: 44000, liabilities: -5000, netWorth: 39000 },
        { month: 'Nov', assets: 46000, liabilities: -4800, netWorth: 41200 },
        { month: 'Dec', assets: 48500, liabilities: -4000, netWorth: 44500 },
        { month: 'Jan', assets: 51200, liabilities: -3500, netWorth: 47700 },
     ];
  }, []);

  const topAssets = useMemo(() => {
      // Get top 3 assets by value
      return [...accounts]
        .filter(a => a.balance > 0)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 3);
  }, [accounts]);

  if (accountsLoading || summaryLoading) {
      return <div className="p-12 text-center text-muted-text">Loading Net Worth analysis...</div>;
  }

  return (
    <div className="space-y-6">
       {/* Summary Cards */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="p-6 bg-card-bg border-border">
               <div className="flex items-center gap-3 mb-2">
                   <div className="p-2 bg-primary-green/10 rounded-lg text-primary-green">
                       <TrendingUp className="w-5 h-5" />
                   </div>
                   <span className="text-secondary-text font-medium">Total Assets</span>
               </div>
               <div className="text-2xl font-mono font-bold text-primary-text">
                   {formatCurrency(summary?.totalBalance || 0)}
               </div>
           </Card>

           <Card className="p-6 bg-card-bg border-border">
               <div className="flex items-center gap-3 mb-2">
                   <div className="p-2 bg-semantic-red/10 rounded-lg text-semantic-red">
                       <TrendingDown className="w-5 h-5" />
                   </div>
                   <span className="text-secondary-text font-medium">Total Liabilities</span>
               </div>
               <div className="text-2xl font-mono font-bold text-primary-text">
                   {formatCurrency(summary?.totalLiabilities || 0)}
               </div>
           </Card>

           <Card className="p-6 bg-card-bg border-border">
               <div className="flex items-center gap-3 mb-2">
                   <div className="p-2 bg-accent-purple/10 rounded-lg text-accent-purple">
                       <DollarSign className="w-5 h-5" />
                   </div>
                   <span className="text-secondary-text font-medium">Net Worth</span>
               </div>
               <div className="text-2xl font-mono font-bold text-primary-text">
                   {formatCurrency(summary?.netWorth || 0)}
               </div>
           </Card>
       </div>

       {/* Main Chart */}
       <FinancialHealthChart data={healthData} />

       {/* Top Assets */}
       <div>
           <h3 className="text-lg font-semibold text-primary-text mb-4">Top Liquid Assets</h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {topAssets.map(account => (
                   <AssetCard
                        key={account.id}
                        type={account.type === 'credit_card' ? 'credit' : 'bank'}
                        name={account.name}
                        balance={account.balance}
                        provider={account.bank_name || 'Bank'}
                        colorTheme={account.type.includes('bank') ? 'blue' : 'green'}
                        accountNumber={account.mask_account_number}
                   />
               ))}
           </div>
       </div>
    </div>
  );
}
