'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../../../../components/layout/AppLayout';
import { instrumentApi } from '../../../../lib/api/instruments';
import { InstrumentCard as InstrumentCardType, Bank } from '../../../../types/instruments';
import { Badge } from '../../../../components/ui/primitives/Badge';
import { CreditCard, Wallet, ChevronRight, Building2 } from 'lucide-react';

export default function InstrumentsPage() {
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Fetch instruments hierarchy
  const { data: banks = [], isLoading } = useQuery<Bank[]>({
    queryKey: ['instruments-hierarchy'],
    queryFn: () => instrumentApi.getHierarchy()
  });

  const selectedBank = banks.find(b => b.id === selectedBankId) || banks[0];
  const selectedAccount = selectedBank?.accounts.find(a => a.id === selectedAccountId) || selectedBank?.accounts[0];

  if (isLoading) {
    return (
      <AppLayout title="Instruments" showRightSidebar={false}>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading instruments...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Instruments" showRightSidebar={false}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Banks List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Banks & Institutions</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {banks.map((bank) => (
              <button
                key={bank.id}
                onClick={() => {
                  setSelectedBankId(bank.id);
                  setSelectedAccountId(null);
                }}
                className={`w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left flex items-center justify-between ${
                  selectedBank?.id === bank.id ? 'bg-green-50 dark:bg-green-900/10 border-l-4 border-green-500' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{bank.name}</p>
                    <p className="text-xs text-gray-500">{bank.accounts?.length || 0} accounts</p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${
                  selectedBank?.id === bank.id ? 'rotate-90' : ''
                }`} />
              </button>
            ))}
          </div>
        </div>

        {/* Middle: Accounts List */}
        {selectedBank && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedBank.name}</h3>
              <p className="text-sm text-gray-500 mt-1">Accounts</p>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {selectedBank.accounts?.map((account) => (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccountId(account.id)}
                  className={`w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left ${
                    selectedAccountId === account.id || (!selectedAccountId && selectedBank.accounts[0].id === account.id) ? 'bg-green-50 dark:bg-green-900/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{account.name}</p>
                      <p className="text-xs text-gray-500">{account.accountNumberMasked}</p>
                    </div>
                    <Badge variant="secondary">{account.type}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{account.cards?.length || 0} cards</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Right: Cards for Selected Account */}
        {selectedAccount && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 px-1">Cards</h3>
            {selectedAccount.cards?.map((card) => (
              <InstrumentCardDisplay key={card.id} card={card} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// Sub-component: Card Display
function InstrumentCardDisplay({ card }: { card: InstrumentCardType }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{card.name}</p>
            <p className="text-xs text-gray-500">•••• {card.cardNumberLast4}</p>
          </div>
        </div>
        <Badge variant={card.isActive ? 'success' : 'secondary'}>
          {card.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Utilization Bar */}
      {card.utilization !== undefined && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500">Utilization</span>
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">{Math.round(card.utilization)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                card.utilization > 80 ? 'bg-red-500' : card.utilization > 50 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${card.utilization}%` }}
            />
          </div>
        </div>
      )}

      {/* Balance Info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-500">Balance</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">${card.currentBalance.toFixed(2)}</p>
        </div>
        {card.nextDueDate && (
          <div>
            <p className="text-xs text-gray-500">Due Date</p>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {new Date(card.nextDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
