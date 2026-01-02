import { formatCurrency, cn } from "@/shared/utils";
import Link from "next/link";
import { Transaction } from "@/types/transaction";
// If Transaction type is not available in frontend, I might need to define a local interface or find where it is.
// Looking at useTransactions.ts or similar might help. For now I'll interpret from usage.

interface RecentTransaction {
    id: string;
    merchant: string;
    transaction_date: string | Date;
    transaction_type: string;
    amount: number;
}

interface DashboardRecentTransactionsProps {
  transactions: RecentTransaction[];
}

export function DashboardRecentTransactions({ transactions }: DashboardRecentTransactionsProps) {
  return (
    <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-primary-text">Recent Transactions</h3>
        <Link href="/transactions" className="text-xs text-primary-green hover:underline">View All</Link>
      </div>
      <div className="space-y-4">
        {!transactions || transactions.length === 0 ? (
          <p className="text-sm text-secondary-text text-center py-4">No recent transactions</p>
        ) : (
          transactions.map((t) => (
            <div key={t.id} className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-hover-bg flex items-center justify-center text-xs font-medium text-secondary-text">
                  {t.merchant.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-primary-text truncate max-w-[120px]">{t.merchant}</p>
                  <p className="text-xs text-secondary-text">{new Date(t.transaction_date).toLocaleDateString()}</p>
                </div>
              </div>
              <span className={cn(
                "text-sm font-medium",
                t.transaction_type === "debit" ? "text-error" : "text-success"
              )}>
                {t.transaction_type === "debit" ? "-" : "+"}{formatCurrency(Math.abs(t.amount))}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
