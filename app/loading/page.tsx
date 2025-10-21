"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, 
  Shield, 
  CheckCircle, 
  Loader2,
  Database,
  BarChart3,
  Zap
} from 'lucide-react';

interface LoadingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  duration: number;
}

const LoadingPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const steps: LoadingStep[] = [
    {
      id: 'auth',
      title: 'Authenticating',
      description: 'Verifying your credentials securely',
      icon: Shield,
      duration: 2000
    },
    {
      id: 'data',
      title: 'Loading Data',
      description: 'Fetching your credit card information',
      icon: Database,
      duration: 2500
    },
    {
      id: 'dashboard',
      title: 'Preparing Dashboard',
      description: 'Setting up your personalized experience',
      icon: BarChart3,
      duration: 1500
    }
  ];

  useEffect(() => {
    const processSteps = async () => {
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(i);
        
        // Wait for step duration
        await new Promise(resolve => setTimeout(resolve, steps[i].duration));
        
        // Mark step as completed
        setCompletedSteps(prev => [...prev, steps[i].id]);
      }
      
      // All steps completed
      setIsComplete(true);
      
      // Redirect to dashboard after a brief delay
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    };

    processSteps();
  }, []);

  const progressPercentage = ((completedSteps.length) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-primary-bg flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center space-x-3 mb-12"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-accent-mint to-accent-green rounded-xl flex items-center justify-center">
            <CreditCard className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">CreditDash</h1>
        </motion.div>

        {/* Main Loading Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-8"
        >
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-300">
                {isComplete ? 'Complete!' : `Step ${currentStep + 1} of ${steps.length}`}
              </span>
              <span className="text-sm font-medium text-gray-300">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-accent-mint to-accent-green rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === index;
              const isCompleted = completedSteps.includes(step.id);
              const isPending = index > currentStep;

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center space-x-4 p-4 rounded-lg transition-all duration-300 ${
                    isActive 
                      ? 'bg-accent-mint/10 border border-accent-mint/20' 
                      : isCompleted 
                        ? 'bg-accent-green/10 border border-accent-green/20'
                        : 'bg-gray-800/30 border border-gray-700/30'
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    isActive 
                      ? 'bg-accent-mint/20 border border-accent-mint/30' 
                      : isCompleted 
                        ? 'bg-accent-green/20 border border-accent-green/30'
                        : 'bg-gray-700/30 border border-gray-600/30'
                  }`}>
                    <AnimatePresence mode="wait">
                      {isCompleted ? (
                        <motion.div
                          key="completed"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <CheckCircle className="w-6 h-6 text-accent-green" />
                        </motion.div>
                      ) : isActive ? (
                        <motion.div
                          key="loading"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Loader2 className="w-6 h-6 text-accent-mint animate-spin" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="pending"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Icon className={`w-6 h-6 ${isPending ? 'text-gray-500' : 'text-gray-400'}`} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className={`font-semibold transition-colors duration-300 ${
                      isActive 
                        ? 'text-accent-mint' 
                        : isCompleted 
                          ? 'text-accent-green'
                          : isPending 
                            ? 'text-gray-500'
                            : 'text-gray-300'
                    }`}>
                      {step.title}
                    </h3>
                    <p className={`text-sm transition-colors duration-300 ${
                      isActive 
                        ? 'text-accent-mint/80' 
                        : isCompleted 
                          ? 'text-accent-green/80'
                          : isPending 
                            ? 'text-gray-600'
                            : 'text-gray-400'
                    }`}>
                      {step.description}
                    </p>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center">
                    {isActive && (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-2 h-2 bg-accent-mint rounded-full"
                      />
                    )}
                    {isCompleted && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-2 h-2 bg-accent-green rounded-full"
                      />
                    )}
                    {isPending && (
                      <div className="w-2 h-2 bg-gray-600 rounded-full" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Completion Message */}
          <AnimatePresence>
            {isComplete && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mt-8 text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5 }}
                  className="w-16 h-16 bg-gradient-to-br from-accent-green to-accent-mint rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle className="w-8 h-8 text-white" />
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-2">All Set!</h2>
                <p className="text-gray-400">Redirecting to your dashboard...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Loading Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 text-center"
        >
          <div className="glass-card rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-gray-300">Pro Tip</span>
            </div>
            <p className="text-xs text-gray-400">
              Set up spending alerts to stay on top of your credit card usage
            </p>
          </div>
        </motion.div>

        {/* Security Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-4 text-center"
        >
          <div className="flex items-center justify-center space-x-2">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">
              Your data is encrypted and secure
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoadingPage;