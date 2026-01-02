"use client";

import { useState } from "react";
import { X, Landmark, Wallet, Banknote, CreditCard } from "lucide-react";
import { accountsApi, AccountInput } from "@/features/accounts/api";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const accountTypes = [
  { value: "savings_account", label: "Savings Account", icon: Landmark },
  { value: "current_account", label: "Current Account", icon: Landmark },
  { value: "nre_account", label: "NRE Account", icon: Landmark },
  { value: "nro_account", label: "NRO Account", icon: Landmark },
  { value: "wallet", label: "Digital Wallet", icon: Wallet },
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "prepaid_card", label: "Prepaid Card", icon: CreditCard },
];

export function AddAccountModal({ isOpen, onClose, onSuccess }: AddAccountModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AccountInput>({
    type: "savings_account",
    name: "",
    balance: 0,
    currency: "INR",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Account name is required");
      return;
    }

    try {
      setLoading(true);
      await accountsApi.create(formData);
      onSuccess();
      onClose();
      setFormData({ type: "savings_account", name: "", balance: 0, currency: "INR" });
    } catch (err: unknown) {
      console.error("Failed to create account:", err);
      setError("Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card-bg rounded-xl border border-muted-text/10 w-full max-w-md mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-muted-text/10">
          <h2 className="text-lg font-semibold text-primary-text">Add Account</h2>
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

          {/* Account Type */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-2">
              Account Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {accountTypes.map((type) => {
                const IconComponent = type.icon;
                const isSelected = formData.type === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.value })}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-primary-green bg-primary-green/10 text-primary-green"
                        : "border-muted-text/10 text-muted-text hover:border-muted-text/30"
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span className="text-sm">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Name */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">
              Account Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., HDFC Savings"
              className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
            />
          </div>

          {/* Bank/Provider Name */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">
              Bank / Provider
            </label>
            <input
              type="text"
              value={formData.providerName || ""}
              onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
              placeholder="e.g., HDFC Bank, PayTM, PhonePe"
              className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
            />
          </div>

          {/* Last 4 digits */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">
              Account Number (Last 4 digits)
            </label>
            <input
              type="text"
              value={formData.last4 || ""}
              onChange={(e) => setFormData({ ...formData, last4: e.target.value.slice(0, 4) })}
              placeholder="1234"
              maxLength={4}
              className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
            />
          </div>

          {/* Current Balance */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">
              Current Balance
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text">₹</span>
              <input
                type="number"
                value={formData.balance || ""}
                onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
              />
            </div>
          </div>

          {/* Interest Rate (for savings accounts) */}
          {["savings_account", "nre_account", "nro_account"].includes(formData.type) && (
            <div>
              <label className="block text-sm font-medium text-primary-text mb-1">
                Interest Rate (% per annum)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.interestRate || ""}
                onChange={(e) => setFormData({ ...formData, interestRate: parseFloat(e.target.value) || undefined })}
                placeholder="4.0"
                className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
              />
            </div>
          )}

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
              {loading ? "Creating..." : "Add Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddAccountModal;
