"use client";

import { useState } from "react";
import { Button } from "@/components/ui/primitives/Button";
import { X, CreditCard, Loader2 } from "lucide-react";
import { gmailApi } from "@/lib/api/gmail";

interface ManualCardMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  onSuccess: () => void;
}

export function ManualCardMappingModal({
  isOpen,
  onClose,
  messageId,
  onSuccess,
}: ManualCardMappingModalProps) {
  const [bankName, setBankName] = useState("");
  const [last4, setLast4] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await gmailApi.manualMap(messageId, { bankName, last4 });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to save mapping");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-card-bg rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6 pointer-events-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary-text flex items-center gap-2">
              <CreditCard size={24} />
              Map Card Manually
            </h2>
            <button
              onClick={onClose}
              className="text-secondary-text hover:text-primary-text transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <p className="text-sm text-secondary-text">
            We couldn&apos;t automatically detect the card for this transaction. 
            Please enter the card details found in the email.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-text mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HDFC, SBI, ICICI"
                className="w-full px-3 py-2 bg-hover-bg border border-border-color rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-primary-green"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-text mb-1">
                Last 4 Digits
              </label>
              <input
                type="text"
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="1234"
                className="w-full px-3 py-2 bg-hover-bg border border-border-color rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-primary-green"
                required
                pattern="\d{4}"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 p-2 rounded">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" onClick={onClose} variant="ghost">
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mapping...
                  </>
                ) : (
                  "Save & Retry"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
