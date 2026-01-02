import React from "react";
import { ArrowRight } from "lucide-react";
import { cn, formatCurrency } from "@/shared/utils";
import { Button } from "@/shared/components/ui";

export interface InventoryDetailsCardProps {
  totalBalance: number;
  cardCount: number;
  onDetailsClick?: () => void;
  className?: string;
}

export function InventoryDetailsCard({
  totalBalance,
  cardCount,
  onDetailsClick,
  className,
}: InventoryDetailsCardProps) {
  return (
    <div
      className={cn(
        "bg-card-bg rounded-xl overflow-hidden card-shadow",
        className
      )}
    >
      <div className="flex h-48">
        {/* Left Section - Dark */}
        <div className="flex-1 p-8 flex flex-col justify-center">
          <p className="text-secondary-text text-sm mb-2 uppercase tracking-wide">
            Your Balance
          </p>
          <h2 className="text-4xl font-bold text-white mb-4">
            {formatCurrency(totalBalance)}
          </h2>
          <p className="text-secondary-text text-sm">
            <span className="font-semibold text-primary-text">{cardCount}</span>{" "}
            CARD{cardCount !== 1 ? "S" : ""}
          </p>
        </div>

        {/* Right Section - Green with Pattern */}
        <div className="flex-1 relative gradient-green flex items-center justify-center">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <svg
              className="w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d="M0,50 Q25,30 50,50 T100,50 L100,100 L0,100 Z"
                fill="currentColor"
              />
            </svg>
          </div>

          {/* Abstract Line Patterns */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/4 left-1/4 w-16 h-0.5 bg-white rotate-12" />
            <div className="absolute top-1/2 right-1/3 w-12 h-0.5 bg-white -rotate-12" />
            <div className="absolute bottom-1/3 left-1/3 w-8 h-0.5 bg-white rotate-45" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            <Button
              variant="secondary"
              onClick={onDetailsClick}
              className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm"
            >
              Details
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
