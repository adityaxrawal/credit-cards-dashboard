import { formatCurrency, cn } from "@/shared/utils";
import { CreditCard, TrendingUp, Calendar, Award, AlertCircle } from "lucide-react";

interface DashboardStatsGridProps {
  totalBalance: number;
  totalCards: number;
  currentMonthSpent: number;
  budgetStatus: { ratio: number } | null;
  upcomingBillsCount: number;
  totalUpcomingBillAmount: number;
  upcomingBills: { days_until_due: number }[];
  totalRewards: number;
  pendingReviewCount?: number;
}

export function DashboardStatsGrid({
  totalBalance,
  totalCards,
  currentMonthSpent,
  budgetStatus,
  upcomingBillsCount,
  totalUpcomingBillAmount,
  upcomingBills,
  totalRewards,
  pendingReviewCount = 0,
}: DashboardStatsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-secondary-text font-medium">Total Balance</p>
            <h3 className="text-2xl font-bold text-primary-text mt-2">
              {formatCurrency(totalBalance)}
            </h3>
          </div>
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <CreditCard className="w-5 h-5 text-blue-500" />
          </div>
        </div>
        <p className="text-xs text-secondary-text mt-4">Across {totalCards} cards</p>
      </div>

      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-secondary-text font-medium">Monthly Spending</p>
            <h3 className="text-2xl font-bold text-primary-text mt-2">
              {formatCurrency(currentMonthSpent)}
            </h3>
          </div>
          <div className="p-2 bg-warning/10 rounded-lg">
            <TrendingUp className="w-5 h-5 text-warning" />
          </div>
        </div>
        {budgetStatus && (
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-secondary-text">Budget</span>
              <span className={cn(
                budgetStatus.ratio > 0.9 ? "text-error" : "text-success"
              )}>
                {(budgetStatus.ratio * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-hover-bg rounded-full h-1.5">
              <div 
                className={cn("h-1.5 rounded-full", budgetStatus.ratio > 0.9 ? "bg-error" : "bg-success")}
                style={{ width: `${Math.min(budgetStatus.ratio * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-secondary-text font-medium">Upcoming Bills</p>
            <h3 className="text-2xl font-bold text-primary-text mt-2">
              {formatCurrency(totalUpcomingBillAmount)}
            </h3>
          </div>
          <div className="p-2 bg-error/10 rounded-lg">
            <Calendar className="w-5 h-5 text-error" />
          </div>
        </div>
        <p className="text-xs text-secondary-text mt-4">
          {upcomingBillsCount > 0 
            ? `${upcomingBillsCount} bill${upcomingBillsCount > 1 ? 's' : ''} due, next in ${Math.min(...upcomingBills.map(b => b.days_until_due))} days`
            : "No bills due soon"}
        </p>
      </div>

      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-secondary-text font-medium">Total Rewards</p>
            <h3 className="text-2xl font-bold text-primary-text mt-2">
              {(totalRewards || 0).toLocaleString()}
            </h3>
          </div>
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Award className="w-5 h-5 text-purple-500" />
          </div>
        </div>
        <p className="text-xs text-secondary-text mt-4">~ {formatCurrency((totalRewards || 0) * 0.25)} value</p>
      </div>
    </div>
  );
}
