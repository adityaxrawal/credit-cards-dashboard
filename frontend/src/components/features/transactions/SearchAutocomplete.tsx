"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchSuggestion {
  type: "merchant" | "category" | "recent";
  value: string;
  count?: number;
}

interface SearchAutocompleteProps {
  onSearch: (query: string) => void;
  getSuggestions: (query: string) => Promise<SearchSuggestion[]>;
  recentSearches?: string[];
  placeholder?: string;
  className?: string;
}

export function SearchAutocomplete({
  onSearch,
  getSuggestions,
  recentSearches = [],
  placeholder = "Search transactions...",
  className,
}: SearchAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced suggestion fetching
  useEffect(() => {
    if (!query.trim()) {
      // Show recent searches when empty
      setSuggestions(
        recentSearches.slice(0, 5).map((s) => ({
          type: "recent" as const,
          value: s,
        }))
      );
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await getSuggestions(query);
        setSuggestions(results);
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, getSuggestions, recentSearches]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex].value);
        } else {
          handleSearch();
        }
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query.trim());
      setIsOpen(false);
    }
  };

  const handleSelect = (value: string) => {
    setQuery(value);
    onSearch(value);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case "recent":
        return Clock;
      case "category":
        return TrendingUp;
      default:
        return Search;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 bg-hover-bg border border-muted-text/10 rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted-text/10 rounded"
          >
            <X className="w-4 h-4 text-muted-text" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && (suggestions.length > 0 || isLoading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card-bg border border-muted-text/10 rounded-lg shadow-lg overflow-hidden z-50">
          {isLoading ? (
            <div className="p-4 text-center text-muted-text">
              <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            </div>
          ) : (
            <ul className="py-1">
              {suggestions.map((suggestion, index) => {
                const Icon = getSuggestionIcon(suggestion.type);
                return (
                  <li key={`${suggestion.type}-${suggestion.value}`}>
                    <button
                      onClick={() => handleSelect(suggestion.value)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                        index === selectedIndex
                          ? "bg-primary/10 text-primary"
                          : "text-primary-text hover:bg-hover-bg"
                      )}
                    >
                      <Icon className="w-4 h-4 text-muted-text flex-shrink-0" />
                      <span className="flex-1 truncate">{suggestion.value}</span>
                      {suggestion.count && (
                        <span className="text-xs text-muted-text">
                          {suggestion.count} results
                        </span>
                      )}
                      {suggestion.type === "category" && (
                        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
                          Category
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
