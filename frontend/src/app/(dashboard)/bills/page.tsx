"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  Calendar as CalendarIcon,
  Plus,
  Check,
  X,
  Clock,
  AlertCircle,
  Repeat,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button, Input, Modal, Badge } from "@/components/ui";
import { formatCurrency, cn } from "@/lib/utils";

interface BillReminder {
  id: string;
  title: string;
  description: string;
  amount: number;
  dueDate: string;
  reminderDate: string;
  status: "pending" | "sent" | "paid" | "overdue" | "cancelled";
  isRecurring: boolean;
  recurrencePattern?: string;
  credit_cards?: {
    card_name: string;
  };
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  eventType: string;
  eventDate: string;
  color: string;
  icon: string;
  bill_reminders?: {
    title: string;
    amount: number;
    status: string;
  };
}

export default function BillsCalendarPage() {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  // Form state
  const [newReminder, setNewReminder] = useState({
    title: "",
    description: "",
    amount: "",
    dueDate: "",
    isRecurring: false,
    recurrencePattern: "monthly",
    recurrenceDay: 1,
  });

  // Fetch calendar events
  const startOfMonth = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth(),
    1
  );
  const endOfMonth = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth() + 1,
    0
  );

  const { data: calendarEvents } = useQuery({
    queryKey: ["billCalendar", selectedMonth.toISOString()],
    queryFn: async () => {
      const response = await apiClient.get<any>(
        `/api/bills/calendar?startDate=${startOfMonth.toISOString()}&endDate=${endOfMonth.toISOString()}`
      );
      return response.data as CalendarEvent[];
    },
  });

  // Fetch all reminders
  const { data: reminders } = useQuery({
    queryKey: ["billReminders"],
    queryFn: async () => {
      const response = await apiClient.get<any>("/api/bills/reminders");
      return response.data as BillReminder[];
    },
  });

  // Fetch recurring templates
  const { data: recurringTemplates } = useQuery({
    queryKey: ["recurringTemplates"],
    queryFn: async () => {
      const response = await apiClient.get<any>(
        "/api/bills/recurring-templates?activeOnly=true"
      );
      return response.data;
    },
  });

  // Create reminder mutation
  const createReminderMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post("/api/bills/reminders", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billReminders"] });
      queryClient.invalidateQueries({ queryKey: ["billCalendar"] });
      setShowCreateModal(false);
      resetForm();
    },
  });

  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const response = await apiClient.put(`/api/bills/reminders/${id}/paid`, {
        amount,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billReminders"] });
      queryClient.invalidateQueries({ queryKey: ["billCalendar"] });
    },
  });

  // Detect recurring bills
  const detectRecurringMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<any>("/api/bills/detect-recurring");
      return response.data;
    },
    onSuccess: (data: any) => {
      alert(`Detected ${data.detectedCount} recurring bills!`);
      queryClient.invalidateQueries({ queryKey: ["recurringTemplates"] });
    },
  });

  const resetForm = () => {
    setNewReminder({
      title: "",
      description: "",
      amount: "",
      dueDate: "",
      isRecurring: false,
      recurrencePattern: "monthly",
      recurrenceDay: 1,
    });
  };

  const handleCreateReminder = () => {
    const reminderDate = new Date(newReminder.dueDate);
    reminderDate.setDate(reminderDate.getDate() - 3); // 3 days before

    createReminderMutation.mutate({
      ...newReminder,
      amount: parseFloat(newReminder.amount),
      reminderDate: reminderDate.toISOString(),
    });
  };

  // Calendar rendering
  const getDaysInMonth = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getEventsForDate = (date: Date) => {
    if (!calendarEvents) return [];
    return calendarEvents.filter((event) => {
      const eventDate = new Date(event.eventDate);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: "Pending", className: "bg-warning/10 text-warning" },
      sent: { label: "Sent", className: "bg-info/10 text-info" },
      paid: { label: "Paid", className: "bg-success/10 text-success" },
      overdue: { label: "Overdue", className: "bg-error/10 text-error" },
      cancelled: { label: "Cancelled", className: "bg-muted-text/10 text-muted-text" },
    };
    const variant = variants[status] || variants.pending;
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${variant.className}`}
      >
        {variant.label}
      </span>
    );
  };

  const days = getDaysInMonth();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <AppLayout title="Bills & Reminders" showRightSidebar={false}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-secondary-text">
              Manage your bill due dates and payment reminders
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="secondary"
              onClick={() => detectRecurringMutation.mutate()}
            >
              <Repeat className="w-4 h-4 mr-2" />
              Detect Recurring
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Reminder
            </Button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center space-x-2 bg-hover-bg p-1 rounded-lg w-fit">
          <button
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center",
              viewMode === "calendar" ? "bg-card-bg text-primary-text shadow-sm" : "text-secondary-text hover:text-primary-text"
            )}
            onClick={() => setViewMode("calendar")}
          >
            <CalendarIcon className="w-4 h-4 mr-2" />
            Calendar View
          </button>
          <button
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center",
              viewMode === "list" ? "bg-card-bg text-primary-text shadow-sm" : "text-secondary-text hover:text-primary-text"
            )}
            onClick={() => setViewMode("list")}
          >
            List View
          </button>
        </div>

        {viewMode === "calendar" ? (
          <>
            {/* Calendar Navigation */}
            <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelectedMonth(
                      new Date(
                        selectedMonth.getFullYear(),
                        selectedMonth.getMonth() - 1
                      )
                    )
                  }
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-xl font-semibold text-primary-text">
                  {selectedMonth.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSelectedMonth(
                      new Date(
                        selectedMonth.getFullYear(),
                        selectedMonth.getMonth() + 1
                      )
                    )
                  }
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-4">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-center font-semibold text-secondary-text py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {days.map((day, index) => {
                  if (!day) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="min-h-[100px] bg-hover-bg/50 rounded-lg"
                      ></div>
                    );
                  }

                  const events = getEventsForDate(day);
                  const isToday =
                    day.getDate() === new Date().getDate() &&
                    day.getMonth() === new Date().getMonth() &&
                    day.getFullYear() === new Date().getFullYear();

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-[100px] border rounded-lg p-2 cursor-pointer hover:shadow-md transition-all",
                        isToday
                          ? "border-primary-green bg-primary-green/5"
                          : "border-muted-text/10 bg-card-bg hover:bg-hover-bg"
                      )}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div className={cn("font-semibold text-sm mb-1", isToday ? "text-primary-green" : "text-primary-text")}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-1">
                        {events.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className="text-xs p-1 rounded truncate"
                            style={{
                              backgroundColor: event.color + "20",
                              color: event.color,
                            }}
                          >
                            {event.title}
                          </div>
                        ))}
                        {events.length > 3 && (
                          <div className="text-xs text-secondary-text">
                            +{events.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* List View */}
            <div className="space-y-6">
              {/* Upcoming Bills */}
              <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-primary-text mb-4">Upcoming Bills</h3>
                <div className="space-y-3">
                  {reminders
                    ?.filter(
                      (r) => r.status === "pending" || r.status === "sent"
                    )
                    .sort(
                      (a, b) =>
                        new Date(a.dueDate).getTime() -
                        new Date(b.dueDate).getTime()
                    )
                    .map((reminder) => (
                      <div
                        key={reminder.id}
                        className="flex items-center justify-between p-4 bg-hover-bg rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h4 className="font-semibold text-primary-text">{reminder.title}</h4>
                            {getStatusBadge(reminder.status)}
                            {reminder.isRecurring && (
                              <Badge variant="secondary" className="text-xs bg-card-bg">
                                <Repeat className="w-3 h-3 mr-1" />
                                {reminder.recurrencePattern}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-secondary-text mt-1">
                            {reminder.description}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-secondary-text">
                            <span className="flex items-center">
                              <CalendarIcon className="w-4 h-4 mr-1" />
                              Due:{" "}
                              {new Date(reminder.dueDate).toLocaleDateString()}
                            </span>
                            <span className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              Reminder:{" "}
                              {new Date(
                                reminder.reminderDate
                              ).toLocaleDateString()}
                            </span>
                            {reminder.credit_cards && (
                              <span className="text-xs bg-card-bg px-2 py-1 rounded border border-muted-text/10">
                                {reminder.credit_cards.card_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2 ml-4">
                          <p className="text-xl font-bold text-primary-text">
                            {formatCurrency(reminder.amount)}
                          </p>
                          {reminder.status !== "paid" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                markAsPaidMutation.mutate({
                                  id: reminder.id,
                                  amount: reminder.amount,
                                })
                              }
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  {!reminders?.some(
                    (r) => r.status === "pending" || r.status === "sent"
                  ) && (
                    <p className="text-center text-secondary-text py-8">
                      No upcoming bills
                    </p>
                  )}
                </div>
              </div>

              {/* Overdue Bills */}
              {reminders?.some((r) => r.status === "overdue") && (
                <div className="bg-error/5 border border-error/20 rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-error mb-4 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Overdue Bills
                  </h3>
                  <div className="space-y-3">
                    {reminders
                      ?.filter((r) => r.status === "overdue")
                      .map((reminder) => (
                        <div
                          key={reminder.id}
                          className="flex items-center justify-between p-4 bg-card-bg border border-error/20 rounded-lg"
                        >
                          <div className="flex-1">
                            <h4 className="font-semibold text-error">
                              {reminder.title}
                            </h4>
                            <p className="text-sm text-secondary-text mt-1">
                              {reminder.description}
                            </p>
                            <p className="text-sm text-error mt-2">
                              Due:{" "}
                              {new Date(reminder.dueDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-col items-end space-y-2 ml-4">
                            <p className="text-xl font-bold text-error">
                              {formatCurrency(reminder.amount)}
                            </p>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                markAsPaidMutation.mutate({
                                  id: reminder.id,
                                  amount: reminder.amount,
                                })
                              }
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Pay Now
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Recurring Templates */}
              {recurringTemplates && recurringTemplates.length > 0 && (
                <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-primary-text mb-4">
                    Recurring Bills
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recurringTemplates.map((template: any) => (
                      <div
                        key={template.id}
                        className="p-4 border border-muted-text/10 rounded-lg bg-hover-bg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-primary-text">{template.title}</h4>
                          <Badge variant="secondary" className="bg-card-bg">
                            <Repeat className="w-3 h-3 mr-1" />
                            {template.recurrence_pattern}
                          </Badge>
                        </div>
                        <p className="text-sm text-secondary-text">
                          {template.description}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-secondary-text">
                            Next:{" "}
                            {new Date(
                              template.next_generation_date
                            ).toLocaleDateString()}
                          </span>
                          <span className="font-semibold text-primary-text">
                            {template.typical_amount ? formatCurrency(template.typical_amount) : "N/A"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Create Reminder Modal */}
        {showCreateModal && (
          <Modal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            title="Create Bill Reminder"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">
                  Title
                </label>
                <Input
                  value={newReminder.title}
                  onChange={(e: any) =>
                    setNewReminder({ ...newReminder, title: e.target.value })
                  }
                  placeholder="e.g., Credit Card Payment"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">
                  Description
                </label>
                <Input
                  value={newReminder.description}
                  onChange={(e: any) =>
                    setNewReminder({
                      ...newReminder,
                      description: e.target.value,
                    })
                  }
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">
                  Amount
                </label>
                <Input
                  type="number"
                  value={newReminder.amount}
                  onChange={(e: any) =>
                    setNewReminder({ ...newReminder, amount: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">
                  Due Date
                </label>
                <Input
                  type="date"
                  value={newReminder.dueDate}
                  onChange={(e: any) =>
                    setNewReminder({ ...newReminder, dueDate: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newReminder.isRecurring}
                  onChange={(e) =>
                    setNewReminder({
                      ...newReminder,
                      isRecurring: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-muted-text/20 bg-input-bg text-primary-green focus:ring-primary-green"
                />
                <label className="text-sm font-medium text-primary-text">
                  Recurring Bill
                </label>
              </div>
              {newReminder.isRecurring && (
                <div>
                  <label className="block text-sm font-medium text-primary-text mb-1">
                    Recurrence
                  </label>
                  <select
                    value={newReminder.recurrencePattern}
                    onChange={(e) =>
                      setNewReminder({
                        ...newReminder,
                        recurrencePattern: e.target.value,
                      })
                    }
                    className="w-full border border-muted-text/20 rounded-lg px-3 py-2 bg-input-bg text-primary-text focus:outline-none focus:ring-2 focus:ring-primary-green"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateReminder}
                  disabled={!newReminder.title || !newReminder.dueDate}
                >
                  Create Reminder
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppLayout>
  );
}
