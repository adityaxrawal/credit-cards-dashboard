import React from "react";
import {
  Plus,
  MoreHorizontal,
  CreditCard as CreditCardIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CardVisual, ProgressBar } from "@/components/ui";
import type { CreditCard, SpendingLimit } from "@/types";

export interface RightSidebarProps {
  selectedCard?: CreditCard;
  spendingLimit?: SpendingLimit & { currentSpending: number };
  className?: string;
}

export function RightSidebar({
  selectedCard,
  spendingLimit,
  className,
}: RightSidebarProps) {
  return (
    <div
      className={cn("w-80 bg-card-bg p-6 space-y-8 overflow-y-auto", className)}
    >
      {/* Card Details Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary-text">
            Details Card
          </h3>
          <div className="flex items-center space-x-2">
            <button className="w-8 h-8 flex items-center justify-center text-secondary-text hover:text-primary-text transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 flex items-center justify-center text-secondary-text hover:text-primary-text transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {selectedCard ? (
          <div className="space-y-4">
            {/* Card Visual */}
            <CardVisual
              cardName={selectedCard.card_name}
              cardNumber={selectedCard.card_number_last4}
              gradient="gradient-green"
              orientation="vertical"
              className="w-full"
            />

            {/* Card Details Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-secondary-text mb-1">Card Number</p>
                <p className="text-primary-text font-mono">
                  **** **** **** {selectedCard.card_number_last4}
                </p>
              </div>
              <div>
                <p className="text-secondary-text mb-1">Expire Date</p>
                <p className="text-primary-text">08/28</p>
              </div>
              <div>
                <p className="text-secondary-text mb-1">CVV</p>
                <p className="text-primary-text">***</p>
              </div>
              <div>
                <p className="text-secondary-text mb-1">Level</p>
                <p className="text-primary-text">02</p>
              </div>
            </div>

            {/* Card Stats */}
            <div className="pt-4 border-t border-muted-text/10 space-y-3">
              <div className="flex justify-between">
                <span className="text-secondary-text">Current Balance</span>
                <span className="text-primary-text font-semibold">
                  ${selectedCard.current_balance.toLocaleString()}
                </span>
              </div>
              {selectedCard.credit_limit && (
                <>
                  <div className="flex justify-between">
                    <span className="text-secondary-text">Credit Limit</span>
                    <span className="text-primary-text font-semibold">
                      ${selectedCard.credit_limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary-text">Available</span>
                    <span className="text-success font-semibold">
                      $
                      {(
                        selectedCard.credit_limit - selectedCard.current_balance
                      ).toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-secondary-text">
            <CreditCardIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Select a card to view details</p>
          </div>
        )}
      </div>

      {/* Spending Limits Section */}
      {spendingLimit && (
        <div>
          <h3 className="text-lg font-semibold text-primary-text mb-4">
            Spending Limits
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-secondary-text uppercase tracking-wide">
                  Daily Transaction Limit
                </span>
                <span className="text-sm text-primary-text">
                  {Math.round(
                    (spendingLimit.currentSpending /
                      spendingLimit.monthly_limit) *
                      100
                  )}
                  %
                </span>
              </div>

              <ProgressBar
                value={spendingLimit.currentSpending}
                max={spendingLimit.monthly_limit}
                showPercentage={false}
                size="md"
                className="mb-2"
              />

              <p className="text-sm text-primary-text">
                <span className="font-semibold">
                  ${spendingLimit.currentSpending.toLocaleString()}
                </span>
                <span className="text-secondary-text"> spent of </span>
                <span className="font-semibold">
                  ${spendingLimit.monthly_limit.toLocaleString()}
                </span>
              </p>
            </div>

            {/* Additional limits */}
            {spendingLimit.daily_limit && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-secondary-text uppercase tracking-wide">
                    Daily Limit
                  </span>
                </div>
                <p className="text-sm text-primary-text">
                  <span className="font-semibold">
                    ${spendingLimit.daily_limit.toLocaleString()}
                  </span>
                  <span className="text-secondary-text"> per day</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold text-primary-text mb-4">
          Quick Actions
        </h3>
        <div className="space-y-3">
          <button className="w-full p-3 bg-primary-green/10 border border-primary-green/20 rounded-lg text-primary-green hover:bg-primary-green/20 transition-colors text-left">
            <div className="font-medium">Add Transaction</div>
            <div className="text-sm opacity-75">Record a new expense</div>
          </button>

          <button className="w-full p-3 bg-hover-bg border border-muted-text/20 rounded-lg text-primary-text hover:bg-muted-text/10 transition-colors text-left">
            <div className="font-medium">View Statements</div>
            <div className="text-sm text-secondary-text">
              Download or view bills
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
