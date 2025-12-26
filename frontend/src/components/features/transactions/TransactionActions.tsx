"use client";

import React, { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Eye, Edit2, Mail, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface TransactionActionsProps {
  onViewDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewGmail?: () => void;
}

export function TransactionActions({
  onViewDetails,
  onEdit,
  onDelete,
  onViewGmail,
}: TransactionActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border border-border bg-card-bg shadow-lg py-1">
          {onViewGmail && (
            <button
              className="flex w-full items-center px-4 py-2 text-sm text-primary-text hover:bg-hover-bg"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onViewGmail();
              }}
            >
              <Mail className="mr-2 h-4 w-4 text-secondary-text" />
              View in Gmail
            </button>
          )}

          <button
            className="flex w-full items-center px-4 py-2 text-sm text-primary-text hover:bg-hover-bg"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onViewDetails();
            }}
          >
            <Eye className="mr-2 h-4 w-4 text-secondary-text" />
            View Details
          </button>

          <button
            className="flex w-full items-center px-4 py-2 text-sm text-primary-text hover:bg-hover-bg"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onEdit();
            }}
          >
            <Edit2 className="mr-2 h-4 w-4 text-secondary-text" />
            Edit
          </button>

          <div className="my-1 h-px bg-border" />

          <button
            className="flex w-full items-center px-4 py-2 text-sm text-error hover:bg-error/10"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onDelete();
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
