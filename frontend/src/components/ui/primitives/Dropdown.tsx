"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownProps {
  options: DropdownOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  multiSelect?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
  error?: string;
  helperText?: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  multiSelect = false,
  disabled = false,
  className,
  label,
  error,
  helperText,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle clicks outside the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOptionSelect = useCallback(
    (optionValue: string) => {
      if (multiSelect) {
        const currentValues = Array.isArray(value)
          ? value
          : [value].filter(Boolean);
        const newValues = currentValues.includes(optionValue)
          ? currentValues.filter((v) => v !== optionValue)
          : [...currentValues, optionValue];
        onChange(newValues);
      } else {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm("");
      }
    },
    [multiSelect, value, onChange]
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case "Escape":
          setIsOpen(false);
          setSearchTerm("");
          break;
        case "ArrowDown":
        case "ArrowUp":
          event.preventDefault();
          // TODO: Implement arrow key navigation
          break;
        case "Enter":
          event.preventDefault();
          if (filteredOptions.length > 0) {
            handleOptionSelect(filteredOptions[0].value);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredOptions, handleOptionSelect]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const getDisplayValue = () => {
    if (multiSelect) {
      const selectedOptions = options.filter(
        (option) => Array.isArray(value) && value.includes(option.value)
      );
      if (selectedOptions.length === 0) return placeholder;
      if (selectedOptions.length === 1) return selectedOptions[0].label;
      return `${selectedOptions.length} selected`;
    } else {
      const selectedOption = options.find((option) => option.value === value);
      return selectedOption ? selectedOption.label : placeholder;
    }
  };

  const isSelected = (optionValue: string) => {
    if (multiSelect) {
      return Array.isArray(value) && value.includes(optionValue);
    }
    return value === optionValue;
  };

  return (
    <div className={cn("relative", className)}>
      {label && (
        <label className="block text-sm font-medium text-primary-text mb-2">
          {label}
        </label>
      )}

      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 text-left",
            "bg-card-bg border border-muted-text/20 rounded-lg",
            "text-primary-text placeholder-muted-text",
            "focus:outline-none focus:ring-2 focus:ring-primary-green focus:border-primary-green",
            "transition-colors duration-200",
            disabled && "opacity-50 cursor-not-allowed",
            error && "border-error focus:ring-error",
            isOpen && "ring-2 ring-primary-green border-primary-green"
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span
            className={cn(
              "truncate",
              (!value || (Array.isArray(value) && value.length === 0)) &&
                "text-muted-text"
            )}
          >
            {getDisplayValue()}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-text transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-card-bg border border-muted-text/20 rounded-lg shadow-lg max-h-60 overflow-hidden">
            {/* Search Input */}
            {options.length > 5 && (
              <div className="p-2 border-b border-muted-text/20">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search options..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-2 py-1 bg-primary-bg border border-muted-text/20 rounded text-primary-text placeholder-muted-text focus:outline-none focus:ring-1 focus:ring-primary-green"
                />
              </div>
            )}

            {/* Options List */}
            <div className="max-h-48 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-text">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleOptionSelect(option.value)}
                    disabled={option.disabled}
                    className={cn(
                      "w-full flex items-center px-3 py-2 text-left text-sm transition-colors",
                      "hover:bg-hover-bg focus:bg-hover-bg focus:outline-none",
                      option.disabled && "opacity-50 cursor-not-allowed",
                      isSelected(option.value) &&
                        "bg-primary-green/10 text-primary-green"
                    )}
                    role="option"
                    aria-selected={isSelected(option.value)}
                  >
                    <span className="flex-1 truncate">{option.label}</span>
                    {isSelected(option.value) && (
                      <Check className="w-4 h-4 text-primary-green flex-shrink-0 ml-2" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Helper Text / Error */}
      {(helperText || error) && (
        <p
          className={cn(
            "mt-1 text-xs",
            error ? "text-error" : "text-muted-text"
          )}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
}
