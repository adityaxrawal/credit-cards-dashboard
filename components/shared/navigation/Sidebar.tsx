"use client";

import React from "react";
import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  CreditCard,
  List,
  BarChart3,
  Settings,
  Mail,
  Headphones,
  User,
  Loader2,
} from "lucide-react";
import { useLoading } from "@/contexts/LoadingContext";

interface SidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isOpen = false,
  onToggle,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { setLoading, setLoadingMessage } = useLoading();

  const menuItems = [
    { id: "dashboard", icon: Home, label: "Dashboard", path: "/dashboard" },
    { id: "cards", icon: CreditCard, label: "Cards", path: "/cards" },
    {
      id: "transactions",
      icon: List,
      label: "Transactions",
      path: "/transactions",
    },
    {
      id: "statements",
      icon: BarChart3,
      label: "Statement",
      path: "/statements",
    },
    { id: "settings", icon: Settings, label: "Settings", path: "/settings" },
  ];

  // Determine active tab from pathname if not provided
  const currentActiveTab =
    activeTab ||
    menuItems.find((item) => pathname === item.path)?.id ||
    "dashboard";

  const handleNavigation = async (item: (typeof menuItems)[0]) => {
    // Don't navigate if already on the same page
    if (pathname === item.path) return;

    // Show loading state
    setLoadingMessage(`Loading ${item.label}...`);
    setLoading(true);

    try {
      // Add a small delay to show the loading state
      await new Promise((resolve) => setTimeout(resolve, 300));

      router.push(item.path);
      onTabChange?.(item.id);

      // Close mobile sidebar after navigation
      if (isOpen && onToggle) {
        onToggle();
      }

      // Hide loading after a short delay to ensure smooth transition
      setTimeout(() => {
        setLoading(false);
      }, 200);
    } catch (error) {
      console.error("Navigation error:", error);
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`
        fixed lg:relative z-[9998] lg:z-auto
        w-20 lg:w-20 xl:w-24 bg-sidebar-bg backdrop-blur-xl h-screen 
        flex flex-col items-center py-4 lg:py-6 border-r border-white/5 shrink-0
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
    >
      {/* Brand Logo */}
      <div className="w-10 h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 rounded-2xl bg-gradient-to-br from-cred-green to-emerald-400 flex items-center justify-center cursor-pointer mb-6 lg:mb-8 shadow-lg">
        <div className="w-5 h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 rounded-full bg-white/20"></div>
      </div>

      {/* Menu Items */}
      <nav className="flex flex-col gap-3 lg:gap-4 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentActiveTab === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => handleNavigation(item)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={`
                w-10 h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 rounded-2xl flex items-center justify-center 
                transition-all duration-300 ease-in-out relative group
                ${
                  isActive
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
              <div className="absolute left-full ml-4 px-3 py-2 bg-cred-secondary rounded-lg text-sm text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[9999]">
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
        <div className="absolute left-full ml-4 px-3 py-2 bg-cred-secondary rounded-lg text-sm text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[9999]">
          Profile
          <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-cred-secondary"></div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Sidebar;
