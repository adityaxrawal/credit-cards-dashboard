"use client";

import React, { useState } from "react";
import { Modal, Button, Badge } from "@/components/ui";
import { Merge, AlertTriangle, Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transactionApi, Transaction } from "@/lib/api/transactions";
import { useToast } from "@/components/ui/feedback/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

interface MergeTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTransactions: Transaction[];
  onSuccess: () => void;
}

export function MergeTransactionsModal({
  isOpen,
  onClose,
  selectedTransactions,
  onSuccess,
}: MergeTransactionsModalProps) {
  const [masterTransactionId, setMasterTransactionId] = useState<string | null>(
    selectedTransactions[0]?.id || null
  );
  const queryClient = useQueryClient();
  const { success, error: errorToast } = useToast();

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!masterTransactionId) throw new Error("No master transaction selected");
      
      const duplicateIds = selectedTransactions
        .filter((t) => t.id !== masterTransactionId)
        .map((t) => t.id);

      // Merge each duplicate into master one by one
      for (const duplicateId of duplicateIds) {
        await transactionApi.merge(masterTransactionId, duplicateId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      success("Transactions merged successfully!");
      onSuccess();
      onClose();
    },
    onError: (err) => {
      errorToast(`Failed to merge: ${err instanceof Error ? err.message : "Unknown error"}`);
    },
  });

  if (selectedTransactions.length < 2) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Merge Transactions">
        <div className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
          <p className="text-secondary-text">
            Please select at least 2 transactions to merge.
          </p>
          <Button onClick={onClose} className="mt-4">
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Merge Duplicate Transactions" size="lg">
      <div className="p-6 space-y-6">
        {/* Warning */}
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-warning">This action is permanent</p>
            <p className="text-sm text-secondary-text mt-1">
              The selected duplicates will be deleted, and only the master transaction will remain.
            </p>
          </div>
        </div>

        {/* Transaction List */}
        <div>
          <h4 className="text-sm font-semibold text-secondary-text mb-3">
            Select the transaction to keep (Master):
          </h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {selectedTransactions.map((tx) => (
              <button
                key={tx.id}
                onClick={() => setMasterTransactionId(tx.id)}
                className={`w-full p-4 rounded-xl border text-left transition-all ${
                  masterTransactionId === tx.id
                    ? "border-primary-green bg-primary-green/5 ring-2 ring-primary-green/30"
                    : "border-border bg-hover-bg hover:border-primary-green/50"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{tx.merchant || "Unknown Merchant"}</p>
                    <p className="text-sm text-secondary-text">
                      {formatDate(tx.transaction_date, "long")}
                    </p>
                    {tx.category && (
                      <Badge variant="secondary" className="mt-1">
                        {tx.category}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">
                      {formatCurrency(tx.amount)}
                    </p>
                    {masterTransactionId === tx.id && (
                      <div className="flex items-center gap-1 text-primary-green text-xs mt-1">
                        <Check className="w-3 h-3" />
                        Master
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mergeMutation.mutate()}
            disabled={!masterTransactionId || mergeMutation.isPending}
            className="gap-2"
          >
            {mergeMutation.isPending ? (
              "Merging..."
            ) : (
              <>
                <Merge className="w-4 h-4" />
                Merge {selectedTransactions.length - 1} into Master
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
