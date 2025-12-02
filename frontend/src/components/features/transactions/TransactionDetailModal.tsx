"use client";

import React from "react";
import { ExternalLink, Calendar, CreditCard, Building2, Hash, Globe, Clock } from "lucide-react";
import { Modal, Button, Badge } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Transaction } from "@/lib/api/transactions";

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

export function TransactionDetailModal({
  isOpen,
  onClose,
  transaction,
}: TransactionDetailModalProps) {
  if (!transaction) return null;

  const gmailLink = transaction.gmail_message_id
    ? `https://mail.google.com/mail/u/0/#all/${transaction.gmail_message_id}`
    : undefined;

  const gmailThreadLink = transaction.gmail_thread_id
    ? `https://mail.google.com/mail/u/0/#all/${transaction.gmail_thread_id}`
    : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transaction Details">
      <div className="space-y-6">
        {/* Amount & Date Section */}
        <div className="bg-hover-bg rounded-lg p-4">
          <div className="text-center">
            <div className="text-3xl font-bold mb-2">
              <span
                className={
                  transaction.transaction_type === "debit"
                    ? "text-error"
                    : "text-success"
                }
              >
                {transaction.transaction_type === "debit" ? "-" : "+"}
                {formatCurrency(Math.abs(transaction.amount))}
              </span>
            </div>
            
            {/* Original Amount for International Transactions */}
            {transaction.original_amount && transaction.currency_code && transaction.currency_code !== "INR" && (
              <div className="text-sm text-secondary-text mb-2">
                Original: {transaction.currency_code} {transaction.original_amount.toFixed(2)}
              </div>
            )}
            
            <div className="flex items-center justify-center gap-2 text-secondary-text">
              <Calendar className="w-4 h-4" />
              <span>
                {transaction.exact_timestamp
                  ? new Date(transaction.exact_timestamp).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : formatDate(transaction.transaction_date, "long")}
              </span>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="space-y-4">
          {/* Merchant */}
          <DetailRow label="Merchant" icon={<Building2 className="w-4 h-4" />}>
            <span className="font-medium">{transaction.merchant}</span>
          </DetailRow>

          {/* Card */}
          <DetailRow label="Card" icon={<CreditCard className="w-4 h-4" />}>
            <div className="flex items-center gap-2">
              <span>{transaction.card?.card_name || "Unknown"}</span>
              {transaction.card?.last_four && (
                <Badge label={`•••• ${transaction.card.last_four}`} variant="default" size="sm" />
              )}
            </div>
          </DetailRow>

          {/* Bank */}
          <DetailRow label="Bank" icon={<Building2 className="w-4 h-4" />}>
            <span>{transaction.card?.bank_name || "Unknown"}</span>
          </DetailRow>

          {/* Category */}
          <DetailRow label="Category">
            <Badge
              label={transaction.category || "Uncategorized"}
              variant="info"
              size="sm"
            />
          </DetailRow>

          {/* Transaction Type */}
          <DetailRow label="Type">
            <Badge
              label={transaction.transaction_type.toUpperCase()}
              variant={
                transaction.transaction_type === "credit" ? "success" : "warning"
              }
              size="sm"
            />
          </DetailRow>

          {/* Reference Number */}
          {transaction.reference_number && (
            <DetailRow label="Reference Number" icon={<Hash className="w-4 h-4" />}>
              <code className="bg-hover-bg px-2 py-1 rounded text-sm">
                {transaction.reference_number}
              </code>
            </DetailRow>
          )}

          {/* Currency for International Transactions */}
          {transaction.currency_code && transaction.currency_code !== "INR" && (
            <DetailRow label="Currency" icon={<Globe className="w-4 h-4" />}>
              <Badge label={transaction.currency_code} variant="info" size="sm" />
            </DetailRow>
          )}

          {/* Exact Timestamp */}
          {transaction.exact_timestamp && (
            <DetailRow label="Exact Time" icon={<Clock className="w-4 h-4" />}>
              <span className="text-sm">
                {new Date(transaction.exact_timestamp).toLocaleString("en-IN", {
                  dateStyle: "long",
                  timeStyle: "medium",
                })}
              </span>
            </DetailRow>
          )}

          {/* Email Subject */}
          {transaction.email_subject && (
            <DetailRow label="Email Subject">
              <span className="text-sm text-secondary-text">
                {transaction.email_subject}
              </span>
            </DetailRow>
          )}

          {/* Description */}
          {transaction.description && (
            <DetailRow label="Description">
              <p className="text-sm text-secondary-text">
                {transaction.description}
              </p>
            </DetailRow>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          {gmailLink && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(gmailLink, "_blank")}
              className="flex-1"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Original Email
            </Button>
          )}
          {gmailThreadLink && !gmailLink && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(gmailThreadLink, "_blank")}
              className="flex-1"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Email Thread
            </Button>
          )}
          <Button variant="primary" onClick={onClose} className="flex-1">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Helper component for detail rows
function DetailRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-start gap-4">
      <div className="flex items-center gap-2 text-secondary-text min-w-[120px]">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-right flex-1">{children}</div>
    </div>
  );
}
