"use client";

import React from "react";
import { Save, Mail, CreditCard, Smartphone, Check, AlertTriangle, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Button, Input, Toggle, ProgressBar } from "@/components/ui";
import { cn, formatCurrency } from "@/lib/utils";
import { settingsApi, type UserSettings } from "@/lib/api/settings";
import { useToast } from "@/components/ui/Toast";
import { apiClient } from "@/lib/api-client";

const tabs = [
  { key: "spending", label: "Spending Limits", icon: CreditCard },
  { key: "email", label: "Email Preferences", icon: Mail },
  { key: "gmail", label: "Gmail Integration", icon: Smartphone },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState("spending");

  return (
    <AppLayout title="Settings" showRightSidebar={false}>
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors",
                  activeTab === tab.key
                    ? "bg-primary-green/10 text-primary-green border border-primary-green/20"
                    : "text-secondary-text hover:text-primary-text hover:bg-hover-bg"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "spending" && <SpendingLimitsSettings />}
          {activeTab === "email" && <EmailPreferencesSettings />}
          {activeTab === "gmail" && <GmailIntegrationSettings />}
        </div>
      </div>
    </AppLayout>
  );
}

function SpendingLimitsSettings() {
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();

  // Fetch settings
  const { data: userSettings, isLoading } = useQuery({
    queryKey: ["user-settings"],
    queryFn: () => settingsApi.getSettings(),
  });

  const [settings, setSettings] = React.useState({
    monthlyLimit: "",
    alertThreshold: "80",
    isActive: true,
    dailyLimit: "500",
    enableDailyLimit: false,
  });

  // Update local state when data is fetched
  React.useEffect(() => {
    if (userSettings) {
      setSettings({
        monthlyLimit: userSettings.monthly_budget?.toString() || "",
        alertThreshold: userSettings.alert_threshold?.toString() || "80",
        isActive: userSettings.email_notifications !== false,
        dailyLimit: "500",
        enableDailyLimit: false,
      });
    }
  }, [userSettings]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: settingsApi.updateSettings,
    onSuccess: () => {
      success("Spending limits updated successfully");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: Error) => {
      errorToast((error as any)?.response?.data?.message || "Failed to update settings");
    },
  });

  const handleSave = () => {
    const data: Partial<UserSettings> = {
      monthly_budget: parseFloat(settings.monthlyLimit) || 0,
      alert_threshold: parseFloat(settings.alertThreshold) || 80,
      email_notifications: settings.isActive,
    };
    updateMutation.mutate(data);
  };

  const currentSpending = 400; // This should ideally come from analytics API
  const monthlyLimit = parseInt(settings.monthlyLimit) || 0;

  if (isLoading) {
    return (
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-hover-bg rounded w-3/4"></div>
          <div className="h-4 bg-hover-bg rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-text mb-2">
          Spending Limits
        </h2>
        <p className="text-secondary-text">
          Set your monthly spending budget and alert thresholds.
        </p>
      </div>

      <div className="space-y-4">
        <Input
          label="Monthly Spending Limit"
          type="number"
          value={settings.monthlyLimit}
          onChange={(e) =>
            setSettings({ ...settings, monthlyLimit: e.target.value })
          }
          helperText="Set your maximum monthly spending budget"
        />

        <div>
          <label className="block text-sm font-medium text-primary-text mb-2">
            Alert Threshold ({settings.alertThreshold}%)
          </label>
          <input
            type="range"
            min="50"
            max="100"
            value={settings.alertThreshold}
            onChange={(e) =>
              setSettings({ ...settings, alertThreshold: e.target.value })
            }
            className="w-full h-2 bg-hover-bg rounded-lg appearance-none cursor-pointer accent-primary-green"
          />
          <p className="text-sm text-secondary-text mt-1">
            Get alerted when you reach {settings.alertThreshold}% of your
            monthly limit
          </p>
        </div>

        <Toggle
          checked={settings.isActive}
          onChange={(checked) =>
            setSettings({ ...settings, isActive: checked })
          }
          label="Enable spending limit alerts"
        />
      </div>

      {/* Current Progress */}
      <div className="pt-4 border-t border-muted-text/10">
        <h3 className="text-lg font-medium text-primary-text mb-4">
          Current Month Progress
        </h3>
        <ProgressBar
          value={currentSpending}
          max={monthlyLimit}
          label={`${formatCurrency(currentSpending)} spent of ${formatCurrency(monthlyLimit)}`}
          showPercentage={true}
        />
      </div>

      <Button
        className="w-full"
        onClick={handleSave}
        disabled={updateMutation.isPending}
      >
        <Save className="w-4 h-4 mr-2" />
        {updateMutation.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}

function EmailPreferencesSettings() {
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();

  // Fetch settings
  const { data: userSettings, isLoading } = useQuery({
    queryKey: ["user-settings"],
    queryFn: () => settingsApi.getSettings(),
  });

  const [preferences, setPreferences] = React.useState({
    emailNotifications: true,
    spendingAlerts: true,
    billReminders: true,
    reminderDays: "3",
    unusualTransactions: false,
    weeklySummary: true,
    monthlyReport: true,
  });

  // Update local state when data is fetched
  React.useEffect(() => {
    if (userSettings) {
      const notifPrefs = userSettings.notification_preferences || {};
      setPreferences({
        emailNotifications: userSettings.email_notifications !== false,
        spendingAlerts: notifPrefs.spending_alerts !== false,
        billReminders: notifPrefs.bill_reminders !== false,
        reminderDays: "3",
        unusualTransactions: false,
        weeklySummary: notifPrefs.weekly_summary !== false,
        monthlyReport: true,
      });
    }
  }, [userSettings]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<UserSettings>) =>
      settingsApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      success("Preferences saved successfully");
    },
    onError: () => {
      errorToast("Failed to save preferences");
    },
  });

  const handleSave = () => {
    const data: Partial<UserSettings> = {
      email_notifications: preferences.emailNotifications,
      notification_preferences: {
        bill_reminders: preferences.billReminders,
        spending_alerts: preferences.spendingAlerts,
        weekly_summary: preferences.weeklySummary,
      },
    };
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-hover-bg rounded w-3/4"></div>
          <div className="h-4 bg-hover-bg rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-text mb-2">
          Email Preferences
        </h2>
        <p className="text-secondary-text">
          Configure when and how you receive email notifications.
        </p>
      </div>

      <div className="space-y-4">
        <Toggle
          checked={preferences.emailNotifications}
          onChange={(checked) =>
            setPreferences({ ...preferences, emailNotifications: checked })
          }
          label="Enable email notifications"
        />

        <div className="ml-6 space-y-4 border-l-2 border-muted-text/10 pl-4">
          <Toggle
            checked={preferences.spendingAlerts}
            onChange={(checked) =>
              setPreferences({ ...preferences, spendingAlerts: checked })
            }
            label="Spending limit alerts"
            disabled={!preferences.emailNotifications}
          />

          <div>
            <Toggle
              checked={preferences.billReminders}
              onChange={(checked) =>
                setPreferences({ ...preferences, billReminders: checked })
              }
              label="Bill due date reminders"
              disabled={!preferences.emailNotifications}
            />
            {preferences.billReminders && (
              <div className="mt-2 ml-6">
                <Input
                  label="Remind me (days before due date)"
                  type="number"
                  value={preferences.reminderDays}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      reminderDays: e.target.value,
                    })
                  }
                  min="1"
                  max="15"
                  className="w-32"
                />
              </div>
            )}
          </div>

          <Toggle
            checked={preferences.weeklySummary}
            onChange={(checked) =>
              setPreferences({ ...preferences, weeklySummary: checked })
            }
            label="Weekly spending summary"
            disabled={!preferences.emailNotifications}
          />
        </div>
      </div>

      <Button
        className="w-full"
        onClick={handleSave}
        disabled={updateMutation.isPending}
      >
        <Save className="w-4 h-4 mr-2" />
        {updateMutation.isPending ? "Saving..." : "Save Preferences"}
      </Button>
    </div>
  );
}

