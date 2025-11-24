"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Search, Filter } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button, Input, CardVisual, Modal, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import {
  cn,
  getCardGradient,
  formatCurrency,
  calculateUtilization,
} from "@/lib/utils";
import { cardApi, type Card, type CardFormData } from "@/lib/api/cards";

export default function CardsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();

  const [searchValue, setSearchValue] = React.useState("");
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [selectedCard, setSelectedCard] = React.useState<Card | null>(null);

  // Fetch cards from API
  const {
    data: cards,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cards"],
    queryFn: () => cardApi.getCards(),
  });

  // Create card mutation
  const createCardMutation = useMutation({
    mutationFn: (data: CardFormData) => cardApi.createCard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      window.dispatchEvent(new CustomEvent("cards-updated"));
      success("Card added successfully");
      setIsAddModalOpen(false);
      setSelectedCard(null);
    },
    onError: (error: any) => {
      errorToast(error.response?.data?.message || "Failed to add card");
    },
  });

  // Update card mutation
  const updateCardMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CardFormData> }) =>
      cardApi.updateCard(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      window.dispatchEvent(new CustomEvent("cards-updated"));
      success("Card updated successfully");
      setIsAddModalOpen(false);
      setSelectedCard(null);
    },
    onError: (error: any) => {
      errorToast(error.response?.data?.message || "Failed to update card");
    },
  });

  // Delete card mutation
  const deleteCardMutation = useMutation({
    mutationFn: (cardId: string) => cardApi.deleteCard(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      window.dispatchEvent(new CustomEvent("cards-updated"));
      success("Card deleted successfully");
    },
    onError: (error: any) => {
      errorToast(error.response?.data?.message || "Failed to delete card");
    },
  });

  const filteredCards =
    cards?.filter(
      (card) =>
        card.card_name.toLowerCase().includes(searchValue.toLowerCase()) ||
        card.bank_name?.toLowerCase().includes(searchValue.toLowerCase())
    ) || [];

  const handleCardClick = (card: Card) => {
    router.push(`/cards/${card.id}`);
  };

  const handleEditCard = (e: React.MouseEvent, card: Card) => {
    e.stopPropagation();
    setSelectedCard(card);
    setIsAddModalOpen(true);
  };

  const handleDeleteCard = (e: React.MouseEvent, card: Card) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete ${card.card_name}?`)) {
      deleteCardMutation.mutate(card.id);
    }
  };

  const handleViewTransactions = (e: React.MouseEvent, card: Card) => {
    e.stopPropagation();
    router.push(`/transactions?card_id=${card.id}`);
  };

  const handleSubmitCard = (data: CardFormData) => {
    if (selectedCard) {
      updateCardMutation.mutate({ id: selectedCard.id, data });
    } else {
      createCardMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Cards" showRightSidebar={false}>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading cards...</div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Cards" showRightSidebar={false}>
        <div className="text-red-600">
          Error loading cards: {(error as Error).message}
        </div>
      </AppLayout>
    );
  }

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
        {filteredCards.length === 0 && !searchValue ? (
          <div className="text-center py-12">
            <p className="text-secondary-text mb-4">No cards added yet</p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Card
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCards.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                gradient={getCardGradient(
                  card.card_name || card.bank_name || "default"
                )}
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
        )}

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
        onSubmit={handleSubmitCard}
        isSubmitting={
          createCardMutation.isPending || updateCardMutation.isPending
        }
      />
    </AppLayout>
  );
}

interface CardItemProps {
  card: Card;
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
    ? calculateUtilization(card.current_outstanding, card.credit_limit)
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
          cardNumber={card.last_four_digits}
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
            <p className="text-secondary-text">Outstanding</p>
            <p className="font-semibold text-primary-text">
              {formatCurrency(card.current_outstanding)}
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
          <Badge label="Active" variant="success" size="sm" />

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
  card?: Card | null;
  onSubmit: (data: CardFormData) => void;
  isSubmitting: boolean;
}

const CARD_PRESETS = [
  { name: "SBI Cashback", bank: "SBI", billDate: 9, dueDate: 29 },
  { name: "HDFC Swiggy", bank: "HDFC", billDate: 13, dueDate: 2 },
  { name: "HDFC Tata Neu Plus", bank: "HDFC", billDate: 1, dueDate: 21 },
  { name: "Axis Ace", bank: "Axis", billDate: 15, dueDate: 5 },
  { name: "ICICI Amazon Pay", bank: "ICICI", billDate: 12, dueDate: 2 },
  { name: "Amex Platinum Travel", bank: "American Express", billDate: 18, dueDate: 8 },
];

function AddCardModal({
  isOpen,
  onClose,
  card,
  onSubmit,
  isSubmitting,
}: AddCardModalProps) {
  const [formData, setFormData] = React.useState<CardFormData>({
    card_name: "",
    bank_name: "",
    card_type: "credit",
    last_four_digits: "",
    bill_date: 1,
    due_date: 5,
    credit_limit: 0,
  });

  React.useEffect(() => {
    if (card) {
      setFormData({
        card_name: card.card_name,
        bank_name: card.bank_name,
        card_type: card.card_type,
        last_four_digits: card.last_four_digits,
        bill_date: card.bill_date,
        due_date: card.due_date,
        credit_limit: card.credit_limit,
      });
    } else {
      setFormData({
        card_name: "",
        bank_name: "",
        card_type: "credit",
        last_four_digits: "",
        bill_date: 1,
        due_date: 5,
        credit_limit: 0,
      });
    }
  }, [card, isOpen]);

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetName = e.target.value;
    if (!presetName) return;

    const preset = CARD_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setFormData((prev) => ({
        ...prev,
        card_name: preset.name,
        bank_name: preset.bank,
        bill_date: preset.billDate,
        due_date: preset.dueDate,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={card ? "Edit Card" : "Add New Card"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!card && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-secondary-text">
              Quick Fill (Optional)
            </label>
            <select
              className="w-full p-2 rounded-lg border border-border bg-input-bg text-primary-text focus:ring-2 focus:ring-primary-green focus:border-transparent outline-none transition-all"
              onChange={handlePresetChange}
              defaultValue=""
            >
              <option value="">Select a popular card...</option>
              {CARD_PRESETS.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>
        )}

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
          required
          value={formData.bank_name}
          onChange={(e) =>
            setFormData({ ...formData, bank_name: e.target.value })
          }
          placeholder="e.g., Chase Bank"
        />

        <Input
          label="Last 4 Digits"
          required
          value={formData.last_four_digits}
          onChange={(e) =>
            setFormData({ ...formData, last_four_digits: e.target.value })
          }
          placeholder="1234"
          maxLength={4}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Bill Date"
            type="number"
            required
            value={formData.bill_date.toString()}
            onChange={(e) =>
              setFormData({ ...formData, bill_date: parseInt(e.target.value) })
            }
            placeholder="15"
            min="1"
            max="31"
          />

          <Input
            label="Due Date"
            type="number"
            required
            value={formData.due_date.toString()}
            onChange={(e) =>
              setFormData({ ...formData, due_date: parseInt(e.target.value) })
            }
            placeholder="5"
            min="1"
            max="31"
          />
        </div>

        <Input
          label="Credit Limit"
          type="number"
          required
          value={formData.credit_limit.toString()}
          onChange={(e) =>
            setFormData({
              ...formData,
              credit_limit: parseFloat(e.target.value),
            })
          }
          placeholder="10000"
        />

        <div className="flex gap-4 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : card ? "Update" : "Add"} Card
          </Button>
        </div>
      </form>
    </Modal>
  );
}
