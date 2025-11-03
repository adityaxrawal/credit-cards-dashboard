import React, { useState, useRef, useEffect, useCallback } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

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
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
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
          event.preventDefault();
          if (value) {
            handleDateSelect(value);
          }
          break;
        case "ArrowLeft":
          event.preventDefault();
          navigateMonth("prev");
          break;
        case "ArrowRight":
          event.preventDefault();
          navigateMonth("next");
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, value, handleDateSelect, navigateMonth]);

  return (
    <div ref={datePickerRef} className={`relative ${className}`}>
      {/* Input Field */}
      <div
        className={`
          flex items-center border rounded-lg px-3 py-2 cursor-pointer
          ${
            disabled
              ? "bg-gray-100 dark:bg-[#2A2D34] border-gray-300 dark:border-gray-600 cursor-not-allowed"
              : "bg-white dark:bg-[#1A1D21] border-gray-300 dark:border-gray-600 hover:border-[#6ECB8E] dark:hover:border-[#6ECB8E]"
          }
          ${isOpen ? "ring-2 ring-[#6ECB8E] border-[#6ECB8E]" : ""}
        `}
        onClick={handleToggle}
      >
        <input
          ref={inputRef}
          type="text"
          value={formatDate(value || null)}
          placeholder={placeholder}
          readOnly
          disabled={disabled}
          className={`
            flex-1 bg-transparent outline-none text-sm
            ${
              disabled
                ? "text-gray-400 dark:text-gray-500"
                : "text-gray-900 dark:text-white"
            }
            placeholder-gray-400 dark:placeholder-gray-500
          `}
        />

        <div className="flex items-center gap-1">
          {showClearButton && value && !disabled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ×
            </button>
          )}
          <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </div>
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#25282E] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigateMonth("prev")}
                className="p-1"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateYear("prev")}
                  className="text-sm font-medium text-gray-900 dark:text-white hover:text-[#6ECB8E] dark:hover:text-[#6ECB8E]"
                >
                  {viewDate.getFullYear()}
                </button>
                <button
                  onClick={() => navigateMonth("prev")}
                  className="text-sm font-medium text-gray-900 dark:text-white hover:text-[#6ECB8E] dark:hover:text-[#6ECB8E]"
                >
                  {MONTHS[viewDate.getMonth()]}
                </button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigateMonth("next")}
                className="p-1"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 gap-1 p-2 border-b border-gray-200 dark:border-gray-700">
            {DAYS.map((day) => (
              <div
                key={day}
                className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1 p-2">
            {calendarDays.map((date, index) => {
              const isCurrentMonth = date.getMonth() === viewDate.getMonth();
              const isSelected = isDateSelected(date);
              const isToday = isDateToday(date);
              const isDisabled = isDateDisabled(date);

              return (
                <button
                  key={index}
                  onClick={() => handleDateSelect(date)}
                  disabled={isDisabled}
                  className={`
                    text-sm py-2 px-1 rounded text-center transition-colors
                    ${
                      !isCurrentMonth
                        ? "text-gray-300 dark:text-gray-600"
                        : isSelected
                          ? "bg-[#6ECB8E] text-white"
                          : isToday
                            ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                            : "text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                    }
                    ${isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDateSelect(new Date())}
              className="text-[#6ECB8E] hover:text-[#6ECB8E]"
            >
              Today
            </Button>

            {showClearButton && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClear}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
