import React from 'react';
import { Transaction } from '@/lib/sampleData';

interface RecentActivityComponentProps {
  transactions: Transaction[];
  formatCurrency: (amount: number) => string;
  formatDate: (dateString: string) => string;
}

const RecentActivityComponent: React.FC<RecentActivityComponentProps> = ({
  transactions,
  formatCurrency,
  formatDate,
}) => {
  return (
    <div className="bg-gray-900/95 rounded-2xl p-6 shadow-2xl backdrop-blur-sm border border-gray-800">
      <h3 className="text-xl font-bold text-white mb-6">
        Recent Activity
      </h3>
      <div className="space-y-3">
        {transactions.slice(0, 5).map((transaction: Transaction) => (
          <div
            key={transaction.id}
            className="group flex justify-between items-center rounded-xl bg-gray-800/60 hover:bg-gray-800/80 border border-gray-700/50 hover:border-gray-600/50 p-4 transition-all duration-300"
          >
            <div>
              <div className="text-white font-semibold group-hover:text-gray-100 transition-colors duration-200">
                {transaction.description}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {formatDate(transaction.transaction_date)}
              </div>
            </div>
            <div
              className={`font-bold text-lg transition-colors duration-200 ${
                transaction.amount > 0 ? "text-green-400 group-hover:text-green-300" : "text-white group-hover:text-gray-100"
              }`}
            >
              {transaction.amount > 0 ? "+" : ""}
              {formatCurrency(Math.abs(transaction.amount))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivityComponent;