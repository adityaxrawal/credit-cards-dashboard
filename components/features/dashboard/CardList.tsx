"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, MoreHorizontal, ChevronDown, CreditCard as CreditCardIcon } from 'lucide-react';
import CreditCard from '@/components/shared/data-display/CreditCard';
import EmptyState from '@/components/shared/feedback/EmptyState';
import { getSampleDashboardSummary } from '@/lib/sampleData';

interface Card {
  id: string;
  bank_name: string;
  card_last_4: string;
  card_holder_name: string;
  card_type: string;
}

interface CardListProps {
  cards: Card[];
  onAddCard?: () => void;
  onCardClick?: (cardId: string) => void;
}

const CardList: React.FC<CardListProps> = ({
  cards,
  onAddCard,
  onCardClick,
}) => {
  const dashboardSummary = getSampleDashboardSummary();

  // Get due information for each card
  const getCardDueInfo = (cardId: string) => {
    const dueInfo = dashboardSummary.upcomingDueDates.find(due => due.card_id === cardId);
    return dueInfo ? {
      currentDue: dueInfo.due_amount,
      dueDate: new Date(dueInfo.due_date)
    } : undefined;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="glass-card rounded-2xl p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-semibold text-white">Cards</h2>
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-xs font-medium text-white">{cards.length}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="text-white/60 hover:text-white transition-colors">
            <ChevronDown size={20} />
          </button>
          <button className="text-white/60 hover:text-white transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      {cards.length === 0 ? (
        <EmptyState
          icon={CreditCardIcon}
          title="No Cards Added"
          description="Add your first credit card to start tracking your spending and rewards."
          actionLabel="Add Your First Card"
          onAction={onAddCard}
          size="md"
          className="my-8"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-3 lg:gap-4 mb-4">
          {cards.map((card, index) => {
            const dueInfo = getCardDueInfo(card.id);
            
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <CreditCard
                  card={{
                    ...card,
                    credit_limit: 500000, // Default values for display
                    available_credit: 325000,
                    reward_points: 12450,
                  }}
                  currentDue={dueInfo?.currentDue}
                  dueDate={dueInfo?.dueDate}
                  onClick={() => onCardClick?.(card.id)}
                  className="h-44 lg:h-48 xl:h-52"
                  variant="compact"
                  showRewards={true}
                />
              </motion.div>
            );
          })}

          {/* Add Card Button */}
          <motion.button
            onClick={onAddCard}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="
              h-44 lg:h-48 xl:h-52 rounded-2xl border-2 border-dashed border-white/20
              flex flex-col items-center justify-center
              text-white/60 hover:text-white hover:border-white/40
              transition-all duration-200 group
            "
          >
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-white/5 group-hover:bg-white/10 flex items-center justify-center mb-3 transition-colors">
              <Plus size={20} className="lg:w-6 lg:h-6" />
            </div>
            <span className="font-medium text-sm lg:text-base">Add Card</span>
          </motion.button>
        </div>
      )}
    </motion.div>
  );
};

export default CardList;