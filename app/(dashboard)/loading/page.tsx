"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, Mail, Settings, Gift } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSSE } from '@/lib/hooks/useSSE';

interface ProcessStatus {
  progress: number;
  message: string;
  isComplete: boolean;
}

interface ProcessItemProps {
  number: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  progress: number;
  message: string;
  isComplete: boolean;
}

const ProcessItem: React.FC<ProcessItemProps> = ({
  number,
  title,
  icon: Icon,
  progress,
  message,
  isComplete
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: number * 0.2, duration: 0.5 }}
      className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-lg"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
          {isComplete ? (
            <CheckCircle className="w-6 h-6 text-white" />
          ) : (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <Icon className="w-6 h-6 text-white" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
      </div>
      
      <div className="mb-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-white/80">{message}</span>
          <span className="text-sm font-medium text-white">{progress}%</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
};

const LoadingPage: React.FC = () => {
  const router = useRouter();
  const [processes, setProcesses] = useState<Record<string, ProcessStatus>>({
    'process-1': { progress: 0, message: 'Initializing email sync...', isComplete: false },
    'process-2': { progress: 0, message: 'Preparing Gmail setup...', isComplete: false },
    'process-3': { progress: 0, message: 'Loading card perks...', isComplete: false }
  });
  const [allComplete, setAllComplete] = useState(false);

  // SSE connection for real-time progress updates
  const { isConnected, eventSource } = useSSE({});

  // Set up custom event listeners for progress updates
  useEffect(() => {
    if (!eventSource) return;

    const handleProgress = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const { process, progress, message } = data;
        setProcesses(prev => ({
          ...prev,
          [process]: {
            progress,
            message,
            isComplete: progress >= 100
          }
        }));
      } catch (error) {
        console.error('Error parsing progress data:', error);
      }
    };

    const handleComplete = (event: MessageEvent) => {
      try {
        setAllComplete(true);
        // Redirect to dashboard after 1 second
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } catch (error) {
        console.error('Error handling complete event:', error);
      }
    };

    eventSource.addEventListener('progress', handleProgress);
    eventSource.addEventListener('complete', handleComplete);

    return () => {
      eventSource.removeEventListener('progress', handleProgress);
      eventSource.removeEventListener('complete', handleComplete);
    };
  }, [eventSource, router]);

  // Check if all processes are complete
  useEffect(() => {
    const allProcessesComplete = Object.values(processes).every(p => p.isComplete);
    if (allProcessesComplete && !allComplete) {
      setAllComplete(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    }
  }, [processes, allComplete, router]);

  const processConfigs = [
    {
      key: 'process-1',
      title: 'Email Sync',
      icon: Mail,
      description: 'Syncing your credit card emails'
    },
    {
      key: 'process-2',
      title: 'Gmail Setup',
      icon: Settings,
      description: 'Setting up Gmail integration'
    },
    {
      key: 'process-3',
      title: 'Card Perks',
      icon: Gift,
      description: 'Fetching your card benefits'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            🚀 Setting Up Your Dashboard
          </h1>
          <p className="text-white/80 text-lg">
            {allComplete 
              ? "Setup complete! Redirecting..." 
              : "This may take 2-3 minutes..."
            }
          </p>
        </motion.div>

        {/* Process Items */}
        <div className="space-y-4 mb-8">
          {processConfigs.map((config, index) => {
            const processStatus = processes[config.key];
            return (
              <ProcessItem
                key={config.key}
                number={index}
                title={config.title}
                icon={config.icon}
                progress={processStatus.progress}
                message={processStatus.message}
                isComplete={processStatus.isComplete}
              />
            );
          })}
        </div>

        {/* Connection Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center"
        >
          {!isConnected && (
            <div className="text-yellow-400 text-sm mb-2">
              Connecting to progress updates...
            </div>
          )}
          {allComplete && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-green-400 text-lg font-semibold"
            >
              ✅ Setup Complete! Redirecting to dashboard...
            </motion.div>
          )}
        </motion.div>

        {/* Loading Animation */}
        {!allComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex justify-center mt-8"
          >
            <div className="flex space-x-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-3 h-3 bg-white/60 rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.6, 1, 0.6]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default LoadingPage;