"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Plus,
  Check,
  AlertCircle,
  DollarSign,
  CreditCard,
  Clock,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button, Modal, Input, Badge } from "@/components/ui";
import { formatCurrency, cn, formatDate } from "@/lib/utils";
import { billsApi, type Bill, type BillFormData } from "@/lib/api/bills";
import { cardApi } from "@/lib/api/cards";
import { useToast } from "@/components/ui/feedback/Toast";

export default function BillsPage() {
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [viewMode, setViewMode] = useState<"upcoming" | "all">("upcoming");

  // Fetch bills
  const { data: allBills, isLoading } = useQuery({
    queryKey: ["bills", viewMode],
    queryFn: () =>
      viewMode === "upcoming" ? billsApi.getUpcoming() : billsApi.getAll(),
  });

  // Fetch cards for bill creation
  const { data: cards = [] } = useQuery({
    queryKey: ["cards"],
    queryFn: () => cardApi.getCards(),
  });

  // Update bill mutation (mark as paid)
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      billsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      success("Bill updated successfully");
      setSelectedBill(null);
    },
    onError: (error: any) => {
      errorToast(error.message || "Failed to update bill");
    },
  });

  const markAsPaid = (bill: Bill) => {
    updateMutation.mutate({
      id: bill.id,
      data: {
        paymentStatus: "paid",
        paymentDate: new Date().toISOString(),
        paymentAmount: bill.bill_amount,
      },
    });
  };

  const getStatusVariant = (
    status: string
  ): "success" | "warning" | "error" | "info" | "default" => {
    switch (status) {
      case "paid":
        return "success";
      case "pending":
        return "warning";
      case "overdue":
        return "error";
      case "partial":
        return "info";
      default:
        return "default";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <Check className="w-4 h-4" />;
      case "overdue":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // Group bills by status
  const upcomingBills =
    allBills?.filter(
      (b) => b.payment_status === "pending" || b.payment_status === "partial"
    ) || [];
  const overdueBills =
    allBills?.filter((b) => b.payment_status === "overdue") || [];
  const paidBills = allBills?.filter((b) => b.payment_status === "paid") || [];

  if (isLoading) {
    return (
      <AppLayout title="Bills" showRightSidebar={false}>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading bills...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Bills" showRightSidebar={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-secondary-text">
            Track and manage your credit card bills
          </p>
          <div className="flex items-center space-x-3">
            <Button variant="secondary" onClick={() => setViewMode(viewMode === "upcoming" ? "all" : "upcoming")}>
              <Calendar className="w-4 h-4 mr-2" />
              {viewMode === "upcoming" ? "View All" : "View Upcoming"}
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-text">Upcoming Bills</p>
                <p className="text-2xl font-bold text-warning mt-1">
                  {upcomingBills.length}
                </p>
                <p className="text-sm text-secondary-text mt-1">
                  {formatCurrency(
                    upcomingBills.reduce((sum, b) => sum + b.bill_amount, 0)
                  )}
                </p>
              </div>
              <div className="p-3 bg-warning/10 rounded-lg">
                <Clock className="w-6 h-6 text-warning" />
              </div>
            </div>
          </div>

          <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-text">Overdue Bills</p>
                <p className="text-2xl font-bold text-error mt-1">
                  {overdueBills.length}
                </p>
                <p className="text-sm text-secondary-text mt-1">
                  {formatCurrency(
                    overdueBills.reduce((sum, b) => sum + b.bill_amount, 0)
                  )}
                </p>
              </div>
              <div className="p-3 bg-error/10 rounded-lg">
                <AlertCircle className="w-6 h-6 text-error" />
              </div>
            </div>
          </div>

          <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-text">Paid This Month</p>
                <p className="text-2xl font-bold text-success mt-1">
                  {paidBills.length}
                </p>
                <p className="text-sm text-secondary-text mt-1">
                  {formatCurrency(
                    paidBills.reduce((sum, b) => sum + (b.payment_amount || 0), 0)
                  )}
                </p>
              </div>
              <div className="p-3 bg-success/10 rounded-lg">
                <Check className="w-6 h-6 text-success" />
              </div>
            </div>
          </div>
        </div>

        {/* Overdue Bills */}
        {overdueBills.length > 0 && (
          <div className="bg-error/5 border border-error/20 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-error mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              Overdue Bills
            </h3>
            <div className="space-y-3">
              {overdueBills.map((bill) => (
                <BillCard key={bill.id} bill={bill} onMarkAsPaid={markAsPaid} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Bills */}
        <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-primary-text mb-4">
            {viewMode === "upcoming" ? "Upcoming Bills" : "All Bills"}
          </h3>
          <div className="space-y-3">
            {viewMode === "upcoming" && upcomingBills.length === 0 && (
              <p className="text-center text-secondary-text py-8">
                No upcoming bills
              </p>
            )}
            {viewMode === "upcoming"
              ? upcomingBills.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onMarkAsPaid={markAsPaid}
                  />
                ))
              : allBills?.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onMarkAsPaid={markAsPaid}
                  />
                ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

interface BillCardProps {
  bill: Bill;
  onMarkAsPaid: (bill: Bill) => void;
}

function BillCard({ bill, onMarkAsPaid }: BillCardProps) {
  const isOverdue = bill.payment_status === "overdue";
  const isPaid = bill.payment_status === "paid";

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-lg hover:shadow-sm transition-shadow",
        isOverdue
          ? "bg-error/5 border border-error/20"
          : "bg-hover-bg border border-muted-text/10"
      )}
    >
      <div className="flex-1">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-card-bg rounded-lg">
            <CreditCard className="w-4 h-4 text-primary-green" />
          </div>
          <div>
            <h4 className="font-semibold text-primary-text">{bill.card_name}</h4>
            <p className="text-sm text-secondary-text">{bill.bank_name}</p>
          </div>
          <Badge
            label={bill.payment_status.toUpperCase()}
            variant={getStatusVariant(bill.payment_status)}
            size="sm"
          />
        </div>
        <div className="flex items-center space-x-4 text-sm text-secondary-text ml-10">
          <span className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            Bill: {formatDate(bill.bill_date, "short")}
          </span>
          <span className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            Due: {formatDate(bill.due_date, "short")}
          </span>
          <span className="text-xs bg-card-bg px-2 py-1 rounded border border-muted-text/10">
            {bill.bill_month}/{bill.bill_year}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end space-y-2 ml-4">
        <p className={cn("text-xl font-bold", isOverdue ? "text-error" : "text-primary-text")}>
          {formatCurrency(bill.bill_amount)}
        </p>
        {!isPaid && (
          <Button size="sm" onClick={() => onMarkAsPaid(bill)}>
            <Check className="w-4 h-4 mr-1" />
            Mark Paid
          </Button>
        )}
        {isPaid && bill.payment_date && (
          <p className="text-xs text-success">
            Paid: {formatDate(bill.payment_date, "short")}
          </p>
        )}
      </div>
    </div>
  );
}

function getStatusVariant(
  status: string
): "success" | "warning" | "error" | "info" | "default" {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
      return "warning";
    case "overdue":
      return "error";
    case "partial":
      return "info";
    default:
      return "default";
  }
}
