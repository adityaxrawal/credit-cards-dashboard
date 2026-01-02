"use client";

import { useEffect, useState } from "react";
import { dashboardApi, DashboardAlert } from "@/features/dashboard/api";
import { 
  AlertTriangle, 
  Bell, 
  Clock, 
  CreditCard, 
  AlertCircle,
  Target,
  PiggyBank,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/shared/utils";

interface AlertsPanelProps {
  alerts?: DashboardAlert[];
  loading?: boolean;
  maxDisplay?: number;
}

const alertTypeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; link: string }> = {
  bill_due: { icon: Clock, color: "text-accent-orange", link: "/bills" },
  emi_due: { icon: PiggyBank, color: "text-accent-purple", link: "/loans" },
  low_balance: { icon: AlertTriangle, color: "text-error", link: "/accounts" },
  high_credit_utilization: { icon: CreditCard, color: "text-error", link: "/cards" },
  budget_warning: { icon: AlertCircle, color: "text-accent-orange", link: "/budget" },
  goal_reminder: { icon: Target, color: "text-primary-green", link: "/goals" },
};

const priorityStyles: Record<string, string> = {
  high: "border-l-4 border-l-error bg-error/5",
  medium: "border-l-4 border-l-accent-orange bg-accent-orange/5",
  low: "border-l-4 border-l-muted-text/30",
};

export function AlertsPanel({ 
  alerts: propsAlerts, 
  loading: propsLoading,
  maxDisplay = 5 
}: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<DashboardAlert[]>(propsAlerts || []);
  const [loading, setLoading] = useState(propsLoading ?? !propsAlerts);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propsAlerts) {
      setAlerts(propsAlerts);
      setLoading(false);
      return;
    }

    const fetchAlerts = async () => {
      try {
        setLoading(true);
        const data = await dashboardApi.getAlerts();
        setAlerts(data);
      } catch (err) {
        console.error("Failed to fetch alerts:", err);
        setError("Failed to load alerts");
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [propsAlerts]);

  if (loading) {
    return (
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-hover-bg rounded w-1/3"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-hover-bg rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-primary-green" />
          <h3 className="text-lg font-semibold text-primary-text">Alerts</h3>
        </div>
        <div className="text-center py-6 text-muted-text">
          <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">All clear! No alerts at the moment.</p>
        </div>
      </div>
    );
  }

  const displayAlerts = alerts.slice(0, maxDisplay);
  const highPriorityCount = alerts.filter(a => a.priority === 'high').length;

  return (
    <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-green" />
          <h3 className="text-lg font-semibold text-primary-text">Alerts</h3>
          {highPriorityCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-error/20 text-error rounded-full">
              {highPriorityCount} urgent
            </span>
          )}
        </div>
        <span className="text-sm text-muted-text">{alerts.length} total</span>
      </div>

      <div className="space-y-2">
        {displayAlerts.map((alert) => {
          const config = alertTypeConfig[alert.type] || { 
            icon: Bell, 
            color: "text-muted-text", 
            link: "/dashboard" 
          };
          const IconComponent = config.icon;

          return (
            <Link
              key={alert.id}
              href={config.link}
              className={`block rounded-lg p-3 transition-colors hover:bg-hover-bg ${priorityStyles[alert.priority]}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${config.color}`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary-text truncate">
                    {alert.title}
                  </p>
                  <p className="text-xs text-muted-text mt-0.5 truncate">
                    {alert.message}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-text">
                    {alert.amount && (
                      <span className="font-medium">
                        {formatCurrency(alert.amount)}
                      </span>
                    )}
                    {alert.dueDate && (
                      <span>
                        Due: {new Date(alert.dueDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-text flex-shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>

      {alerts.length > maxDisplay && (
        <div className="mt-4 pt-3 border-t border-muted-text/10 text-center">
          <Link 
            href="/notifications" 
            className="text-sm text-primary-green hover:underline"
          >
            View all {alerts.length} alerts
          </Link>
        </div>
      )}
    </div>
  );
}

export default AlertsPanel;
