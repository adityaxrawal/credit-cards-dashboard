'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

interface ScanStats {
  totalProcessed: number;
  totalTransactions: number;
  totalErrors: number;
  percentComplete: number;
  queueStatus: {
    queue1: number;
    queue2: number;
    queue3: number;
  };
}

export function ScanResults({ jobId }: { jobId: string }) {
  const [stats, setStats] = useState<ScanStats>({
    totalProcessed: 0,
    totalTransactions: 0,
    totalErrors: 0,
    percentComplete: 0,
    queueStatus: { queue1: 0, queue2: 0, queue3: 0 },
  });

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket server
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000', {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to WebSocket');
      setConnected(true);
      // Subscribe to job updates
      socket.emit('subscribe', { jobId });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
      setConnected(false);
    });

    socket.on('processing_update', (message: any) => {
      if (message.type === 'processing_update') {
        const payload = message.payload;
        setStats((prev) => ({
          ...prev,
          totalProcessed: payload.totalProcessed,
          totalTransactions: payload.totalTransactions,
          totalErrors: payload.totalErrors,
          // If totalEmails is not provided frequently, we might need to store it or accept partial data
          // Assuming payload has totalEmails or we calculate percentage differently
          percentComplete: payload.totalEmails ? (payload.totalProcessed / payload.totalEmails) * 100 : 0,
          queueStatus: payload.queueStatus,
        }));
      }
      
      if (message.type === 'processing_complete') {
        console.log('Processing completed!', message.payload);
        // Trigger refresh if needed
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [jobId]);

  return (
    <div className="scan-results p-4 border rounded shadow-sm bg-white">
      <h2 className="text-xl font-bold mb-4">Processing Progress {connected ? '(Live)' : '(Connecting...)'}</h2>
      
      <div className="progress-bar w-full bg-gray-200 rounded h-4 mb-4">
        <div 
          className="progress-fill bg-blue-600 h-4 rounded transition-all duration-300"
          style={{ width: `${stats.percentComplete}%` }}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat-card p-4 bg-gray-50 rounded">
          <h3 className="text-sm font-semibold text-gray-500">Processed</h3>
          <p className="text-2xl font-bold">{stats.totalProcessed}</p>
        </div>
        
        <div className="stat-card p-4 bg-green-50 rounded">
          <h3 className="text-sm font-semibold text-green-600">Transactions Found</h3>
          <p className="text-2xl font-bold text-green-700">{stats.totalTransactions}</p>
        </div>
        
        <div className="stat-card p-4 bg-red-50 rounded">
          <h3 className="text-sm font-semibold text-red-600">Errors</h3>
          <p className="text-2xl font-bold text-red-700">{stats.totalErrors}</p>
        </div>
      </div>

      <div className="queue-status text-sm text-gray-600">
        <h3 className="font-semibold mb-2">Queue Status</h3>
        <div className="grid grid-cols-3 gap-2">
          <div>Queue 1: {stats.queueStatus.queue1}</div>
          <div>Queue 2: {stats.queueStatus.queue2}</div>
          <div>Queue 3: {stats.queueStatus.queue3}</div>
        </div>
      </div>
    </div>
  );
}
