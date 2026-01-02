"use client";

import React from "react";
import { cn, formatCurrency, maskCardNumber } from "@/shared/utils";
import { CreditCard, Landmark, Wallet, MoreVertical, Copy } from "lucide-react";

export interface AssetCardProps {
  type: "bank" | "credit" | "investment" | "cash" | "wallet";
  name: string;
  balance: number;
  currency?: string;
  accountNumber?: string; // Last 4 for cards, or masked for banks
  provider?: string;
  colorTheme?: "purple" | "blue" | "green" | "orange" | "black" | "slate";
  trend?: number; // Percent change if available
  className?: string;
  onClick?: () => void;
  onMenuClick?: (e: React.MouseEvent) => void;
}

const themeMap = {
  purple: "from-purple-600 to-indigo-700 shadow-purple-900/20",
  blue: "from-blue-600 to-cyan-700 shadow-blue-900/20",
  green: "from-emerald-600 to-teal-700 shadow-emerald-900/20",
  orange: "from-orange-500 to-red-600 shadow-orange-900/20",
  black: "from-neutral-800 to-neutral-900 shadow-black/40",
  slate: "from-slate-700 to-slate-800 shadow-slate-900/30",
};

export function AssetCard({
  type,
  name,
  balance,
  currency,
  accountNumber,
  provider,
  colorTheme = "black",
  trend,
  className,
  onClick,
  onMenuClick,
}: AssetCardProps) {
  const isCredit = type === "credit";
  const displayBalance = Math.abs(balance);
  const Icon = type === "bank" ? Landmark : type === "credit" ? CreditCard : Wallet;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group",
        "bg-gradient-to-br shadow-lg",
        themeMap[colorTheme],
        className
      )}
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-1/3 -translate-y-1/3">
        <Icon className="w-48 h-48 text-white" />
      </div>

      {/* Glassmorphism Overlay */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] group-hover:bg-white/10 transition-colors" />

      {/* Content */}
      <div className="relative p-6 flex flex-col justify-between h-full min-h-[180px] text-white">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/10">
                 <Icon className="w-5 h-5" />
             </div>
             <div>
                 <h3 className="font-semibold tracking-wide text-sm opacity-90">{name}</h3>
                 <p className="text-xs text-white/60">{provider}</p>
             </div>
          </div>
          
          {onMenuClick && (
            <button 
                onClick={(e) => { e.stopPropagation(); onMenuClick(e); }}
                className="p-1 rounded-full hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
            >
                <MoreVertical className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Center / Balance */}
        <div className="mt-6 mb-2">
            <p className="text-xs uppercase tracking-wider text-white/60 mb-1">
                {isCredit ? "Current Balance" : "Total Balance"}
            </p>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-bold tracking-tight">
                    {formatCurrency(displayBalance, currency)}
                </span>
                {trend !== undefined && (
                    <div className={cn(
                        "text-xs px-1.5 py-0.5 rounded backdrop-blur-md",
                        trend >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                    )}>
                        {trend > 0 ? "+" : ""}{trend}%
                    </div>
                )}
            </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end">
             <div className="font-mono text-sm opacity-70 tracking-widest">
                 {accountNumber ? (
                     type === 'credit' ? `•••• ${accountNumber.slice(-4)}` : accountNumber
                 ) : '•••• ••••'}
             </div>
             {type === 'credit' && (
                 <div className="flex gap-2">
                     <div className="w-8 h-5 rounded bg-white/20" />
                     <div className="w-8 h-5 rounded bg-white/20" />
                 </div>
             )}
        </div>
      </div>
    </div>
  );
}
