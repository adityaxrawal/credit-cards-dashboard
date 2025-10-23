'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

export interface SSEOptions {
  onTransaction?: (data: Record<string, unknown>) => void;
  onStatement?: (data: Record<string, unknown>) => void;
  onLimitExceeded?: (data: Record<string, unknown>) => void;
}

export function useSSE(options: SSEOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const { onTransaction, onStatement, onLimitExceeded } = options;

  const connect = () => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    try {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Create new EventSource connection with credentials for authentication
      const eventSource = new EventSource('/api/notifications/sse', {
        withCredentials: true
      });
      eventSourceRef.current = eventSource;
      setConnectionStatus('connecting');

      // Handle connection opened
      eventSource.addEventListener('open', () => {
        console.log('SSE connection opened');
        setConnectionStatus('connected');
        reconnectAttempts.current = 0; // Reset reconnect attempts on successful connection
      });

      // Handle connected event
      eventSource.addEventListener('connected', (event) => {
        console.log('SSE connected:', event.data);
        toast.success('Real-time notifications connected');
      });

      // Handle new transaction event
      eventSource.addEventListener('transaction:new', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('New transaction received:', data);
          
          toast.success(`New transaction: ${data.merchant || 'Unknown'} - $${data.amount || '0.00'}`);
          
          if (onTransaction) {
            onTransaction(data);
          }
        } catch (error) {
          console.error('Error parsing transaction data:', error);
        }
      });

      // Handle statement generated event
      eventSource.addEventListener('statement:generated', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Statement generated:', data);
          
          toast.success(`New statement generated for ${data.cardName || 'your card'}`);
          
          if (onStatement) {
            onStatement(data);
          }
        } catch (error) {
          console.error('Error parsing statement data:', error);
        }
      });

      // Handle limit exceeded event
      eventSource.addEventListener('limit:exceeded', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Limit exceeded:', data);
          
          toast.error(`Spending limit exceeded! Current: $${data.currentAmount || '0'}, Limit: $${data.limit || '0'}`);
          
          if (onLimitExceeded) {
            onLimitExceeded(data);
          }
        } catch (error) {
          console.error('Error parsing limit data:', error);
        }
      });

      // Handle ping event (keep-alive)
      eventSource.addEventListener('ping', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE ping received:', data.timestamp);
        } catch (error) {
          console.error('Error parsing ping data:', error);
        }
      });

      // Handle connection errors
      eventSource.addEventListener('error', (event) => {
        console.error('SSE connection error:', {
          readyState: eventSource.readyState,
          url: eventSource.url,
          event: event
        });
        
        // Check if it's an authentication error (401)
        if (eventSource.readyState === EventSource.CLOSED) {
          console.log('SSE connection closed, attempting to reconnect...');
          
          // Check if we should show an authentication error
            fetch('/api/notifications/sse', { method: 'HEAD' })
              .then(response => {
                if (response.status === 401) {
                  toast.error('Authentication required for real-time notifications');
                  console.error('SSE connection failed: User not authenticated');
                  setConnectionStatus('disconnected');
                  return;
                }
                // If not auth error, attempt reconnect
                attemptReconnect();
              })
              .catch(() => {
                // If fetch fails, still attempt reconnect
                attemptReconnect();
              });
        }
      });

    } catch (error) {
      console.error('Error creating SSE connection:', error);
      attemptReconnect();
    }
  };

  const attemptReconnect = () => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      toast.error('Connection lost. Please refresh the page.');
      setConnectionStatus('disconnected');
      return;
    }

    const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current); // Exponential backoff
    reconnectAttempts.current++;

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
    setConnectionStatus('connecting');

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  };

  const disconnect = () => {
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close EventSource connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionStatus('disconnected');
    console.log('SSE connection disconnected');
  };

  useEffect(() => {
    // Only establish connection on client side
    if (typeof window !== 'undefined') {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []); // Empty dependency array - only run on mount/unmount

  return {
    eventSource: eventSourceRef.current,
    connect,
    disconnect,
    connectionStatus,
    isConnected: typeof window !== 'undefined' && eventSourceRef.current?.readyState === EventSource.OPEN
  };
}