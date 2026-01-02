"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/shared/utils";

export interface TabItem {
  label: string;
  href: string;
  count?: number; // For notifications or items requiring attention
}

interface NavTabsProps {
  tabs: TabItem[];
  className?: string;
}

export function NavTabs({ tabs, className }: NavTabsProps) {
  const pathname = usePathname();

  return (
    <div className={cn("border-b border-white/5 bg-primary-bg/50 backdrop-blur-sm sticky top-0 z-30", className)}>
      <div className="flex items-center gap-6 px-6 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative py-4 text-sm font-medium transition-colors hover:text-primary-text",
                isActive ? "text-primary-green" : "text-muted-text"
              )}
            >
              <div className="flex items-center gap-2">
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="flex items-center justify-center h-5 min-w-[1.25rem] rounded-full bg-slate-800 px-1.5 text-xs text-primary-text">
                    {tab.count}
                  </span>
                )}
              </div>
              
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-green shadow-[0_0_8px_rgba(110,203,142,0.4)]"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
