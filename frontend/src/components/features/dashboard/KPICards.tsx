import React from "react";
import { TrendingUp, TrendingDown, Target } from "lucide-react";
import { StatCard } from "@/components/ui";
import type { KPIData } from "@/types";

export interface KPICardsProps {
  data: KPIData;
  className?: string;
}

export function KPICards({ data, className }: KPICardsProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
      <StatCard
        title="Total Earnings"
        value={data.totalEarnings}
        icon={<TrendingUp className="w-6 h-6" />}
        iconColor="info"
        trend="up"
        trendValue="+12.5%"
      />

      <StatCard
        title="Total Spendings"
        value={data.totalSpendings}
        icon={<TrendingDown className="w-6 h-6" />}
        iconColor="warning"
        trend="down"
        trendValue="-5.2%"
      />

      <StatCard
        title="Spending Goal"
        value={data.spendingGoal}
        icon={<Target className="w-6 h-6" />}
        iconColor="success"
        trend="neutral"
        trendValue="On track"
      />
    </div>
  );
}
