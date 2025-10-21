import React from 'react';
import { FileText, Eye } from 'lucide-react';
import { Statement } from '@/lib/sampleData';

interface StatementsComponentProps {
  statements: Statement[];
  formatCurrency: (amount: number) => string;
  formatDate: (dateString: string) => string;
}

const StatementsComponent: React.FC<StatementsComponentProps> = ({
  statements,
  formatCurrency,
  formatDate,
}) => {
  return (
    <div className="bg-gray-900/95 rounded-2xl p-6 shadow-2xl backdrop-blur-sm border border-gray-800">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gray-800 rounded-lg">
          <FileText className="w-5 h-5 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-white">
          Statements
        </h3>
      </div>

      <div className="space-y-3">
        {statements.map((statement: Statement) => (
          <div
            key={statement.id}
            className="group p-4 rounded-xl bg-gray-800/60 hover:bg-gray-800/80 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-700/50 rounded-lg group-hover:bg-gray-700/70 transition-colors duration-200">
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white group-hover:text-gray-100 transition-colors duration-200">
                    Statement for{" "}
                    {formatDate(statement.statement_date)}
                  </h4>
                  <p className="text-sm text-gray-400 mt-1">
                    Due: {formatDate(statement.due_date)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-lg font-bold text-white">
                    {formatCurrency(statement.total_amount)}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    Statement Amount
                  </div>
                </div>

                <button className="px-4 py-2 bg-gray-700/50 hover:bg-gray-700/70 text-gray-300 hover:text-white font-medium rounded-lg transition-all duration-200 hover:scale-105 active:scale-95">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Download
                  </div>
                </button>
              </div>
            </div>

            {/* Status indicator */}
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-500 font-medium">
                Ready for download
              </span>
            </div>
          </div>
        ))}

        {statements.length === 0 && (
          <div className="text-center py-12">
            <div className="p-4 bg-gray-800/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <FileText className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400">
              No statements available
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatementsComponent;