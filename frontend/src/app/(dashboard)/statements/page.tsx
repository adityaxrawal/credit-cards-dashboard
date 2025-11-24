"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { FileUpload } from "@/components/statements/FileUpload";
import { StatementList } from "@/components/statements/StatementList";
import { statementsApi } from "@/lib/api/statements";
import { useToast } from "@/components/ui/Toast";

export default function StatementsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  // Fetch statements with polling for processing status
  const { data: statements = [] } = useQuery({
    queryKey: ["statements"],
    queryFn: statementsApi.getStatements,
    refetchInterval: (query) => {
      // Poll every 5 seconds if any statement is processing
      const hasProcessing = query.state.data?.some(
        (s) => s.status === "processing"
      );
      return hasProcessing ? 5000 : false;
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: statementsApi.uploadStatement,
    onMutate: () => {
      setIsUploading(true);
    },
    onSuccess: () => {
      toast({
        title: "Upload Successful",
        description: "Statement uploaded and queued for processing.",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["statements"] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload statement.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: statementsApi.deleteStatement,
    onSuccess: () => {
      toast({
        title: "Statement Deleted",
        description: "The statement has been removed.",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["statements"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete statement.",
        variant: "destructive",
      });
    },
  });

  const handleUpload = (file: File) => {
    uploadMutation.mutate(file);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this statement?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <AppLayout title="Statements" showRightSidebar={false}>
      <div className="space-y-8">
        {/* Header Section */}
        <div>
          <p className="text-secondary-text">
            Upload and manage your credit card statements. We'll automatically extract transactions and insights.
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-card-bg rounded-xl border border-muted-text/10 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-primary-text mb-4">Upload New Statement</h2>
          <FileUpload 
            onUpload={handleUpload} 
            isUploading={isUploading}
            accept=".pdf,.csv"
          />
        </div>

        {/* Statements List */}
        <div>
          <h2 className="text-lg font-semibold text-primary-text mb-4">Statement History</h2>
          <StatementList 
            statements={statements} 
            onDelete={handleDelete}
          />
        </div>
      </div>
    </AppLayout>
  );
}
