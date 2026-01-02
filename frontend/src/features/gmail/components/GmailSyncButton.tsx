"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/shared/components/ui/primitives/Button";
import { Input } from "@/shared/components/ui/primitives/Input";
import { Label } from "@/shared/components/ui/primitives/label";
import { 
  RefreshCw, 
  X, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Calendar,
  Loader2,
  Database,
  Mail,
  Search,
  FileText,
  ArrowRight
} from "lucide-react";
import { gmailApi } from "@/features/gmail/api";
import { ManualCardMappingModal } from "./ManualCardMappingModal";
import { useGmailSync } from "@/lib/contexts/GmailWebSocketContext";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---

interface GmailSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

type StepStatus = 'pending' | 'active' | 'completed' | 'error';

interface SyncStep {
  id: string;
  label: string;
  icon: React.ElementType;
  status: StepStatus;
  detail?: string;
}

// --- Components ---

const StepItem = ({ step, isLast }: { step: SyncStep; isLast: boolean }) => {
  const getStatusColor = (s: StepStatus) => {
    switch (s) {
      case 'completed': return 'text-primary-green';
      case 'active': return 'text-primary-green';
      case 'error': return 'text-semantic-red';
      default: return 'text-muted-text';
    }
  };

  const getIcon = () => {
    if (step.status === 'active') return <Loader2 className="w-5 h-5 animate-spin text-primary-green" />;
    if (step.status === 'completed') return <CheckCircle className="w-5 h-5 text-primary-green" />;
    if (step.status === 'error') return <XCircle className="w-5 h-5 text-semantic-red" />;
    return <step.icon className={`w-5 h-5 ${getStatusColor(step.status)}`} />;
  };

  return (
    <div className="flex gap-4 relative">
      <div className="flex flex-col items-center">
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center border transition-colors duration-300
          ${step.status === 'active' ? 'bg-primary-green/10 border-primary-green/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 
            step.status === 'completed' ? 'bg-primary-green/10 border-primary-green/50' : 
            step.status === 'error' ? 'bg-semantic-red/10 border-semantic-red/50' : 
            'bg-hover-bg border-muted-text/20'}
        `}>
          {getIcon()}
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 my-1 transition-colors duration-300 ${
            step.status === 'completed' ? 'bg-primary-green/30' : 'bg-muted-text/10'
          }`} />
        )}
      </div>
      <div className="flex-1 pb-6 pt-1">
        <div className="flex justify-between items-start">
          <h4 className={`text-sm font-medium transition-colors ${
            step.status === 'active' ? 'text-primary-text' : 
            step.status === 'completed' ? 'text-primary-text/80' : 
            'text-muted-text'
          }`}>
            {step.label}
          </h4>
          {step.status === 'active' && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-primary-green animate-pulse">
              In Progress
            </span>
          )}
        </div>
        {step.detail && step.status !== 'pending' && (
          <p className="text-xs text-secondary-text mt-1 font-medium animate-in fade-in slide-in-from-top-1">
            {step.detail}
          </p>
        )}
      </div>
    </div>
  );
};

// --- Main Modal Component ---

