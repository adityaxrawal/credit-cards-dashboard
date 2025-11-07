"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuthenticatedUser } from "@/lib/auth/user-context";

/**
 * Dashboard Layout Client Component
 * Handles client-side navigation and UI
 */
export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useAuthenticatedUser();
  const pathname = usePathname();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: "📊" },
    { name: "Cards", href: "/cards", icon: "💳" },
    { name: "Transactions", href: "/transactions", icon: "💸" },
    { name: "Analytics", href: "/analytics", icon: "📈" },
    { name: "Budget", href: "/budget", icon: "💰" },
    { name: "Bills", href: "/bills", icon: "📅" },
    { name: "Settings", href: "/settings", icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen bg-primary-bg">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-card-bg border-r border-border">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
            <div className="w-8 h-8 bg-primary-green rounded-lg flex items-center justify-center">
              <span className="text-white text-xl">💳</span>
            </div>
            <span className="text-lg font-semibold text-primary-text">
              Credit Cards
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary-green/10 text-primary-green"
                      : "text-secondary-text hover:bg-hover hover:text-primary-text"
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="px-4 py-4 border-t border-border">
            <div className="flex items-center gap-3">
              {user.profilePicture ? (
                <Image
                  src={user.profilePicture}
                  alt={user.name}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-green/20 flex items-center justify-center">
                  <span className="text-primary-green font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-text truncate">
                  {user.name}
                </p>
                <p className="text-xs text-secondary-text truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pl-64">
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
