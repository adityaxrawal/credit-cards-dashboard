import React from "react";
import { Plus } from "lucide-react";
import { cn, getCardGradient } from "@/lib/utils";
import { CardVisual } from "@/components/ui";
import type { CreditCard } from "@/types";

export interface CardsPreviewProps {
  cards: CreditCard[];
  onCardClick?: (card: CreditCard) => void;
  onAddCard?: () => void;
  className?: string;
}

export function CardsPreview({
  cards,
  onCardClick,
  onAddCard,
  className,
}: CardsPreviewProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-primary-text">Your Cards</h3>
        <button
          onClick={onAddCard}
          className="text-sm text-primary-green hover:text-primary-green/80 transition-colors"
        >
          View All
        </button>
      </div>

      <div className="flex space-x-4 overflow-x-auto pb-2">
        {/* Existing Cards */}
        {cards.map((card) => (
          <div
            key={card.id}
            className="flex-shrink-0 cursor-pointer transition-transform hover:scale-105"
            onClick={() => onCardClick?.(card)}
          >
            <CardVisual
              cardName={card.card_name}
              cardNumber={card.card_number_last4}
              gradient={getCardGradient(
                card.card_name || card.bank_name || "default"
              )}
              className="w-72"
            />
            <div className="mt-2 text-sm text-center">
              <p className="font-medium text-primary-text">{card.card_name}</p>
              <p className="text-secondary-text">{card.bank_name}</p>
            </div>
          </div>
        ))}

        {/* Add Card Button */}
        <div className="flex-shrink-0 cursor-pointer" onClick={onAddCard}>
          <div className="w-72 aspect-[16/10] border-2 border-dashed border-muted-text/30 rounded-xl flex flex-col items-center justify-center text-muted-text hover:border-primary-green hover:text-primary-green transition-colors">
            <Plus className="w-8 h-8 mb-2" />
            <span className="font-medium">Add Card</span>
          </div>
          <div className="mt-2 text-sm text-center">
            <p className="font-medium text-secondary-text">New Card</p>
          </div>
        </div>
      </div>
    </div>
  );
}