export function GmailSyncModal({
  isOpen,
  onClose,
}: GmailSyncModalProps) {
  const [configMode, setConfigMode] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [mappingMessageId, setMappingMessageId] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Consume Global Sync State
  const { state, startSyncObservation, resetState } = useGmailSync();
  const { 
    isSyncing, 
    status, 
    processed, 
    total, 
    inserted, 
    errors, 
    currentStep,
    postProcessingStats,
    errorList,
    queueStatus,
    errorMessage: apiErrorMessage
  } = state;

  const isCompleted = status === 'COMPLETED';
  const isFailed = status === 'FAILED';


  // State initialization
  useEffect(() => {
    if (isOpen) {
      if (!isSyncing && !isCompleted && !isFailed) {
        setConfigMode(true);
        loadDates();
      } else {
        setConfigMode(false);
      }
    }
  }, [isOpen, isSyncing, isCompleted, isFailed]);

  const loadDates = async () => {
    // Helper to get YYYY-MM-DD in local time
    const toLocalISO = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    try {
      const { lastSync } = await gmailApi.getLastSync();
      setEndDate(toLocalISO(new Date()));
      // Default to 90 days if no last sync
      const start = lastSync ? new Date(lastSync) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      setStartDate(toLocalISO(start));
    } catch (e) {
      console.error("Failed to load last sync:", e);
      setStartDate(toLocalISO(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)));
      setEndDate(toLocalISO(new Date()));
    }
  };

  const handleSync = async () => {
    setConfigMode(false);
    resetState();
    try {
      const result = await gmailApi.scanHistorical(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );
      if (result.jobId) startSyncObservation(result.jobId);
    } catch (error: any) {
      console.error("Sync error:", error);
      const msg = error?.response?.data?.error?.message || error?.message || "Failed to start sync";
      toast.error(msg);
      setConfigMode(true); 
    }
  };

  const handleClose = () => {
    onClose();
  };

  const resetAndViewConfig = () => {
    resetState();
    setConfigMode(true);
    loadDates();
  };
  
  // -- Sync Logic Mappers --

  const steps = useMemo<SyncStep[]>(() => {
    const isPostProcessing = currentStep?.startsWith('POST_PROCESSING') ?? false;
    const isQueued = (queueStatus?.queue1 ?? 0) > 0 || (queueStatus?.queue2 ?? 0) > 0;
    const hasProcessed = processed > 0;
    const isFetching = currentStep === 'FETCHING' || currentStep === 'PROCESSING_AND_FETCHING';
    
    // Helper to determine status based on overall flow
    // Order: Connecting -> Fetching -> Parsing -> Detecting -> DB -> Finalizing
    
    // 1. Connecting
    let connectingStatus: StepStatus = 'completed'; // Assume completed if we see any other state
    if (status === 'STARTING' || status === 'IDLE') connectingStatus = 'active';
    
    // 2. Fetching Emails
    let fetchingStatus: StepStatus = 'pending';
    if (connectingStatus === 'completed') {
        if (isFetching && !isPostProcessing && !isCompleted) fetchingStatus = 'active';
        else if (hasProcessed || isPostProcessing || isCompleted) fetchingStatus = 'completed';
    }

    // 3. Parsing Messages
    let parsingStatus: StepStatus = 'pending';
    if (fetchingStatus !== 'pending') {
        // Active if we are processing emails (even if also fetching)
        if (!isPostProcessing && !isCompleted && (hasProcessed || isFetching)) parsingStatus = 'active';
        else if (isPostProcessing || isCompleted) parsingStatus = 'completed';
    }

    // 4. Detecting Transactions
    let detectingStatus: StepStatus = 'pending';
    if (parsingStatus !== 'pending') {
        // Active alongside parsing
        if (!isPostProcessing && !isCompleted && hasProcessed) detectingStatus = 'active';
        else if (isPostProcessing || isCompleted) detectingStatus = 'completed';
    }

    // 5. Writing to Database
    let dbStatus: StepStatus = 'pending';
    if (detectingStatus !== 'pending') {
         if (isQueued && !isCompleted) dbStatus = 'active';
         else if ((isPostProcessing || isCompleted) && !isQueued) dbStatus = 'completed';
         else if (!isQueued && detectingStatus === 'active') dbStatus = 'active'; // ready to write
    }

    // 6. Finalizing
    let finalizingStatus: StepStatus = 'pending';
    if (dbStatus !== 'pending') {
        if (isPostProcessing && !isCompleted) finalizingStatus = 'active';
        else if (isCompleted) finalizingStatus = 'completed';
    }

    // Error Override
    if (isFailed) {
        // Find the last active step and mark it error? Or just leave them as they stopped?
        // Let's mark the likely failed step
        if (!isPostProcessing) parsingStatus = 'error'; 
        else finalizingStatus = 'error';
    }

    return [
      {
        id: 'connecting',
        label: 'Connecting to Gmail',
        icon: Mail,
        status: connectingStatus,
        detail: connectingStatus === 'active' ? 'Establishing secure connection...' : undefined
      },
      {
        id: 'fetching',
        label: 'Fetching emails',
        icon: Search,
        status: fetchingStatus,
        detail: fetchingStatus === 'active' ? `Scanning date range...` : 
                fetchingStatus === 'completed' ? `Scanned ${total} emails` : undefined
      },
      {
        id: 'parsing',
        label: 'Parsing messages',
        icon: FileText,
        status: parsingStatus,
        detail: parsingStatus === 'active' ? `${processed} / ${total} emails processed` : 
                parsingStatus === 'completed' ? 'All emails parsed' : undefined
      },
      {
        id: 'detecting',
        label: 'Detecting transactions',
        icon: Search,
        status: detectingStatus,
        detail: detectingStatus === 'active' ? `Found ${inserted} transactions so far` : 
                detectingStatus === 'completed' ? `Found ${inserted} transactions` : undefined
      },
      {
        id: 'writing',
        label: 'Writing to database',
        icon: Database,
        status: dbStatus,
        detail: dbStatus === 'active' ? `${(queueStatus?.queue1 ?? 0) + (queueStatus?.queue2 ?? 0)} items queued` : 
                dbStatus === 'completed' ? 'All writes complete' : undefined
      },
      {
        id: 'finalizing',
        label: 'Finalizing sync',
        icon: CheckCircle,
        status: finalizingStatus,
        detail: finalizingStatus === 'active' ? (
            currentStep === 'POST_PROCESSING_ANALYTICS' ? 'Computing analytics...' :
            currentStep === 'POST_PROCESSING_BILLS' ? 'Generating bills...' :
            currentStep === 'POST_PROCESSING_CARDS' ? 'Detecting new cards...' : 'Finishing up...'
        ) : finalizingStatus === 'completed' ? 'Sync complete!' : undefined
      }
    ];
  }, [status, currentStep, processed, total, inserted, queueStatus, postProcessingStats, isCompleted, isFailed]);


  // Calculate overall percentage
  // We can weigh the steps: Parsing (80%), Post-processing (20%)
  const percentage = useMemo(() => {
    if (isCompleted) return 100;
    if (total === 0) return 5; // indeterminate start
    
    const parsingProgress = processed / total;
    // Cap parsing at 90%
    const weightedParsing = Math.min(parsingProgress * 90, 90);
    
    // Add extra for post processing
    const isPostProcessing = currentStep?.startsWith('POST_PROCESSING');
    const weightedPost = isPostProcessing ? 10 : 0; // Simple bump

    return Math.round(weightedParsing + weightedPost);
  }, [processed, total, currentStep, isCompleted]);


  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={(e) => e.stopPropagation()} />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-card-bg border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col pointer-events-auto">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div>
                    <h2 className="text-xl font-bold text-primary-text flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSyncing ? 'bg-primary-green/10' : 'bg-white/5'}`}>
                        <RefreshCw className={`w-5 h-5 text-primary-green ${isSyncing ? "animate-spin" : ""}`} />
                    </div>
                    Gmail Sync
                    </h2>
                    <p className="text-xs text-secondary-text mt-1 ml-1 overflow-hidden">
                        {configMode ? "Select range to scan" : 
                         isCompleted ? "Sync completed successfully" : 
                         isFailed ? "Sync failed" : "Synchronizing your financial data..."}
                    </p>
                </div>
            <button
                onClick={handleClose}
                className="text-muted-text hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
             >
                <X size={20} />
             </button>
          </div>

          <div className="overflow-y-auto flex-1 p-6">
          {configMode ? (
            <div className="space-y-6">
              <div className="p-4 bg-primary-green/10 border border-primary-green/20 rounded-xl flex gap-3">
                <Calendar className="w-5 h-5 text-primary-green flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-sm font-medium text-primary-text">Date Range</p>
                    <p className="text-xs text-secondary-text leading-relaxed">
                        Select a date range to scan for transaction emails. 
                        We recommend syncing the last 90 days for optimal results.
                    </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-secondary-text uppercase tracking-wider">Start Date</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="bg-hover-bg border-white/10 focus:border-primary-green/50"
                  />
                </div>
                <div className="space-y-2">
                   <Label className="text-xs font-semibold text-secondary-text uppercase tracking-wider">End Date</Label>
                   <Input 
                     type="date" 
                     value={endDate} 
                     onChange={(e) => setEndDate(e.target.value)} 
                     className="bg-hover-bg border-white/10 focus:border-primary-green/50"
                   />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
                
                {/* Stats Grid */}
               <div className="grid grid-cols-3 gap-3">
                    <div className="bg-hover-bg rounded-xl p-3 border border-white/5 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-muted-text mb-1">Found</p>
                        <p className="text-xl font-bold text-primary-green tabular-nums">{inserted}</p>
                    </div>
                    <div className="bg-hover-bg rounded-xl p-3 border border-white/5 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-muted-text mb-1">Processed</p>
                        <p className="text-xl font-bold text-primary-text tabular-nums">{processed}</p>
                    </div>
                     <div className={`bg-hover-bg rounded-xl p-3 border border-white/5 text-center ${errors > 0 ? 'bg-semantic-red/10 border-semantic-red/20' : ''}`}>
                        <p className="text-[10px] uppercase tracking-wider text-muted-text mb-1">Errors</p>
                        <p className={`text-xl font-bold tabular-nums ${errors > 0 ? 'text-semantic-red' : 'text-primary-text'}`}>{errors}</p>
                    </div>
               </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                 <div className="flex justify-between text-xs font-medium">
                    <span className="text-primary-text">Overall Progress</span>
                    <span className="text-primary-green">{percentage}%</span>
                 </div>
                 <div className="h-2 w-full bg-hover-bg rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ type: "spring", stiffness: 50, damping: 20 }}
                        className={`h-full ${isFailed ? 'bg-semantic-red' : 'bg-primary-green'}`} 
                    />
                 </div>
              </div>

               {/* Multi-step Flow */}
               <div className="space-y-0 pl-2">
                    {steps.map((step, idx) => (
                        <StepItem key={step.id} step={step} isLast={idx === steps.length - 1} />
                    ))}
               </div>

                {/* Error Banner */}
               {isFailed && (
                   <div className="bg-semantic-red/10 border border-semantic-red/20 rounded-xl p-4 flex gap-3 items-start">
                        <AlertCircle className="w-5 h-5 text-semantic-red shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-semantic-red">Sync Failed</p>
                            <p className="text-xs text-red-300/80 mt-1">{apiErrorMessage || "An unexpected error occurred during the sync process. Please try again."}</p>
                        </div>
                   </div>
               )}

               {/* Manual Mapping / Warns */}
               {errorList && errorList.length > 0 && (
                   <div className="border-t border-white/10 pt-4">
                       <button 
                         onClick={() => setShowErrorDetails(!showErrorDetails)}
                         className="flex items-center gap-2 text-xs text-muted-text hover:text-white transition-colors w-full"
                       >
                           {showErrorDetails ? 'Hide' : 'Show'} {errorList.length} Issues that need attention
                           <ArrowRight className={`w-3 h-3 transition-transform ${showErrorDetails ? 'rotate-90' : ''}`} />
                       </button>
                       
                       <AnimatePresence>
                           {showErrorDetails && (
                               <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                               >
                                   <div className="space-y-2 mt-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                        {errorList.map((err: any, idx: number) => (
                                            <div key={idx} className="bg-white/5 p-2 rounded text-[10px] flex justify-between items-center group">
                                                <span className="text-red-300 truncate max-w-[70%]">{err.message || JSON.stringify(err)}</span>
                                                {err.messageId && (
                                                     <Button 
                                                        size="sm" 
                                                        variant="ghost"
                                                        className="h-6 text-[10px] bg-white/5 hover:bg-white/10"
                                                        onClick={() => setMappingMessageId(err.messageId)}
                                                     >
                                                         Map
                                                     </Button>
                                                )}
                                            </div>
                                        ))}
                                   </div>
                               </motion.div>
                           )}
                       </AnimatePresence>
                   </div>
               )}

            </div>
          )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-card-bg rounded-b-2xl">
             {configMode ? (
                 <>
                    <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                    <Button 
                        onClick={handleSync} 
                        disabled={!startDate || !endDate}
                        className="bg-primary-green hover:bg-primary-green/90 text-black font-semibold"
                    >
                        Start Scan
                    </Button>
                 </>
             ) : (
                <>
                    {(isCompleted || isFailed) && (
                        <Button variant="ghost" onClick={resetAndViewConfig}>New Scan</Button>
                    )}
                    {isSyncing ? (
                         <Button 
                            onClick={handleClose} 
                            variant="primary"
                            className="bg-zinc-800 hover:bg-zinc-700 text-white border border-white/10"
                         >
                            Running in background...
                         </Button>
                    ) : (
                        <Button 
                            onClick={handleClose} 
                            className="bg-primary-green hover:bg-primary-green/90 text-black font-semibold min-w-[100px]"
                        >
                            Done
                        </Button>
                    )}
                </>
             )}
          </div>
        </div>
      </motion.div>

       {mappingMessageId && (
        <ManualCardMappingModal
          isOpen={true}
          onClose={() => setMappingMessageId(null)}
          messageId={mappingMessageId}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}

// --- Button Wrapper ---

interface GmailSyncButtonProps {
  onSyncComplete?: () => void;
  className?: string;
}

export function GmailSyncButton({
  onSyncComplete,
  className,
}: GmailSyncButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setLastSync(new Date());
    onSyncComplete?.();
  };

  return (
    <>
      <div className={`flex items-center gap-4 ${className || ""}`}>
        <Button onClick={handleOpenModal} variant="primary" size="md">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Gmail
        </Button>
        {lastSync && (
          <span className="text-xs text-muted-text">
            Last check: {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
            <GmailSyncModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSyncComplete={onSyncComplete}
            />
        )}
      </AnimatePresence>
    </>
  );
}

