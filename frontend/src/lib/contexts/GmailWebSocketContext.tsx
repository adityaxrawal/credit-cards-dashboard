"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { ScanStatus } from '@/lib/api/gmail';

interface GmailSyncState extends ScanStatus {
  isSyncing: boolean;
  isConnected: boolean;
}

interface GmailWebSocketContextType {
  socket: Socket | null;
  state: GmailSyncState;
  startSyncObservation: (jobId: string) => void;
  resetState: () => void;
}

const GmailWebSocketContext = createContext<GmailWebSocketContextType | null>(null);

const DEFAULT_STATE: GmailSyncState = {
  jobId: '',
  status: 'IDLE',
  processed: 0,
  total: 0,
  isSyncing: false,
  isConnected: false,
  fetched: 0,
  inserted: 0,
  errors: 0,
  errorList: [],
  currentStep: 'IDLE'
};

export function GmailWebSocketProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GmailSyncState>(DEFAULT_STATE);
  const socketRef = useRef<Socket | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  // Initialize Socket
  useEffect(() => {
    // Only initialize once
    if (socketRef.current) return;

    const url = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    console.log('[GmailWS] Initializing socket connection to', url);

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[GmailWS] Connected');
      setState(prev => ({ ...prev, isConnected: true }));
      
      // Resubscribe if we were watching a job
      if (activeJobIdRef.current) {
        console.log('[GmailWS] Resubscribing to job', activeJobIdRef.current);
        socket.emit('subscribe', { jobId: activeJobIdRef.current });
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn('[GmailWS] Disconnected:', reason);
      setState(prev => ({ ...prev, isConnected: false }));
    });

    socket.on('connect_error', (error) => {
      console.error('[GmailWS] Connection error:', error);
    });

    // Heartbeat handling
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat', { timestamp: Date.now() });
      }
    }, 25000);

    return () => {
      console.log('[GmailWS] Cleaning up socket');
      clearInterval(heartbeatInterval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Event Handlers
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onUpdate = (event: { type: string; payload: Partial<ScanStatus> }) => {
      console.log('[GmailWS] Update:', event.payload.status, event.payload.currentStep);
      
      setState(prev => {
        // Merge strategy: Keep existing values if new ones consistently 0 or undefined, 
        // but prefer payload values.
        const payload = event.payload;
        
        // Don't overwrite inserted count with 0 if we already have some
        const newInserted = (payload.inserted !== undefined && payload.inserted > 0) 
          ? payload.inserted 
          : (payload.totalTransactions !== undefined && payload.totalTransactions > 0)
            ? payload.totalTransactions
            : prev.inserted;

        return {
          ...prev,
          ...payload,
          inserted: newInserted,
          // Map backend 'totalTransactions' to 'inserted' if plain 'inserted' missing
          // Map backend 'totalEmails' to 'total' and 'fetched'
          total: payload.totalEmails ?? payload.total ?? prev.total,
          fetched: payload.totalEmails ?? payload.fetched ?? prev.fetched,
          processed: payload.totalProcessed ?? payload.processed ?? prev.processed,
          errors: payload.totalErrors ?? payload.errors ?? prev.errors,
          // Pass through queueStatus for frontend visualization
          queueStatus: payload.queueStatus ?? prev.queueStatus,
          
          isSyncing: payload.status !== 'COMPLETED' && payload.status !== 'FAILED',
          status: payload.status || prev.status,
        };
      });
    };

    const onComplete = (event: { type: string; payload: Partial<ScanStatus> }) => {
        console.log('[GmailWS] Job Complete:', event.payload);
        setState(prev => ({
            ...prev,
            ...event.payload,
            isSyncing: false,
            status: 'COMPLETED',
            inserted: event.payload.totalTransactions ?? prev.inserted,
            processed: event.payload.totalEmails ?? prev.processed,
        }));
        
        // Trigger global refreshes
        window.dispatchEvent(new CustomEvent("transactions-updated"));
        window.dispatchEvent(new CustomEvent("refresh-dashboard"));
        toast.success("Gmail sync completed successfully");
    };

    socket.on('processing_update', onUpdate);
    socket.on('processing_complete', onComplete);

    return () => {
      socket.off('processing_update', onUpdate);
      socket.off('processing_complete', onComplete);
    };
  }, []);

  const startSyncObservation = useCallback((jobId: string) => {
    if (!socketRef.current) return;
    
    console.log('[GmailWS] Starting observation for job', jobId);
    activeJobIdRef.current = jobId;
    
    // Reset relevant state for new job
    setState(prev => ({
      ...DEFAULT_STATE,
      isConnected: prev.isConnected,
      jobId,
      isSyncing: true,
      status: 'STARTING'
    }));

    // Subscribe
    if (socketRef.current.connected) {
      socketRef.current.emit('subscribe', { jobId });
    }
  }, []);

  const resetState = useCallback(() => {
    activeJobIdRef.current = null;
    setState(prev => ({
      ...DEFAULT_STATE,
      isConnected: prev.isConnected
    }));
  }, []);

  return (
    <GmailWebSocketContext.Provider value={{ 
      socket: socketRef.current, 
      state, 
      startSyncObservation,
      resetState 
    }}>
      {children}
    </GmailWebSocketContext.Provider>
  );
}

export function useGmailSync() {
  const context = useContext(GmailWebSocketContext);
  if (!context) {
    throw new Error('useGmailSync must be used within a GmailWebSocketProvider');
  }
  return context;
}
