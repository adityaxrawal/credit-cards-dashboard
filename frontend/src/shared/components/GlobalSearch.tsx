"use client";

import React, { useEffect, useState } from "react";
import { Search, Command, CreditCard, LayoutDashboard, Settings, FileText, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/shared/utils";

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const [search, setSearch] = useState("");

  const items = [
    { name: "Dashboard Overview", href: "/command-center/overview", icon: LayoutDashboard },
    { name: "Transactions", href: "/operations/transactions", icon: FileText },
    { name: "Budget", href: "/operations/budget", icon: FileText },
    { name: "Cashflow", href: "/operations/cashflow", icon: FileText },
    { name: "Portfolio Accounts", href: "/portfolio/accounts", icon: CreditCard },
    { name: "Settings", href: "/system/settings", icon: Settings },
  ];

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (href: string) => {
    router.push(href);
    setIsOpen(false);
    setSearch("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
      <div 
        className="w-full max-w-lg bg-card-bg border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-border px-4 py-3">
            <Search className="w-5 h-5 text-secondary-text mr-3" />
            <input 
                autoFocus
                className="flex-1 bg-transparent text-lg text-primary-text placeholder-secondary-text outline-none"
                placeholder="Type a command or search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
            <button onClick={() => setIsOpen(false)} className="text-secondary-text hover:text-primary-text">
                <X className="w-5 h-5" />
            </button>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto py-2">
            {filteredItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-secondary-text text-sm">
                    No results found.
                </div>
            ) : (
                <div className="px-2 space-y-1">
                    <div className="px-2 py-1.5 text-xs font-semibold text-secondary-text uppercase tracking-wider">
                        Navigation
                    </div>
                    {filteredItems.map(item => (
                        <button
                            key={item.href}
                            onClick={() => handleSelect(item.href)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-primary-text rounded-lg hover:bg-hover-bg transition-colors text-left"
                        >
                            <item.icon className="w-4 h-4 text-secondary-text" />
                            {item.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
        
        <div className="px-4 py-2 border-t border-border bg-primary-bg/50 text-[10px] text-secondary-text flex justify-between">
            <span>Press <kbd className="font-sans bg-card-bg border border-border px-1 rounded">esc</kbd> to close</span>
            <span>Search components, pages, and actions</span>
        </div>
      </div>
    </div>
  );
}
