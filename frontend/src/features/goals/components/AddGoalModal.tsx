"use client";

import { useState } from "react";
import { X, Shield, Plane, Home, Car, Smartphone, Heart, GraduationCap, Palmtree, Target, Calendar } from "lucide-react";
import { goalsApi, GoalInput } from "@/features/goals/api";

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const goalTypes = [
  { value: "emergency_fund", label: "Emergency", icon: Shield, color: "#6ECB8E" },
  { value: "vacation", label: "Vacation", icon: Plane, color: "#3498DB" },
  { value: "home_purchase", label: "Home", icon: Home, color: "#9B59B6" },
  { value: "car", label: "Car", icon: Car, color: "#F39C12" },
  { value: "gadget", label: "Gadget", icon: Smartphone, color: "#E74C3C" },
  { value: "wedding", label: "Wedding", icon: Heart, color: "#E91E63" },
  { value: "education", label: "Education", icon: GraduationCap, color: "#00BCD4" },
  { value: "retirement", label: "Retirement", icon: Palmtree, color: "#4CAF50" },
  { value: "other", label: "Other", icon: Target, color: "#607D8B" },
];

const contributionFrequencies = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

export function AddGoalModal({ isOpen, onClose, onSuccess }: AddGoalModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<GoalInput>({
    goalName: "",
    goalType: "emergency_fund",
    targetAmount: 0,
  });

  const selectedType = goalTypes.find(t => t.value === formData.goalType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.goalName.trim()) {
      setError("Goal name is required");
      return;
    }
    if (formData.targetAmount <= 0) {
      setError("Target amount must be greater than 0");
      return;
    }

    try {
      setLoading(true);
      // Add color from selected type
      const goalData = {
        ...formData,
        color: selectedType?.color,
      };
      await goalsApi.create(goalData);
      onSuccess();
      onClose();
      setFormData({
        goalName: "",
        goalType: "emergency_fund",
        targetAmount: 0,
      });
    } catch (err: unknown) {
      console.error("Failed to create goal:", err);
      setError("Failed to create goal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate suggested monthly contribution
  const suggestedMonthly = () => {
    if (formData.targetAmount && formData.targetDate) {
      const months = Math.max(1, Math.ceil(
        (new Date(formData.targetDate).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000)
      ));
      return Math.ceil((formData.targetAmount - (formData.currentAmount || 0)) / months);
    }
    return null;
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
          <h2 className="text-lg font-semibold text-primary-text">Create Goal</h2>
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

          {/* Goal Type */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-2">
              Goal Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {goalTypes.map((type) => {
                const IconComponent = type.icon;
                const isSelected = formData.goalType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, goalType: type.value })}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-primary-green bg-primary-green/10"
                        : "border-muted-text/10 hover:border-muted-text/30"
                    }`}
                    style={isSelected ? { borderColor: type.color, backgroundColor: `${type.color}15` } : {}}
                  >
                    <IconComponent className="w-5 h-5" style={{ color: type.color }} />
                    <span className="text-xs text-primary-text">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Goal Name */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">
              Goal Name *
            </label>
            <input
              type="text"
              value={formData.goalName}
              onChange={(e) => setFormData({ ...formData, goalName: e.target.value })}
              placeholder="e.g., Emergency Fund - 6 months expenses"
              className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">
              Description
            </label>
            <textarea
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional notes about this goal..."
              rows={2}
              className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green resize-none"
            />
          </div>

          {/* Target Amount */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">
              Target Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text">₹</span>
              <input
                type="number"
                value={formData.targetAmount || ""}
                onChange={(e) => setFormData({ ...formData, targetAmount: parseFloat(e.target.value) || 0 })}
                placeholder="500000"
                className="w-full pl-7 pr-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
              />
            </div>
          </div>

          {/* Current Amount */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">
              Current Savings (if any)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text">₹</span>
              <input
                type="number"
                value={formData.currentAmount || ""}
                onChange={(e) => setFormData({ ...formData, currentAmount: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full pl-7 pr-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
              />
            </div>
          </div>

          {/* Target Date */}
          <div>
            <label className="block text-sm font-medium text-primary-text mb-1">
              Target Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text" />
              <input
                type="date"
                value={formData.targetDate || ""}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                className="w-full pl-10 pr-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text focus:outline-none focus:border-primary-green"
              />
            </div>
          </div>

          {/* Suggested Contribution */}
          {suggestedMonthly() && (
            <div className="p-3 bg-primary-green/10 border border-primary-green/20 rounded-lg">
              <p className="text-sm text-muted-text">
                To reach your goal by the target date, save approximately:
              </p>
              <p className="text-lg font-bold text-primary-green">
                ₹{suggestedMonthly()?.toLocaleString()} / month
              </p>
            </div>
          )}

          {/* Contribution Plan */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-text mb-1">
                Contribution Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text">₹</span>
                <input
                  type="number"
                  value={formData.contributionAmount || ""}
                  onChange={(e) => setFormData({ ...formData, contributionAmount: parseFloat(e.target.value) || undefined })}
                  placeholder="10000"
                  className="w-full pl-7 pr-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text placeholder:text-muted-text focus:outline-none focus:border-primary-green"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-text mb-1">
                Frequency
              </label>
              <select
                value={formData.contributionFrequency || ""}
                onChange={(e) => setFormData({ ...formData, contributionFrequency: e.target.value })}
                className="w-full px-3 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text focus:outline-none focus:border-primary-green"
              >
                <option value="">Select...</option>
                {contributionFrequencies.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
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
              {loading ? "Creating..." : "Create Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddGoalModal;
