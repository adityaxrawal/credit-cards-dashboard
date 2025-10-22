"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Sidebar from "@/components/shared/navigation/Sidebar";
import Topbar from "@/components/shared/navigation/Topbar";
import { 
  User, 
  CreditCard, 
  Mail, 
  AlertTriangle, 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  X,
  DollarSign,
  Calendar,
  Bell
} from "lucide-react";
import { SpendingLimitService, SpendingLimit } from "@/lib/services/spending-limit";
import { createClient } from "@/lib/supabase/client";
import "../../globals.css";

interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

interface EmailPattern {
  id: string;
  pattern: string;
  bank_name: string;
  is_active: boolean;
}

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const [user, setUser] = useState<User | null>(null);
  const [spendingLimits, setSpendingLimits] = useState<SpendingLimit[]>([]);
  const [emailPatterns, setEmailPatterns] = useState<EmailPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewLimitForm, setShowNewLimitForm] = useState(false);
  const [showNewPatternForm, setShowNewPatternForm] = useState(false);

  // Form states
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    email: ""
  });

  const [limitForm, setLimitForm] = useState({
    category: "",
    limit_amount: "",
    period: "monthly" as "daily" | "weekly" | "monthly" | "yearly",
    alert_threshold: "80"
  });

  const [patternForm, setPatternForm] = useState({
    pattern: "",
    bank_name: ""
  });

  const spendingLimitService = new SpendingLimitService();

  useEffect(() => {
    loadUserData();
    loadSpendingLimits();
    loadEmailPatterns();
  }, []);

  const loadUserData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUser(user as User);
        setProfileForm({
          full_name: user.user_metadata?.full_name || "",
          email: user.email || ""
        });
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const loadSpendingLimits = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const limits = await spendingLimitService.getActiveSpendingLimits(user.id);
        setSpendingLimits(limits);
      }
    } catch (error) {
      console.error("Error loading spending limits:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmailPatterns = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: patterns } = await supabase
          .from('email_patterns')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        setEmailPatterns(patterns || []);
      }
    } catch (error) {
      console.error("Error loading email patterns:", error);
    }
  };

  const handleProfileUpdate = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { full_name: profileForm.full_name }
      });

      if (error) throw error;
      
      // Show success message
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile");
    }
  };

  const handleCreateSpendingLimit = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      await spendingLimitService.createSpendingLimit(user.id, {
        category: limitForm.category || undefined,
        limit_amount: parseFloat(limitForm.limit_amount),
        period: limitForm.period,
        alert_threshold: parseFloat(limitForm.alert_threshold)
      });

      setShowNewLimitForm(false);
      setLimitForm({
        category: "",
        limit_amount: "",
        period: "monthly",
        alert_threshold: "80"
      });
      
      await loadSpendingLimits();
      alert("Spending limit created successfully!");
    } catch (error) {
      console.error("Error creating spending limit:", error);
      alert("Failed to create spending limit");
    }
  };

  const handleDeleteSpendingLimit = async (limitId: string) => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      await spendingLimitService.deleteSpendingLimit(limitId, user.id);
      await loadSpendingLimits();
      alert("Spending limit deleted successfully!");
    } catch (error) {
      console.error("Error deleting spending limit:", error);
      alert("Failed to delete spending limit");
    }
  };

  const handleCreateEmailPattern = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { error } = await supabase
        .from('email_patterns')
        .insert({
          user_id: user.id,
          pattern: patternForm.pattern,
          bank_name: patternForm.bank_name,
          is_active: true
        });

      if (error) throw error;

      setShowNewPatternForm(false);
      setPatternForm({ pattern: "", bank_name: "" });
      await loadEmailPatterns();
      alert("Email pattern created successfully!");
    } catch (error) {
      console.error("Error creating email pattern:", error);
      alert("Failed to create email pattern");
    }
  };

  const handleDeleteEmailPattern = async (patternId: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('email_patterns')
        .delete()
        .eq('id', patternId);

      if (error) throw error;

      await loadEmailPatterns();
      alert("Email pattern deleted successfully!");
    } catch (error) {
      console.error("Error deleting email pattern:", error);
      alert("Failed to delete email pattern");
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      "Are you sure you want to delete your account? This action cannot be undone."
    );
    
    if (!confirmed) return;

    try {
      // In a real implementation, you would call an API endpoint to handle account deletion
      alert("Account deletion functionality would be implemented here");
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Failed to delete account");
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "spending-limits", label: "Spending Limits", icon: CreditCard },
    { id: "email-patterns", label: "Email Patterns", icon: Mail },
    { id: "danger-zone", label: "Danger Zone", icon: AlertTriangle }
  ];

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Profile Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={profileForm.full_name}
              onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-accent-mint"
              placeholder="Enter your full name"
            />
          </div>
          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={profileForm.email}
              disabled
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white/50 cursor-not-allowed"
            />
            <p className="text-white/50 text-xs mt-1">Email cannot be changed</p>
          </div>
          <button
            onClick={handleProfileUpdate}
            className="px-6 py-3 bg-gradient-to-r from-accent-purple to-accent-orange rounded-lg text-white font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );

  const renderSpendingLimitsTab = () => (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Spending Limits</h3>
          <button
            onClick={() => setShowNewLimitForm(true)}
            className="px-4 py-2 bg-gradient-to-r from-accent-purple to-accent-orange rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Limit
          </button>
        </div>

        {showNewLimitForm && (
          <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <h4 className="text-white font-medium mb-4">Create New Spending Limit</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">
                  Category (Optional)
                </label>
                <input
                  type="text"
                  value={limitForm.category}
                  onChange={(e) => setLimitForm({ ...limitForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-accent-mint"
                  placeholder="e.g., Food, Entertainment"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">
                  Limit Amount
                </label>
                <input
                  type="number"
                  value={limitForm.limit_amount}
                  onChange={(e) => setLimitForm({ ...limitForm, limit_amount: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-accent-mint"
                  placeholder="1000"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">
                  Period
                </label>
                <select
                  value={limitForm.period}
                  onChange={(e) => setLimitForm({ ...limitForm, period: e.target.value as "daily" | "weekly" | "monthly" | "yearly" })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-accent-mint"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">
                  Alert Threshold (%)
                </label>
                <input
                  type="number"
                  value={limitForm.alert_threshold}
                  onChange={(e) => setLimitForm({ ...limitForm, alert_threshold: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-accent-mint"
                  placeholder="80"
                  min="0"
                  max="100"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCreateSpendingLimit}
                className="px-4 py-2 bg-gradient-to-r from-accent-purple to-accent-orange rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Create Limit
              </button>
              <button
                onClick={() => setShowNewLimitForm(false)}
                className="px-4 py-2 bg-white/10 rounded-lg text-white text-sm font-medium hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {spendingLimits.length === 0 ? (
            <p className="text-white/60 text-center py-8">No spending limits configured</p>
          ) : (
            spendingLimits.map((limit) => (
              <div key={limit.id} className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-accent-mint" />
                    <div>
                      <p className="text-white font-medium">
                        {limit.category || "Global Limit"} - ${limit.limit_amount}
                      </p>
                      <p className="text-white/60 text-sm">
                        {limit.period} • ${limit.current_spent} spent • {limit.alert_threshold}% threshold
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteSpendingLimit(limit.id)}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderEmailPatternsTab = () => (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Email Patterns</h3>
          <button
            onClick={() => setShowNewPatternForm(true)}
            className="px-4 py-2 bg-gradient-to-r from-accent-purple to-accent-orange rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Pattern
          </button>
        </div>

        {showNewPatternForm && (
          <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <h4 className="text-white font-medium mb-4">Create New Email Pattern</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">
                  Email Pattern
                </label>
                <input
                  type="text"
                  value={patternForm.pattern}
                  onChange={(e) => setPatternForm({ ...patternForm, pattern: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-accent-mint"
                  placeholder="e.g., *@chase.com"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={patternForm.bank_name}
                  onChange={(e) => setPatternForm({ ...patternForm, bank_name: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-accent-mint"
                  placeholder="Chase Bank"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCreateEmailPattern}
                className="px-4 py-2 bg-gradient-to-r from-accent-purple to-accent-orange rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Create Pattern
              </button>
              <button
                onClick={() => setShowNewPatternForm(false)}
                className="px-4 py-2 bg-white/10 rounded-lg text-white text-sm font-medium hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {emailPatterns.length === 0 ? (
            <p className="text-white/60 text-center py-8">No email patterns configured</p>
          ) : (
            emailPatterns.map((pattern) => (
              <div key={pattern.id} className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-accent-mint" />
                    <div>
                      <p className="text-white font-medium">{pattern.pattern}</p>
                      <p className="text-white/60 text-sm">{pattern.bank_name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteEmailPattern(pattern.id)}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderDangerZoneTab = () => (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 border border-red-500/20">
        <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h3>
        <div className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <h4 className="text-white font-medium mb-2">Delete Account</h4>
            <p className="text-white/70 text-sm mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button
              onClick={handleDeleteAccount}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white text-sm font-medium transition-colors"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return renderProfileTab();
      case "spending-limits":
        return renderSpendingLimitsTab();
      case "email-patterns":
        return renderEmailPatternsTab();
      case "danger-zone":
        return renderDangerZoneTab();
      default:
        return renderProfileTab();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-bg flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-y-auto bg-primary-bg"
        >
          {/* Topbar */}
          <Topbar />

          {/* Page Header */}
          <div className="glass-card rounded-2xl p-6">
            <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">Settings</h1>
            <p className="text-white/70">Manage your account preferences and security settings</p>
          </div>

          {/* Tabs */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-gradient-to-r from-accent-purple to-accent-orange text-white"
                        : "text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            {renderTabContent()}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsPage;