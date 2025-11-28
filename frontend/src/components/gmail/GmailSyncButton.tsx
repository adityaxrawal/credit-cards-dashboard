"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { RefreshCw, X, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { gmailApi, type ScanStatus } from "@/lib/api/gmail";

interface GmailSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

/**
 * GmailSyncModal Component
 * Modal dialog for Gmail sync with progress tracking
 * Blocks dashboard interaction until sync is complete
 */
export function GmailSyncModal({
  isOpen,
  onClose,
  onSyncComplete,
}: GmailSyncModalProps) {
  const [syncing, setSyncing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanStatus | null>(null);
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-start sync when modal opens
  useEffect(() => {
    if (isOpen && !syncing && !completed && !failed) {
      handleSync();
    }
  }, [isOpen]);

  // Poll job status when jobId is set
  useEffect(() => {
    if (!jobId) return;

    const pollStatus = async () => {
      try {
        const status = await gmailApi.getScanStatus(jobId);
        setProgress(status);

        // Check if job is complete
        if (status.status === "completed") {
          clearPolling();
          handleCompletion(status);
        } else if (status.status === "failed") {
          clearPolling();
          handleFailure(status);
        }
      } catch (error) {
        console.error("Failed to poll job status:", error);
      }
    };

    // Start polling every 3 seconds
    pollIntervalRef.current = setInterval(pollStatus, 3000);

    return () => {
      clearPolling();
    };
  }, [jobId]);

  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setProgress(null);
    setCompleted(false);
    setFailed(false);
    setErrorMessage("");

    try {
      const result = await gmailApi.scanHistorical();

      if (result.jobId) {
        setJobId(result.jobId);
      }
    } catch (error: unknown) {
      console.error("Sync error:", error);

      const apiError = error as {
        response?: {
          data?: { 
            error?: { 
              message?: string;
              code?: string;
            };
            message?: string;
          };
          status?: number;
        };
        message?: string;
      };

      const statusCode = apiError?.response?.status;
      let errorMsg = 
        apiError?.response?.data?.error?.message ||
        apiError?.response?.data?.message ||
        apiError?.message ||
        "Failed to sync Gmail";

      // Provide helpful error messages
      if (errorMsg.includes("Gmail not connected") || errorMsg.includes("no refresh token")) {
        errorMsg = "Gmail not connected. Please connect your Gmail account in Settings before syncing.";
      } else if (statusCode === 400 || statusCode === 404) {
        errorMsg = "Gmail not connected. Please set up Gmail integration in Settings first.";
      }

      setErrorMessage(errorMsg);
      setFailed(true);
      setSyncing(false);
    }
  };

  const handleCompletion = (status: ScanStatus) => {
    setSyncing(false);
    setCompleted(true);
    setJobId(null);

    // Refresh UI
    window.dispatchEvent(new CustomEvent("transactions-updated"));
    window.dispatchEvent(new CustomEvent("refresh-dashboard"));

    if (onSyncComplete) {
      onSyncComplete();
    }
  };

  const handleFailure = (status: ScanStatus) => {
    setSyncing(false);
    setFailed(true);
    setJobId(null);
    setErrorMessage(status.errorMessage || "An error occurred during scanning");
  };

  const handleClose = () => {
    // Only allow closing if sync is complete or failed
    if (!syncing) {
      clearPolling();
      setJobId(null);
      setProgress(null);
      setCompleted(false);
      setFailed(false);
      setErrorMessage("");
      onClose();
    }
  };

  if (!isOpen) return null;

  // Calculate progress percentage
  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  return (
    <>
      {/* Backdrop - blocks interaction */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={(e) => e.stopPropagation()} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card-bg rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary-text flex items-center gap-2">
              <RefreshCw className={syncing ? "animate-spin" : ""} size={24} />
              Gmail Sync
            </h2>
            {!syncing && (
              <button
                onClick={handleClose}
                className="text-secondary-text hover:text-primary-text transition-colors"
              >
                <X size={24} />
              </button>
            )}
          </div>

          {/* Status Messages */}
          {completed && (
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
              <div>
                <p className="font-semibold text-green-900">Sync Complete!</p>
                <p className="text-sm text-green-700 mt-1">
                  Found {progress?.inserted || 0} new transaction{progress?.inserted !== 1 ? "s" : ""} 
                  {progress?.total && ` out of ${progress.total} emails scanned`}
                </p>
              </div>
            </div>
          )}

          {failed && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="text-red-600 flex-shrink-0" size={24} />
              <div className="flex-1">
                <p className="font-semibold text-red-900">Sync Failed</p>
                <p className="text-sm text-red-700 mt-1">
                  {errorMessage}
                </p>
                {errorMessage.includes("Gmail not connected") && (
                  <p className="text-xs text-red-600 mt-2">
                    💡 Tip: Go to Settings → Gmail Integration to connect your account
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Progress */}
          {syncing && !completed && !failed && (
            <div className="space-y-4">
              {progress ? (
                <>
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-secondary-text">
                      <span>
                        {progress.processed}/{progress.total} emails processed
                      </span>
                      <span className="font-semibold">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-hover-bg rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-primary-green h-3 transition-all duration-300 ease-out"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-hover-bg rounded-lg p-3">
                      <p className="text-xs text-secondary-text">Transactions Found</p>
                      <p className="text-2xl font-bold text-primary-text mt-1">
                        {progress.inserted || 0}
                      </p>
                    </div>
                    <div className="bg-hover-bg rounded-lg p-3">
                      <p className="text-xs text-secondary-text">Errors</p>
                      <p className="text-2xl font-bold text-primary-text mt-1">
                        {progress.errors || 0}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-green border-t-transparent mb-4" />
                  <p className="text-secondary-text">Starting scan...</p>
                  <p className="text-xs text-muted-text mt-1">This may take a moment</p>
                </div>
              )}

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-blue-900">
                    Scanning your Gmail for credit card transaction emails. 
                    This scans the last 3 months and typically takes 10-60 seconds.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-muted-text/10">
            {completed || failed ? (
              <Button onClick={handleClose} variant="primary">
                Close
              </Button>
            ) : syncing ? (
              <p className="text-sm text-secondary-text py-2">
                Syncing in progress...
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

interface GmailSyncButtonProps {
  onSyncComplete?: () => void;
  className?: string;
}

/**
 * GmailSyncButton Component
 * Button that triggers the Gmail sync modal
 */
export function GmailSyncButton({
  onSyncComplete,
  className,
}: GmailSyncButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setLastSync(new Date());
  };

  const handleSyncComplete = () => {
    if (onSyncComplete) {
      onSyncComplete();
    }
  };

  return (
    <>
      <div className={`flex items-center gap-4 ${className || ""}`}>
        <Button onClick={handleOpenModal} variant="primary" size="md">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Gmail
        </Button>

        {lastSync && (
          <span className="text-sm text-gray-500">
            Last synced: {lastSync.toLocaleTimeString()}
          </span>
        )}
      </div>

      <GmailSyncModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSyncComplete={handleSyncComplete}
      />
    </>
  );
}
