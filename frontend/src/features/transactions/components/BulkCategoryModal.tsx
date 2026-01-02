"use client";

import React, { useState } from "react";
import { X, Tag, Check } from "lucide-react";

interface BulkCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (category: string) => void;
  selectedCount: number;
  categories: string[];
  isLoading?: boolean;
}

export function BulkCategoryModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  categories,
  isLoading = false,
}: BulkCategoryModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedCategory) {
      onConfirm(selectedCategory);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card-bg rounded-xl shadow-xl border border-muted-text/10 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-muted-text/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Tag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-primary-text">
                Assign Category
              </h3>
              <p className="text-sm text-secondary-text">
                {selectedCount} transaction{selectedCount > 1 ? "s" : ""} selected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-hover-bg rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-secondary-text" />
          </button>
        </div>

        {/* Category Grid */}
        <div className="p-4 max-h-80 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  selectedCategory === category
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted-text/10 hover:border-primary/50 text-primary-text"
                }`}
              >
                <span className="font-medium truncate">{category}</span>
                {selectedCategory === category && (
                  <Check className="w-4 h-4 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-muted-text/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-secondary-text hover:text-primary-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedCategory || isLoading}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
              selectedCategory && !isLoading
                ? "bg-primary text-white hover:bg-primary/90"
                : "bg-muted-text/20 text-muted-text cursor-not-allowed"
            }`}
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Apply Category</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
