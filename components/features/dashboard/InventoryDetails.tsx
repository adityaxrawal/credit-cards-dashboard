"use client";

import React, { useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowRight, MoreHorizontal, Calendar } from "lucide-react";
import Button from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

interface InventoryDetailsProps {
  balance: number;
  cardCount: number;
  onDetailsClick?: () => void;
}

const InventoryDetails = React.memo<InventoryDetailsProps>(({
  balance,
  cardCount,
  onDetailsClick,
}) => {
  const formattedBalance = useMemo(() => formatCurrency(balance), [balance]);
  
  const handleDetailsClick = useCallback(() => {
    onDetailsClick?.();
  }, [onDetailsClick]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card rounded-2xl p-4 sm:p-6 mb-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-white">
          Inventory Details
        </h2>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white">
            <Calendar size={18} className="sm:w-5 sm:h-5" />
          </button>
          <button className="text-white/60 hover:text-white transition-colors">
            <MoreHorizontal size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Balance Section */}
      <div className="relative bg-gradient-to-r from-gray-200 via-gray-100 to-[#9AE6B4] rounded-2xl p-4 sm:p-6 overflow-hidden">
        <div className="flex items-center justify-between relative z-10">
          <div className="flex-1">
            <p className="text-gray-600 text-sm mb-2">Your balance:</p>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1">
              {formattedBalance}
            </h3>
            <p className="text-gray-700 text-sm font-medium">
              {cardCount} CARD{cardCount !== 1 ? "S" : ""}
            </p>
          </div>

          <div className="flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDetailsClick}
              className="flex items-center space-x-2 border-gray-700/30 text-gray-800 hover:bg-gray-800/10 bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm"
            >
              <span className="text-sm font-medium">Details</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 opacity-20 overflow-hidden">
          <div className="absolute -top-4 -right-4 w-24 h-24 sm:w-32 sm:h-32 rounded-full border-2 border-white/40"></div>
          <div className="absolute top-2 right-2 w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-white/30"></div>
          <div className="absolute top-6 right-6 w-8 h-8 sm:w-12 sm:h-12 rounded-full border border-white/20"></div>
        </div>

        {/* Additional decorative lines */}
        <div className="absolute top-1/2 right-8 w-16 h-px bg-white/30 transform rotate-45"></div>
        <div className="absolute top-1/3 right-12 w-12 h-px bg-white/30 transform rotate-12"></div>
        <div className="absolute bottom-1/3 right-6 w-20 h-px bg-white/30 transform -rotate-12"></div>
      </div>
    </motion.div>
  );
});

InventoryDetails.displayName = 'InventoryDetails';

export default InventoryDetails;
