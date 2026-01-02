import React, { useState, useRef, useEffect, useCallback } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/shared/components/ui";
import { cn } from "@/shared/utils"; // Assuming cn is available here, otherwise will use template literals but cn is safer given other files use it.
// Checking imports in TransactionsPageClient (step 20) confirms 'cn' is in '@/shared/utils'.

export interface DatePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  dateFormat?: string;
  showClearButton?: boolean;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
  className = "",
  minDate,
  maxDate,
  dateFormat = "MM/dd/yyyy",
  showClearButton = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value || new Date());
  const datePickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync viewDate when value changes
  useEffect(() => {
    if (value) {
      setViewDate(value);
    }
  }, [value]);

  const formatDate = useCallback(
    (date: Date | null): string => {
      if (!date) return "";

      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      const year = date.getFullYear();

      return dateFormat
        .replace("MM", month)
        .replace("dd", day)
        .replace("yyyy", year.toString());
    },
    [dateFormat]
  );

  const handleDateSelect = useCallback(
    (date: Date) => {
      if (disabled) return;

      // Check if date is within valid range
      if (minDate && date < minDate) return;
      if (maxDate && date > maxDate) return;

      onChange(date);
      setIsOpen(false);
    },
    [disabled, minDate, maxDate, onChange]
  );

  const handleClear = useCallback(() => {
    if (disabled) return;
    onChange(null);
    setIsOpen(false);
  }, [disabled, onChange]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  const navigateMonth = useCallback(
    (direction: "prev" | "next") => {
      const newDate = new Date(viewDate);
      if (direction === "prev") {
        newDate.setMonth(viewDate.getMonth() - 1);
      } else {
        newDate.setMonth(viewDate.getMonth() + 1);
      }
      setViewDate(newDate);
    },
    [viewDate]
  );

  const navigateYear = (direction: "prev" | "next") => {
    const newDate = new Date(viewDate);
    if (direction === "prev") {
      newDate.setFullYear(viewDate.getFullYear() - 1);
    } else {
      newDate.setFullYear(viewDate.getFullYear() + 1);
    }
    setViewDate(newDate);
  };

  const isDateDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const isDateSelected = (date: Date): boolean => {
    if (!value) return false;
    return (
      date.getDate() === value.getDate() &&
      date.getMonth() === value.getMonth() &&
      date.getFullYear() === value.getFullYear()
    );
  };

  const isDateToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const generateCalendarDays = (): Date[] => {
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const currentDate = new Date(startDate);

    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case "Escape":
          setIsOpen(false);
          break;
        case "Enter":
          if (document.activeElement === inputRef.current) {
             // If focused on input, maybe toggle? But standard is Enter accepts selection if grid focused.
             // We'll leave specific grid focus logic for now or simple "Enter closes" if handled.
          }
          break;
        // Basic month navigation shortcuts could go here if grid focus management was implemented
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <div ref={datePickerRef} className={`relative ${className}`}>
      {/* Input Field */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer group",
          disabled
            ? "bg-bg-primary/50 border-border opacity-60 cursor-not-allowed"
            : "bg-primary-bg border-border hover:border-border/80 hover:bg-hover-bg",
          isOpen && "ring-1 ring-primary-green border-primary-green",
        )}
        onClick={handleToggle}
      >
        <CalendarIcon className={cn(
            "w-4 h-4 transition-colors",
            isOpen || value ? "text-primary-green hover:text-primary-green" : "text-secondary-text group-hover:text-primary-text"
        )} />
        
        <input
          ref={inputRef}
          type="text"
          value={formatDate(value || null)}
          placeholder={placeholder}
          readOnly
          disabled={disabled}
          className={cn(
            "flex-1 bg-transparent outline-none text-sm transition-colors cursor-pointer",
            disabled ? "text-muted-text" : "text-primary-text placeholder-secondary-text"
          )}
        />

        {showClearButton && value && !disabled && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-1 -mr-1 rounded-full hover:bg-white/10 text-muted-text hover:text-error transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-card-bg border border-border rounded-xl shadow-2xl z-50 min-w-[280px] p-3 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-4 px-1">
            <button
               onClick={() => navigateMonth("prev")}
               className="p-1.5 rounded-lg hover:bg-hover-bg text-secondary-text hover:text-primary-text transition-colors"
               aria-label="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
               <span className="text-sm font-semibold text-primary-text">
                  {MONTHS[viewDate.getMonth()]}
               </span>
               <span className="text-sm font-medium text-secondary-text">
                  {viewDate.getFullYear()}
               </span>
            </div>

            <button
               onClick={() => navigateMonth("next")}
               className="p-1.5 rounded-lg hover:bg-hover-bg text-secondary-text hover:text-primary-text transition-colors"
               aria-label="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map((day) => (
              <div
                key={day}
                className="text-[10px] font-bold text-secondary-text uppercase tracking-wider text-center py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) => {
              const isCurrentMonth = date.getMonth() === viewDate.getMonth();
              const isSelected = isDateSelected(date);
              const isToday = isDateToday(date);
              const isDisabled = isDateDisabled(date);

              return (
                <button
                  key={index}
                  onClick={(e) => {
                      e.preventDefault();
                      handleDateSelect(date);
                  }}
                  disabled={isDisabled}
                  className={cn(
                    "relative h-9 rounded-lg text-sm flex items-center justify-center transition-all duration-200",
                    !isCurrentMonth && "text-muted-text opacity-30 font-normal",
                    isCurrentMonth && !isSelected && !isToday && "text-primary-text hover:bg-hover-bg",
                    isToday && !isSelected && "text-primary-green font-semibold bg-primary-green/5 ring-1 ring-primary-green/30",
                    isSelected && "bg-primary-green text-primary-bg font-bold shadow-sm scale-105",
                    isDisabled && "opacity-20 cursor-not-allowed hover:bg-transparent"
                  )}
                >
                  {date.getDate()}
                  {isToday && !isSelected && (
                      <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary-green" />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Footer - "Go to Today" */}
          <div className="mt-3 pt-3 border-t border-border flex justify-center">
               <button 
                  onClick={() => handleDateSelect(new Date())}
                  className="text-xs font-medium text-primary-green hover:underline decoration-primary-green/50 underline-offset-4"
               >
                   Today
               </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
