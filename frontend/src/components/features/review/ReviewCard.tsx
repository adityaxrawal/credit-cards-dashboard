'use client';

import React, { useState } from 'react';
import { Check, X, SkipForward, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { Button, Card, Input, Label } from '@/components/ui';

interface ReviewItem {
  id: string;
  emailSubject: string;
  emailSnippet: string;
  emailSender: string;
  suggestedType: string | null;
  suggestedMerchant: string | null;
  suggestedAmount: number | null;
  reviewReason: string;
  createdAt: string;
}

interface ReviewCardProps {
  item: ReviewItem;
  onApprove: (id: string, data: any) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
}

export function ReviewCard({ item, onApprove, onReject, onSkip }: ReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  // Edit fields
  const [merchant, setMerchant] = useState(item.suggestedMerchant || '');
  const [amount, setAmount] = useState(item.suggestedAmount?.toString() || '');
  const [category, setCategory] = useState('');

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(item.id, {
        merchant: merchant || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        category: category || undefined,
        transactionType: item.suggestedType || 'debit',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setIsProcessing(true);
    try {
      await onReject(item.id, rejectReason);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = async () => {
    setIsProcessing(true);
    try {
      await onSkip(item.id);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 truncate">{item.emailSender}</span>
          </div>
          <h3 className="font-medium text-sm line-clamp-1">{item.emailSubject}</h3>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.emailSnippet}</p>
          
          {/* Review reason badge */}
          <div className="mt-2">
            <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
              {item.reviewReason}
            </span>
          </div>
        </div>

        {/* Suggested values */}
        {(item.suggestedMerchant || item.suggestedAmount) && (
          <div className="ml-4 text-right flex-shrink-0">
            {item.suggestedAmount && (
              <div className="text-lg font-semibold">
                ₹{item.suggestedAmount.toLocaleString()}
              </div>
            )}
            {item.suggestedMerchant && (
              <div className="text-sm text-gray-500">{item.suggestedMerchant}</div>
            )}
          </div>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs text-blue-500 mt-3 hover:text-blue-600"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="h-3 w-3" /> Less options
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3" /> Edit before approving
          </>
        )}
      </button>

      {/* Expanded edit section */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Merchant</Label>
              <Input
                value={merchant}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMerchant(e.target.value)}
                placeholder="Merchant name"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Amount</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Input
                value={category}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)}
                placeholder="Category"
                className="mt-1"
              />
            </div>
          </div>
        </div>
      )}

      {/* Reject reason input */}
      {showRejectInput && (
        <div className="mt-4 pt-4 border-t">
          <Label className="text-xs">Rejection reason</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={rejectReason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRejectReason(e.target.value)}
              placeholder="Why are you rejecting this?"
              className="flex-1"
            />
            <Button size="sm" variant="destructive" onClick={handleReject} disabled={isProcessing || !rejectReason.trim()}>
              Confirm
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowRejectInput(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!showRejectInput && (
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSkip}
            disabled={isProcessing}
          >
            <SkipForward className="h-4 w-4 mr-1" />
            Skip
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRejectInput(true)}
            disabled={isProcessing}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4 mr-1" />
            Approve
          </Button>
        </div>
      )}
    </Card>
  );
}
