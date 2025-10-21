"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Home, 
  CreditCard, 
  List, 
  BarChart3, 
  Settings, 
  Mail, 
  Headphones,
  User
} from 'lucide-react';

interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab = "dashboard",
  onTabChange,
}) => {
  const menuItems = [
    { id: "dashboard", icon: Home, label: "Dashboard" },
    { id: "cards", icon: CreditCard, label: "Cards" },
    { id: "transactions", icon: List, label: "Transactions" },
    { id: "reports", icon: BarChart3, label: "Reports" },
    { id: "mail", icon: Mail, label: "Mail" },
    { id: "support", icon: Headphones, label: "Support" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-20 lg:w-20 xl:w-24 bg-cred-dark/95 backdrop-blur-xl h-screen lg:h-screen flex flex-col items-center py-4 lg:py-6 border-r border-white/5 shrink-0"
    >
      {/* Brand Logo */}
      <div className="w-10 h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 rounded-2xl bg-gradient-to-br from-cred-green to-emerald-400 flex items-center justify-center cursor-pointer mb-6 lg:mb-8 shadow-lg">
        <div className="w-5 h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 rounded-full bg-white/20"></div>
      </div>

      {/* Menu Items */}
      <nav className="flex flex-col gap-3 lg:gap-4 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => onTabChange?.(item.id)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={`
                w-10 h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 rounded-2xl flex items-center justify-center 
                transition-all duration-300 ease-in-out relative group
                ${isActive
                  ? "bg-white/10 text-white shadow-lg backdrop-blur-sm"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
                }
              `}
            >
              <Icon size={18} className="lg:w-5 lg:h-5 xl:w-6 xl:h-6" />
              
              {/* Active Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-1 h-4 lg:h-6 xl:h-8 bg-gradient-to-b from-cred-purple to-cred-pink rounded-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}

              {/* Tooltip */}
              <div className="absolute left-full ml-4 px-3 py-2 bg-cred-secondary rounded-lg text-sm text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                {item.label}
                <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-cred-secondary"></div>
              </div>
            </motion.button>
          );
        })}
      </nav>

      {/* User Profile */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="w-10 h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 rounded-2xl bg-gradient-to-br from-cred-purple to-cred-pink flex items-center justify-center cursor-pointer shadow-lg group relative"
      >
        <User size={18} className="lg:w-5 lg:h-5 xl:w-6 xl:h-6 text-white" />
        
        {/* Profile Tooltip */}
        <div className="absolute left-full ml-4 px-3 py-2 bg-cred-secondary rounded-lg text-sm text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
          Profile
          <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-cred-secondary"></div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Sidebar;