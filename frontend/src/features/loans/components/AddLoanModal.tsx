"use client";

import { useState } from "react";
import { X, Home, GraduationCap, Car, CreditCard, ShoppingBag, Calculator } from "lucide-react";
import { loansApi, LoanInput } from "@/features/loans/api";

interface AddLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const loanTypes = [
  { value: "home_loan", label: "Home Loan", icon: Home },
  { value: "education_loan", label: "Education Loan", icon: GraduationCap },
  { value: "personal_loan", label: "Personal Loan", icon: CreditCard },
  { value: "car_loan", label: "Car Loan", icon: Car },
  { value: "bnpl", label: "BNPL", icon: ShoppingBag },
  { value: "credit_card_emi", label: "CC EMI", icon: CreditCard },
];

export function AddLoanModal({ isOpen, onClose, onSuccess }: AddLoanModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculatedEmi, setCalculatedEmi] = useState<number | null>(null);
  const [formData, setFormData] = useState<LoanInput>({
    loanName: "",
    loanType: "personal_loan",
    principalAmount: 0,
    interestRate: 10,
    startDate: new Date().toISOString().split("T")[0],
  });

  // EMI Calculator
  const calculateEmi = () => {
    if (formData.principalAmount && formData.interestRate && formData.tenureMonths) {
      const monthlyRate = formData.interestRate / 100 / 12;
      const n = formData.tenureMonths;
      const emi = formData.principalAmount * monthlyRate * Math.pow(1 + monthlyRate, n) / 
                  (Math.pow(1 + monthlyRate, n) - 1);
      setCalculatedEmi(Math.round(emi * 100) / 100);
      setFormData({ ...formData, emiAmount: Math.round(emi * 100) / 100 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.loanName.trim()) {
      setError("Loan name is required");
      return;
    }
    if (formData.principalAmount <= 0) {
      setError("Principal amount must be greater than 0");
      return;
    }

    try {
      setLoading(true);
      await loansApi.create(formData);
      onSuccess();
      onClose();
      setFormData({
        loanName: "",
        loanType: "personal_loan",
        principalAmount: 0,
        interestRate: 10,
        startDate: new Date().toISOString().split("T")[0],
      });
      setCalculatedEmi(null);
    } catch (err: unknown) {
      console.error("Failed to create loan:", err);
      setError("Failed to create loan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card-bg rounded-xl border border-muted-text/10 w-full max-w-lg mx-4 my-8 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-muted-text/10 bg-card-bg">
          <h2 className="text-lg font-semibold text-primary-text">Add Loan</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-text hover:text-primary-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          {/* Loan Type */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-2">
              Loan Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {loanTypes.map((type) => {
                const IconComponent = type.icon;
                const isSelected = formData.loanType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, loanType: type.value })}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-primary-green bg-primary-green/10 text-primary-green"
                        : "border-muted-text/10 text-muted-text hover:border-muted-text/30"
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                    <span className="text-xs">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loan Name */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">
              Loan Name *
            </label>
            <input
              type="text"
              value={formData.loanName}
              onChange={(e) => setFormData({ ...formData, loanName: e.target.value })}
              placeholder="e.g., Home Loan - HDFC"
              className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
            />
          </div>

          {/* Lender Name */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">
              Lender / Bank
            </label>
            <input
              type="text"
              value={formData.lenderName || ""}
              onChange={(e) => setFormData({ ...formData, lenderName: e.target.value })}
              placeholder="e.g., HDFC Bank"
              className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
            />
          </div>

          {/* Principal Amount */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">
              Principal Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text">₹</span>
              <input
                type="number"
                value={formData.principalAmount || ""}
                onChange={(e) => setFormData({ ...formData, principalAmount: parseFloat(e.target.value) || 0 })}
                placeholder="1000000"
                className="w-full pl-7 pr-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
              />
            </div>
          </div>

          {/* Interest Rate & Tenure */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-text mb-1">
                Interest Rate (% p.a.)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.interestRate || ""}
                onChange={(e) => setFormData({ ...formData, interestRate: parseFloat(e.target.value) || 0 })}
                placeholder="10.5"
                className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-text mb-1">
                Tenure (months)
              </label>
              <input
                type="number"
                value={formData.tenureMonths || ""}
                onChange={(e) => setFormData({ ...formData, tenureMonths: parseInt(e.target.value) || undefined })}
                placeholder="240"
                className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
              />
            </div>
          </div>

          {/* EMI Calculator */}
          <div className="p-3 bg-hover-bg rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-text">Calculate EMI</span>
              <button
                type="button"
                onClick={calculateEmi}
                className="flex items-center gap-1 px-3 py-1 bg-primary-green/10 text-primary-green text-sm rounded-lg hover:bg-primary-green/20 transition-colors"
              >
                <Calculator className="w-4 h-4" />
                Calculate
              </button>
            </div>
            {calculatedEmi && (
              <div className="mt-2 text-center">
                <span className="text-sm text-muted-text">Monthly EMI: </span>
                <span className="text-lg font-bold text-primary-green">₹{calculatedEmi.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* EMI Amount (manual) */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">
              EMI Amount (or enter manually)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text">₹</span>
              <input
                type="number"
                value={formData.emiAmount || ""}
                onChange={(e) => setFormData({ ...formData, emiAmount: parseFloat(e.target.value) || undefined })}
                placeholder="25000"
                className="w-full pl-7 pr-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
              />
            </div>
          </div>

          {/* EMI Day & Start Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-text mb-1">
                EMI Day of Month
              </label>
              <input
                type="number"
                min="1"
                max="28"
                value={formData.emiDayOfMonth || ""}
                onChange={(e) => setFormData({ ...formData, emiDayOfMonth: parseInt(e.target.value) || undefined })}
                placeholder="5"
                className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-text mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text focus:outline-none focus:border-primary-green"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-hover-bg text-primary-text rounded-lg hover:bg-muted-text/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 bg-primary-green text-white rounded-lg hover:bg-primary-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Add Loan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddLoanModal;
