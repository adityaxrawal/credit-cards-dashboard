"use client";

import { useEffect, useState } from "react";
import { dashboardApi, GoalProgress } from "@/lib/api/dashboard";
import { formatCurrency } from "@/lib/utils";
import { Target, Calendar, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface GoalProgressBarsProps {
  goals?: GoalProgress[];
  loading?: boolean;
  maxDisplay?: number;
}

const goalTypeIcons: Record<string, string> = {
  emergency_fund: "🛡️",
  vacation: "✈️",
  home_purchase: "🏠",
  car: "🚗",
  gadget: "📱",
  wedding: "💒",
  education: "🎓",
  retirement: "🏖️",
  other: "🎯",
};

const goalTypeColors: Record<string, string> = {
  emergency_fund: "#6ECB8E",
  vacation: "#3498DB",
  home_purchase: "#9B59B6",
  car: "#F39C12",
  gadget: "#E74C3C",
  wedding: "#E91E63",
  education: "#00BCD4",
  retirement: "#4CAF50",
  other: "#607D8B",
};

export function GoalProgressBars({ 
  goals: propsGoals, 
  loading: propsLoading,
  maxDisplay = 4 
}: GoalProgressBarsProps) {
  const [goals, setGoals] = useState<GoalProgress[]>(propsGoals || []);
  const [loading, setLoading] = useState(propsLoading ?? !propsGoals);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propsGoals) {
      setGoals(propsGoals);
      setLoading(false);
      return;
    }

    const fetchGoals = async () => {
      try {
        setLoading(true);
        const data = await dashboardApi.getGoalsProgress();
        setGoals(data);
      } catch (err) {
        console.error("Failed to fetch goals progress:", err);
        setError("Failed to load goals");
      } finally {
        setLoading(false);
      }
    };

    fetchGoals();
  }, [propsGoals]);

  if (loading) {
    return (
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-hover-bg rounded w-1/3"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-hover-bg rounded w-2/3"></div>
              <div className="h-3 bg-hover-bg rounded-full w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary-text flex items-center gap-2">
            <Target className="w-5 h-5 text-primary-green" />
            Goals
          </h3>
          <Link href="/goals" className="text-sm text-primary-green hover:underline">
            Create Goal
          </Link>
        </div>
        <div className="text-center py-8 text-muted-text">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No active goals</p>
          <p className="text-sm mt-1">Set savings goals to track your progress</p>
        </div>
      </div>
    );
  }

  const displayGoals = goals.slice(0, maxDisplay);

  return (
    <div className="bg-card-bg rounded-xl p-6 border border-muted-text/10 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary-text flex items-center gap-2">
          <Target className="w-5 h-5 text-primary-green" />
          Goals Progress
        </h3>
        <Link href="/goals" className="text-sm text-primary-green hover:underline">
          View All
        </Link>
      </div>

      <div className="space-y-4">
        {displayGoals.map((goal) => {
          const color = goal.color || goalTypeColors[goal.type] || "#6ECB8E";
          const icon = goalTypeIcons[goal.type] || "🎯";
          const isCompleted = goal.status === "completed";

          return (
            <div key={goal.id} className="group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{icon}</span>
                  <span className="text-sm font-medium text-primary-text">
                    {goal.name}
                  </span>
                  {isCompleted && (
                    <CheckCircle2 className="w-4 h-4 text-primary-green" />
                  )}
                </div>
                <span className="text-sm text-muted-text">
                  {Math.round(goal.progressPercent)}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="relative">
                <div className="h-2 bg-hover-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(100, goal.progressPercent)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>

              {/* Amount Details */}
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-muted-text">
                  {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
                </span>
                {goal.targetDate && !isCompleted && (
                  <span className="flex items-center gap-1 text-muted-text">
                    <Calendar className="w-3 h-3" />
                    {new Date(goal.targetDate).toLocaleDateString('en-IN', { 
                      month: 'short', 
                      year: 'numeric' 
                    })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {goals.length > maxDisplay && (
        <div className="mt-4 pt-4 border-t border-muted-text/10 text-center">
          <Link 
            href="/goals" 
            className="text-sm text-primary-green hover:underline"
          >
            +{goals.length - maxDisplay} more goals
          </Link>
        </div>
      )}
    </div>
  );
}

export default GoalProgressBars;
