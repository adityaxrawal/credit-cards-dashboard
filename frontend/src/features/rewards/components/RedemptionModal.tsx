"use client";

import React, { useState } from "react";
import { Modal } from "@/shared/components/ui/primitives/Modal";
import { Button } from "@/shared/components/ui/primitives/Button";
import { Input } from "@/shared/components/ui/primitives/Input";
import { Gift, CreditCard, Plane, Check } from "lucide-react";
import { formatCurrency, cn } from "@/shared/utils";

interface RedemptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  availablePoints: number;
  onRedeem: (option: string, points: number) => void;
}

export function RedemptionModal({
  isOpen,
  onClose,
  availablePoints,
  onRedeem,
}: RedemptionModalProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState(false);

  const redemptionOptions = [
    {
      id: "cashback",
      title: "Cashback",
      description: "Convert points to statement credit",
      rate: 0.25, // 1 point = $0.25
      icon: CreditCard,
      color: "text-primary-green",
      bgColor: "bg-primary-green/10",
    },
    {
      id: "giftcard",
      title: "Gift Cards",
      description: "Redeem for popular store gift cards",
      rate: 0.30, // 1 point = $0.30
      icon: Gift,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      id: "travel",
      title: "Travel Miles",
      description: "Transfer to airline partners",
      rate: 1.0, // 1 point = 1 mile
      icon: Plane,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ];

  const handleRedeem = () => {
    if (selectedOption && amount) {
      onRedeem(selectedOption, parseInt(amount));
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
        setSelectedOption(null);
        setAmount("");
      }, 2000);
    }
  };

  const selectedOptionData = redemptionOptions.find(o => o.id === selectedOption);
  const redemptionValue = selectedOptionData && amount ? parseInt(amount) * selectedOptionData.rate : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Redeem Rewards"
      size="lg"
    >
      {isSuccess ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-success" />
          </div>
          <h3 className="text-xl font-bold text-primary-text">Redemption Successful!</h3>
          <p className="text-secondary-text mt-2">Your request has been processed.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card-bg p-4 rounded-lg border border-muted-text/10">
            <p className="text-sm text-secondary-text">Available Points</p>
            <p className="text-2xl font-bold text-primary-text">{availablePoints.toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {redemptionOptions.map((option) => (
              <div
                key={option.id}
                className={cn(
                  "p-4 rounded-lg border cursor-pointer transition-all",
                  selectedOption === option.id
                    ? "border-primary-green bg-primary-green/5 ring-1 ring-primary-green"
                    : "border-muted-text/10 bg-card-bg hover:border-primary-green/50"
                )}
                onClick={() => setSelectedOption(option.id)}
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", option.bgColor)}>
                  <option.icon className={cn("w-5 h-5", option.color)} />
                </div>
                <h4 className="font-semibold text-primary-text">{option.title}</h4>
                <p className="text-xs text-secondary-text mt-1">{option.description}</p>
                <p className="text-xs font-medium text-primary-text mt-2">Rate: {option.rate}x</p>
              </div>
            ))}
          </div>

          {selectedOption && (
            <div className="space-y-4 pt-4 border-t border-muted-text/10">
              <div>
                <label className="block text-sm font-medium text-primary-text mb-1">
                  Points to Redeem
                </label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter points amount"
                  max={availablePoints}
                />
                <p className="text-xs text-secondary-text mt-1">
                  Max: {availablePoints} points
                </p>
              </div>

              <div className="bg-hover-bg p-4 rounded-lg flex justify-between items-center">
                <span className="text-sm text-secondary-text">Estimated Value</span>
                <span className="text-lg font-bold text-primary-text">
                  {selectedOption === "travel" 
                    ? `${redemptionValue.toLocaleString()} Miles` 
                    : formatCurrency(redemptionValue)
                  }
                </span>
              </div>

              <div className="flex justify-end space-x-3">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button 
                  onClick={handleRedeem}
                  disabled={!amount || parseInt(amount) > availablePoints || parseInt(amount) <= 0}
                >
                  Redeem Now
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
