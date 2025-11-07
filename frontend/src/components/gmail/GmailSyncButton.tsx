"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

interface SyncResult {
  success: boolean;
  summary?: {
    emailsScanned: number;
    transactionEmailsFound: number;
    newTransactions: number;
    duplicatesSkipped: number;
    processingTime: string;
  };
  error?: string;
}

interface GmailSyncButtonProps {
  onSyncComplete?: () => void;
  className?: string;
}

/**
 * GmailSyncButton Component
 * Triggers manual Gmail sync and orchestrates downstream services
 */
export function GmailSyncButton({
  onSyncComplete,
  className,
}: GmailSyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { user } = useAuth();

  const handleSync = async () => {
    if (!user) {
      showToast("error", "Please log in to sync Gmail");
      return;
    }

    setSyncing(true);

    try {
      // Step 1: Trigger Gmail sync (httpOnly cookie sent automatically)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/gmail/sync`,
        {
          method: "POST",
          credentials: "include", // Send httpOnly cookie
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data: SyncResult = await response.json();

      if (response.ok && data.success) {
        setLastSync(new Date());

        const newCount = data.summary?.newTransactions || 0;
        showToast(
          "success",
          `Sync complete! ${newCount} new transaction${
            newCount !== 1 ? "s" : ""
          }`,
          `Scanned ${data.summary?.emailsScanned} emails in ${data.summary?.processingTime}`
        );

        // Step 2: Trigger downstream services if new transactions found
        if (data.summary && data.summary.newTransactions > 0) {
          await triggerDownstreamServices();
        }

        // Step 3: Refresh UI
        window.dispatchEvent(new CustomEvent("transactions-updated"));
        window.dispatchEvent(new CustomEvent("refresh-dashboard"));

        // Call callback if provided
        if (onSyncComplete) {
          onSyncComplete();
        }
      } else {
        showToast("error", data.error || "Sync failed");
      }
    } catch (error) {
      console.error("Sync error:", error);
      showToast("error", "Network error during sync");
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Trigger all downstream services in parallel after sync
   */
  const triggerDownstreamServices = async () => {
    const services = [
      {
        name: "update-budget",
        url: `${process.env.NEXT_PUBLIC_API_URL}/services/update-budget`,
      },
      {
        name: "check-alerts",
        url: `${process.env.NEXT_PUBLIC_API_URL}/services/check-alerts`,
      },
      {
        name: "check-reminders",
        url: `${process.env.NEXT_PUBLIC_API_URL}/services/check-reminders`,
      },
      {
        name: "refresh-analytics",
        url: `${process.env.NEXT_PUBLIC_API_URL}/services/refresh-analytics`,
      },
    ];

    const servicePromises = services.map((service) =>
      fetch(service.url, {
        method: "POST",
        credentials: "include", // Send httpOnly cookie
      }).catch((err) => {
        console.error(`Service ${service.name} failed:`, err);
        return null;
      })
    );

    const results = await Promise.allSettled(servicePromises);

    // Handle alerts and reminders
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "fulfilled") {
        const response = (results[i] as PromiseFulfilledResult<Response | null>)
          .value;

        if (!response) continue;

        try {
          const data = await response.json();

          // Show alerts (service index 1)
          if (i === 1 && data.alerts?.length > 0) {
            data.alerts.forEach(
              (alert: { message?: string; title?: string }) => {
                showToast(
                  "warning",
                  alert.message || alert.title || "Alert",
                  undefined,
                  5000
                );
              }
            );
          }

          // Show reminders (service index 2)
          if (i === 2 && data.reminders?.length > 0) {
            const reminderCount = data.reminders.length;
            showToast(
              "info",
              `${reminderCount} upcoming bill reminder${
                reminderCount !== 1 ? "s" : ""
              }`,
              data.reminders[0]?.message
            );
          }
        } catch (err) {
          console.error("Error parsing service response:", err);
        }
      }
    }
  };

  /**
   * Show toast notification (simple implementation)
   * In production, use a library like react-hot-toast or sonner
   */
  const showToast = (
    type: "success" | "error" | "warning" | "info",
    message: string,
    description?: string,
    duration: number = 4000
  ) => {
    // Simple console logging for now
    // Replace with actual toast library
    const icon = {
      success: "✓",
      error: "✗",
      warning: "⚠",
      info: "ℹ",
    }[type];

    console.log(
      `[${icon}] ${message}${description ? ` - ${description}` : ""}`
    );

    // Dispatch custom event for toast (can be picked up by a toast provider)
    window.dispatchEvent(
      new CustomEvent("show-toast", {
        detail: { type, message, description, duration },
      })
    );
  };

  return (
    <div className={`flex items-center gap-4 ${className || ""}`}>
      <Button
        onClick={handleSync}
        disabled={syncing}
        variant="primary"
        size="md"
      >
        <RefreshCw
          className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`}
        />
        {syncing ? "Syncing Gmail..." : "Sync Gmail"}
      </Button>

      {lastSync && (
        <span className="text-sm text-gray-500">
          Last synced: {lastSync.toLocaleTimeString()}
        </span>
      )}

      {syncing && (
        <span className="text-sm text-gray-400 animate-pulse">
          This may take 10-30 seconds...
        </span>
      )}
    </div>
  );
}
