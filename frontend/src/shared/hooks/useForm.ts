import { useState, useCallback, ChangeEvent } from "react";

export interface FormField<T = string> {
  value: T;
  error?: string;
  touched: boolean;
  required?: boolean;
}

type ValidationRule<T> = (value: T) => string | undefined;

export interface UseFormOptions<T extends Record<string, unknown>> {
  initialValues: T;
  validationRules?: Partial<Record<keyof T, ValidationRule<T[keyof T]>>>;
  onSubmit?: (values: T) => void | Promise<void>;
}

export interface UseFormReturn<T extends Record<string, unknown>> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;

  // Field operations
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setError: <K extends keyof T>(field: K, error: string | undefined) => void;
  setTouched: <K extends keyof T>(field: K, touched?: boolean) => void;

  // Form operations
  handleChange: <K extends keyof T>(
    field: K
  ) => (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  handleBlur: <K extends keyof T>(field: K) => () => void;
  handleSubmit: (event?: React.FormEvent) => Promise<void>;
  reset: () => void;
  validate: () => boolean;
}

/**
 * Hook for form state management with validation
 * @param options - Form configuration options
 * @returns Form state and handlers
 */
export function useForm<T extends Record<string, unknown>>(
  options: UseFormOptions<T>
): UseFormReturn<T> {
  const { initialValues, validationRules = {}, onSubmit } = options;

  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouchedState] = useState<
    Partial<Record<keyof T, boolean>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if form is dirty (values changed from initial)
  const isDirty = Object.keys(initialValues).some(
    (key) => values[key] !== initialValues[key]
  );

  // Validate a single field
  const validateField = useCallback(
    (field: keyof T, value: T[keyof T]): string | undefined => {
      if (
        validationRules &&
        Object.prototype.hasOwnProperty.call(validationRules, field)
      ) {
        const rule = (
          validationRules as Record<keyof T, ValidationRule<T[keyof T]>>
        )[field];
        if (rule) {
          return rule(value);
        }
      }
      return undefined;
    },
    [validationRules]
  );

  // Validate all fields
  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    Object.keys(values).forEach((key) => {
      const field = key as keyof T;
      const error = validateField(field, values[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, validateField]);

  const isValid = Object.keys(errors).length === 0;

  // Set error for a specific field
  const setError = useCallback(
    <K extends keyof T>(field: K, error: string | undefined) => {
      setErrors((prev) => ({
        ...prev,
        [field]: error,
      }));
    },
    []
  );

  // Set value for a specific field
  const setValue = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setValues((prev) => ({ ...prev, [field]: value }));

      // Validate field if it has been touched
      if (touched[field]) {
        const error = validateField(field, value);
        setError(field, error);
      }
    },
    [touched, validateField, setError]
  );

  // Set touched state for a specific field
  const setTouched = useCallback(
    <K extends keyof T>(field: K, isTouched = true) => {
      setTouchedState((prev) => ({ ...prev, [field]: isTouched }));
    },
    []
  );

  // Handle input change
  const handleChange = useCallback(
    <K extends keyof T>(field: K) =>
      (
        event: ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >
      ) => {
        const { value, type, checked } = event.target as HTMLInputElement;
        const fieldValue = type === "checkbox" ? checked : value;
        setValue(field, fieldValue as T[K]);
      },
    [setValue]
  );

  // Handle input blur (mark as touched and validate)
  const handleBlur = useCallback(
    <K extends keyof T>(field: K) =>
      () => {
        setTouched(field, true);
        const error = validateField(field, values[field]);
        setError(field, error);
      },
    [values, validateField, setTouched, setError]
  );

  // Handle form submission
  const handleSubmit = useCallback(
    async (event?: React.FormEvent) => {
      if (event) {
        event.preventDefault();
      }

      // Mark all fields as touched
      const allTouched: Partial<Record<keyof T, boolean>> = {};
      Object.keys(values).forEach((key) => {
        allTouched[key as keyof T] = true;
      });
      setTouchedState(allTouched);

      // Validate form
      const isFormValid = validate();

      if (isFormValid && onSubmit) {
        setIsSubmitting(true);
        try {
          await onSubmit(values);
        } catch (error) {
          console.error("Form submission error:", error);
        } finally {
          setIsSubmitting(false);
        }
      }
    },
    [values, validate, onSubmit]
  );

  // Reset form to initial state
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouchedState({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    setValue,
    setError,
    setTouched,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    validate,
  };
}

/**
 * Hook for simple form field management
 */
export function useFormField<T = string>(
  initialValue: T,
  validator?: (value: T) => string | undefined
) {
  const [value, setValue] = useState<T>(initialValue);
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback(
    (newValue: T) => {
      setValue(newValue);
      if (touched && validator) {
        setError(validator(newValue));
      }
    },
    [touched, validator]
  );

  const handleBlur = useCallback(() => {
    setTouched(true);
    if (validator) {
      setError(validator(value));
    }
  }, [value, validator]);

  const reset = useCallback(() => {
    setValue(initialValue);
    setError(undefined);
    setTouched(false);
  }, [initialValue]);

  return {
    value,
    error,
    touched,
    setValue: handleChange,
    handleBlur,
    reset,
    isValid: !error,
  };
}
