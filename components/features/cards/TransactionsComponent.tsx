import React from 'react';
import { CreditCard as CreditCardIcon } from 'lucide-react';
import { Transaction, getSampleTransactions } from '@/lib/sampleData';

interface TransactionsComponentProps {
  cardId?: string;
  formatCurrency: (amount: number) => string;
  formatDate: (dateString: string) => string;
}

const TransactionsComponent: React.FC<TransactionsComponentProps> = ({
  cardId,
  formatCurrency,
  formatDate,
}) => {
  // Get transactions filtered by cardId if provided, otherwise get all transactions
  const transactions = getSampleTransactions(cardId);
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Food & Dining":
        return <span className="text-lg">🍕</span>;
      case "Shopping":
        return <span className="text-lg">🛍️</span>;
      case "Transportation":
        return <span className="text-lg">🚗</span>;
      case "Entertainment":
        return <span className="text-lg">🎬</span>;
      case "Gas":
        return <span className="text-lg">⛽</span>;
      case "Groceries":
        return <span className="text-lg">🛒</span>;
      default:
        return <CreditCardIcon className="w-5 h-5 text-primary-blue" />;
    }
  };

  return (
    <div className="bg-gray-900/95 rounded-2xl p-6 shadow-2xl backdrop-blur-sm border border-gray-800">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gray-800 rounded-lg">
          <CreditCardIcon className="w-5 h-5 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-white">
          Card Transactions
        </h3>
      </div>

      <div className="space-y-3">
        {transactions.map((transaction: Transaction) => (
          <div
            key={transaction.id}
            className="group p-4 rounded-xl bg-gray-800/60 hover:bg-gray-800/80 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-700/50 rounded-lg group-hover:bg-gray-700/70 transition-colors duration-200">
                  {getCategoryIcon(transaction.category)}
                </div>
                <div>
                  <h4 className="font-semibold text-white group-hover:text-gray-100 transition-colors duration-200">
                    {transaction.description}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-400">
                      {transaction.category}
                    </span>
                    <div className="w-1 h-1 bg-gray-500 rounded-full"></div>
                    <span className="text-sm text-gray-400">
                      {formatDate(transaction.transaction_date)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div
                  className={`text-lg font-bold transition-colors duration-200 ${
                    transaction.amount > 0
                      ? "text-green-400 group-hover:text-green-300"
                      : "text-white group-hover:text-gray-100"
                  }`}
                >
                  {transaction.amount > 0 ? "+" : ""}
                  {formatCurrency(Math.abs(transaction.amount))}
                </div>
                <div className="text-xs text-gray-500 mt-1 font-medium">
                  {transaction.amount > 0 ? "Income" : "Expense"}
                </div>
              </div>
            </div>
          </div>
        ))}

        {transactions.length === 0 && (
          <div className="text-center py-12">
            <div className="p-4 bg-gray-800/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <CreditCardIcon className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400">
              No transactions found
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsComponent;