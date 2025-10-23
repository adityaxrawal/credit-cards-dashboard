"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Download, 
  Eye, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  FileText
} from 'lucide-react';

interface Statement {
  id: string;
  month: string;
  year: number;
  totalDue: number;
  paymentStatus: 'paid' | 'unpaid' | 'overdue';
  dueDate: string;
  downloadUrl?: string;
  transactionCount: number;
}

interface StatementTimelineProps {
  statements: Statement[];
}

const StatementTimeline: React.FC<StatementTimelineProps> = ({ statements }) => {
  const getStatusConfig = (status: Statement['paymentStatus']) => {
    switch (status) {
      case 'paid':
        return {
          color: 'text-green-400',
          bgColor: 'bg-green-400/20',
          borderColor: 'border-green-400/30',
          icon: CheckCircle,
          label: 'Paid'
        };
      case 'overdue':
        return {
          color: 'text-red-400',
          bgColor: 'bg-red-400/20',
          borderColor: 'border-red-400/30',
          icon: AlertCircle,
          label: 'Overdue'
        };
      case 'unpaid':
        return {
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-400/20',
          borderColor: 'border-yellow-400/30',
          icon: Clock,
          label: 'Upcoming'
        };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="glass-card rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gray-800/50 rounded-lg">
          <FileText className="w-5 h-5 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-white">Statement Timeline</h3>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-gray-600 via-gray-700 to-transparent"></div>

        <div className="space-y-6">
          {statements.map((statement, index) => {
            const statusConfig = getStatusConfig(statement.paymentStatus);
            const StatusIcon = statusConfig.icon;

            return (
              <motion.div
                key={statement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative group"
              >
                {/* Timeline dot */}
                <div className={`absolute left-4 w-4 h-4 rounded-full border-2 border-gray-900 z-10 transition-all duration-300 group-hover:scale-110 ${statusConfig.bgColor} ${statusConfig.borderColor}`}>
                  <div className={`w-full h-full rounded-full ${statusConfig.bgColor} animate-pulse`}></div>
                </div>

                {/* Statement card */}
                <div className={`ml-12 p-6 rounded-xl bg-gray-800/60 hover:bg-gray-800/80 border transition-all duration-300 ${statusConfig.borderColor} hover:border-opacity-60`}>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg transition-colors duration-200 ${statusConfig.bgColor}`}>
                        <Calendar className={`w-5 h-5 ${statusConfig.color}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-lg">
                          {statement.month} {statement.year}
                        </h4>
                        <p className="text-gray-400 text-sm">
                          Due: {formatDate(statement.dueDate)}
                        </p>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusConfig.bgColor} ${statusConfig.borderColor} border`}>
                      <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                      <span className={`text-sm font-medium ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Amount and details */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {formatCurrency(statement.totalDue)}
                      </div>
                      <div className="text-sm text-gray-400">
                        Total Due Amount
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-300">
                        {statement.transactionCount}
                      </div>
                      <div className="text-sm text-gray-400">
                        Transactions
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3">
                    {statement.downloadUrl && (
                      <button className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700/70 text-gray-300 hover:text-white font-medium rounded-lg transition-all duration-200 hover:scale-105 active:scale-95">
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    )}
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 font-medium rounded-lg border border-blue-600/30 hover:border-blue-600/50 transition-all duration-200 hover:scale-105 active:scale-95">
                      <Eye className="w-4 h-4" />
                      View Transactions
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Empty state */}
        {statements.length === 0 && (
          <div className="text-center py-12">
            <div className="p-4 bg-gray-800/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <FileText className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400 text-lg font-medium">
              No statements available
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Statements will appear here once they are generated
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatementTimeline;