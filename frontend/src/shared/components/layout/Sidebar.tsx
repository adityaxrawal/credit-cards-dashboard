"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PieChart,
  Layers,
  Settings,
  User,
  LogOut
} from "lucide-react";
import { cn } from "@/shared/utils";

// New "Titanium" Module Structure
const navigationItems = [
  { 
    icon: LayoutDashboard, 
    href: "/command-center", 
    label: "Command Center",
    description: "Overview & Intelligence"
  },
  { 
    icon: PieChart, 
    href: "/portfolio", 
    label: "Portfolio",
    description: "Assets & Liabilities"
  },
  { 
    icon: Layers, 
    href: "/operations", 
    label: "Operations",
    description: "Transactions & Planning"
  },
  { 
    icon: Settings, 
    href: "/system", 
    label: "System",
    description: "Configuration"
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="fixed left-0 top-0 h-full w-20 bg-primary-bg border-r border-white/5 flex flex-col items-center py-6 z-50 shadow-xl shadow-black/20">
      {/* Profile / Logo Area */}
      <div className="mb-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-green to-emerald-600 flex items-center justify-center relative shadow-lg shadow-primary-green/20 group cursor-pointer transition-transform hover:scale-105">
          <User className="w-5 h-5 text-black font-bold" />
          {/* Online indicator */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-bg rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-6 flex-1 w-full px-3">
        {navigationItems.map((item) => {
          // Active state logic: partial match for modules
          const isActive = pathname?.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href} className="w-full">
              <div
                className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 relative group mx-auto",
                  isActive 
                    ? "bg-primary-green text-black shadow-lg shadow-primary-green/25 scale-100" 
                    : "text-muted-text hover:bg-white/5 hover:text-primary-text hover:scale-105"
                )}
              >
                <Icon strokeWidth={isActive ? 2.5 : 2} className="w-6 h-6" />

                {/* Tooltip */}
                <div className="absolute left-full ml-4 pl-1 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 z-50 translate-x-[-10px] group-hover:translate-x-0">
                  <div className="bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-white/10 shadow-xl whitespace-nowrap">
                    <p className="font-semibold text-sm">{item.label}</p>
                    <p className="text-muted-text text-[10px] uppercase tracking-wider">{item.description}</p>
                    {/* Arrow */}
                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-slate-800 rotate-45 border-l border-b border-white/10" />
                  </div>
                </div>
                
                {/* Active Indicator Bar (Left) */}
                {isActive && (
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-green rounded-r-full" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto flex flex-col gap-4">
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-muted-text hover:text-red-400 hover:bg-white/5 transition-colors" title="Logout">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export function MobileSidebar() {
  const [isOpen, setIsOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="fixed top-4 left-4 z-50 w-10 h-10 bg-slate-800/90 backdrop-blur-md rounded-xl flex items-center justify-center md:hidden border border-white/10 shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-5 h-5 flex flex-col justify-center space-y-1.5">
          <span className={cn("block h-0.5 w-full bg-white transition-transform", isOpen && "rotate-45 translate-y-2")} />
          <span className={cn("block h-0.5 w-full bg-white transition-opacity", isOpen && "opacity-0")} />
          <span className={cn("block h-0.5 w-full bg-white transition-transform", isOpen && "-rotate-45 -translate-y-2")} />
        </div>
      </button>

      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 h-full w-72 bg-slate-900 border-r border-white/10 transform transition-transform duration-300 ease-out z-50 md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-green to-emerald-600 flex items-center justify-center shadow-lg shadow-primary-green/20">
              <User className="w-5 h-5 text-black font-bold" />
            </div>
            <div>
              <p className="font-bold text-white text-lg tracking-tight">Financial OS</p>
              <p className="text-xs text-muted-text uppercase tracking-widest">Titanium Edition</p>
            </div>
          </div>

          <nav className="space-y-2">
            {navigationItems.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                >
                  <div
                    className={cn(
                      "flex items-center space-x-4 p-4 rounded-xl transition-all border border-transparent",
                      isActive 
                        ? "bg-primary-green/10 text-primary-green border-primary-green/20" 
                        : "text-muted-text hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Icon className="w-6 h-6" />
                    <div>
                      <span className="font-semibold block">{item.label}</span>
                      <span className="text-xs opacity-70 block mt-0.5">{item.description}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
