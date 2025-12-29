"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/primitives/Button";
import { Input } from "@/components/ui/primitives/Input";
import { Label } from "@/components/ui/primitives/label";
import { RefreshCw, X, CheckCircle, XCircle, AlertCircle, Calendar } from "lucide-react";
import { gmailApi } from "@/lib/api/gmail";
import { ManualCardMappingModal } from "./ManualCardMappingModal";
import { useGmailSync } from "@/lib/contexts/GmailWebSocketContext";
import { toast } from "react-hot-toast";

interface GmailSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSyncComplete?: () => void;
}

export function GmailSyncModal({
  isOpen,
  onClose,
}: GmailSyncModalProps) {
  const [configMode, setConfigMode] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [mappingMessageId, setMappingMessageId] = useState<string | null>(null);

  // Consume Global Sync State
  const { state, startSyncObservation, resetState } = useGmailSync();
  const { 
    isSyncing, 
    status, 
    jobId, 
    processed, 
    total, 
    inserted, 
    errors, 
    currentStep,
    progress: progressPercent,
    postProcessingStats,
    errorList,
    errorMessage: apiErrorMessage
  } = state;

  const isCompleted = status === 'COMPLETED';
  const isFailed = status === 'FAILED';

  // State initialization when opening modal
  React.useEffect(() => {
    if (isOpen) {
      if (!isSyncing && !isCompleted && !isFailed) {
        setConfigMode(true);
        loadDates();
      } else {
        // If already syncing or showing results, show status view
        setConfigMode(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadDates = async () => {
    try {
      const { lastSync } = await gmailApi.getLastSync();
      const end = new Date();
      // Default to 90 days if no last sync, otherwise use last sync date
      const start = lastSync ? new Date(lastSync) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    } catch (e) {
      console.error("Failed to load last sync:", e);
      setStartDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      setEndDate(new Date().toISOString().split('T')[0]);
    }
  };

  const handleSync = async () => {
    console.log(`[GmailSync] Starting manual sync... Range: ${startDate || 'Default'} to ${endDate || 'Default'}`);
    setConfigMode(false);
    // Reset any previous state (though startSyncObservation does it too)
    resetState();

    try {
      const result = await gmailApi.scanHistorical(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      if (result.jobId) {
        console.log(`[GmailSync] Job started: ${result.jobId}`);
        startSyncObservation(result.jobId);
      }
    } catch (error: unknown) {
      console.error("Sync error:", error);
      const apiError = error as { message?: string; response?: { data?: { error?: { message?: string } } } };
      const msg = apiError?.response?.data?.error?.message || apiError?.message || "Failed to start sync";
      toast.error(msg);
      // We manually update state here if needed, but easier to let user retry
      setConfigMode(true); 
    }
  };

  const handleClose = () => {
    // FORCE close allowed
    onClose();
    // We do NOT reset state on close if syncing, so user can background it
    if (!isSyncing) {
       // Optional: reset state on close if finished? 
       // resetState(); 
    }
  };

  const resetAndViewConfig = () => {
    resetState();
    setConfigMode(true);
    loadDates();
  };

  if (!isOpen) return null;

  // Calculate percentage for display
  const displayPercent = progressPercent ?? (total > 0 ? Math.round((processed / total) * 100) : 0);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={(e) => e.stopPropagation()} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card-bg rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary-text flex items-center gap-2">
              <RefreshCw className={isSyncing ? "animate-spin" : ""} size={24} />
              Gmail Sync
            </h2>
            <button
                onClick={handleClose}
                className="text-secondary-text hover:text-primary-text transition-colors"
             >
                <X size={24} />
             </button>
          </div>

          {configMode ? (
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 flex items-start gap-2">
                <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Select the date range to scan for transactions.</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Start Date</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                   <Label className="text-sm font-medium">End Date</Label>
                   <Input 
                     type="date" 
                     value={endDate} 
                     onChange={(e) => setEndDate(e.target.value)} 
                   />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-muted-text/10">
                <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleSync} disabled={!startDate || !endDate}>Start Sync</Button>
              </div>
            </div>
          ) : (
            <>
              {/* Status Messages (Completed) */}
              {isCompleted && (
                <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                  <div>
                    <p className="font-semibold text-green-900">Sync Complete!</p>
                    <p className="text-sm text-green-700 mt-1">
                      Found {inserted || 0} new transaction{inserted !== 1 ? "s" : ""} 
                      {total ? ` out of ${total} emails scanned` : ''}
                    </p>
                    {postProcessingStats && (
                      <div className="mt-2 text-xs text-green-800 space-y-1">
                         {postProcessingStats.billsCreated ? (
                            <p>• Generated {postProcessingStats.billsCreated} new bills</p>
                         ) : null}
                         {postProcessingStats.instrumentsCreated ? (
                            <p>• Detected {postProcessingStats.instrumentsCreated} new cards</p>
                         ) : null}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status Messages (Failed) */}
              {isFailed && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle className="text-red-600 flex-shrink-0" size={24} />
                  <div className="flex-1">
                    <p className="font-semibold text-red-900">Sync Failed</p>
                    <p className="text-sm text-red-700 mt-1">
                      {apiErrorMessage || "An error occurred during scanning"}
                    </p>
                  </div>
                </div>
              )}

              {/* Progress View */}
              {(isSyncing || (!isCompleted && !isFailed)) && (
                <div className="space-y-4">
                  {/* Post-Processing Steps UI */}
                  {currentStep?.startsWith("POST_PROCESSING") ? (
                    <div className="space-y-3 bg-hover-bg rounded-xl p-4 border border-border-color">
                      <h3 className="text-sm font-semibold text-primary-text mb-2">Finalizing Sync...</h3>
                      
                      <div className="flex items-center gap-3">
                        <CheckCircle className="text-green-600 w-5 h-5 flex-shrink-0" />
                        <span className="text-secondary-text text-sm">Sync Emails & Transactions</span>
                      </div>

                      <div className="flex items-center gap-3">
                        {currentStep === 'POST_PROCESSING_ANALYTICS' ? (
                            <RefreshCw className="text-primary-green w-5 h-5 flex-shrink-0 animate-spin" />
                        ) : (
                            <CheckCircle className="text-green-600 w-5 h-5 flex-shrink-0" />
                        )}
                        <span className={`text-sm ${currentStep === 'POST_PROCESSING_ANALYTICS' ? "text-primary-text font-medium" : "text-secondary-text"}`}>
                            Computing Analytics
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                         {currentStep === 'POST_PROCESSING_ANALYTICS' ? (
                            <div className="w-5 h-5 rounded-full border-2 border-muted-text/20 flex-shrink-0" />
                        ) : currentStep === 'POST_PROCESSING_BILLS' ? (
                            <RefreshCw className="text-primary-green w-5 h-5 flex-shrink-0 animate-spin" />
                        ) : (
                            <CheckCircle className="text-green-600 w-5 h-5 flex-shrink-0" />
                        )}
                        <span className={`text-sm ${currentStep === 'POST_PROCESSING_BILLS' ? "text-primary-text font-medium" : "text-secondary-text"}`}>
                            Generating Bills {postProcessingStats?.billsCreated ? `(${postProcessingStats.billsCreated} created)` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                         {['POST_PROCESSING_ANALYTICS', 'POST_PROCESSING_BILLS'].includes(currentStep || '') ? (
                            <div className="w-5 h-5 rounded-full border-2 border-muted-text/20 flex-shrink-0" />
                        ) : currentStep === 'POST_PROCESSING_CARDS' ? (
                            <RefreshCw className="text-primary-green w-5 h-5 flex-shrink-0 animate-spin" />
                        ) : (
                            <CheckCircle className="text-green-600 w-5 h-5 flex-shrink-0" />
                        )}
                        <span className={`text-sm ${currentStep === 'POST_PROCESSING_CARDS' ? "text-primary-text font-medium" : "text-secondary-text"}`}>
                            Detecting New Cards {postProcessingStats?.instrumentsCreated ? `(${postProcessingStats.instrumentsCreated} found)` : ''}
                        </span>
                      </div>
                    </div>
                  ) : (
                  // Normal Fetch/Process Progress
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-secondary-text">
                      <span>
                        {processed}/{total} emails processed
                      </span>
                      <span className="font-semibold">{displayPercent}%</span>
                    </div>
                    <div className="w-full bg-hover-bg rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-primary-green h-3 transition-all duration-300 ease-out"
                        style={{ width: `${displayPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                       <p className="text-xs text-secondary-text">
                           {(!jobId || jobId === '') ? 'Initializing...' : 
                             currentStep === 'FETCHING' ? 'Fetching emails...' :
                             currentStep === 'PROCESSING_AND_FETCHING' ? 'Processing emails...' :
                             currentStep || 'Scanning...'}
                       </p>
                    </div>
                  </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-hover-bg rounded-lg p-3">
                      <p className="text-xs text-secondary-text">Transactions Found</p>
                      <p className="text-2xl font-bold text-primary-text mt-1">
                        {inserted || 0}
                      </p>
                    </div>

                    <div className="bg-hover-bg rounded-lg p-3">
                      <p className="text-xs text-secondary-text">Errors</p>
                      <p className="text-2xl font-bold text-primary-text mt-1">
                        {errors || 0}
                      </p>
                    </div>
                    <div className="bg-hover-bg rounded-lg p-3 col-span-2">
                       <p className="text-xs text-secondary-text">Emails Scanned</p>
                       <p className="text-xl font-bold text-primary-text mt-1">
                         {total || 0}
                       </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                      <p className="text-xs text-blue-900">
                        Scanning your Gmail for credit card transaction emails. 
                        This scan happens in the background. You can close this window.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error List & Manual Mapping */}
              {errorList && errorList.length > 0 && (
                <div className="mt-4 border-t border-border-color pt-4">
                  <h3 className="text-sm font-semibold text-primary-text mb-2">Failed Items</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {errorList.map((err: unknown, idx: number) => {
                       /* eslint-disable @typescript-eslint/no-explicit-any */
                       const errMsg = typeof err === 'string' ? err : (err as any).message || (err as any).error || JSON.stringify(err);
                       const msgId = (err as any)?.messageId;
                       
                       return (
                      <div key={idx} className="flex items-center justify-between bg-hover-bg p-2 rounded text-xs">
                        <span className="truncate flex-1 mr-2 text-red-500" title={errMsg}>
                          {errMsg}
                        </span>
                        {msgId && (
                            <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 text-[10px]"
                            onClick={() => setMappingMessageId(msgId)}
                            >
                            Map Card
                            </Button>
                        )}
                      </div>
                    )})}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-muted-text/10">
                {isCompleted || isFailed ? (
                  <>
                    <Button onClick={resetAndViewConfig} variant="ghost">Start New Sync</Button>
                    <Button onClick={handleClose} variant="primary">Close</Button>
                  </>
                ) : isSyncing ? (
                  <Button onClick={handleClose} variant="primary">Run in Background</Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {mappingMessageId && (
        <ManualCardMappingModal
          isOpen={true}
          onClose={() => setMappingMessageId(null)}
          messageId={mappingMessageId}
          onSuccess={() => {
            // No-op for now
          }}
        />
      )}
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
    // Ideally we update lastSync from context or API, but simple local state is fine for now
    setLastSync(new Date());
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
            Last check: {lastSync.toLocaleTimeString()}
          </span>
        )}
      </div>

      <GmailSyncModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSyncComplete={onSyncComplete}
      />
    </>
  );
}
