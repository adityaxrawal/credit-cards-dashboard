import React from "react";
import { Search, Mail, MessageCircle, Wallet, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HeaderProps {
  title: string;
  className?: string;
}

export function Header({ title, className }: HeaderProps) {
  const [searchValue, setSearchValue] = React.useState("");

  return (
    <div
      className={cn(
        "flex items-center justify-between p-6 bg-transparent",
        className
      )}
    >
      {/* Left side - Title */}
      <h1 className="text-2xl font-bold text-primary-text">{title}</h1>

      {/* Center - Search */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-text" />
          <input
            type="text"
            placeholder="Search transactions, cards..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card-bg border border-muted-text/20 rounded-lg text-primary-text placeholder-muted-text focus:outline-none focus:ring-2 focus:ring-primary-green focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center space-x-4">
        {/* Action Icons */}
        <div className="flex items-center space-x-3">
          <HeaderAction icon={Mail} />
          <HeaderAction icon={MessageCircle} />
          <HeaderAction icon={Wallet} />

          {/* Notifications with badge */}
          <div className="relative">
            <HeaderAction icon={Bell} />
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-error rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-white">2</span>
            </div>
          </div>
        </div>

        {/* Profile */}
        <div className="ml-4">
          <button className="w-8 h-8 rounded-full bg-primary-green flex items-center justify-center hover:bg-primary-green/90 transition-colors">
            <User className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface HeaderActionProps {
  icon: React.ElementType;
  onClick?: () => void;
  className?: string;
}

function HeaderAction({ icon: Icon, onClick, className }: HeaderActionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-8 h-8 flex items-center justify-center text-secondary-text hover:text-primary-text transition-colors",
        className
      )}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
