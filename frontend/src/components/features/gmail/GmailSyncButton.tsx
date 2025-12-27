"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/primitives/Button";
import { Input } from "@/components/ui/primitives/Input";
import { Label } from "@/components/ui/primitives/label";
import { RefreshCw, X, CheckCircle, XCircle, AlertCircle, Calendar } from "lucide-react";
import { gmailApi, type ScanStatus } from "@/lib/api/gmail";
import { ManualCardMappingModal } from "./ManualCardMappingModal";

interface GmailSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export function GmailSyncModal({
  isOpen,
  onClose,
  onSyncComplete,
}: GmailSyncModalProps) {
  const [configMode, setConfigMode] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const [syncing, setSyncing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ScanStatus | null>(null);
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [mappingMessageId, setMappingMessageId] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const lastStatusChangeRef = useRef<number>(Date.now());
  const lastStatusRef = useRef<ScanStatus | null>(null);

  // Initialize config when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log("[GmailSync] Modal opened");
      setConfigMode(true);
      setSyncing(false);
      setCompleted(false);
      setFailed(false);
      setJobId(null);
      setProgress(null);
      setTimeoutWarning(false);
      lastStatusChangeRef.current = Date.now();
      lastStatusRef.current = null;
      
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
      
      loadDates();
    }
  }, [isOpen]);

  const handleCompletion = useCallback((_status: ScanStatus) => {
    console.log("[GmailSync] Sync completed successfully");
    setSyncing(false);
    setCompleted(true);
    setJobId(null);
    setTimeoutWarning(false);

    // Refresh UI
    window.dispatchEvent(new CustomEvent("transactions-updated"));
    window.dispatchEvent(new CustomEvent("refresh-dashboard"));

    if (onSyncComplete) {
      onSyncComplete();
    }
  }, [onSyncComplete]);

  const handleFailure = useCallback((status: ScanStatus) => {
    console.error(`[GmailSync] Sync failed: ${status.errorMessage}`);
    setSyncing(false);
    setFailed(true);
    setJobId(null);
    setErrorMessage(status.errorMessage || "An error occurred during scanning");
  }, []);

  // Poll job status when jobId is set
  useEffect(() => {
    if (!jobId) return;

    // Reset timeout tracking when job starts
    lastStatusChangeRef.current = Date.now();
    lastStatusRef.current = null;
    setTimeoutWarning(false);

    const pollStatus = async () => {
      try {
        const status = await gmailApi.getScanStatus(jobId);
        // console.log(`[GmailSync] Polled status: ${status.status} (${status.processed}/${status.total})`);
        setProgress(status);

        // Check for progress changes to reset timeout
        const prev = lastStatusRef.current;
        const hasChanged = !prev || 
          prev.status !== status.status || 
          prev.processed !== status.processed || 
          prev.fetched !== status.fetched ||
          prev.currentStep !== status.currentStep;

        if (hasChanged) {
          lastStatusChangeRef.current = Date.now();
          lastStatusRef.current = status;
          setTimeoutWarning(false); // Clear warning if we see movement
        } else {
          // Check for timeout (30 seconds of no change)
          if (Date.now() - lastStatusChangeRef.current > 30000) {
            setTimeoutWarning(true);
          }
        }

        // Check if job is complete
        // Check if job is complete (Case insensitive)
        const s = status.status.toUpperCase();
        if (s === "COMPLETED") {
          clearPolling();
          handleCompletion(status);
        } else if (s === "FAILED") {
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
  }, [jobId, handleCompletion, handleFailure]);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // WebSocket Connection
  useEffect(() => {
    if (!jobId) return;

    let socket: Socket | null = null;

    try {
        socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', {
            transports: ['websocket'],
        });

        socket.on('connect', () => {
            console.log('[GmailSync] Connected to WebSocket');
            socket?.emit('subscribe', { jobId });
        });

        socket.on('processing_update', (event: any) => {
            console.log('[GmailSync] Received update:', event);
            if (event.payload) {
                const status = event.payload;
                setProgress(prev => ({
                    ...prev,
                    ...status,
                    // Map WebSocket stats to UI expectation
                    inserted: status.totalTransactions ?? prev?.inserted,
                    total: status.totalEmails ?? prev?.total,
                    // Keep previous errors/lists if not provided in update
                    errorList: status.errorList || prev?.errorList || [], 
                    jobId: jobId // Ensure jobId is preserved
                }));

                // Reset timeout on activity
                lastStatusChangeRef.current = Date.now();
                setTimeoutWarning(false);
            }
        });

        socket.on('processing_complete', (event: any) => {
             console.log('[GmailSync] Received completion:', event);
             if (event.payload) {
                 const status = event.payload;
                 // Ensure final stats are reflected in UI
                 setProgress(prev => ({
                    ...prev,
                    ...status,
                    inserted: status.totalTransactions ?? prev?.inserted,
                    total: status.totalEmails ?? prev?.total,
                    jobId
                 }));

                 handleCompletion({
                     ...event.payload,
                     jobId,
                     status: 'COMPLETED'
                 });
             }
        });
        
        socket.on('disconnect', () => {
            console.log('[GmailSync] WebSocket disconnected');
        });

    } catch (err) {
        console.error('[GmailSync] Socket initialization failed:', err);
    }

    return () => {
        if (socket) {
            socket.disconnect();
        }
    };
  }, [jobId, handleCompletion]);

  const handleSync = async () => {
    console.log(`[GmailSync] Starting manual sync... Range: ${startDate || 'Default'} to ${endDate || 'Default'}`);
    setConfigMode(false);
    setSyncing(true);
    setProgress(null);
    setCompleted(false);
    setFailed(false);
    setErrorMessage("");
    setTimeoutWarning(false);
    lastStatusChangeRef.current = Date.now();

    try {
      const result = await gmailApi.scanHistorical(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      if (result.jobId) {
        console.log(`[GmailSync] Job started: ${result.jobId}`);
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



  const handleClose = () => {
    // FORCE close allowed if there's a timeout warning or not syncing
    if (!syncing || timeoutWarning) {
      clearPolling();
      setJobId(null);
      setProgress(null);
      setCompleted(false);
      setFailed(false);
      setErrorMessage("");
      setTimeoutWarning(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  const progressPercent =
    progress?.progress !== undefined
      ? progress.progress
      : progress && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={(e) => e.stopPropagation()} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card-bg rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
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
              {/* Status Messages (Completed/Failed) ... same as before ... */}
              {completed && (
                <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                  <div>
                    <p className="font-semibold text-green-900">Sync Complete!</p>
                    <p className="text-sm text-green-700 mt-1">
                      Found {progress?.inserted || 0} new transaction{progress?.inserted !== 1 ? "s" : ""} 
                      {progress?.total && ` out of ${progress.total} emails scanned`}
                    </p>
                    {progress?.postProcessingStats && (
                      <div className="mt-2 text-xs text-green-800 space-y-1">
                         {progress.postProcessingStats.billsCreated ? (
                            <p>• Generated {progress.postProcessingStats.billsCreated} new bills</p>
                         ) : null}
                         {progress.postProcessingStats.instrumentsCreated ? (
                            <p>• Detected {progress.postProcessingStats.instrumentsCreated} new cards</p>
                         ) : null}
                      </div>
                    )}
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
                      {progress.currentStep?.startsWith("POST_PROCESSING") ? (
                        <div className="space-y-3 bg-hover-bg rounded-xl p-4 border border-border-color">
                          <h3 className="text-sm font-semibold text-primary-text mb-2">Finalizing Sync...</h3>
                          
                          <div className="flex items-center gap-3">
                            <CheckCircle className="text-green-600 w-5 h-5 flex-shrink-0" />
                            <span className="text-secondary-text text-sm">Sync Emails & Transactions</span>
                          </div>

                          <div className="flex items-center gap-3">
                            {progress.currentStep === 'POST_PROCESSING_ANALYTICS' ? (
                                <RefreshCw className="text-primary-green w-5 h-5 flex-shrink-0 animate-spin" />
                            ) : (
                                <CheckCircle className="text-green-600 w-5 h-5 flex-shrink-0" />
                            )}
                            <span className={`text-sm ${progress.currentStep === 'POST_PROCESSING_ANALYTICS' ? "text-primary-text font-medium" : "text-secondary-text"}`}>
                                Computing Analytics
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                             {progress.currentStep === 'POST_PROCESSING_ANALYTICS' ? (
                                <div className="w-5 h-5 rounded-full border-2 border-muted-text/20 flex-shrink-0" />
                            ) : progress.currentStep === 'POST_PROCESSING_BILLS' ? (
                                <RefreshCw className="text-primary-green w-5 h-5 flex-shrink-0 animate-spin" />
                            ) : (
                                <CheckCircle className="text-green-600 w-5 h-5 flex-shrink-0" />
                            )}
                            <span className={`text-sm ${progress.currentStep === 'POST_PROCESSING_BILLS' ? "text-primary-text font-medium" : "text-secondary-text"}`}>
                                Generating Bills {progress.postProcessingStats?.billsCreated ? `(${progress.postProcessingStats.billsCreated} created)` : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                             {['POST_PROCESSING_ANALYTICS', 'POST_PROCESSING_BILLS'].includes(progress.currentStep) ? (
                                <div className="w-5 h-5 rounded-full border-2 border-muted-text/20 flex-shrink-0" />
                            ) : progress.currentStep === 'POST_PROCESSING_CARDS' ? (
                                <RefreshCw className="text-primary-green w-5 h-5 flex-shrink-0 animate-spin" />
                            ) : (
                                <CheckCircle className="text-green-600 w-5 h-5 flex-shrink-0" />
                            )}
                            <span className={`text-sm ${progress.currentStep === 'POST_PROCESSING_CARDS' ? "text-primary-text font-medium" : "text-secondary-text"}`}>
                                Detecting New Cards {progress.postProcessingStats?.instrumentsCreated ? `(${progress.postProcessingStats.instrumentsCreated} found)` : ''}
                            </span>
                          </div>
                        </div>
                      ) : (
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
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-secondary-text">
                            {progress.currentStep === 'FETCHING_BATCH' ? `Fetching Batch ${progress.currentBatch || 1}...` : 
                             progress.currentStep === 'PROCESSING_BATCH' ? `Processing Batch ${progress.currentBatch || 1}...` : 
                             progress.status === 'FETCHING' ? `Fetching emails... (${progress.fetched || 0})` :
                             progress.currentStep}
                          </p>
                          {progress.currentBatch && (
                            <p className="text-xs font-medium text-primary-text">
                              Batch {progress.currentBatch} {progress.totalBatches ? `of ${progress.totalBatches}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      )}

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
                        <div className="bg-hover-bg rounded-lg p-3 col-span-2">
                           <p className="text-xs text-secondary-text">Emails Scanned</p>
                           <p className="text-xl font-bold text-primary-text mt-1">
                             {progress.fetched || progress.total || 0}
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

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                      <p className="text-xs text-blue-900">
                        Scanning your Gmail for credit card transaction emails. 
                        This scans from {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {timeoutWarning && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={16} />
                    <div>
                      <p className="text-sm font-medium text-yellow-900">Sync is taking longer than expected</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        The background job hasn&apos;t reported progress for 30 seconds. It might be stuck or processing a large batch.
                        You can safely close this window; the sync will continue in the background.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error List & Manual Mapping */}
              {progress?.errorList && progress.errorList.length > 0 && (
                <div className="mt-4 border-t border-border-color pt-4">
                  <h3 className="text-sm font-semibold text-primary-text mb-2">Failed Items</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {progress.errorList.map((err: unknown, idx: number) => (
                      <div key={idx} className="flex items-center justify-between bg-hover-bg p-2 rounded text-xs">
                        <span className="truncate flex-1 mr-2 text-red-500" title={typeof err === 'string' ? err : (err as any).message || (err as any).error || JSON.stringify(err)}>
                          {typeof err === 'string' ? err : (err as any).message || (err as any).error || "Unknown error"}
                        </span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 text-[10px]"
                          onClick={() => setMappingMessageId((err as any).messageId)}
                        >
                          Map Card
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
            // Maybe trigger a refresh or just show success
            // Ideally we should update the error list but that's hard without re-fetching
            // For now just close
          }}
        />
      )}
    </>
  );
}

// ... (GmailSyncButton component same as before)

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
