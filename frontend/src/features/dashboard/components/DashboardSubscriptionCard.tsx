import Link from 'next/link';
import { RefreshCcw, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/shared/utils';
import { RecurringStats } from '@/types/recurring';

interface DashboardSubscriptionCardProps {
  stats: RecurringStats;
}

export function DashboardSubscriptionCard({ stats }: DashboardSubscriptionCardProps) {
  return (
    <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-primary-text flex items-center gap-2">
          <RefreshCcw className="w-5 h-5 text-accent-blue" />
          Recurring Expenses
        </h3>
        <Link 
          href="/recurring" 
          className="text-sm text-accent-blue hover:text-accent-blue/80 flex items-center gap-1 transition-colors"
        >
          View All <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-secondary-text mb-1">Estimated Monthly Cost</p>
          <p className="text-2xl font-bold text-primary-text">
            {formatCurrency(stats.totalMonthly)}
          </p>
        </div>

        <div className="flex items-center justify-between p-3 bg-hover-bg/30 rounded-lg border border-muted-text/10">
          <span className="text-sm text-primary-text">Active Subscriptions</span>
          <span className="font-medium text-primary-text bg-accent-blue/10 text-accent-blue px-2 py-1 rounded-md text-sm">
            {stats.activeCount}
          </span>
        </div>
      </div>
    </div>
  );
}
