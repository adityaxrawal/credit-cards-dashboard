"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  TrendingDown,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button, Badge } from "@/components/ui";
import {  formatCurrency, cn, formatDate } from "@/lib/utils";
import { statementsApi, type StatementSummary } from "@/lib/api/statements";
import { cardApi } from "@/lib/api/cards";
import { useRouter } from "next/navigation";

export default function StatementsPage() {
  const router = useRouter();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedCard, setSelectedCard] = useState<string>("");

  // Fetch all statements
  const { data: statements = [], isLoading } = useQuery({
    queryKey: ["statements"],
    queryFn: () => statementsApi.getAll(),
  });

  // Fetch cards for filter
  const { data: cards = [] } = useQuery({
    queryKey: ["cards"],
    queryFn: () => cardApi.getCards(),
  });

  // Filter statements
  const filteredStatements = statements.filter((stmt) => {
    if (selectedCard && stmt.card_id !== selectedCard) return false;
    return true;
  });

  // Group by month/year
  const statementsByPeriod = filteredStatements.reduce((acc, stmt) => {
    const key = `${stmt.bill_year}-${stmt.bill_month.toString().padStart(2,"0")}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(stmt);
    return acc;
  }, {} as Record<string, StatementSummary[]>);

  const periods = Object.keys(statementsByPeriod).sort().reverse();

  const navigateMonth = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  const viewStatementDetails = (stmt: StatementSummary) => {
    // Navigate to detailed statement view (could be a new page or modal)
    router.push(`/statements/${stmt.card_id}/${stmt.bill_month}/${stmt.bill_year}`);
  };

  if (isLoading) {
    return (
      <AppLayout title="Statements" showRightSidebar={false}>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading statements...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Statements" showRightSidebar={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-secondary-text">
            View monthly billing statements and transaction summaries
          </p>
          <div className="flex items-center space-x-3">
            <select
              value={selectedCard}
              onChange={(e) => setSelectedCard(e.target.value)}
              className="px-4 py-2 border border-muted-text/20 rounded-lg bg-card-bg text-primary-text"
            >
              <option value="">All Cards</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.card_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Month selector */}
        <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth("prev")}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-xl font-semibold text-primary-text">
              {new Date(selectedYear, selectedMonth - 1).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateMonth("next")}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Statements List */}
        {periods.length === 0 ? (
          <div className="text-center py-12 bg-card-bg rounded-xl border border-muted-text/10">
            <FileText className="w-12 h-12 text-secondary-text mx-auto mb-4" />
            <p className="text-secondary-text">No statements available</p>
          </div>
        ) : (
          periods.map((period) => {
            const [year, month] = period.split("-");
            const periodStatements = statementsByPeriod[period];
            const totalDebits = periodStatements.reduce((sum, s) => sum + s.total_debits, 0);
            const totalCredits = periodStatements.reduce((sum, s) => sum + s.total_credits, 0);
            const netAmount = periodStatements.reduce((sum, s) => sum + s.net_amount, 0);

            return (
              <div key={period} className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm overflow-hidden">
                {/* Period Header */}
                <div className="p-6 border-b border-muted-text/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-3 bg-primary-green/10 rounded-lg">
                        <Calendar className="w-5 h-5 text-primary-green" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-primary-text">
                          {new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })}
                        </h3>
                        <p className="text-sm text-secondary-text">
                          {periodStatements.length} card{periodStatements.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-6 text-right">
                      <div>
                        <p className="text-sm text-secondary-text">Spent</p>
                        <p className="text-lg font-semibold text-error">
                          {formatCurrency(totalDebits)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-secondary-text">Credits</p>
                        <p className="text-lg font-semibold text-success">
                          {formatCurrency(totalCredits)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-secondary-text">Net</p>
                        <p className={cn("text-lg font-semibold", netAmount < 0 ? "text-error" : "text-success")}>
                          {formatCurrency(Math.abs(netAmount))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Statements */}
                <div className="divide-y divide-muted-text/10">
                  {periodStatements.map((stmt) => (
                    <div
                      key={`${stmt.card_id}-${stmt.bill_month}-${stmt.bill_year}`}
                      className="p-6 hover:bg-hover-bg transition-colors cursor-pointer"
                      onClick={() => viewStatementDetails(stmt)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="p-2 bg-primary-green/10 rounded-lg">
                              <FileText className="w-4 h-4 text-primary-green" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-primary-text">
                                {stmt.card_name}
                              </h4>
                              <p className="text-sm text-secondary-text">
                                {stmt.bank_name} •••• {stmt.card_number_last4}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6 text-sm text-secondary-text ml-10">
                            <span className="flex items-center">
                              <TrendingDown className="w-4 h-4 mr-1 text-error" />
                              Debits: {formatCurrency(stmt.total_debits)}
                            </span>
                            <span className="flex items-center">
                              <TrendingUp className="w-4 h-4 mr-1 text-success" />
                              Credits: {formatCurrency(stmt.total_credits)}
                            </span>
                            <Badge
                              label={`${stmt.transaction_count} transactions`}
                              variant="default"
                              size="sm"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <p className={cn("text-xl font-bold", stmt.net_amount < 0 ? "text-error" : "text-success")}>
                            {formatCurrency(Math.abs(stmt.net_amount))}
                          </p>
                          <Button size="sm" variant="secondary">
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
