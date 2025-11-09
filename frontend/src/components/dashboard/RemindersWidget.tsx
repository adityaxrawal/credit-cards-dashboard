"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Calendar, AlertCircle } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";

interface Reminder {
  id: string;
  card_id: string;
  card_name: string;
  bank_name: string;
  reminder_type: "bill_date" | "due_date" | "payment_due";
  reminder_date: string;
  days_until_due: number;
  amount_due?: number;
}

export function RemindersWidget() {
  const { data: reminders, isLoading } = useQuery({
    queryKey: ["upcoming-reminders"],
    queryFn: async () => {
      const data = await apiClient.get("/api/bills/upcoming?days=14");
      return (data.data?.reminders || []) as Reminder[];
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="bg-card-bg rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-primary-green" />
          <h3 className="font-semibold text-primary-text">
            Upcoming Reminders
          </h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-hover-bg rounded"></div>
          <div className="h-16 bg-hover-bg rounded"></div>
        </div>
      </div>
    );
  }

  if (!reminders || reminders.length === 0) {
    return (
      <div className="bg-card-bg rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-primary-green" />
          <h3 className="font-semibold text-primary-text">
            Upcoming Reminders
          </h3>
        </div>
        <div className="text-center py-6">
          <Calendar className="w-12 h-12 mx-auto mb-2 text-muted-text" />
          <p className="text-sm text-secondary-text">No upcoming reminders</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card-bg rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-green" />
          <h3 className="font-semibold text-primary-text">
            Upcoming Reminders
          </h3>
        </div>
        <span className="text-xs text-secondary-text">
          {reminders.length} upcoming
        </span>
      </div>

      <div className="space-y-3">
        {reminders.slice(0, 5).map((reminder) => {
          const isUrgent = reminder.days_until_due <= 3;
          const isWarning =
            reminder.days_until_due > 3 && reminder.days_until_due <= 7;

          return (
            <Link
              key={reminder.id}
              href={`/cards/${reminder.card_id}`}
              className="block p-3 bg-hover-bg hover:bg-primary-bg/50 rounded-lg transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-primary-text truncate">
                      {reminder.card_name}
                    </p>
                    {isUrgent && (
                      <AlertCircle className="w-4 h-4 text-error flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-secondary-text truncate">
                    {reminder.bank_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-3 h-3 text-muted-text" />
                    <p className="text-xs text-secondary-text">
                      {reminder.reminder_type === "bill_date"
                        ? "Bill Date"
                        : reminder.reminder_type === "due_date"
                        ? "Due Date"
                        : "Payment Due"}
                      {" - "}
                      {formatDate(reminder.reminder_date, "short")}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span
                    className={cn(
                      "inline-block px-2 py-1 rounded text-xs font-medium",
                      isUrgent && "bg-error/10 text-error",
                      isWarning && "bg-warning/10 text-warning",
                      !isUrgent &&
                        !isWarning &&
                        "bg-primary-green/10 text-primary-green"
                    )}
                  >
                    {reminder.days_until_due === 0
                      ? "Today"
                      : reminder.days_until_due === 1
                      ? "Tomorrow"
                      : `${reminder.days_until_due} days`}
                  </span>
                  {reminder.amount_due && (
                    <p className="text-xs text-secondary-text mt-1">
                      ${reminder.amount_due.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {reminders.length > 5 && (
        <Link
          href="/bills"
          className="block mt-4 text-center text-sm text-primary-green hover:underline"
        >
          View all {reminders.length} reminders
        </Link>
      )}
    </div>
  );
}
