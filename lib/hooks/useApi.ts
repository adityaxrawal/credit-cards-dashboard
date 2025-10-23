'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Configuration options for the useApi hook
 * @template T - The type of data returned by the API function
 * @interface UseApiOptions
 */
interface UseApiOptions<T> {
  /** Initial data to set before any API calls */
  initialData?: T;
  /** Whether to execute the API function immediately on mount */
  immediate?: boolean;
  /** Callback function called when API call succeeds */
  onSuccess?: (data: T) => void;
  /** Callback function called when API call fails */
  onError?: (error: Error) => void;
  /** Cache key for storing/retrieving cached results */
  cacheKey?: string;
  /** Duration in milliseconds to keep cached data valid (default: 5 minutes) */
  cacheDuration?: number;
}

/**
 * Return type for the useApi hook
 * @template T - The type of data returned by the API function
 * @interface UseApiReturn
 */
interface UseApiReturn<T> {
  /** The current data from the API call */
  data: T | null;
  /** Whether an API call is currently in progress */
  loading: boolean;
  /** Any error that occurred during the API call */
  error: Error | null;
  /** Function to manually execute the API call */
  execute: (...args: unknown[]) => Promise<T | null>;
  /** Function to reset the hook state to initial values */
  reset: () => void;
}

/**
 * Simple in-memory cache for API responses
 * Maps cache keys to data and timestamp objects
 */
const cache = new Map<string, { data: unknown; timestamp: number }>();

/**
 * Custom React hook for managing API calls with loading states, error handling, and caching
 * @template T - The type of data returned by the API function
 * @param {Function} apiFunction - The async function to call for API requests
 * @param {UseApiOptions<T>} options - Configuration options for the hook
 * @returns {UseApiReturn<T>} Object containing data, loading state, error, and control functions
 * @example
 * ```typescript
 * // Basic usage
 * const { data, loading, error, execute } = useApi(fetchUserData, {
 *   immediate: true,
 *   cacheKey: 'user-data',
 *   onSuccess: (data) => console.log('User loaded:', data),
 *   onError: (error) => console.error('Failed to load user:', error)
 * });
 * 
 * // Manual execution
 * const handleRefresh = () => {
 *   execute(userId);
 * };
 * ```
 */
function useApi<T>(
  apiFunction: (...args: unknown[]) => Promise<T>,
  options: UseApiOptions<T> = {}
): UseApiReturn<T> {
  const {
    initialData = null,
    immediate = false,
    onSuccess,
    onError,
    cacheKey,
    cacheDuration = 5 * 60 * 1000, // 5 minutes default
  } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check cache for initial data
  useEffect(() => {
    if (cacheKey && !initialData) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheDuration) {
        setData(cached.data as T);
      }
    }
  }, [cacheKey, cacheDuration, initialData]);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const result = await apiFunction(...args);
        
        if (!mountedRef.current) return null;

        setData(result);
        
        // Cache the result
        if (cacheKey) {
          cache.set(cacheKey, {
            data: result,
            timestamp: Date.now(),
          });
        }

        onSuccess?.(result);
        return result;
      } catch (err) {
        if (!mountedRef.current) return null;

        const error = err instanceof Error ? err : new Error('An error occurred');
        setError(error);
        onError?.(error);
        return null;
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [apiFunction, onSuccess, onError, cacheKey]
  );

  const reset = useCallback(() => {
    setData(initialData);
    setLoading(false);
    setError(null);
    
    // Clear cache if exists
    if (cacheKey) {
      cache.delete(cacheKey);
    }
  }, [initialData, cacheKey]);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}

export { useApi };
export type { UseApiOptions, UseApiReturn };