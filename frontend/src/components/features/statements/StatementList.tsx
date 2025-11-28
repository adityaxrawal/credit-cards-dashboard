"use client";

import React from "react";
import { FileText, CheckCircle, XCircle, Clock, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/Badge";

export interface Statement {
  id: string;
  filename: string;
  uploadDate: string;
  status: "processing" | "completed" | "failed";
  url?: string;
  size?: number;
}

interface StatementListProps {
  statements: Statement[];
  onDelete?: (id: string) => void;
}

export function StatementList({ statements, onDelete }: StatementListProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="success" className="bg-success/10 text-success border-0">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="warning" className="bg-warning/10 text-warning border-0">
            <Clock className="w-3 h-3 mr-1 animate-pulse" />
            Processing
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="bg-error/10 text-error border-0">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (statements.length === 0) {
    return (
      <div className="text-center py-12 bg-card-bg rounded-xl border border-muted-text/10">
        <div className="w-12 h-12 rounded-full bg-hover-bg flex items-center justify-center mx-auto mb-4">
          <FileText className="w-6 h-6 text-secondary-text" />
        </div>
        <h3 className="text-lg font-medium text-primary-text">No statements yet</h3>
        <p className="text-secondary-text mt-1">Upload your first statement to get started</p>
      </div>
    );
  }

  return (
    <div className="bg-card-bg rounded-xl border border-muted-text/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-muted-text/10">
          <thead className="bg-hover-bg">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                File Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                Date Uploaded
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-secondary-text uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-secondary-text uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted-text/10 bg-card-bg">
            {statements.map((statement) => (
              <tr key={statement.id} className="hover:bg-hover-bg/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 text-secondary-text mr-3" />
                    <div>
                      <p className="text-sm font-medium text-primary-text">{statement.filename}</p>
                      {statement.size && (
                        <p className="text-xs text-secondary-text">{(statement.size / 1024 / 1024).toFixed(2)} MB</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-text">
                  {format(new Date(statement.uploadDate), "MMM d, yyyy HH:mm")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(statement.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    {statement.status === "completed" && statement.url && (
                      <a
                        href={statement.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-secondary-text hover:text-primary-green transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(statement.id)}
                        className="p-2 text-secondary-text hover:text-error transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
