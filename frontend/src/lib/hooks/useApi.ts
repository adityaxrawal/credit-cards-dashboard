import { useState, useCallback } from "react";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

export interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
}

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  execute: () => Promise<T>;
  reset: () => void;
}

/**
 * Generic hook for API calls with loading, error, and success states
 * @param apiFunction - Function that returns a Promise with API response
 * @param options - Configuration options
 * @returns State object with data, loading, error, execute, and reset
 */
export function useApi<T>(
  apiFunction: () => Promise<ApiResponse<T>>,
  options: UseApiOptions<T> = {}
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const { onSuccess, onError } = options;

  const execute = useCallback(async (): Promise<T> => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiFunction();

      if (response.success) {
        setData(response.data);
        onSuccess?.(response.data);
        return response.data;
      } else {
        const apiError: ApiError = {
          message: response.error || "An error occurred",
        };
        setError(apiError);
        onError?.(apiError);
        throw apiError;
      }
    } catch (err: unknown) {
      const apiError: ApiError = {
        message: err instanceof Error ? err.message : "Network error occurred",
        status:
          err && typeof err === "object" && "status" in err
            ? (err as { status: number }).status
            : undefined,
        code:
          err && typeof err === "object" && "code" in err
            ? (err as { code: string }).code
            : undefined,
      };
      setError(apiError);
      onError?.(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [apiFunction, onSuccess, onError]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}

/**
 * Hook for mutation operations (POST, PUT, DELETE)
 */
export function useApiMutation<T, P = unknown>(
  apiFunction: (params: P) => Promise<ApiResponse<T>>,
  options: UseApiOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const { onSuccess, onError } = options;

  const mutate = useCallback(
    async (params: P): Promise<T> => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiFunction(params);

        if (response.success) {
          setData(response.data);
          onSuccess?.(response.data);
          return response.data;
        } else {
          const apiError: ApiError = {
            message: response.error || "An error occurred",
          };
          setError(apiError);
          onError?.(apiError);
          throw apiError;
        }
      } catch (err: unknown) {
        const apiError: ApiError = {
          message:
            err instanceof Error ? err.message : "Network error occurred",
          status:
            err && typeof err === "object" && "status" in err
              ? (err as { status: number }).status
              : undefined,
          code:
            err && typeof err === "object" && "code" in err
              ? (err as { code: string }).code
              : undefined,
        };
        setError(apiError);
        onError?.(apiError);
        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    mutate,
    reset,
  };
}
