"use client";

import React from "react";
import { Save, Mail, CreditCard, Smartphone, Check, AlertTriangle, RefreshCw, DollarSign } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, ProgressBar, Switch, Label } from "@/shared/components/ui";
import { cn, formatCurrency } from "@/shared/utils";
import { settingsApi, type UserSettings } from "@/features/settings/api";
import { useToast } from "@/shared/utils/toast";
import { apiClient } from "@/lib/api-client";
import { useOverview } from "@/features/dashboard/hooks/useDashboardHooks";

const tabs = [
  { key: "spending", label: "Spending Limits", icon: CreditCard },
  { key: "email", label: "Email Preferences", icon: Mail },
  { key: "gmail", label: "Gmail Integration", icon: Smartphone },
  { key: "currency", label: "Currency Settings", icon: DollarSign },
];

export default function SettingsPageClient() {
  const [activeTab, setActiveTab] = React.useState("spending");

  return (
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
        {activeTab === "currency" && <CurrencySettings />}
      </div>
    </div>
  );
}

function SpendingLimitsSettings() {
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();

  // Fetch overview data for current spending
  const { data: overviewData, isLoading: isOverviewLoading } = useOverview();

  // Fetch settings
  const { data: userSettings, isLoading: isSettingsLoading } = useQuery({
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
      const err = error as unknown as { response?: { data?: { message?: string } } };
      errorToast(err.response?.data?.message || "Failed to update settings");
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

  const currentSpending = overviewData?.currentMonth?.totalSpent || 0;
  const monthlyLimit = parseFloat(settings.monthlyLimit) || 0;

  const isLoading = isSettingsLoading || isOverviewLoading;

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

        <div className="flex items-center justify-between">
          <Label htmlFor="spending-limit-alerts">Enable spending limit alerts</Label>
          <Switch
            id="spending-limit-alerts"
            checked={settings.isActive}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, isActive: checked })
            }
          />
        </div>
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
        <div className="flex items-center justify-between">
          <Label htmlFor="email-notifications">Enable email notifications</Label>
          <Switch
            id="email-notifications"
            checked={preferences.emailNotifications}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, emailNotifications: checked })
            }
          />
        </div>

        <div className="ml-6 space-y-4 border-l-2 border-muted-text/10 pl-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="spending-alerts" className={!preferences.emailNotifications ? "opacity-50" : ""}>Spending limit alerts</Label>
            <Switch
              id="spending-alerts"
              checked={preferences.spendingAlerts}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, spendingAlerts: checked })
              }
              disabled={!preferences.emailNotifications}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="bill-reminders" className={!preferences.emailNotifications ? "opacity-50" : ""}>Bill due date reminders</Label>
              <Switch
                id="bill-reminders"
                checked={preferences.billReminders}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, billReminders: checked })
                }
                disabled={!preferences.emailNotifications}
              />
            </div>
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

          <div className="flex items-center justify-between">
            <Label htmlFor="weekly-summary" className={!preferences.emailNotifications ? "opacity-50" : ""}>Weekly spending summary</Label>
            <Switch
              id="weekly-summary"
              checked={preferences.weeklySummary}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, weeklySummary: checked })
              }
              disabled={!preferences.emailNotifications}
            />
          </div>
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
      errorToast("Failed to initiate Gmail connection");
    }
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<any>("/api/gmail/sync");
      return res.data;
    },
    onSuccess: (data) => {
      success(`Found ${data.summary?.newTransactions || 0} new transactions.`);
      queryClient.invalidateQueries({ queryKey: ["gmail-status"] });
    },
    onError: () => {
      errorToast("Sync failed");
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/api/gmail/disconnect");
    },
    onSuccess: () => {
      success("Gmail account disconnected");
      queryClient.invalidateQueries({ queryKey: ["gmail-status"] });
    },
    onError: () => {
      errorToast("Failed to disconnect");
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

function CurrencySettings() {
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();

  // Fetch current preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ["currency-preferences"],
    queryFn: async () => {
      const res = await apiClient.get<any>("/api/currency/preferences");
      return res.data.data;
    }
  });

  // Fetch live rates
  const { data: rates } = useQuery({
    queryKey: ["currency-rates"],
    queryFn: async () => {
      const res = await apiClient.get<any>("/api/currency/rates?base=USD");
      return res.data.data;
    }
  });

  const [selectedCurrency, setSelectedCurrency] = React.useState("INR");

  React.useEffect(() => {
    if (preferences?.baseCurrency) {
      setSelectedCurrency(preferences.baseCurrency);
    }
  }, [preferences]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (currency: string) => {
      await apiClient.put("/api/currency/preferences", { baseCurrency: currency });
    },
    onSuccess: () => {
      success("Currency preference saved");
      queryClient.invalidateQueries({ queryKey: ["currency-preferences"] });
    },
    onError: () => {
      errorToast("Failed to save currency preference");
    }
  });

  const handleSave = () => {
    updateMutation.mutate(selectedCurrency);
  };

  const currencies = [
    { code: "INR", name: "Indian Rupee", symbol: "₹" },
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
    { code: "GBP", name: "British Pound", symbol: "£" },
    { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
    { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
    { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
    { code: "AUD", name: "Australian Dollar", symbol: "A$" },
    { code: "JPY", name: "Japanese Yen", symbol: "¥" },
    { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  ];

  // Sample rates for display
  const sampleRates: Record<string, number> = {
    INR: 1,
    USD: 83.5,
    EUR: 91.2,
    GBP: 106.0,
    AED: 22.7,
    SGD: 62.3,
    CAD: 61.4,
    AUD: 54.6,
    JPY: 0.56,
    CHF: 94.9,
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
          Currency Settings
        </h2>
        <p className="text-secondary-text">
          Choose your preferred display currency for transactions and analytics.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="display-currency" className="block mb-2">Display Currency</Label>
          <select
            id="display-currency"
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="w-full bg-hover-bg border border-muted-text/20 rounded-lg p-3 text-primary-text focus:ring-2 focus:ring-primary-green/50 focus:border-primary-green"
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code} - {c.name}
              </option>
            ))}
          </select>
          <p className="text-sm text-secondary-text mt-2">
            All transaction amounts will be displayed in this currency.
          </p>
        </div>

        {/* Exchange Rate Preview */}
        <div className="bg-hover-bg rounded-lg p-4">
          <h3 className="text-sm font-medium text-primary-text mb-3">
            Current Exchange Rates (to INR)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {currencies.slice(0, 6).map((c) => (
              <div key={c.code} className="flex justify-between text-sm">
                <span className="text-secondary-text">1 {c.code}</span>
                <span className="text-primary-text font-medium">
                  ₹{sampleRates[c.code]?.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-text mt-3">
            Rates updated daily from currency-api.pages.dev
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-primary-green/5 border border-primary-green/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-primary-green shrink-0 mt-0.5" />
            <div className="text-sm text-secondary-text">
              <p className="font-medium text-primary-text mb-1">Automatic Conversion</p>
              <p>
                Transactions in foreign currencies are automatically converted using 
                real-time exchange rates. The original amount is always preserved.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Button
        className="w-full"
        onClick={handleSave}
        disabled={updateMutation.isPending}
      >
        <Save className="w-4 h-4 mr-2" />
        {updateMutation.isPending ? "Saving..." : "Save Currency Settings"}
      </Button>
    </div>
  );
}
