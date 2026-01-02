"use client";

import React, { useState, useEffect } from "react";
import { Bell, Mail, Clock, DollarSign, AlertTriangle, Save, RotateCcw } from "lucide-react";
import { cn } from "@/shared/utils";
import { usePushNotifications } from "@/shared/hooks/usePushNotifications";

interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  largeTransactionThreshold: number;
  budgetWarningThreshold: number;
  billReminderDays: number;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

interface NotificationSettingsProps {
  initialPreferences?: NotificationPreferences;
  onSave: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  onReset: () => Promise<void>;
}

export function NotificationSettings({
  initialPreferences,
  onSave,
  onReset,
}: NotificationSettingsProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailEnabled: true,
    pushEnabled: true,
    largeTransactionThreshold: 10000,
    budgetWarningThreshold: 80,
    billReminderDays: 3,
    quietHoursStart: null,
    quietHoursEnd: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const { 
    permission, 
    requestPermission, 
    subscribeToPush, 
    unsubscribeFromPush, 
    subscription, 
    isSupported 
  } = usePushNotifications();

  useEffect(() => {
    if (initialPreferences) {
      setPreferences(initialPreferences);
    }
  }, [initialPreferences]);

  const handleChange = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(preferences);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await onReset();
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-primary-text">Notification Settings</h2>
          <p className="text-sm text-secondary-text mt-1">
            Configure how and when you receive alerts
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-secondary-text hover:text-primary-text transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
              hasChanges && !isSaving
                ? "bg-primary text-white hover:bg-primary/90"
                : "bg-muted-text/20 text-muted-text cursor-not-allowed"
            )}
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Notification Channels */}
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <h3 className="text-lg font-medium text-primary-text mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notification Channels
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-secondary-text" />
              <div>
                <p className="text-primary-text font-medium">Email Notifications</p>
                <p className="text-sm text-secondary-text">Receive alerts via email</p>
              </div>
            </div>
            <button
              onClick={() => handleChange("emailEnabled", !preferences.emailEnabled)}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative",
                preferences.emailEnabled ? "bg-primary" : "bg-muted-text/30"
              )}
            >
              <div
                className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  preferences.emailEnabled ? "translate-x-7" : "translate-x-1"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-secondary-text" />
              <div>
                <p className="text-primary-text font-medium">Push Notifications</p>
                <p className="text-sm text-secondary-text">Browser push alerts</p>
              </div>
            </div>
            <button
              onClick={async () => {
                const newValue = !preferences.pushEnabled;
                if (newValue) {
                  // Enable push
                  if (permission === 'default') {
                    const result = await requestPermission();
                    if (result !== 'granted') return; // User denied
                  } else if (permission === 'denied') {
                    alert('Please enable notifications in your browser settings');
                    return;
                  }
                  
                  // Try to subscribe if key is available
                  if (!subscription && isSupported) {
                    try {
                      // Placeholder for VAPID key - should come from env
                      // If no key, we just enable the preference but can't push
                      const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY; 
                      if (vapidKey) {
                        await subscribeToPush(vapidKey);
                      }
                    } catch (e) {
                      console.error("Failed to subscribe to push", e);
                      // proceed to just update preference? Or fail? 
                      // For now, let's update preference so UI reflects intent
                    }
                  }
                } else {
                  // Disable push
                  if (subscription) {
                    await unsubscribeFromPush();
                  }
                }
                handleChange("pushEnabled", newValue);
              }}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative",
                preferences.pushEnabled ? "bg-primary" : "bg-muted-text/30"
              )}
            >
              <div
                className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                  preferences.pushEnabled ? "translate-x-7" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Thresholds */}
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <h3 className="text-lg font-medium text-primary-text mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Alert Thresholds
        </h3>

        <div className="space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-secondary-text mb-2">
              <DollarSign className="w-4 h-4" />
              Large Transaction Threshold
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1000"
                max="100000"
                step="1000"
                value={preferences.largeTransactionThreshold}
                onChange={(e) => handleChange("largeTransactionThreshold", Number(e.target.value))}
                className="flex-1 h-2 bg-hover-bg rounded-full appearance-none cursor-pointer"
              />
              <span className="min-w-[100px] text-right font-medium text-primary-text">
                ₹{preferences.largeTransactionThreshold.toLocaleString('en-IN')}
              </span>
            </div>
            <p className="text-xs text-muted-text mt-1">Get alerted for transactions above this amount</p>
          </div>

          <div>
            <label className="text-sm font-medium text-secondary-text mb-2 block">
              Budget Warning Threshold
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={preferences.budgetWarningThreshold}
                onChange={(e) => handleChange("budgetWarningThreshold", Number(e.target.value))}
                className="flex-1 h-2 bg-hover-bg rounded-full appearance-none cursor-pointer"
              />
              <span className="min-w-[60px] text-right font-medium text-primary-text">
                {preferences.budgetWarningThreshold}%
              </span>
            </div>
            <p className="text-xs text-muted-text mt-1">Warn when budget usage exceeds this percentage</p>
          </div>

          <div>
            <label className="text-sm font-medium text-secondary-text mb-2 block">
              Bill Reminder Days
            </label>
            <select
              value={preferences.billReminderDays}
              onChange={(e) => handleChange("billReminderDays", Number(e.target.value))}
              className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text"
            >
              {[1, 2, 3, 5, 7, 10, 14].map((days) => (
                <option key={days} value={days}>
                  {days} day{days > 1 ? "s" : ""} before due date
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quiet Hours */}
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <h3 className="text-lg font-medium text-primary-text mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-secondary-text" />
          Quiet Hours
        </h3>
        <p className="text-sm text-secondary-text mb-4">
          Don't send notifications during these hours
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-secondary-text mb-2 block">Start</label>
            <input
              type="time"
              value={preferences.quietHoursStart || ""}
              onChange={(e) => handleChange("quietHoursStart", e.target.value || null)}
              className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-secondary-text mb-2 block">End</label>
            <input
              type="time"
              value={preferences.quietHoursEnd || ""}
              onChange={(e) => handleChange("quietHoursEnd", e.target.value || null)}
              className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
