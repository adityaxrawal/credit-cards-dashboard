"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Shield, 
  Zap, 
  BarChart3, 
  Bell, 
  TrendingUp,
  CheckCircle
} from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  const features = [
    {
      icon: Shield,
      title: "Bank-Level Security",
      description: "Your data is protected with enterprise-grade encryption"
    },
    {
      icon: BarChart3,
      title: "Smart Analytics",
      description: "AI-powered insights to optimize your spending"
    },
    {
      icon: Bell,
      title: "Real-time Alerts",
      description: "Instant notifications for all your transactions"
    },
    {
      icon: TrendingUp,
      title: "Reward Optimization",
      description: "Maximize your cashback and reward points"
    }
  ];

  return (
    <div className="min-h-screen bg-primary-bg flex">
      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col justify-center px-12 xl:px-16">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Logo */}
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-mint to-accent-green flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">CreditDash</h1>
              <p className="text-white/60 text-sm">Smart Credit Management</p>
            </div>
          </div>

          {/* Hero Content */}
          <div className="mb-12">
            <h2 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
              Take Control of Your
              <span className="bg-gradient-to-r from-accent-purple to-accent-orange bg-clip-text text-transparent"> Credit Cards</span>
            </h2>
            <p className="text-xl text-white/70 leading-relaxed">
              The most intelligent way to manage your credit cards, track spending, and maximize rewards. 
              Join thousands of users who&apos;ve optimized their financial life.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="bg-white/5 backdrop-filter backdrop-blur-sm rounded-2xl p-6 border border-white/10"
              >
                <feature.icon className="w-8 h-8 text-accent-mint mb-4" />
                <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                <p className="text-white/60 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center px-6 lg:px-12">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent-mint to-accent-green flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">CreditDash</h1>
          </div>

          {/* Form Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">{title}</h2>
            <p className="text-white/60">{subtitle}</p>
          </div>

          {/* Form Content */}
          {children}

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-white/40 text-sm">
              By continuing, you agree to our{' '}
              <a href="#" className="text-accent-purple hover:text-accent-orange transition-colors">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="text-accent-purple hover:text-accent-orange transition-colors">
                Privacy Policy
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthLayout;