"use client";

import React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectionCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  className,
}: SelectionCheckboxProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
        checked || indeterminate
          ? "bg-primary border-primary"
          : "border-muted-text/30 hover:border-primary/50",
        className
      )}
    >
      {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      {indeterminate && !checked && (
        <Minus className="w-3 h-3 text-white" strokeWidth={3} />
      )}
    </button>
  );
}

interface UseSelectionReturn<T> {
  selectedIds: Set<string>;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  toggleItem: (id: string) => void;
  toggleAll: (items: T[], getId: (item: T) => string) => void;
  clearSelection: () => void;
  selectAll: (items: T[], getId: (item: T) => string) => void;
}

export function useSelection<T>(): UseSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const toggleItem = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(
    (items: T[], getId: (item: T) => string) => {
      setSelectedIds((prev) => {
        const allIds = items.map(getId);
        const allSelected = allIds.every((id) => prev.has(id));
        
        if (allSelected) {
          return new Set();
        } else {
          return new Set(allIds);
        }
      });
    },
    []
  );

  const selectAll = React.useCallback(
    (items: T[], getId: (item: T) => string) => {
      setSelectedIds(new Set(items.map(getId)));
    },
    []
  );

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = selectedIds.size > 0;
  const isIndeterminate = selectedIds.size > 0;

  return {
    selectedIds,
    isAllSelected,
    isIndeterminate,
    toggleItem,
    toggleAll,
    clearSelection,
    selectAll,
  };
}
