"use client";

import React, { useState, useEffect } from "react";
import { TrendingUp, DollarSign, Target, ArrowRight } from "lucide-react";
import { Card, Input, Button } from "@/shared/components/ui";
import { cn, formatCurrency } from "@/shared/utils";

interface ForecasterProps {
  currentNetWorth: number;
  avgMonthlySavings: number;
  avgMonthlyReturns: number; // percentage (e.g., 0.07 for 7%)
}

export default function ForecasterWidget({
  currentNetWorth,
  avgMonthlySavings,
  avgMonthlyReturns = 0.06, // Default 6% annual
}: ForecasterProps) {
  const [extraSavings, setExtraSavings] = useState(0);
  const [projectedValue, setProjectedValue] = useState(currentNetWorth);

  useEffect(() => {
    // Simple compound interest for 1 year
    // FV = PV * (1+r)^n + PMT * [((1+r)^n - 1) / r]
    const r = avgMonthlyReturns / 12; // Monthly rate
    const n = 12; // 12 Months
    const PMT = avgMonthlySavings + extraSavings;
    
    // Future value of initial lump sum
    const futureLumpSum = currentNetWorth * Math.pow(1 + r, n);
    
    // Future value of series of payments
    const futureSeries = PMT * ((Math.pow(1 + r, n) - 1) / r);
    
    setProjectedValue(futureLumpSum + futureSeries);
  }, [currentNetWorth, avgMonthlySavings, extraSavings, avgMonthlyReturns]);

  const gain = projectedValue - currentNetWorth;

  return (
    <Card className="h-full p-6 flex flex-col bg-card-bg border-border">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-primary-text flex items-center gap-2">
          <Target className="w-5 h-5 text-accent-purple" />
          Wealth Forecaster
        </h3>
        <p className="text-sm text-secondary-text">
          Project your Net Worth in 12 months
        </p>
      </div>

      <div className="flex-1 space-y-6">
        <div className="bg-primary-bg/50 p-4 rounded-lg border border-border">
          <div className="text-sm text-secondary-text mb-1">Projected Net Worth</div>
          <div className="text-3xl font-mono font-bold text-primary-text">
            {formatCurrency(projectedValue)}
          </div>
          <div className="text-xs text-primary-green flex items-center mt-1">
            <TrendingUp className="w-3 h-3 mr-1" />
            +{formatCurrency(gain)} (+{((gain / currentNetWorth) * 100).toFixed(1)}%)
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-secondary-text uppercase tracking-wider mb-2 block">
                Boost Monthly Savings
            </label>
            <div className="flex items-center gap-3">
                 <div className="relative flex-1">
                     <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-text" />
                     <Input 
                        type="number" 
                        value={extraSavings} 
                        onChange={(e) => setExtraSavings(Number(e.target.value))}
                        className="pl-9"
                     />
                 </div>
            </div>
            <p className="text-xs text-muted-text mt-2">
                Base savings: {formatCurrency(avgMonthlySavings)}/mo
            </p>
          </div>
          
          <div className="space-y-2">
              <div className="flex justify-between text-xs">
                  <span>Current Path</span>
                  <span className="text-secondary-text">{formatCurrency(currentNetWorth + (avgMonthlySavings * 12))}</span>
              </div>
               <div className="h-1.5 w-full bg-secondary-text/10 rounded-full overflow-hidden">
                   <div className="h-full bg-secondary-text rounded-full" style={{ width: '80%' }}></div>
               </div>
               
               <div className="flex justify-between text-xs font-medium text-accent-purple">
                  <span>With Boost (+{formatCurrency(extraSavings)})</span>
              </div>
              <div className="h-1.5 w-full bg-secondary-text/10 rounded-full overflow-hidden">
                   <div className="h-full bg-accent-purple rounded-full" style={{ width: '95%' }}></div>
               </div>
          </div>
        </div>
      </div>

      <Button className="mt-6 w-full" variant="outline">
        View Detailed Projections <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </Card>
  );
}
