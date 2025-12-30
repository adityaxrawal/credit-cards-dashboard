"use client";

import { useState, useCallback, useMemo } from "react";

interface CursorPaginationOptions<T> {
  fetchFn: (cursor: string | null, direction: "forward" | "backward") => Promise<{
    data: T[];
    nextCursor: string | null;
    prevCursor: string | null;
    hasMore: boolean;
  }>;
  initialPageSize?: number;
}

interface CursorPaginationResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  fetchNextPage: () => void;
  fetchPrevPage: () => void;
  refresh: () => void;
  cursors: {
    current: string | null;
    next: string | null;
    prev: string | null;
  };
}

export function useCursorPagination<T>({
  fetchFn,
  initialPageSize = 20,
}: CursorPaginationOptions<T>): CursorPaginationResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [cursors, setCursors] = useState<{
    current: string | null;
    next: string | null;
    prev: string | null;
  }>({
    current: null,
    next: null,
    prev: null,
  });

  const fetchPage = useCallback(async (
    cursor: string | null,
    direction: "forward" | "backward"
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchFn(cursor, direction);
      setData(result.data);
      setCursors({
        current: cursor,
        next: result.nextCursor,
        prev: result.prevCursor,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch"));
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn]);

  const fetchNextPage = useCallback(() => {
    if (cursors.next) {
      fetchPage(cursors.next, "forward");
    }
  }, [cursors.next, fetchPage]);

  const fetchPrevPage = useCallback(() => {
    if (cursors.prev) {
      fetchPage(cursors.prev, "backward");
    }
  }, [cursors.prev, fetchPage]);

  const refresh = useCallback(() => {
    fetchPage(null, "forward");
  }, [fetchPage]);

  return {
    data,
    isLoading,
    error,
    hasNextPage: !!cursors.next,
    hasPrevPage: !!cursors.prev,
    fetchNextPage,
    fetchPrevPage,
    refresh,
    cursors,
  };
}

// Cursor pagination controls component
import React from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CursorPaginationControlsProps {
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
  itemCount?: number;
}

export function CursorPaginationControls({
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  onRefresh,
  isLoading = false,
  itemCount,
}: CursorPaginationControlsProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="text-sm text-secondary-text">
        {itemCount !== undefined && `Showing ${itemCount} items`}
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={cn(
            "p-2 rounded-lg transition-colors",
            isLoading
              ? "bg-muted-text/10 text-muted-text cursor-not-allowed"
              : "hover:bg-hover-bg text-secondary-text"
          )}
          title="Refresh"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </button>
        
        <div className="flex items-center border border-muted-text/10 rounded-lg overflow-hidden">
          <button
            onClick={onPrevPage}
            disabled={!hasPrevPage || isLoading}
            className={cn(
              "p-2 transition-colors",
              hasPrevPage && !isLoading
                ? "hover:bg-hover-bg text-primary-text"
                : "bg-muted-text/5 text-muted-text cursor-not-allowed"
            )}
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="w-px h-6 bg-muted-text/10" />
          
          <button
            onClick={onNextPage}
            disabled={!hasNextPage || isLoading}
            className={cn(
              "p-2 transition-colors",
              hasNextPage && !isLoading
                ? "hover:bg-hover-bg text-primary-text"
                : "bg-muted-text/5 text-muted-text cursor-not-allowed"
            )}
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
