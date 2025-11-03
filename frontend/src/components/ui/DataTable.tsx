import React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./Skeleton";

export interface Column<T = unknown> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (value: T, row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T = unknown> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pagination?: boolean;
  sortable?: boolean;
  selectable?: boolean;
  onRowClick?: (row: T) => void;
  onSort?: (key: string, direction: "asc" | "desc") => void;
  onSelect?: (rows: T[]) => void;
  className?: string;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  sortable = false,
  selectable = false,
  onRowClick,
  onSort,
  onSelect,
  className,
  emptyMessage = "No data available",
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = React.useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [selectedRows, setSelectedRows] = React.useState<T[]>([]);

  const handleSort = (key: string) => {
    if (!sortable) return;

    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }

    setSortConfig({ key, direction });
    onSort?.(key, direction);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(data);
      onSelect?.(data);
    } else {
      setSelectedRows([]);
      onSelect?.([]);
    }
  };

  const handleSelectRow = (row: T, checked: boolean) => {
    let newSelection: T[];
    if (checked) {
      newSelection = [...selectedRows, row];
    } else {
      newSelection = selectedRows.filter((r) => r !== row);
    }
    setSelectedRows(newSelection);
    onSelect?.(newSelection);
  };

  const isAllSelected = data.length > 0 && selectedRows.length === data.length;
  const isSomeSelected =
    selectedRows.length > 0 && selectedRows.length < data.length;

  if (loading) {
    return (
      <div className={cn("bg-card-bg rounded-lg overflow-hidden", className)}>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={40} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card-bg rounded-lg overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-hover-bg">
            <tr>
              {selectable && (
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-muted-text/30 bg-card-bg text-primary-green focus:ring-primary-green focus:ring-offset-0"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-sm font-medium text-secondary-text",
                    sortable &&
                      column.sortable !== false &&
                      "cursor-pointer hover:text-primary-text",
                    column.className
                  )}
                  onClick={() =>
                    column.sortable !== false && handleSort(column.key)
                  }
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.header}</span>
                    {sortable && column.sortable !== false && (
                      <div className="flex flex-col">
                        <ChevronUp
                          className={cn(
                            "h-3 w-3",
                            sortConfig?.key === column.key &&
                              sortConfig.direction === "asc"
                              ? "text-primary-green"
                              : "text-muted-text/50"
                          )}
                        />
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 -mt-1",
                            sortConfig?.key === column.key &&
                              sortConfig.direction === "desc"
                              ? "text-primary-green"
                              : "text-muted-text/50"
                          )}
                        />
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-muted-text/10">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-8 text-center text-secondary-text"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const isSelected = selectedRows.includes(row);
                return (
                  <tr
                    key={index}
                    className={cn(
                      "hover:bg-hover-bg/50 transition-colors",
                      onRowClick && "cursor-pointer",
                      isSelected && "bg-primary-green/10"
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            handleSelectRow(row, e.target.checked)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-muted-text/30 bg-card-bg text-primary-green focus:ring-primary-green focus:ring-offset-0"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-4 py-3 text-sm text-primary-text",
                          column.className
                        )}
                      >
                        {column.render
                          ? column.render(row[column.key] as T, row)
                          : String(row[column.key] || "")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
