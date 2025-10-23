"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckSquare,
  Square,
  MoreHorizontal,
  Edit3,
  Trash2,
  Tag,
  Download,
  Archive,
  RefreshCw,
  AlertTriangle,
  Check,
  X
} from 'lucide-react';

interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  requiresConfirmation: boolean;
  description: string;
}

export interface BulkEditData {
  category: string;
  tags: string;
  notes: string;
}

interface BulkTransactionActionsProps {
  selectedTransactions: string[];
  totalTransactions: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkAction: (action: string, data?: BulkEditData) => Promise<void>;
  className?: string;
}

const BulkTransactionActions: React.FC<BulkTransactionActionsProps> = ({
  selectedTransactions,
  totalTransactions,
  onSelectAll,
  onDeselectAll,
  onBulkAction,
  className = ''
}) => {
  const [showActions, setShowActions] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState<string | null>(null);
  const [bulkEditData, setBulkEditData] = useState({
    category: '',
    tags: '',
    notes: ''
  });

  const bulkActions: BulkAction[] = [
    {
      id: 'edit',
      label: 'Edit Selected',
      icon: Edit3,
      color: 'text-blue-400',
      requiresConfirmation: false,
      description: 'Update category, tags, or notes for selected transactions'
    },
    {
      id: 'categorize',
      label: 'Bulk Categorize',
      icon: Tag,
      color: 'text-green-400',
      requiresConfirmation: false,
      description: 'Apply the same category to all selected transactions'
    },
    {
      id: 'export',
      label: 'Export Selected',
      icon: Download,
      color: 'text-purple-400',
      requiresConfirmation: false,
      description: 'Export selected transactions to CSV or PDF'
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: Archive,
      color: 'text-yellow-400',
      requiresConfirmation: true,
      description: 'Move selected transactions to archive'
    },
    {
      id: 'reprocess',
      label: 'Reprocess',
      icon: RefreshCw,
      color: 'text-cyan-400',
      requiresConfirmation: true,
      description: 'Reprocess selected transactions for categorization'
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      color: 'text-red-400',
      requiresConfirmation: true,
      description: 'Permanently delete selected transactions'
    }
  ];

  const isAllSelected = selectedTransactions.length === totalTransactions && totalTransactions > 0;
  const isPartiallySelected = selectedTransactions.length > 0 && selectedTransactions.length < totalTransactions;

  const handleBulkAction = async (actionId: string) => {
    const action = bulkActions.find(a => a.id === actionId);
    if (!action) return;

    if (action.requiresConfirmation) {
      setShowConfirmation(actionId);
      return;
    }

    if (actionId === 'edit') {
      setActiveAction('edit');
      return;
    }

    setIsProcessing(true);
    try {
      await onBulkAction(actionId);
      setShowActions(false);
    } catch (error) {
      console.error('Bulk action failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmAction = async (actionId: string) => {
    setIsProcessing(true);
    try {
      await onBulkAction(actionId);
      setShowConfirmation(null);
      setShowActions(false);
    } catch (error) {
      console.error('Bulk action failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkEdit = async () => {
    setIsProcessing(true);
    try {
      await onBulkAction('edit', bulkEditData);
      setActiveAction(null);
      setBulkEditData({ category: '', tags: '', notes: '' });
      setShowActions(false);
    } catch (error) {
      console.error('Bulk edit failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (selectedTransactions.length === 0) {
    return null;
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className={`glass-card rounded-xl p-4 border border-gray-700/50 ${className}`}
      >
        <div className="flex items-center justify-between">
          {/* Selection Info */}
          <div className="flex items-center gap-4">
            <button
              onClick={isAllSelected ? onDeselectAll : onSelectAll}
              className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
            >
              {isAllSelected ? (
                <CheckSquare className="w-5 h-5 text-blue-400" />
              ) : isPartiallySelected ? (
                <div className="w-5 h-5 bg-blue-400 rounded border-2 border-blue-400 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-sm"></div>
                </div>
              ) : (
                <Square className="w-5 h-5" />
              )}
              <span className="text-sm font-medium">
                {selectedTransactions.length} of {totalTransactions} selected
              </span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowActions(!showActions)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span className="text-sm font-medium">Actions</span>
            </motion.button>

            <button
              onClick={onDeselectAll}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Actions Menu */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 pt-4 border-t border-gray-700/50"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {bulkActions.map(action => {
                  const Icon = action.icon;
                  return (
                    <motion.button
                      key={action.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleBulkAction(action.id)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon className={`w-4 h-4 ${action.color}`} />
                      <span className="text-sm text-gray-300">{action.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bulk Edit Modal */}
      <AnimatePresence>
        {activeAction === 'edit' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setActiveAction(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl p-6 w-full max-w-md border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Edit3 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Bulk Edit</h3>
                    <p className="text-gray-400 text-sm">
                      Edit {selectedTransactions.length} transactions
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveAction(null)}
                  className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Category (leave empty to keep existing)
                  </label>
                  <select
                    value={bulkEditData.category}
                    onChange={(e) => setBulkEditData({ ...bulkEditData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Keep existing categories</option>
                    <option value="Food & Dining">Food & Dining</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Bills & Utilities">Bills & Utilities</option>
                    <option value="Gas">Gas</option>
                    <option value="Groceries">Groceries</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Add Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={bulkEditData.tags}
                    onChange={(e) => setBulkEditData({ ...bulkEditData, tags: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="business, travel, recurring"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Add Notes
                  </label>
                  <textarea
                    value={bulkEditData.notes}
                    onChange={(e) => setBulkEditData({ ...bulkEditData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                    placeholder="Additional notes for selected transactions..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setActiveAction(null)}
                  className="flex-1 px-4 py-2 bg-gray-800/50 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkEdit}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Update All
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowConfirmation(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl p-6 w-full max-w-md border border-gray-700/50"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Confirm Action</h3>
                  <p className="text-gray-400 text-sm">This action cannot be undone</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-300">
                  Are you sure you want to{' '}
                  <span className="font-medium text-white">
                    {bulkActions.find(a => a.id === showConfirmation)?.label.toLowerCase()}
                  </span>{' '}
                  {selectedTransactions.length} selected transaction{selectedTransactions.length > 1 ? 's' : ''}?
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  {bulkActions.find(a => a.id === showConfirmation)?.description}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(null)}
                  className="flex-1 px-4 py-2 bg-gray-800/50 text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmAction(showConfirmation)}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BulkTransactionActions;