function GmailIntegrationSettings() {
  const { success, error: errorToast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["gmail-status"],
    queryFn: async () => {
      const res = await apiClient.get<any>("/api/gmail/status");
      return res.data;
    }
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<any>("/api/gmail/auth-url");
      return res.data.url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: () => {
      errorToast("Failed to initiate Gmail connection", { title: "Error" });
    }
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<any>("/api/gmail/sync");
      return res.data;
    },
    onSuccess: (data) => {
      success(`Found ${data.summary?.newTransactions || 0} new transactions.`, { 
        title: "Sync Complete" 
      });
      queryClient.invalidateQueries({ queryKey: ["gmail-status"] });
    },
    onError: () => {
      errorToast("Sync failed", { title: "Error" });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/api/gmail/disconnect");
    },
    onSuccess: () => {
      success("Gmail account disconnected", { title: "Disconnected" });
      queryClient.invalidateQueries({ queryKey: ["gmail-status"] });
    },
    onError: () => {
      errorToast("Failed to disconnect", { title: "Error" });
    }
  });

  if (isLoading) {
    return (
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-hover-bg rounded w-3/4"></div>
          <div className="h-4 bg-hover-bg rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const isConnected = status?.connected;

  return (
    <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-text mb-2">
          Gmail Integration
        </h2>
        <p className="text-secondary-text">
          Connect your Gmail account to automatically import transactions from bank emails.
        </p>
      </div>

      {/* Connection Status */}
      <div className={cn(
        "p-4 rounded-lg border",
        isConnected ? "bg-success/5 border-success/20" : "bg-warning/5 border-warning/20"
      )}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={cn("font-medium", isConnected ? "text-success" : "text-warning")}>
              {isConnected ? "Connected to Gmail" : "Not connected"}
            </h3>
            {isConnected && status?.lastSync && (
              <p className="text-xs text-secondary-text mt-1">
                Last synced: {new Date(status.lastSync).toLocaleString()}
              </p>
            )}
          </div>
          <div
            className={cn(
              "w-3 h-3 rounded-full",
              isConnected ? "bg-success" : "bg-warning"
            )}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-4">
        {!isConnected ? (
          <Button 
            onClick={() => connectMutation.mutate()} 
            className="w-full"
            disabled={connectMutation.isPending}
          >
            <Mail className="w-4 h-4 mr-2" />
            {connectMutation.isPending ? "Connecting..." : "Connect Gmail Account"}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                variant="secondary" 
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", syncMutation.isPending && "animate-spin")} />
                {syncMutation.isPending ? "Syncing..." : "Sync Now"}
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                Disconnect Gmail
              </Button>
            </div>

            <div className="bg-hover-bg p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div className="text-sm text-secondary-text">
                  <p className="font-medium text-primary-text mb-1">Privacy Note</p>
                  <p>We only scan emails from known banks for transaction details. Your other emails are never accessed or stored.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
