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

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("accessToken");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rewards/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRewards(data.data);
      }
    } catch (error) {
      console.error("Error fetching rewards:", error);
    } finally {
      setLoading(false);
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!rewards) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No rewards data available</p>
      </div>
    );
  }

  const levelProgress = (rewards.totalPoints / rewards.nextLevelPoints) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Rewards & Achievements
          </h2>
          <p className="text-gray-600 mt-1">
            Track your financial milestones and earn rewards
          </p>
        </div>
      </div>

      {/* Level Progress Card */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm opacity-90">Current Level</p>
            <p className="text-4xl font-bold">Level {rewards.level}</p>
          </div>
          <div className="p-4 bg-white bg-opacity-20 rounded-full">
            <Crown className="w-12 h-12" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress to Level {rewards.level + 1}</span>
            <span>
              {rewards.totalPoints} / {rewards.nextLevelPoints} points
            </span>
          </div>
          <div className="w-full bg-white bg-opacity-20 rounded-full h-3">
            <div
              className="bg-white h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(levelProgress, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Points</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {rewards.totalPoints}
              </p>
            </div>
            <Star className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cashback Earned</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                ₹{rewards.earnedRewards.cashback.toFixed(2)}
              </p>
            </div>
            <Gift className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Reward Points</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {rewards.earnedRewards.points}
              </p>
            </div>
            <Award className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Achievements</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {rewards.achievements.filter((a) => a.earned_at).length} /{" "}
                {rewards.achievements.length}
              </p>
            </div>
            <Trophy className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto">
        {["all", "spending", "savings", "consistency", "milestone"].map(
          (category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
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
              className={`bg-white rounded-lg shadow overflow-hidden transition-all hover:shadow-lg ${
                isEarned ? "border-2 border-blue-500" : ""
              }`}
            >
              <div
                className={`h-2 bg-gradient-to-r ${getTierColor(
                  achievement.tier
                )}`}
              ></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`p-3 rounded-full ${
                      isEarned ? "bg-blue-100" : "bg-gray-100"
                    }`}
                  >
                    <IconComponent
                      className={`w-6 h-6 ${
                        isEarned ? "text-blue-600" : "text-gray-400"
                      }`}
                    />
                  </div>
                  {isEarned && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                      Earned
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {achievement.name}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {achievement.description}
                </p>

                {!isEarned && achievement.target && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Progress</span>
                      <span>
                        {progress} / {target}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(progressPercent, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {achievement.reward_points && (
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="text-gray-700">
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Activity
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {rewards.recentActivity.slice(0, 5).map((activity, index) => (
              <div
                key={index}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(activity.timestamp).toLocaleDateString()} at{" "}
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-blue-600 font-semibold">
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
  );
}
