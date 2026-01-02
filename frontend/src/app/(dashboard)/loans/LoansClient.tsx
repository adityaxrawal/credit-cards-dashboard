"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/shared/components/layout";
import { loansApi, Loan, LoansSummary } from "@/features/loans/api";
import { formatCurrency } from "@/shared/utils";
import {
  Plus,
  Home,
  GraduationCap,
  Car,
  CreditCard,
  ShoppingBag,
  MoreVertical,
  Calendar,
  TrendingDown,
  Clock,
} from "lucide-react";
import { AddLoanModal } from "@/features/loans/components/AddLoanModal";

const loanTypeConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  home_loan: { label: "Home Loan", icon: Home, color: "text-accent-blue" },
  education_loan: { label: "Education Loan", icon: GraduationCap, color: "text-accent-purple" },
  personal_loan: { label: "Personal Loan", icon: CreditCard, color: "text-accent-orange" },
  car_loan: { label: "Car Loan", icon: Car, color: "text-primary-green" },
  bnpl: { label: "Buy Now Pay Later", icon: ShoppingBag, color: "text-error" },
  credit_card_emi: { label: "Credit Card EMI", icon: CreditCard, color: "text-warning" },
  other: { label: "Other Loan", icon: CreditCard, color: "text-muted-text" },
};

export default function LoansClient() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<LoansSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("active");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [loansData, summaryData] = await Promise.all([
        loansApi.getAll({ status: filter === "all" ? undefined : filter }),
        loansApi.getSummary(),
      ]);
      setLoans(Array.isArray(loansData) ? loansData : []);
      setSummary(summaryData);
    } catch (error) {
      console.error("Failed to load loans:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  if (loading) {
    return (
      <AppLayout title="Loans" showRightSidebar={false}>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Loans & EMIs" showRightSidebar={false}>
      <div className="space-y-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card-bg rounded-xl p-4 border border-muted-text/10">
              <p className="text-sm text-muted-text mb-1">Total Outstanding</p>
              <p className="text-2xl font-bold text-error">
                {formatCurrency(summary.totalOutstanding)}
              </p>
            </div>
            <div className="bg-card-bg rounded-xl p-4 border border-muted-text/10">
              <p className="text-sm text-muted-text mb-1">Monthly EMI</p>
              <p className="text-2xl font-bold text-accent-orange">
                {formatCurrency(summary.totalMonthlyEmi)}
              </p>
            </div>
            <div className="bg-card-bg rounded-xl p-4 border border-muted-text/10">
              <p className="text-sm text-muted-text mb-1">Active Loans</p>
              <p className="text-2xl font-bold text-primary-text">
                {summary.activeLoans}
              </p>
            </div>
            <div className="bg-card-bg rounded-xl p-4 border border-muted-text/10">
              <p className="text-sm text-muted-text mb-1">Total Loans</p>
              <p className="text-2xl font-bold text-primary-text">
                {summary.totalLoans}
              </p>
            </div>
          </div>
        )}

        {/* Upcoming EMIs */}
        {summary?.upcomingEmis && summary.upcomingEmis.length > 0 && (
          <div className="bg-card-bg rounded-xl p-5 border border-muted-text/10">
            <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent-orange" />
              Upcoming EMIs
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {summary.upcomingEmis.map((emi) => (
                <div key={emi.loanId} className="flex-shrink-0 bg-hover-bg rounded-lg p-3 min-w-[180px]">
                  <p className="text-sm font-medium text-primary-text truncate">{emi.loanName}</p>
                  <p className="text-lg font-bold text-accent-orange mt-1">{formatCurrency(emi.emiAmount)}</p>
                  <p className="text-xs text-muted-text mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(emi.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Header with Add Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-card-bg border border-muted-text/10 rounded-lg px-3 py-2 text-sm text-primary-text"
            >
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="all">All Loans</option>
            </select>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary-green text-white px-4 py-2 rounded-lg hover:bg-primary-green/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Loan
          </button>
        </div>

        {/* Loans List */}
        <div className="space-y-4">
          {Array.isArray(loans) && loans.map((loan) => {
            const config = loanTypeConfig[loan.loanType] || loanTypeConfig.other;
            const IconComponent = config.icon;
            const progressPercent = loan.principalAmount > 0 
              ? ((loan.principalAmount - loan.currentOutstanding) / loan.principalAmount) * 100 
              : 0;

            return (
              <div
                key={loan.id}
                className="bg-card-bg rounded-xl p-5 border border-muted-text/10 hover:border-primary-green/30 transition-colors cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${config.color.replace('text-', 'bg-')}/10`}>
                    <IconComponent className={`w-6 h-6 ${config.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-primary-text">{loan.loanName}</h3>
                        <p className="text-sm text-muted-text">{config.label} • {loan.lenderName || 'Unknown Lender'}</p>
                      </div>
                      <button className="p-1 text-muted-text hover:text-primary-text opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-text">Outstanding</p>
                        <p className="text-lg font-bold text-primary-text">{formatCurrency(loan.currentOutstanding)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-text">EMI Amount</p>
                        <p className="text-lg font-semibold text-accent-orange">{formatCurrency(loan.emiAmount || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-text">Interest Rate</p>
                        <p className="text-lg font-semibold text-primary-text">{loan.interestRate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-text">Remaining EMIs</p>
                        <p className="text-lg font-semibold text-primary-text">{loan.remainingEmis || '-'}</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-text mb-1">
                        <span>Repayment Progress</span>
                        <span>{Math.round(progressPercent)}%</span>
                      </div>
                      <div className="h-2 bg-hover-bg rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-green rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-text mt-1">
                        <span>Paid: {formatCurrency(loan.totalPrincipalPaid)}</span>
                        <span>of {formatCurrency(loan.principalAmount)}</span>
                      </div>
                    </div>

                    {loan.nextEmiDate && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-muted-text">
                        <Calendar className="w-4 h-4" />
                        Next EMI: {new Date(loan.nextEmiDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {loans.length === 0 && (
          <div className="text-center py-12 text-muted-text">
            <TrendingDown className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No {filter === 'all' ? '' : filter} loans found</p>
            <p className="text-sm mt-1">Add a loan to track your EMIs and repayments</p>
          </div>
        )}
      </div>

      {/* Add Loan Modal */}
      <AddLoanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
      />
    </AppLayout>
  );
}
