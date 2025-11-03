"use client";

import { useState, useEffect } from "react";
import {
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader,
} from "lucide-react";

interface ScanProgress {
  jobId: string;
  status:
    | "pending"
    | "running"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";
  totalMessages: number;
  processedMessages: number;
  extractedTransactions: number;
  failedMessages: number;
  duplicateMessages: number;
  progressPercentage: number;
  estimatedCompletion?: string;
  startedAt?: string;
  completedAt?: string;
}

export default function HistoricalScanProgress({ jobId }: { jobId: string }) {
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = async () => {
    try {
      const response = await fetch(`/api/scanner/progress/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setProgress(data);
      }
    } catch (error) {
      console.error("Failed to fetch progress:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchProgress();

    // Poll every 2 seconds while job is running
    const interval = setInterval(() => {
      if (progress?.status === "running" || progress?.status === "pending") {
        fetchProgress();
      }
    }, 2000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, progress?.status]);

  const handlePause = async () => {
    try {
      await fetch(`/api/scanner/${jobId}/pause`, { method: "POST" });
      fetchProgress();
    } catch (error) {
      console.error("Failed to pause:", error);
    }
  };

  const handleResume = async () => {
    try {
      await fetch(`/api/scanner/${jobId}/resume`, { method: "POST" });
      fetchProgress();
    } catch (error) {
      console.error("Failed to resume:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-red-800">Job not found</p>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (progress.status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "running":
        return <Loader className="w-5 h-5 animate-spin text-blue-500" />;
      case "paused":
        return <Pause className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "failed":
        return "bg-red-100 text-red-800 border-red-200";
      case "running":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "paused":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h3 className="text-lg font-semibold">Historical Email Scan</h3>
            <p className="text-sm text-gray-600">
              Job ID: {jobId.slice(0, 8)}...
            </p>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor()}`}
        >
          {progress.status.toUpperCase()}
        </span>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Progress</span>
          <span className="font-medium">
            {progress.progressPercentage.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-500 h-full transition-all duration-300 ease-out"
            style={{ width: `${progress.progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Total Messages</p>
          <p className="text-2xl font-bold text-gray-900">
            {progress.totalMessages.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Processed</p>
          <p className="text-2xl font-bold text-blue-600">
            {progress.processedMessages.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Extracted</p>
          <p className="text-2xl font-bold text-green-600">
            {progress.extractedTransactions.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Failed</p>
          <p className="text-2xl font-bold text-red-600">
            {progress.failedMessages.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="pt-4 border-t border-gray-200 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Duplicates Skipped</span>
          <span className="font-medium">
            {progress.duplicateMessages.toLocaleString()}
          </span>
        </div>
        {progress.startedAt && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Started</span>
            <span className="font-medium">
              {new Date(progress.startedAt).toLocaleString()}
            </span>
          </div>
        )}
        {progress.completedAt && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Completed</span>
            <span className="font-medium">
              {new Date(progress.completedAt).toLocaleString()}
            </span>
          </div>
        )}
        {progress.estimatedCompletion && progress.status === "running" && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Est. Completion</span>
            <span className="font-medium">
              {new Date(progress.estimatedCompletion).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      {(progress.status === "running" || progress.status === "paused") && (
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          {progress.status === "running" && (
            <button
              onClick={handlePause}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
            >
              <Pause className="w-4 h-4" />
              Pause Scan
            </button>
          )}
          {progress.status === "paused" && (
            <button
              onClick={handleResume}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              Resume Scan
            </button>
          )}
        </div>
      )}
    </div>
  );
}
