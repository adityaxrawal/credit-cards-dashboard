"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { goalsApi, Goal, GoalsSummary } from "@/lib/api/goals";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  Target,
  Shield,
  Plane,
  Home,
  Car,
  Smartphone,
  Heart,
  GraduationCap,
  Palmtree,
  MoreVertical,
  Calendar,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { AddGoalModal } from "@/components/features/goals/AddGoalModal";

const goalTypeConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  emergency_fund: { label: "Emergency Fund", icon: Shield, color: "#6ECB8E" },
  vacation: { label: "Vacation", icon: Plane, color: "#3498DB" },
  home_purchase: { label: "Home Purchase", icon: Home, color: "#9B59B6" },
  car: { label: "Car", icon: Car, color: "#F39C12" },
  gadget: { label: "Gadget", icon: Smartphone, color: "#E74C3C" },
  wedding: { label: "Wedding", icon: Heart, color: "#E91E63" },
  education: { label: "Education", icon: GraduationCap, color: "#00BCD4" },
  retirement: { label: "Retirement", icon: Palmtree, color: "#4CAF50" },
  other: { label: "Other", icon: Target, color: "#607D8B" },
};

export default function GoalsClient() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<GoalsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("active");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [goalsData, summaryData] = await Promise.all([
        goalsApi.getAll({ status: filter === "all" ? undefined : filter }),
        goalsApi.getSummary(),
      ]);
      setGoals(Array.isArray(goalsData) ? goalsData : []);
      setSummary(summaryData);
    } catch (error) {
      console.error("Failed to load goals:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  if (loading) {
    return (
      <AppLayout title="Goals" showRightSidebar={false}>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-green"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Savings Goals" showRightSidebar={false}>
      <div className="space-y-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card-bg rounded-xl p-4 border border-muted-text/10">
              <p className="text-sm text-muted-text mb-1">Total Saved</p>
              <p className="text-2xl font-bold text-primary-green">
                {formatCurrency(summary.totalCurrentAmount)}
              </p>
            </div>
            <div className="bg-card-bg rounded-xl p-4 border border-muted-text/10">
              <p className="text-sm text-muted-text mb-1">Target</p>
              <p className="text-2xl font-bold text-primary-text">
                {formatCurrency(summary.totalTargetAmount)}
              </p>
            </div>
            <div className="bg-card-bg rounded-xl p-4 border border-muted-text/10">
              <p className="text-sm text-muted-text mb-1">Overall Progress</p>
              <p className="text-2xl font-bold text-accent-blue">
                {summary.overallProgress}%
              </p>
            </div>
            <div className="bg-card-bg rounded-xl p-4 border border-muted-text/10">
              <p className="text-sm text-muted-text mb-1">Active Goals</p>
              <p className="text-2xl font-bold text-primary-text">
                {summary.activeGoals}
              </p>
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
              <option value="completed">Completed</option>
              <option value="all">All Goals</option>
            </select>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary-green text-white px-4 py-2 rounded-lg hover:bg-primary-green/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Goal
          </button>
        </div>

        {/* Goals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.isArray(goals) && goals.map((goal) => {
            const config = goalTypeConfig[goal.goalType] || goalTypeConfig.other;
            const IconComponent = config.icon;
            const color = goal.color || config.color;
            const isCompleted = goal.status === "completed";
            const amountRemaining = goal.targetAmount - goal.currentAmount;

            return (
              <div
                key={goal.id}
                className={`bg-card-bg rounded-xl p-5 border border-muted-text/10 hover:border-primary-green/30 transition-all cursor-pointer group ${
                  isCompleted ? 'ring-2 ring-primary-green/30' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <span style={{ color }}>
                        <IconComponent className="w-5 h-5" />
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-primary-text">{goal.goalName}</h3>
                        {isCompleted && (
                          <CheckCircle2 className="w-4 h-4 text-primary-green" />
                        )}
                      </div>
                      <p className="text-xs text-muted-text">{config.label}</p>
                    </div>
                  </div>
                  <button className="p-1 text-muted-text hover:text-primary-text opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                {/* Progress Circle / Bar */}
                <div className="flex items-center gap-4 mb-4">
                  {/* Circular Progress */}
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-hover-bg"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke={color}
                        strokeWidth="4"
                        strokeDasharray={`${goal.progressPercent * 1.76} 176`}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary-text">
                        {Math.round(goal.progressPercent)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <p className="text-lg font-bold text-primary-text">
                      {formatCurrency(goal.currentAmount)}
                    </p>
                    <p className="text-sm text-muted-text">
                      of {formatCurrency(goal.targetAmount)}
                    </p>
                    {!isCompleted && amountRemaining > 0 && (
                      <p className="text-xs text-muted-text mt-1">
                        {formatCurrency(amountRemaining)} to go
                      </p>
                    )}
                  </div>
                </div>

                {/* Target Date & Contribution */}
                <div className="space-y-2 text-sm">
                  {goal.targetDate && (
                    <div className="flex items-center justify-between text-muted-text">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Target
                      </span>
                      <span>
                        {new Date(goal.targetDate).toLocaleDateString('en-IN', {
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  )}
                  {goal.contributionAmount && goal.contributionFrequency && (
                    <div className="flex items-center justify-between text-muted-text">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Contribution
                      </span>
                      <span>
                        {formatCurrency(goal.contributionAmount)}/{goal.contributionFrequency.toLowerCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick Add Button */}
                {!isCompleted && (
                  <button
                    className="mt-4 w-full py-2 bg-hover-bg hover:bg-primary-green/10 text-primary-text text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Contribution
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {goals.length === 0 && (
          <div className="text-center py-12 text-muted-text">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No {filter === 'all' ? '' : filter} goals found</p>
            <p className="text-sm mt-1">Create a goal to start tracking your savings</p>
          </div>
        )}
      </div>

      {/* Add Goal Modal */}
      <AddGoalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
      />
    </AppLayout>
  );
}
