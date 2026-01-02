import React from "react";
import Image from "next/image";
import { cn, maskCardNumber } from "@/shared/utils";
import { CreditCard } from "lucide-react";

export interface CardVisualProps {
  cardName: string;
  cardNumber?: string;
  expiryDate?: string;
  bankLogo?: string;
  gradient?: string;
  orientation?: "horizontal" | "vertical";
  showChip?: boolean;
  className?: string;
}

export function CardVisual({
  cardName,
  cardNumber,
  expiryDate = "12/28",
  bankLogo,
  gradient = "gradient-purple",
  orientation = "horizontal",
  showChip = true,
  className,
}: CardVisualProps) {
  const maskedNumber = cardNumber
    ? maskCardNumber(cardNumber)
    : "**** **** **** ****";

  return (
    <div
      className={cn(
        "relative rounded-xl text-white shadow-lg overflow-hidden",
        gradient,
        orientation === "horizontal" ? "aspect-[16/10]" : "aspect-[10/16]",
        className
      )}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 transform translate-x-8 -translate-y-8" />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 transform -translate-x-4 translate-y-4" />

      {/* Content */}
      <div className="relative h-full p-6 flex flex-col justify-between">
        {/* Top Row */}
        <div className="flex justify-between items-start">
          {showChip && (
            <div className="w-12 h-8 bg-gradient-to-br from-yellow-200 to-yellow-400 rounded-md flex items-center justify-center">
              <div className="w-8 h-6 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-sm" />
            </div>
          )}
          <div className="text-right">
            {bankLogo ? (
              <Image
                src={bankLogo}
                alt="Bank Logo"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
            ) : (
              <CreditCard className="h-8 w-8" />
            )}
          </div>
        </div>

        {/* Card Number */}
        <div className="space-y-4">
          <div className="font-mono text-lg tracking-wider">{maskedNumber}</div>

          {/* Bottom Row */}
          <div className="flex justify-between items-end">
            <div>
              <div className="text-xs text-white/70 uppercase tracking-wide">
                Cardholder Name
              </div>
              <div className="font-semibold text-sm">{cardName}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/70 uppercase tracking-wide">
                Expires
              </div>
              <div className="font-mono text-sm">{expiryDate}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
