"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, Search, Filter } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button, Input, CardVisual, Modal, Badge } from "@/components/ui";
import {
  cn,
  getCardGradient,
  formatCurrency,
  calculateUtilization,
} from "@/lib/utils";
import type { CreditCard } from "@/types";

// Mock data
const mockCards: CreditCard[] = [
  {
    id: "1",
    card_name: "Shipping Card",
    bank_name: "Chase Bank",
    card_number_last4: "3040",
    bill_date: 15,
    due_date: 5,
    credit_limit: 10000,
    current_balance: 2500,
    is_active: true,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  {
    id: "2",
    card_name: "Transfer Card",
    bank_name: "Wells Fargo",
    card_number_last4: "4080",
    bill_date: 20,
    due_date: 10,
    credit_limit: 15000,
    current_balance: 3200,
    is_active: true,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  {
    id: "3",
    card_name: "Cashback Card",
    bank_name: "Bank of America",
    card_number_last4: "9876",
    bill_date: 28,
    due_date: 18,
    credit_limit: 5000,
    current_balance: 1200,
    is_active: true,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
];

export default function CardsPage() {
  const router = useRouter();
  const [searchValue, setSearchValue] = React.useState("");
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [selectedCard, setSelectedCard] = React.useState<CreditCard | null>(
    null
  );

  const filteredCards = mockCards.filter(
    (card) =>
      card.card_name.toLowerCase().includes(searchValue.toLowerCase()) ||
      card.bank_name?.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleCardClick = (card: CreditCard) => {
    router.push(`/cards/${card.id}`);
  };

  const handleEditCard = (e: React.MouseEvent, card: CreditCard) => {
    e.stopPropagation();
    setSelectedCard(card);
    setIsAddModalOpen(true);
  };

  const handleDeleteCard = (e: React.MouseEvent, card: CreditCard) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete ${card.card_name}?`)) {
      console.log("Delete card:", card.id);
    }
  };

  const handleViewTransactions = (e: React.MouseEvent, card: CreditCard) => {
    e.stopPropagation();
    router.push(`/transactions?card_id=${card.id}`);
  };

  return (
    <AppLayout title="Cards" showRightSidebar={false}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-text" />
              <Input
                placeholder="Search cards..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Card
            </Button>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCards.map((card, index) => (
            <CardItem
              key={card.id}
              card={card}
              gradient={getCardGradient(index)}
              onClick={() => handleCardClick(card)}
              onEdit={(e) => handleEditCard(e, card)}
              onDelete={(e) => handleDeleteCard(e, card)}
              onViewTransactions={(e) => handleViewTransactions(e, card)}
            />
          ))}

          {/* Add Card Button */}
          <div
            className="aspect-[16/10] border-2 border-dashed border-muted-text/30 rounded-xl flex flex-col items-center justify-center text-muted-text hover:border-primary-green hover:text-primary-green transition-colors cursor-pointer"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="w-8 h-8 mb-2" />
            <span className="font-medium">Add New Card</span>
          </div>
        </div>

        {/* Empty State */}
        {filteredCards.length === 0 && searchValue && (
          <div className="text-center py-12">
            <p className="text-secondary-text">
              No cards found matching &quot;{searchValue}&quot;
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Card Modal */}
      <AddCardModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedCard(null);
        }}
        card={selectedCard}
      />
    </AppLayout>
  );
}

interface CardItemProps {
  card: CreditCard;
  gradient: string;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onViewTransactions: (e: React.MouseEvent) => void;
}

function CardItem({
  card,
  gradient,
  onClick,
  onEdit,
  onDelete,
  onViewTransactions,
}: CardItemProps) {
  const utilization = card.credit_limit
    ? calculateUtilization(card.current_balance, card.credit_limit)
    : 0;

  return (
    <div
      className="bg-card-bg rounded-xl p-6 card-shadow hover:shadow-lg transition-all cursor-pointer group"
      onClick={onClick}
    >
      {/* Card Visual */}
      <div className="mb-4">
        <CardVisual
          cardName={card.card_name}
          cardNumber={card.card_number_last4}
          gradient={gradient}
          className="w-full"
        />
      </div>

      {/* Card Info */}
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold text-primary-text">{card.card_name}</h3>
          <p className="text-sm text-secondary-text">{card.bank_name}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-secondary-text">Balance</p>
            <p className="font-semibold text-primary-text">
              {formatCurrency(card.current_balance)}
            </p>
          </div>
          {card.credit_limit && (
            <div>
              <p className="text-secondary-text">Limit</p>
              <p className="font-semibold text-primary-text">
                {formatCurrency(card.credit_limit)}
              </p>
            </div>
          )}
        </div>

        {card.credit_limit && (
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-secondary-text">Utilization</span>
              <span className="text-primary-text">{utilization}%</span>
            </div>
            <div className="w-full bg-primary-bg rounded-full h-2">
              <div
                className={cn(
                  "h-2 rounded-full transition-all",
                  utilization > 80
                    ? "bg-error"
                    : utilization > 50
                      ? "bg-warning"
                      : "bg-success"
                )}
                style={{ width: `${Math.min(utilization, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-secondary-text">Bill Date</p>
            <p className="text-primary-text">{card.bill_date}th</p>
          </div>
          <div>
            <p className="text-secondary-text">Due Date</p>
            <p className="text-primary-text">{card.due_date}th</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-muted-text/10">
          <Badge
            label={card.is_active ? "Active" : "Inactive"}
            variant={card.is_active ? "success" : "default"}
            size="sm"
          />

          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="p-1.5 text-secondary-text hover:text-primary-text transition-colors"
              title="Edit card"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-secondary-text hover:text-error transition-colors"
              title="Delete card"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onViewTransactions}>
            Transactions
          </Button>
          <Button variant="primary" size="sm" onClick={onClick}>
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card?: CreditCard | null;
}

function AddCardModal({ isOpen, onClose, card }: AddCardModalProps) {
  const [formData, setFormData] = React.useState({
    card_name: "",
    bank_name: "",
    card_number_last4: "",
    bill_date: "",
    due_date: "",
    credit_limit: "",
  });

  React.useEffect(() => {
    if (card) {
      setFormData({
        card_name: card.card_name,
        bank_name: card.bank_name || "",
        card_number_last4: card.card_number_last4,
        bill_date: card.bill_date.toString(),
        due_date: card.due_date.toString(),
        credit_limit: card.credit_limit?.toString() || "",
      });
    } else {
      setFormData({
        card_name: "",
        bank_name: "",
        card_number_last4: "",
        bill_date: "",
        due_date: "",
        credit_limit: "",
      });
    }
  }, [card, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form data:", formData);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={card ? "Edit Card" : "Add New Card"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Card Name"
          required
          value={formData.card_name}
          onChange={(e) =>
            setFormData({ ...formData, card_name: e.target.value })
          }
          placeholder="e.g., Primary Credit Card"
        />

        <Input
          label="Bank Name"
          value={formData.bank_name}
          onChange={(e) =>
            setFormData({ ...formData, bank_name: e.target.value })
          }
          placeholder="e.g., Chase Bank"
        />

        <Input
          label="Last 4 Digits"
          required
          value={formData.card_number_last4}
          onChange={(e) =>
            setFormData({ ...formData, card_number_last4: e.target.value })
          }
          placeholder="e.g., 1234"
          maxLength={4}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Bill Date"
            type="number"
            required
            value={formData.bill_date}
            onChange={(e) =>
              setFormData({ ...formData, bill_date: e.target.value })
            }
            placeholder="15"
            min="1"
            max="31"
          />

          <Input
            label="Due Date"
            type="number"
            required
            value={formData.due_date}
            onChange={(e) =>
              setFormData({ ...formData, due_date: e.target.value })
            }
            placeholder="5"
            min="1"
            max="31"
          />
        </div>

        <Input
          label="Credit Limit (Optional)"
          type="number"
          value={formData.credit_limit}
          onChange={(e) =>
            setFormData({ ...formData, credit_limit: e.target.value })
          }
          placeholder="10000"
        />

        <div className="flex gap-4 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            {card ? "Update" : "Add"} Card
          </Button>
        </div>
      </form>
    </Modal>
  );
}
