'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useSSE } from '@/lib/hooks/useSSE';
import { sseManager } from '@/lib/sse/manager';
import { Bell, Zap, AlertTriangle, Send } from 'lucide-react';
import Button from '@/components/ui/Button';

const SSETest: React.FC = () => {
  const { connect, disconnect, isConnected, connectionStatus, eventSource } = useSSE({
    onTransaction: (data) => {
      console.log('Transaction callback triggered:', data);
    },
    onStatement: (data) => {
      console.log('Statement callback triggered:', data);
    },
    onLimitExceeded: (data) => {
      console.log('Limit exceeded callback triggered:', data);
    }
  });

  const sendTestTransaction = async () => {
    try {
      const response = await fetch('/api/test/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'transaction:new',
          data: {
            merchant: 'Test Store',
            amount: '25.99',
            category: 'Shopping',
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to send test notification');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  };

  const sendTestStatement = async () => {
    try {
      const response = await fetch('/api/test/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'statement:generated',
          data: {
            cardName: 'Chase Sapphire',
            month: 'December 2024',
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to send test notification');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  };

  const sendTestLimitExceeded = async () => {
    try {
      const response = await fetch('/api/test/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'limit:exceeded',
          data: {
            currentAmount: '1250.00',
            limit: '1000.00',
            category: 'Shopping',
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to send test notification');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card rounded-2xl p-6 max-w-2xl mx-auto"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-accent-purple/20 rounded-lg">
          <Bell className="w-6 h-6 text-accent-purple" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">SSE Test Panel</h2>
          <p className="text-white/60">Test real-time notifications</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus === 'connected' ? 'bg-success animate-pulse' : 
            connectionStatus === 'connecting' ? 'bg-warning animate-pulse' : 
            'bg-error'
          }`} />
          <span className="text-white font-medium">
            {connectionStatus === 'connected' ? 'Connected to SSE' : 
             connectionStatus === 'connecting' ? 'Connecting...' : 
             'Disconnected'}
          </span>
        </div>
        {eventSource && (
          <p className="text-white/60 text-sm mt-2">
            Ready State: {eventSource.readyState === 0 ? 'Connecting' : 
                          eventSource.readyState === 1 ? 'Open' : 'Closed'}
          </p>
        )}
      </div>

      {/* Test Buttons */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={sendTestTransaction}
            disabled={!isConnected}
            className="flex items-center gap-2 bg-accent-green/20 hover:bg-accent-green/30 text-accent-green border-accent-green/30"
          >
            <Zap className="w-4 h-4" />
            Test Transaction
          </Button>

          <Button
            onClick={sendTestStatement}
            disabled={!isConnected}
            className="flex items-center gap-2 bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue border-accent-blue/30"
          >
            <Send className="w-4 h-4" />
            Test Statement
          </Button>

          <Button
            onClick={sendTestLimitExceeded}
            disabled={!isConnected}
            className="flex items-center gap-2 bg-accent-orange/20 hover:bg-accent-orange/30 text-accent-orange border-accent-orange/30"
          >
            <AlertTriangle className="w-4 h-4" />
            Test Limit Alert
          </Button>
        </div>

        <div className="text-center">
          <p className="text-white/60 text-sm">
            Click the buttons above to test different notification types. 
            Toast notifications should appear in the top-right corner.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default SSETest;