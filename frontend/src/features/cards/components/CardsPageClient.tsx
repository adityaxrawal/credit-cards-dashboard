"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter } from "lucide-react";
import { Button, Input, Modal } from "@/shared/components/ui";
import { useToast } from "@/shared/utils/toast";
import { cardApi, type Card, type CardFormData } from "@/features/cards/api";
import { AssetCard } from "@/shared/components/ui/AssetCard";

export default function CardsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();

  const [searchValue, setSearchValue] = React.useState("");
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [selectedCard, setSelectedCard] = React.useState<Card | null>(null);

  // Fetch cards
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
    // In new structure, maybe open a details modal or go to transactions filtered by card
    router.push(`/operations/transactions?cardId=${card.id}`);
  };

  const handleEditCard = (e: React.MouseEvent, card: Card) => {
    // Logic to open edit modal
    setSelectedCard(card);
    setIsAddModalOpen(true);
  };

  const handleDeleteCard = (e: React.MouseEvent, card: Card) => {
    if (confirm(`Are you sure you want to delete ${card.card_name}?`)) {
        deleteCardMutation.mutate(card.id);
    }
  };

  // Maps bank name to color theme for AssetCard
  const getBankTheme = (bankName: string = "") => {
    const lower = bankName.toLowerCase();
    if (lower.includes('hdfc')) return 'blue';
    if (lower.includes('sbi')) return 'blue';
    if (lower.includes('axis')) return 'purple';
    if (lower.includes('icici')) return 'orange';
    if (lower.includes('amex') || lower.includes('american')) return 'black';
    return 'slate';
  };

  const handleSubmitCard = (data: CardFormData) => {
    if (selectedCard) {
      updateCardMutation.mutate({ id: selectedCard.id, data });
    } else {
      createCardMutation.mutate(data);
    }
  };


  if (isLoading) return <div className="p-12 text-center text-muted-text">Loading cards...</div>;

  return (
    <div className="space-y-6">
      {/* Search and Add */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-text" />
            <Input
              placeholder="Search cards..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => { setSelectedCard(null); setIsAddModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Card
          </Button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCards.map((card) => (
              <AssetCard
                  key={card.id}
                  type="credit"
                  name={card.card_name}
                  balance={card.current_balance}
                  provider={card.bank_name}
                  accountNumber={card.card_number_last4}
                  colorTheme={getBankTheme(card.bank_name) as any}
                  onClick={() => handleCardClick(card)}
                  onMenuClick={(e) => {
                      // Simple prompt for now, or implement a real dropdown
                      const action = prompt("Type 'edit' to edit or 'delete' to delete:");
                      if (action === 'edit') handleEditCard(e, card);
                      if (action === 'delete') handleDeleteCard(e, card);
                  }}
              />
          ))}

          {/* Add New Card Slot */}
            <div 
                onClick={() => setIsAddModalOpen(true)}
                className="rounded-xl border-2 border-dashed border-muted-text/20 flex flex-col items-center justify-center min-h-[180px] cursor-pointer hover:border-primary-green/50 hover:bg-primary-green/5 transition-all text-muted-text hover:text-primary-green"
            >
                <Plus className="w-8 h-8 mb-2" />
                <span className="font-medium">Add New Card</span>
            </div>
      </div>

       {/* Add/Edit Card Modal - Simplified implementation reuse from previous or create new */}
       {isAddModalOpen && (
           <AddCardModal 
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                card={selectedCard}
                onSubmit={handleSubmitCard}
                isSubmitting={createCardMutation.isPending || updateCardMutation.isPending}
           />
       )}
    </div>
  );
}

// Inline Modal Component for simplicity here
interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card?: Card | null;
  onSubmit: (data: CardFormData) => void;
  isSubmitting: boolean;
}

function AddCardModal({
  isOpen,
  onClose,
  card,
  onSubmit,
  isSubmitting,
}: AddCardModalProps) {
    const [formData, setFormData] = React.useState<CardFormData>({
        cardName: card?.card_name || "",
        bankName: card?.bank_name || "",
        lastFour: card?.card_number_last4 || "",
        billDate: card?.bill_date || 1,
        dueDate: card?.due_date || 5,
        creditLimit: card?.credit_limit || 0,
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={card ? "Edit Card" : "Add Card"}>
            <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-4">
                 <Input label="Card Name" required value={formData.cardName} onChange={e => setFormData({...formData, cardName: e.target.value})} />
                 <Input label="Bank Name" required value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} />
                 <Input label="Last 4 Digits" maxLength={4} required value={formData.lastFour} onChange={e => setFormData({...formData, lastFour: e.target.value})} />
                 <Input label="Limit" type="number" required value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: Number(e.target.value)})} />
                 
                 <div className="flex gap-2 justify-end pt-4">
                     <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                     <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</Button>
                 </div>
            </form>
        </Modal>
    );
}

