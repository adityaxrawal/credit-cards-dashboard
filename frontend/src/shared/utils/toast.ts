import toast from "react-hot-toast";

/**
 * Centralized toast notification utilities
 * Provides consistent user feedback across the application
 */

export const toastService = {
  /**
   * Show success message
   */
  success: (message: string, duration?: number) => {
    toast.success(message, {
      duration: duration || 3000,
      position: "top-right",
      style: {
        background: "#10b981",
        color: "#fff",
      },
    });
  },

  /**
   * Show error message
   */
  error: (message: string, duration?: number) => {
    toast.error(message, {
      duration: duration || 5000,
      position: "top-right",
      style: {
        background: "#ef4444",
        color: "#fff",
      },
    });
  },

  /**
   * Show warning message
   */
  warning: (message: string, duration?: number) => {
    toast(message, {
      duration: duration || 4000,
      position: "top-right",
      icon: "⚠️",
      style: {
        background: "#f59e0b",
        color: "#fff",
      },
    });
  },

  /**
   * Show info message
   */
  info: (message: string, duration?: number) => {
    toast(message, {
      duration: duration || 3000,
      position: "top-right",
      icon: "ℹ️",
      style: {
        background: "#3b82f6",
        color: "#fff",
      },
    });
  },

  /**
   * Show loading message with promise
   */
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(promise, messages, {
      position: "top-right",
    });
  },

  /**
   * Dismiss all toasts
   */
  dismiss: () => {
    toast.dismiss();
  },

  /**
   * Handle API error and show appropriate message
   */
  handleApiError: (error: unknown) => {
    const err = error as {
      response?: { data?: { error?: { message?: string } } };
      message?: string;
    };

    if (err.response?.data?.error?.message) {
      toast.error(err.response.data.error.message);
    } else if (err.message) {
      toast.error(err.message);
    } else {
      toast.error("An unexpected error occurred. Please try again.");
    }
  },
};

/**
 * React hook for toast notifications
 * Provides a consistent API for showing toasts in components
 */
export function useToast() {
  return {
    success: toastService.success,
    error: toastService.error,
    warning: toastService.warning,
    info: toastService.info,
    promise: toastService.promise,
    dismiss: toastService.dismiss,
    handleApiError: toastService.handleApiError,
  };
}

export default toastService;
