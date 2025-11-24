"use client";

import React, { useState, useEffect } from "react";
import {
  Trophy,
  Star,
  TrendingUp,
  Target,
  Award,
  Zap,
  Gift,
  Crown,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { RedemptionModal } from "@/components/rewards/RedemptionModal";
import { formatCurrency, cn } from "@/lib/utils";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  earned_at?: string;
  progress?: number;
  target?: number;
  reward_points?: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
}

interface RewardsSummary {
  totalPoints: number;
  level: number;
  nextLevelPoints: number;
  earnedRewards: {
    cashback: number;
    points: number;
    miles: number;
  };
  achievements: Achievement[];
  recentActivity: {
    type: string;
    points: number;
    description: string;
    timestamp: string;
  }[];
}

export default function RewardsDashboard() {
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ data: RewardsSummary }>("/api/rewards/summary");
      // Handle both wrapped and unwrapped responses if necessary, but assuming apiClient returns data directly from response.data
      // Wait, apiClient.get returns response.data directly in my implementation?
      // Let's check apiClient implementation again. It returns response.data.
      // So if the API returns { success: true, data: ... }, then data is { success: true, data: ... }
      // Actually, apiClient.get<T> returns Promise<ApiResponse<T>> which is { success: boolean, data?: T, ... }
      // So data.data is the actual payload.
      // But in the previous code it was `setRewards(data.data as any)`.
      // I'll stick to `data.data`.
      setRewards(data.data as any);
    } catch (error) {
      console.error("Error fetching rewards:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = (option: string, points: number) => {
    // Implement redemption logic here
    console.log(`Redeeming ${points} points for ${option}`);
    // Optimistically update UI
    if (rewards) {
      setRewards({
        ...rewards,
        totalPoints: rewards.totalPoints - points,
      });
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "bronze":
        return "from-orange-400 to-orange-600";
      case "silver":
        return "from-gray-300 to-gray-500";
      case "gold":
        return "from-yellow-400 to-yellow-600";
      case "platinum":
        return "from-purple-400 to-purple-600";
      default:
        return "from-gray-400 to-gray-600";
    }
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, React.ComponentType<{ className?: string }>> = {
      trophy: Trophy,
      star: Star,
      target: Target,
      award: Award,
      zap: Zap,
      gift: Gift,
      crown: Crown,
      trending: TrendingUp,
    };
    return icons[iconName] || Award;
  };

  const filteredAchievements =
    selectedCategory === "all"
      ? rewards?.achievements || []
      : rewards?.achievements.filter((a) => a.category === selectedCategory) ||
        [];

  if (loading) {
    return (
      <AppLayout title="Rewards" showRightSidebar={false}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-green"></div>
        </div>
      </AppLayout>
    );
  }

  if (!rewards) {
    return (
      <AppLayout title="Rewards" showRightSidebar={false}>
        <div className="text-center py-12 bg-card-bg rounded-xl border border-muted-text/10">
          <Trophy className="w-12 h-12 text-secondary-text mx-auto mb-4" />
          <p className="text-secondary-text">No rewards data available</p>
        </div>
      </AppLayout>
    );
  }

  const levelProgress = (rewards.totalPoints / rewards.nextLevelPoints) * 100;

  return (
    <AppLayout title="Rewards & Achievements" showRightSidebar={false}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-secondary-text">
              Track your financial milestones and earn rewards
            </p>
          </div>
          <Button onClick={() => setShowRedeemModal(true)}>
            <Gift className="w-4 h-4 mr-2" />
            Redeem Points
          </Button>
        </div>

        {/* Level Progress Card */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Crown className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm opacity-90 font-medium">Current Level</p>
                <p className="text-4xl font-bold mt-1">Level {rewards.level}</p>
              </div>
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-full">
                <Crown className="w-8 h-8" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>Progress to Level {rewards.level + 1}</span>
                <span>
                  {rewards.totalPoints.toLocaleString()} / {rewards.nextLevelPoints.toLocaleString()} points
                </span>
              </div>
              <div className="w-full bg-black/20 rounded-full h-3 backdrop-blur-sm">
                <div
                  className="bg-white h-3 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${Math.min(levelProgress, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-text">Total Points</p>
                <p className="text-2xl font-bold text-blue-500 mt-1">
                  {rewards.totalPoints.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Star className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-text">Cashback Earned</p>
                <p className="text-2xl font-bold text-primary-green mt-1">
                  {formatCurrency(rewards.earnedRewards.cashback)}
                </p>
              </div>
              <div className="p-3 bg-primary-green/10 rounded-lg">
                <Gift className="w-6 h-6 text-primary-green" />
              </div>
            </div>
          </div>

          <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-text">Reward Points</p>
                <p className="text-2xl font-bold text-purple-500 mt-1">
                  {rewards.earnedRewards.points.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Award className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </div>

          <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-text">Achievements</p>
                <p className="text-2xl font-bold text-orange-500 mt-1">
                  {rewards.achievements.filter((a) => a.earned_at).length} /{" "}
                  {rewards.achievements.length}
                </p>
              </div>
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <Trophy className="w-6 h-6 text-orange-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {["all", "spending", "savings", "consistency", "milestone"].map(
            (category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm",
                  selectedCategory === category
                    ? "bg-primary-green text-white"
                    : "bg-card-bg text-secondary-text hover:bg-hover-bg border border-muted-text/10"
                )}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            )
          )}
        </div>

        {/* Achievements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAchievements.map((achievement) => {
            const IconComponent = getIconComponent(achievement.icon);
            const isEarned = !!achievement.earned_at;
            const progress = achievement.progress || 0;
            const target = achievement.target || 100;
            const progressPercent = (progress / target) * 100;

            return (
              <div
                key={achievement.id}
                className={cn(
                  "bg-card-bg rounded-xl shadow-sm overflow-hidden transition-all hover:shadow-md border",
                  isEarned ? "border-primary-green/50" : "border-muted-text/10"
                )}
              >
                <div
                  className={cn("h-1.5 bg-gradient-to-r", getTierColor(achievement.tier))}
                ></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={cn(
                        "p-3 rounded-full",
                        isEarned ? "bg-primary-green/10" : "bg-hover-bg"
                      )}
                    >
                      <IconComponent
                        className={cn(
                          "w-6 h-6",
                          isEarned ? "text-primary-green" : "text-secondary-text"
                        )}
                      />
                    </div>
                    {isEarned && (
                      <span className="px-2 py-1 bg-primary-green/10 text-primary-green text-xs font-medium rounded">
                        Earned
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-primary-text mb-2">
                    {achievement.name}
                  </h3>
                  <p className="text-sm text-secondary-text mb-4 min-h-[40px]">
                    {achievement.description}
                  </p>

                  {!isEarned && achievement.target && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-secondary-text">
                        <span>Progress</span>
                        <span>
                          {progress} / {target}
                        </span>
                      </div>
                      <div className="w-full bg-hover-bg rounded-full h-2">
                        <div
                          className="bg-primary-green h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(progressPercent, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {achievement.reward_points && (
                    <div className="mt-4 flex items-center gap-2 text-sm pt-4 border-t border-muted-text/10">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="text-primary-text font-medium">
                        {achievement.reward_points} points
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Activity */}
        {rewards.recentActivity && rewards.recentActivity.length > 0 && (
          <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-muted-text/10">
              <h3 className="text-lg font-semibold text-primary-text">
                Recent Activity
              </h3>
            </div>
            <div className="divide-y divide-muted-text/10">
              {rewards.recentActivity.slice(0, 5).map((activity, index) => (
                <div
                  key={index}
                  className="p-6 hover:bg-hover-bg transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-primary-text">
                        {activity.description}
                      </p>
                      <p className="text-xs text-secondary-text mt-1">
                        {new Date(activity.timestamp).toLocaleDateString()} at{" "}
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-primary-green font-semibold">
                      <span>+{activity.points}</span>
                      <Star className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <RedemptionModal 
        isOpen={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
        availablePoints={rewards.totalPoints}
        onRedeem={handleRedeem}
      />
    </AppLayout>
  );
}
