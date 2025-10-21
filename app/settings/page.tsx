"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Sidebar from "@/components/shared/navigation/Sidebar";
import Topbar from "@/components/shared/navigation/Topbar";
import { Bell, Shield, User, CreditCard, Globe, Moon } from "lucide-react";
import "../globals.css";

const SettingsPage: React.FC = () => {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);

  const settingsSections = [
    {
      title: "Account Settings",
      icon: User,
      items: [
        { label: "Profile Information", description: "Update your personal details" },
        { label: "Change Password", description: "Update your account password" },
        { label: "Email Preferences", description: "Manage email notifications" },
      ]
    },
    {
      title: "Security",
      icon: Shield,
      items: [
        { label: "Two-Factor Authentication", description: "Add an extra layer of security", toggle: true, value: twoFactor, onChange: setTwoFactor },
        { label: "Login History", description: "View recent login activity" },
        { label: "Connected Devices", description: "Manage your connected devices" },
      ]
    },
    {
      title: "Notifications",
      icon: Bell,
      items: [
        { label: "Push Notifications", description: "Receive notifications on your device", toggle: true, value: notifications, onChange: setNotifications },
        { label: "Transaction Alerts", description: "Get notified of new transactions" },
        { label: "Payment Reminders", description: "Receive payment due date reminders" },
      ]
    },
    {
      title: "Cards & Payments",
      icon: CreditCard,
      items: [
        { label: "Manage Cards", description: "Add, remove, or update your cards" },
        { label: "Payment Methods", description: "Manage your payment methods" },
        { label: "Spending Limits", description: "Set daily and monthly limits" },
      ]
    },
    {
      title: "Preferences",
      icon: Globe,
      items: [
        { label: "Language", description: "Choose your preferred language" },
        { label: "Currency", description: "Set your default currency" },
        { label: "Dark Mode", description: "Toggle dark/light theme", toggle: true, value: darkMode, onChange: setDarkMode },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-primary-bg flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Content Area */}
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

          {/* Settings Sections */}
          <div className="space-y-6">
            {settingsSections.map((section, index) => {
              const Icon = section.icon;
              return (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="glass-card rounded-2xl p-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Icon className="w-5 h-5 text-accent-mint" />
                    <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                  </div>
                  
                  <div className="space-y-3">
                    {section.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                        <div>
                          <p className="text-white font-medium">{item.label}</p>
                          <p className="text-white/60 text-sm">{item.description}</p>
                        </div>
                        
                        {item.toggle ? (
                          <button
                            onClick={() => item.onChange && item.onChange(!item.value)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              item.value ? 'bg-accent-mint' : 'bg-white/20'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                item.value ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        ) : (
                          <button className="px-4 py-2 bg-gradient-to-r from-accent-purple to-accent-orange rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity">
                            Configure
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsPage;