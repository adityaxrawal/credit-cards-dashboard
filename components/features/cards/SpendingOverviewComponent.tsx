import React from 'react';

interface SpendingCategory {
  name: string;
  amount: number;
  percentage: number;
}

interface CardSpendingData {
  categories: SpendingCategory[];
  totalSpent: number;
  monthlyLimit: number;
}

interface SpendingOverviewComponentProps {
  spendingData: CardSpendingData;
  formatCurrency: (amount: number) => string;
}

const SpendingOverviewComponent: React.FC<SpendingOverviewComponentProps> = ({
  spendingData,
  formatCurrency,
}) => {
  return (
    <div className="bg-card-bg rounded-xl p-6 border border-border-primary">
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        Monthly Spending
      </h3>
      <div className="space-y-4">
        {spendingData.categories.map(
          (category: SpendingCategory, index: number) => (
            <div
              key={index}
              className="flex justify-between items-center"
            >
              <span className="text-text-secondary">
                {category.name}
              </span>
              <div className="text-right">
                <div className="text-text-primary font-medium">
                  {formatCurrency(category.amount)}
                </div>
                <div className="text-xs text-text-secondary">
                  {category.percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default SpendingOverviewComponent;