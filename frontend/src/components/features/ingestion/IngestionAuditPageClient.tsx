
"use client";

import React, { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Search, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  FileText,
  ExternalLink
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { 
  Button, 
  Input, 
  Badge, 
  Card,
  Select
} from "@/components/ui";
import { gmailApi, IngestionLogsResponse } from "@/lib/api/gmail";
import Link from "next/link";

export default function IngestionAuditPageClient() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const limit = 20;

  const { data, isLoading, refetch } = useQuery<IngestionLogsResponse>({
    queryKey: ["ingestion-logs", page, status, search],
    queryFn: () => gmailApi.getLogs({ page, limit, status, search }),
    placeholderData: keepPreviousData
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="success" className="flex items-center gap-1"><CheckCircle size={12}/> Success</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle size={12}/> Failed</Badge>;
      case 'ignored':
        return <Badge variant="secondary" className="flex items-center gap-1"><AlertCircle size={12}/> Ignored</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AppLayout title="Ingestion Audit">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Ingestion Logs
            </h1>
            <p className="text-gray-500 mt-1">
              Trace email processing from receipt to transaction creation.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center bg-white p-4 rounded-lg shadow-sm border">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search subject or sender..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative w-[180px]">
             <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
             >
                <option value="">All Statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="ignored">Ignored</option>
             </select>
          </div>
        </div>

        {/* Logs Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700 uppercase font-medium text-xs">
                <tr>
                  <th className="px-6 py-3">Received</th>
                  <th className="px-6 py-3">Subject / Sender</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Stage / Error</th>
                  <th className="px-6 py-3">Transaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : data?.data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No logs found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  data?.data.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {format(new Date(log.received_date || log.created_at), "MMM d, HH:mm")}
                      </td>
                      <td className="px-6 py-4 max-w-md">
                        <div className="font-medium text-gray-900 truncate" title={log.subject}>
                          {log.subject || "(No Subject)"}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{log.from_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(log.status_category)}
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="flex flex-col">
                           <span className="font-mono text-xs text-gray-700">{log.stage}</span>
                           {log.error_message && (
                             <span className="text-xs text-red-600 truncate" title={log.error_message}>
                               {log.error_message}
                             </span>
                           )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.transaction_id ? (
                          <Link href={`/transactions?id=${log.transaction_id}`} className="text-blue-600 hover:underline flex items-center gap-1">
                             <FileText size={14} />
                             {log.transaction_merchant} 
                             <span className="text-gray-500">({log.transaction_amount})</span>
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 border-t">
               <div className="text-sm text-gray-500">
                 Page {page} of {data.pagination.totalPages}
               </div>
               <div className="flex gap-2">
                 <Button 
                   variant="outline" 
                   size="sm" 
                   disabled={page === 1}
                   onClick={() => setPage(p => p - 1)}
                 >
                   Previous
                 </Button>
                 <Button 
                   variant="outline" 
                   size="sm" 
                   disabled={page === data.pagination.totalPages}
                   onClick={() => setPage(p => p + 1)}
                 >
                   Next
                 </Button>
               </div>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
