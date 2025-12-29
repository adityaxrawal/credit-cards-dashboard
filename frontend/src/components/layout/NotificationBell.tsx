"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, X, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { formatDate, cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

interface Alert {
  id: string;
  alert_type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  is_read: boolean;
  created_at: string;
  card_name?: string;
}

import { io, Socket } from "socket.io-client";
import { useAuth } from "@/lib/auth/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { rewardsApi } from "@/lib/api/rewards";
import { gmailApi } from "@/lib/api/gmail";

// ... existing imports ...

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Socket Connection for Real-time Alerts
  React.useEffect(() => {
    if (!user?.id) return;

    const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to WebSocket');
      socket.emit('subscribe', { userId: user.id });
    });

    socket.on('new_alert', (data) => {
      console.log('New Alert Received:', data);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["recent-alerts"] });
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id, queryClient]);

  // Fetch unread count (Initial fetch, no polling)
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const data = await apiClient.get<{ total: number }>(
        "/api/alerts?unread_only=true&limit=1"
      );
      return data.data?.total || 0;
    },
    // refetchInterval: 60000, // Removed Polling
  });

  // Fetch Rewards Summary for Alerts
  const { data: rewardsSummary } = useQuery({
    queryKey: ["rewards-summary-alerts"],
    queryFn: () => rewardsApi.getSummary(),
    enabled: isOpen,
  });

  // Fetch Gmail Status for Alerts
  const { data: gmailStatus } = useQuery({
    queryKey: ["gmail-status-alerts"],
    queryFn: () => gmailApi.getStatus(),
    enabled: isOpen,
  });

  // Fetch recent alerts when dropdown is open
  const { data: serverAlerts = [] } = useQuery({
    queryKey: ["recent-alerts"],
    queryFn: async () => {
      const data = await apiClient.get<{ alerts: Alert[] }>(
        "/api/alerts?limit=10"
      );
      return (data.data?.alerts || []) as Alert[];
    },
    enabled: isOpen,
  });

  // Combine Alerts
  const alerts: Alert[] = React.useMemo(() => {
    const virtualAlerts: Alert[] = [];

    // Rewards Expiry Alert
    if (rewardsSummary?.summary?.total_points_expiring_soon && rewardsSummary.summary.total_points_expiring_soon > 0) {
      virtualAlerts.push({
        id: "virtual-rewards-expiry",
        alert_type: "reward_expiry",
        severity: "medium",
        message: `${rewardsSummary.summary.total_points_expiring_soon} points are expiring soon!`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }

    // Gmail Disconnected Alert
    if (gmailStatus && !gmailStatus.connected) {
      virtualAlerts.push({
        id: "virtual-gmail-disconnected",
        alert_type: "system_alert",
        severity: "high",
        message: "Gmail sync is disconnected. Re-connect to track expenses.",
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }

    return [...virtualAlerts, ...serverAlerts];
  }, [serverAlerts, rewardsSummary, gmailStatus]);

  const markAsRead = async (alertId: string) => {
    try {
      await apiClient.put(`/api/alerts/${alertId}/read`, {});
      // Refetch counts
      // queryClient.invalidateQueries(["notifications-unread-count"]);
    } catch (error) {
      console.error("Failed to mark alert as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.put("/api/alerts/mark-all-read", {});
      // Refetch
      // queryClient.invalidateQueries(["notifications-unread-count"]);
      // queryClient.invalidateQueries(["recent-alerts"]);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return <AlertCircle className="w-4 h-4 text-error" />;
      case "medium":
        return <AlertCircle className="w-4 h-4 text-warning" />;
      default:
        return <CheckCircle className="w-4 h-4 text-primary-green" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return "bg-error/10 border-error/20";
      case "medium":
        return "bg-warning/10 border-warning/20";
      default:
        return "bg-primary-green/10 border-primary-green/20";
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-hover-bg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-primary-text" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-error text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-card-bg border border-muted-text/20 rounded-lg shadow-lg z-50 max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-muted-text/20">
              <h3 className="font-semibold text-primary-text">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-primary-green hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-hover-bg rounded"
                >
                  <X className="w-4 h-4 text-secondary-text" />
                </button>
              </div>
            </div>

            {/* Alerts List */}
            <div className="overflow-y-auto flex-1">
              {alerts.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 mx-auto mb-2 text-muted-text" />
                  <p className="text-sm text-secondary-text">
                    No notifications
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-muted-text/10">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        "p-4 hover:bg-hover-bg transition-colors cursor-pointer border-l-4",
                        !alert.is_read && "bg-primary-green/5",
                        getSeverityColor(alert.severity)
                      )}
                      onClick={() => {
                        if (!alert.is_read) {
                          markAsRead(alert.id);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getSeverityIcon(alert.severity)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p
                              className={cn(
                                "text-sm font-medium",
                                !alert.is_read
                                  ? "text-primary-text"
                                  : "text-secondary-text"
                              )}
                            >
                              {alert.alert_type
                                .replace(/_/g, " ")
                                .toUpperCase()}
                            </p>
                            {!alert.is_read && (
                              <span className="w-2 h-2 bg-primary-green rounded-full flex-shrink-0 mt-1"></span>
                            )}
                          </div>
                          <p className="text-sm text-secondary-text mb-1">
                            {alert.message}
                          </p>
                          {alert.card_name && (
                            <p className="text-xs text-muted-text">
                              Card: {alert.card_name}
                            </p>
                          )}
                          <p className="text-xs text-muted-text mt-1">
                            {formatDate(alert.created_at, "relative")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {alerts.length > 0 && (
              <div className="p-3 border-t border-muted-text/20">
                <Link
                  href="/notifications"
                  className="block text-center text-sm text-primary-green hover:underline"
                  onClick={() => setIsOpen(false)}
                >
                  View all notifications
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
