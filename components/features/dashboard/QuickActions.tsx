'use client';

import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Send, 
  Receipt, 
  Settings, 
  Plus,
  ArrowUpRight 
} from 'lucide-react';

const QuickActions = () => {
  const actions = [
    {
      title: 'Pay Bill',
      description: 'Make a payment',
      icon: CreditCard,
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600',
    },
    {
      title: 'Transfer',
      description: 'Send money',
      icon: Send,
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600',
    },
    {
      title: 'Statements',
      description: 'View history',
      icon: Receipt,
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600',
    },
    {
      title: 'Settings',
      description: 'Manage account',
      icon: Settings,
      color: 'bg-gray-500',
      hoverColor: 'hover:bg-gray-600',
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Quick Actions
        </h3>
        <button className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1">
          View All
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {actions.map((action, index) => (
          <motion.button
            key={action.title}
            className="flex flex-col items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors group"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className={`h-10 w-10 ${action.color} ${action.hoverColor} rounded-lg flex items-center justify-center mb-3 transition-colors`}>
              <action.icon className="h-5 w-5 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              {action.title}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400 text-center">
              {action.description}
            </span>
          </motion.button>
        ))}
      </div>

      <motion.button
        className="w-full mt-4 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <Plus className="h-4 w-4" />
        Add Custom Action
      </motion.button>
    </div>
  );
};

export default QuickActions;