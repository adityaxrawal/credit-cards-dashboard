"use client";

import React from "react";
import { Trash2, Tag, Merge, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkCategorize: () => void;
  onBulkMerge?: () => void;
  isDeleting?: boolean;
}

export function BulkActionToolbar({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkCategorize,
  onBulkMerge,
  isDeleting = false,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-primary px-6 py-3 rounded-full shadow-lg border border-primary/20">
        <span className="text-white font-medium">
          {selectedCount} selected
        </span>
        
        <div className="w-px h-6 bg-white/20" />
        
        <button
          onClick={onBulkCategorize}
          className="flex items-center gap-2 px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
        >
          <Tag className="w-4 h-4" />
          <span>Categorize</span>
        </button>

        {selectedCount >= 2 && onBulkMerge && (
          <button
            onClick={onBulkMerge}
            className="flex items-center gap-2 px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          >
            <Merge className="w-4 h-4" />
            <span>Merge</span>
          </button>
        )}
        
        <button
          onClick={onBulkDelete}
          disabled={isDeleting}
          className={cn(
            "flex items-center gap-2 px-4 py-1.5 rounded-full transition-colors",
            isDeleting 
              ? "bg-white/5 text-white/50 cursor-not-allowed"
              : "bg-error/80 hover:bg-error text-white"
          )}
        >
          <Trash2 className="w-4 h-4" />
          <span>{isDeleting ? "Deleting..." : "Delete"}</span>
        </button>
        
        <div className="w-px h-6 bg-white/20" />
        
        <button
          onClick={onClearSelection}
          className="p-1.5 hover:bg-white/10 text-white rounded-full transition-colors"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

