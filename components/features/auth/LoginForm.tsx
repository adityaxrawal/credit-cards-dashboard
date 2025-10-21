"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Eye,
  EyeOff,
  ArrowRight
} from 'lucide-react';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSubmit, isLoading }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(email, password);
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {/* Email Field */}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-white/80">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/40 w-5 h-5" />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-cred-purple focus:border-transparent transition-all duration-200"
            placeholder="Enter your email"
            required
          />
        </div>
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-white/80">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-4 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-cred-purple focus:border-transparent transition-all duration-200"
            placeholder="Enter your password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !email || !password}
        className="w-full bg-gradient-to-r from-cred-purple to-cred-pink hover:from-cred-purple/90 hover:to-cred-pink/90 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            Sign In
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </motion.form>
  );
};

export default LoginForm;