"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { apiRequest } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";

interface Reminder {
  card_id: string;
  card_name: string;
  bank_name: string;
  due_date: number;
  days_remaining: number;
  message: string;
}

interface RemindersResponse {
  success: boolean;
  reminders: Reminder[];
}

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const toast = useToast();

  const fetchReminders = useCallback(async () => {
    if (!user) return;

    const accessToken =
      typeof window !== "undefined"
        ? localStorage.getItem("accessToken")
        : null;
    if (!accessToken) return;

    setLoading(true);
    try {
      const response = await apiRequest("/services/check-reminders", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch reminders");
      }

      const data: RemindersResponse = await response.json();
      setReminders(data.reminders || []);
      setCount(data.reminders?.length || 0);
    } catch (error) {
      console.error("Error fetching reminders:", error);
      toast.error("Failed to load reminders");
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!user) return;

    fetchReminders();

    // Listen for updates from dashboard or sync
    const handleRefresh = () => {
      fetchReminders();
    };

    window.addEventListener("refresh-dashboard", handleRefresh);
    return () => window.removeEventListener("refresh-dashboard", handleRefresh);
  }, [user, fetchReminders]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".notification-bell-container")) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative notification-bell-container">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-6 w-6 text-gray-700 dark:text-gray-300" />
        {count > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {count > 0 ? `${count} upcoming bill reminder${count > 1 ? "s" : ""}` : "No new notifications"}
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading...</p>
              </div>
            ) : reminders.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {reminders.map((reminder) => (
                  <div
                    key={reminder.card_id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {reminder.card_name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {reminder.bank_name}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                          Due on {reminder.due_date}th
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                          {reminder.days_remaining === 0
                            ? "Due today!"
                            : `${reminder.days_remaining} day${reminder.days_remaining > 1 ? "s" : ""} remaining`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-3">
                  <Bell className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  You&apos;re all caught up!
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  No upcoming bill reminders at this time
                </p>
              </div>
            )}
          </div>

          {reminders.length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = "/dashboard/cards";
                }}
                className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                View all cards
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
