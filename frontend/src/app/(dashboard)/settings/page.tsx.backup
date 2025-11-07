"use client";

import React from "react";
import { Save, Mail, CreditCard, Smartphone } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button, Input, Toggle, ProgressBar } from "@/components/ui";
import { cn, formatCurrency } from "@/lib/utils";

const tabs = [
  { key: "spending", label: "Spending Limits", icon: CreditCard },
  { key: "email", label: "Email Preferences", icon: Mail },
  { key: "cards", label: "Card Management", icon: CreditCard },
  { key: "gmail", label: "Gmail Integration", icon: Smartphone },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState("spending");

  return (
    <AppLayout title="Settings" showRightSidebar={false}>
      <div className="flex gap-8">
        {/* Sidebar Navigation */}
        <div className="w-64 space-y-2">
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
        <div className="flex-1">
          {activeTab === "spending" && <SpendingLimitsSettings />}
          {activeTab === "email" && <EmailPreferencesSettings />}
          {activeTab === "cards" && <CardManagementSettings />}
          {activeTab === "gmail" && <GmailIntegrationSettings />}
        </div>
      </div>
    </AppLayout>
  );
}

function SpendingLimitsSettings() {
  const [settings, setSettings] = React.useState({
    monthlyLimit: "2000",
    alertThreshold: "80",
    isActive: true,
    dailyLimit: "500",
    enableDailyLimit: false,
  });

  const currentSpending = 400;
  const monthlyLimit = parseInt(settings.monthlyLimit) || 0;

  return (
    <div className="bg-card-bg rounded-lg p-6 space-y-6">
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
            className="w-full h-2 bg-hover-bg rounded-lg appearance-none cursor-pointer slider"
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

        <div className="pt-4 border-t border-muted-text/20">
          <Toggle
            checked={settings.enableDailyLimit}
            onChange={(checked) =>
              setSettings({ ...settings, enableDailyLimit: checked })
            }
            label="Enable daily spending limit"
          />

          {settings.enableDailyLimit && (
            <div className="mt-4">
              <Input
                label="Daily Spending Limit"
                type="number"
                value={settings.dailyLimit}
                onChange={(e) =>
                  setSettings({ ...settings, dailyLimit: e.target.value })
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Current Progress */}
      <div className="pt-4 border-t border-muted-text/20">
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

      <Button className="w-full">
        <Save className="w-4 h-4 mr-2" />
        Save Settings
      </Button>
    </div>
  );
}

function EmailPreferencesSettings() {
  const [preferences, setPreferences] = React.useState({
    emailNotifications: true,
    spendingAlerts: true,
    billReminders: true,
    reminderDays: "3",
    unusualTransactions: false,
    weeklySummary: true,
    monthlyReport: true,
  });

  return (
    <div className="bg-card-bg rounded-lg p-6 space-y-6">
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

        <div className="ml-6 space-y-4">
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
            checked={preferences.unusualTransactions}
            onChange={(checked) =>
              setPreferences({ ...preferences, unusualTransactions: checked })
            }
            label="Unusual transaction alerts"
            disabled={!preferences.emailNotifications}
          />

          <Toggle
            checked={preferences.weeklySummary}
            onChange={(checked) =>
              setPreferences({ ...preferences, weeklySummary: checked })
            }
            label="Weekly spending summary"
            disabled={!preferences.emailNotifications}
          />

          <Toggle
            checked={preferences.monthlyReport}
            onChange={(checked) =>
              setPreferences({ ...preferences, monthlyReport: checked })
            }
            label="Monthly spending report"
            disabled={!preferences.emailNotifications}
          />
        </div>
      </div>

      <Button className="w-full">
        <Save className="w-4 h-4 mr-2" />
        Save Preferences
      </Button>
    </div>
  );
}

function CardManagementSettings() {
  return (
    <div className="bg-card-bg rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-primary-text mb-2">
          Card Management
        </h2>
        <p className="text-secondary-text">
          Manage your credit cards and their settings.
        </p>
      </div>

      <div className="text-center py-12">
        <CreditCard className="w-12 h-12 mx-auto mb-3 text-muted-text" />
        <p className="text-secondary-text mb-4">
          Card management settings will be available here.
        </p>
        <Button variant="secondary">Go to Cards Page</Button>
      </div>
    </div>
  );
}

function GmailIntegrationSettings() {
  const [isConnected, setIsConnected] = React.useState(false);
  const [settings, setSettings] = React.useState({
    autoSync: true,
    syncFrequency: "hourly",
  });

  return (
    <div className="bg-card-bg rounded-lg p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-text mb-2">
          Gmail Integration
        </h2>
        <p className="text-secondary-text">
          Connect your Gmail account to automatically import transactions.
        </p>
      </div>

      {/* Connection Status */}
      <div className="p-4 bg-hover-bg rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-primary-text">Connection Status</h3>
            <p
              className={cn(
                "text-sm",
                isConnected ? "text-success" : "text-warning"
              )}
            >
              {isConnected ? "Connected to Gmail" : "Not connected"}
            </p>
            {isConnected && (
              <p className="text-xs text-secondary-text mt-1">
                Last synced: 2 hours ago
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
          <Button onClick={() => setIsConnected(true)} className="w-full">
            <Mail className="w-4 h-4 mr-2" />
            Connect Gmail Account
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button variant="secondary">Sync Now</Button>
              <Button variant="secondary">Scan Historical Emails</Button>
            </div>

            <Toggle
              checked={settings.autoSync}
              onChange={(checked) =>
                setSettings({ ...settings, autoSync: checked })
              }
              label="Enable automatic sync"
            />

            {settings.autoSync && (
              <div>
                <label className="block text-sm font-medium text-primary-text mb-2">
                  Sync Frequency
                </label>
                <select
                  value={settings.syncFrequency}
                  onChange={(e) =>
                    setSettings({ ...settings, syncFrequency: e.target.value })
                  }
                  className="w-full p-2 bg-primary-bg border border-muted-text/20 rounded-lg text-primary-text"
                >
                  <option value="realtime">Real-time</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
            )}

            <Button variant="error" onClick={() => setIsConnected(false)}>
              Disconnect Gmail
            </Button>
          </div>
        )}
      </div>

      <Button className="w-full">
        <Save className="w-4 h-4 mr-2" />
        Save Settings
      </Button>
    </div>
  );
}
