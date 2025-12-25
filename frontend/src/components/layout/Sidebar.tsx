import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  ArrowRightLeft,
  Receipt,
  FileText,
  Gift,
  BarChart3,
  Settings,
  User,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  { icon: LayoutDashboard, href: "/dashboard", label: "Dashboard" },
  { icon: Building2, href: "/dashboard/instruments", label: "Instruments" },
  { icon: CreditCard, href: "/cards", label: "Cards" },
  { icon: ArrowRightLeft, href: "/transactions", label: "Transactions" },
  { icon: Receipt, href: "/bills", label: "Bills" },
  { icon: FileText, href: "/statements", label: "Statements" },
  { icon: Gift, href: "/rewards", label: "Rewards" },
  { icon: BarChart3, href: "/analytics", label: "Analytics" },
  { icon: Settings, href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="fixed left-0 top-0 h-full w-20 bg-primary-bg border-r border-muted-text/10 flex flex-col items-center py-6 z-50">
      {/* Profile */}
      <div className="mb-8">
        <div className="w-10 h-10 rounded-full bg-primary-green flex items-center justify-center relative">
          <User className="w-5 h-5 text-white" />
          {/* Online indicator */}
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-primary-bg" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col space-y-4 flex-1">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200",
                  "hover:bg-hover-bg group relative",
                  isActive && "bg-white"
                )}
                title={item.label}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-colors",
                    isActive
                      ? "text-primary-bg"
                      : "text-secondary-text group-hover:text-primary-text"
                  )}
                />

                {/* Tooltip */}
                <div className="absolute left-full ml-2 px-2 py-1 bg-card-bg text-primary-text text-sm rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg border border-muted-text/10">
                  {item.label}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom spacer */}
      <div className="mt-auto" />
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
        className="fixed top-4 left-4 z-50 w-10 h-10 bg-card-bg rounded-lg flex items-center justify-center md:hidden shadow-sm border border-muted-text/10"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-5 h-5 flex flex-col justify-center space-y-1">
          <div
            className={cn(
              "h-0.5 bg-primary-text transition-all",
              isOpen && "rotate-45 translate-y-1.5"
            )}
          />
          <div
            className={cn(
              "h-0.5 bg-primary-text transition-all",
              isOpen && "opacity-0"
            )}
          />
          <div
            className={cn(
              "h-0.5 bg-primary-text transition-all",
              isOpen && "-rotate-45 -translate-y-1.5"
            )}
          />
        </div>
      </button>

      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 h-full w-64 bg-primary-bg border-r border-muted-text/10 transform transition-transform z-50 md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-primary-green flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-primary-text">Dashboard</p>
            </div>
          </div>

          <nav className="space-y-2">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                >
                  <div
                    className={cn(
                      "flex items-center space-x-3 p-3 rounded-lg transition-colors",
                      "hover:bg-hover-bg",
                      isActive && "bg-primary-green/20 text-primary-green"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
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
