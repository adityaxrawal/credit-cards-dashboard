import { create } from "zustand";

/**
 * Loading Store State Interface
 */
interface LoadingState {
  isLoading: boolean;
  loadingMessage: string | null;
  loadingTasks: Map<string, string>;

  // Actions
  startLoading: (taskId?: string, message?: string) => void;
  stopLoading: (taskId?: string) => void;
  setLoadingMessage: (message: string | null) => void;
  clearAllLoading: () => void;
}

/**
 * Global Loading Store
 * Manages all loading states across the application
 *
 * @example
 * // In a component:
 * const { startLoading, stopLoading, isLoading } = useLoadingStore();
 *
 * const handleSubmit = async () => {
 *   const taskId = 'submit-form';
 *   startLoading(taskId, 'Submitting form...');
 *   try {
 *     await apiClient.post('/api/form', data);
 *   } finally {
 *     stopLoading(taskId);
 *   }
 * };
 */
export const useLoadingStore = create<LoadingState>((set) => ({
  isLoading: false,
  loadingMessage: null,
  loadingTasks: new Map(),

  /**
   * Start a loading task
   * @param taskId - Unique identifier for the task (optional, uses 'default' if not provided)
   * @param message - Loading message to display (optional)
   */
  startLoading: (taskId = "default", message) => {
    set((state) => {
      const newTasks = new Map(state.loadingTasks);
      newTasks.set(taskId, message || "Loading...");

      return {
        loadingTasks: newTasks,
        isLoading: true,
        loadingMessage: message || state.loadingMessage || "Loading...",
      };
    });
  },

  /**
   * Stop a loading task
   * @param taskId - Unique identifier for the task (optional, uses 'default' if not provided)
   */
  stopLoading: (taskId = "default") => {
    set((state) => {
      const newTasks = new Map(state.loadingTasks);
      newTasks.delete(taskId);

      // If no more tasks, clear loading state
      const isLoading = newTasks.size > 0;
      const loadingMessage = isLoading
        ? Array.from(newTasks.values())[0]
        : null;

      return {
        loadingTasks: newTasks,
        isLoading,
        loadingMessage,
      };
    });
  },

  /**
   * Update the loading message
   * @param message - New loading message
   */
  setLoadingMessage: (message) => {
    set({ loadingMessage: message });
  },

  /**
   * Clear all loading states
   */
  clearAllLoading: () => {
    set({
      isLoading: false,
      loadingMessage: null,
      loadingTasks: new Map(),
    });
  },
}));

/**
 * Hook to wrap async operations with loading state
 * @param taskId - Unique identifier for the task
 * @returns A function that wraps an async operation with loading state
 *
 * @example
 * const withLoading = useLoadingWrapper('fetch-data');
 *
 * const fetchData = () => withLoading(
 *   async () => {
 *     const data = await apiClient.get('/api/data');
 *     return data;
 *   },
 *   'Fetching data...'
 * );
 */
export const useLoadingWrapper = (taskId: string) => {
  const { startLoading, stopLoading } = useLoadingStore();

  return async <T>(asyncFn: () => Promise<T>, message?: string): Promise<T> => {
    startLoading(taskId, message);
    try {
      return await asyncFn();
    } finally {
      stopLoading(taskId);
    }
  };
};

/**
 * Higher-order function to wrap any async function with loading state
 * @param fn - The async function to wrap
 * @param taskId - Unique identifier for the task
 * @param message - Loading message
 * @returns Wrapped function that manages loading state
 *
 * @example
 * const fetchDataWithLoading = withLoadingState(
 *   () => apiClient.get('/api/data'),
 *   'fetch-data',
 *   'Fetching data...'
 * );
 */
export const withLoadingState = <
  T extends (...args: unknown[]) => Promise<unknown>
>(
  fn: T,
  taskId: string,
  message?: string
): T => {
  return (async (...args: Parameters<T>) => {
    const { startLoading, stopLoading } = useLoadingStore.getState();
    startLoading(taskId, message);
    try {
      return await fn(...args);
    } finally {
      stopLoading(taskId);
    }
  }) as T;
};

export default useLoadingStore;
