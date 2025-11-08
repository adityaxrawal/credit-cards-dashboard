"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiPost } from "@/lib/api/client";

interface SyncResult {
  success: boolean;
  summary?: {
    emailsScanned: number;
    transactionEmailsFound: number;
    newTransactions: number;
    duplicatesSkipped: number;
    errors?: number;
    processingTime: string;
  };
  error?: string;
  message?: string;
  retryable?: boolean;
  errorDetails?: Array<{
    code: string;
    message: string;
    emailId?: string;
  }>;
}

// Error code constants from backend
const GMAIL_ERROR_MESSAGES: Record<string, string> = {
  GMAIL_NOT_CONNECTED: "Gmail is not connected. Please connect your account.",
  GMAIL_TOKEN_EXPIRED: "Gmail access expired. Please reconnect your account.",
  GMAIL_TOKEN_INVALID: "Invalid Gmail credentials. Please reconnect.",
  GMAIL_PERMISSION_DENIED: "Insufficient permissions. Please grant access.",
  GMAIL_RATE_LIMIT: "Rate limit exceeded. Please try again in a few minutes.",
  GMAIL_QUOTA_EXCEEDED: "Daily quota exceeded. Please try again tomorrow.",
  GMAIL_API_ERROR: "Gmail service error. Please try again.",
  NETWORK_ERROR: "Network error. Please check your connection.",
  DATABASE_ERROR: "Database error. Please try again.",
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again.",
};

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
      // Step 1: Trigger Gmail sync (auto-refreshes token if expired)
      const data = await apiPost<SyncResult>("/api/gmail/sync");

      if (data.success) {
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
    } catch (error: any) {
      console.error("Sync error:", error);

      // Extract error code and message from structured error response
      const errorCode = error?.data?.error || error?.error;
      const errorMessage = error?.data?.message || error?.message;
      const retryable = error?.data?.retryable || false;

      // Map error code to user-friendly message
      const displayMessage =
        errorCode && GMAIL_ERROR_MESSAGES[errorCode]
          ? GMAIL_ERROR_MESSAGES[errorCode]
          : errorMessage || "Failed to sync Gmail. Please try again.";

      // Show retry hint if error is retryable
      const hint = retryable ? " (Retryable - please try again)" : "";

      showToast("error", displayMessage + hint);

      // If token expired, suggest reconnecting
      if (
        errorCode === "GMAIL_TOKEN_EXPIRED" ||
        errorCode === "GMAIL_TOKEN_INVALID"
      ) {
        setTimeout(() => {
          showToast(
            "info",
            "Redirecting to Gmail connection...",
            undefined,
            2000
          );
          // Could redirect to Gmail auth here
          // window.location.href = "/settings?tab=integrations";
        }, 2000);
      }
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
        endpoint: "/api/services/update-budget",
      },
      {
        name: "check-alerts",
        endpoint: "/api/services/check-alerts",
      },
      {
        name: "check-reminders",
        endpoint: "/api/services/check-reminders",
      },
      {
        name: "refresh-analytics",
        endpoint: "/api/services/refresh-analytics",
      },
    ];

    const servicePromises = services.map((service) =>
      apiPost(service.endpoint).catch((err) => {
        console.error(`Service ${service.name} failed:`, err);
        return null;
      })
    );

    const results = await Promise.allSettled(servicePromises);

    // Handle alerts and reminders
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "fulfilled") {
        const result = results[i] as PromiseFulfilledResult<unknown>;
        const data = result.value as {
          alerts?: Array<{ message?: string; title?: string }>;
          reminders?: Array<{ message?: string }>;
        } | null;

        if (!data) continue;

        // Show alerts (service index 1)
        if (i === 1 && Array.isArray(data.alerts) && data.alerts.length > 0) {
          data.alerts.forEach((alert) => {
            showToast(
              "warning",
              alert.message || alert.title || "Alert",
              undefined,
              5000
            );
          });
        }

        // Show reminders (service index 2)
        if (
          i === 2 &&
          Array.isArray(data.reminders) &&
          data.reminders.length > 0
        ) {
          const reminderCount = data.reminders.length;
          showToast(
            "info",
            `${reminderCount} upcoming bill reminder${
              reminderCount !== 1 ? "s" : ""
            }`,
            data.reminders[0]?.message
          );
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
