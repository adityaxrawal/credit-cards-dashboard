import toast from 'react-hot-toast';

// Toast helper functions with CRED theme styling
export const showSuccess = (message: string): string => {
  return toast.success(message, {
    duration: 4000,
    position: 'top-right',
    style: {
      background: '#1f2937',
      color: '#10b981',
      border: '1px solid #065f46',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '500',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    },
    iconTheme: {
      primary: '#10b981',
      secondary: '#1f2937',
    },
  });
};

export const showError = (message: string): string => {
  return toast.error(message, {
    duration: 5000,
    position: 'top-right',
    style: {
      background: '#1f2937',
      color: '#ef4444',
      border: '1px solid #7f1d1d',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '500',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    },
    iconTheme: {
      primary: '#ef4444',
      secondary: '#1f2937',
    },
  });
};

export const showLoading = (message: string): string => {
  return toast.loading(message, {
    position: 'top-right',
    style: {
      background: '#1f2937',
      color: '#3b82f6',
      border: '1px solid #1e40af',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '500',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    },
    iconTheme: {
      primary: '#3b82f6',
      secondary: '#1f2937',
    },
  });
};

export const showInfo = (message: string): string => {
  return toast(message, {
    duration: 4000,
    position: 'top-right',
    icon: 'ℹ️',
    style: {
      background: '#1f2937',
      color: '#6b7280',
      border: '1px solid #374151',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '500',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    },
  });
};

export const dismissToast = (id?: string): void => {
  if (id) {
    toast.dismiss(id);
  } else {
    toast.dismiss();
  }
};

// Custom toast with CRED theme colors
export const showCustomToast = (
  message: string,
  type: 'success' | 'error' | 'loading' | 'info' = 'info',
  options?: {
    duration?: number;
    position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  }
): string => {
  const defaultOptions = {
    duration: 4000,
    position: 'top-right' as const,
    ...options,
  };

  switch (type) {
    case 'success':
      return showSuccess(message);
    case 'error':
      return showError(message);
    case 'loading':
      return showLoading(message);
    default:
      return showInfo(message);
  }
};

// Promise-based toast for async operations
export const showPromiseToast = <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: unknown) => string);
  }
): Promise<T> => {
  return toast.promise(
    promise,
    {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    },
    {
      position: 'top-right',
      style: {
        background: '#1f2937',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: '500',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      success: {
        style: {
          color: '#10b981',
          border: '1px solid #065f46',
        },
        iconTheme: {
          primary: '#10b981',
          secondary: '#1f2937',
        },
      },
      error: {
        style: {
          color: '#ef4444',
          border: '1px solid #7f1d1d',
        },
        iconTheme: {
          primary: '#ef4444',
          secondary: '#1f2937',
        },
      },
      loading: {
        style: {
          color: '#3b82f6',
          border: '1px solid #1e40af',
        },
        iconTheme: {
          primary: '#3b82f6',
          secondary: '#1f2937',
        },
      },
    }
  );
};