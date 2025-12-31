import React, { useState, useEffect, useRef } from "react";
import { Input, Button } from "@/components/ui";
import { Check, X, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineEditCellProps {
  value: string | number;
  type?: "text" | "number" | "select" | "date";
  options?: string[]; // For select type
  onSave: (newValue: string | number) => Promise<void>;
  className?: string;
  isEditable?: boolean;
}

export function InlineEditCell({
  value,
  type = "text",
  options = [],
  onSave,
  className,
  isEditable = true,
}: InlineEditCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (currentValue === value) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await onSave(currentValue);
      setIsEditing(false);
    } catch (error) {
      // Error handling is expected to be done by the parent via toast
      console.error("Failed to save inline edit", error);
      setCurrentValue(value); // Revert on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setCurrentValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (!isEditable) {
    return <div className={cn("py-1 px-2", className)}>{value}</div>;
  }

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-1 min-w-[120px]", className)}>
        {type === "select" ? (
           <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1 text-sm border rounded bg-primary-bg text-primary-text focus:outline-none focus:ring-1 focus:ring-primary-green"
            disabled={isLoading}
           >
             {options.map((opt) => (
               <option key={opt} value={opt}>
                 {opt}
               </option>
             ))}
           </select>
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            value={currentValue}
            onChange={(e) =>
              setCurrentValue(
                type === "number" ? parseFloat(e.target.value) : e.target.value
              )
            }
            onKeyDown={handleKeyDown}
            className="h-8 text-sm px-2 py-1 w-full"
            disabled={isLoading}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={isLoading}
          className="h-7 w-7 p-0 text-success hover:text-success hover:bg-success/10"
        >
          <Check className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isLoading}
          className="h-7 w-7 p-0 text-error hover:text-error hover:bg-error/10"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        "group flex items-center gap-2 py-1 px-2 rounded hover:bg-hover-bg cursor-pointer transition-colors min-h-[32px]",
        className
      )}
    >
      <span className="truncate">{value}</span>
      <Edit2 className="w-3 h-3 text-secondary-text opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </div>
  );
}
