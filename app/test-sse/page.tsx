'use client';

import React from 'react';
import { motion } from 'framer-motion';
import SSETest from '@/components/test/SSETest';
import '../globals.css';

const TestSSEPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-bg via-secondary-bg to-primary-bg">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            SSE Testing Dashboard
          </h1>
          <p className="text-white/60 text-lg">
            Test the real-time notification system using Server-Sent Events
          </p>
        </motion.div>

        <SSETest />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 glass-card rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">How to Test:</h3>
          <div className="space-y-3 text-white/70">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-accent-purple/20 rounded-full flex items-center justify-center text-accent-purple text-sm font-bold mt-0.5">
                1
              </div>
              <p>Ensure you are authenticated and the SSE connection shows as &quot;Connected&quot;</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-accent-purple/20 rounded-full flex items-center justify-center text-accent-purple text-sm font-bold mt-0.5">
                2
              </div>
              <p>Click any of the test buttons to send different types of notifications</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-accent-purple/20 rounded-full flex items-center justify-center text-accent-purple text-sm font-bold mt-0.5">
                3
              </div>
              <p>Watch for toast notifications appearing in the top-right corner</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-accent-purple/20 rounded-full flex items-center justify-center text-accent-purple text-sm font-bold mt-0.5">
                4
              </div>
              <p>Check the browser console for detailed event logs</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-6 text-center"
        >
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent-purple/20 hover:bg-accent-purple/30 text-accent-purple border border-accent-purple/30 rounded-xl transition-all duration-200"
          >
            ← Back to Dashboard
          </a>
        </motion.div>
      </div>
    </div>
  );
};

export default TestSSEPage;