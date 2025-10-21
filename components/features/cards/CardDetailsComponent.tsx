import React from 'react';
import { CreditCard as CreditCardIcon } from 'lucide-react';
import { CreditCard as CreditCardType } from '@/lib/sampleData';

interface CardDetailsComponentProps {
  card: CreditCardType;
  formatCurrency: (amount: number) => string;
}

const CardDetailsComponent: React.FC<CardDetailsComponentProps> = ({ 
  card, 
  formatCurrency 
}) => {
  return (
    <div className="glass-card from-card-bg to-card-bg/80 rounded-2xl p-8 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-primary-blue/10 rounded-lg">
          <CreditCardIcon className="w-5 h-5 text-primary-blue" />
        </div>
        <h3 className="text-xl font-bold text-text-primary">
          Card Details
        </h3>
      </div>

      <div className="space-y-6">
        <div className="group">
          <div className="flex justify-between items-center p-4 rounded-xl bg-primary-bg/50 hover:bg-primary-bg/70 transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-text-secondary font-medium">
                Available Credit
              </span>
            </div>
            <span className="text-text-primary font-bold text-lg">
              {formatCurrency(card.available_credit || 0)}
            </span>
          </div>
        </div>

        <div className="group">
          <div className="flex justify-between items-center p-4 rounded-xl bg-primary-bg/50 hover:bg-primary-bg/70 transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-text-secondary font-medium">
                Credit Limit
              </span>
            </div>
            <span className="text-text-primary font-bold text-lg">
              {formatCurrency(card.credit_limit || 0)}
            </span>
          </div>
        </div>

        <div className="group">
          <div className="flex justify-between items-center p-4 rounded-xl bg-primary-bg/50 hover:bg-primary-bg/70 transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span className="text-text-secondary font-medium">
                Used Credit
              </span>
            </div>
            <span className="text-text-primary font-bold text-lg">
              {formatCurrency(
                (card.credit_limit || 0) - (card.available_credit || 0)
              )}
            </span>
          </div>
        </div>

        <div className="group">
          <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-r from-primary-blue/10 to-purple-500/10 hover:from-primary-blue/20 hover:to-purple-500/20 transition-all duration-200 border border-primary-blue/20">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gradient-to-r from-primary-blue to-purple-500 rounded-full"></div>
              <span className="text-text-secondary font-medium">
                Reward Points
              </span>
            </div>
            <div className="text-right">
              <span className="text-text-primary font-bold text-lg">
                {card.reward_points?.toLocaleString() || 0}
              </span>
              <div className="text-xs text-primary-blue font-medium">
                Points
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CardDetailsComponent;