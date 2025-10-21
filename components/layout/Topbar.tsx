"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Bell, Wallet, Settings } from 'lucide-react';
import Button from '../ui/Button';

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

const Topbar: React.FC<TopbarProps> = ({
  title = "Dashboard",
  subtitle = "Welcome",
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-between p-6 glass-card rounded-2xl p-4"
    >
      {/* Left Section - Title */}
      <div className=''>
        <p className="text-white/60 text-sm mb-1">{subtitle}</p>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
      </div>

      {/* Center Section - Search */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/40" size={20} />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="
              w-full pl-12 pr-4 py-3 
              bg-white/5 border border-white/10 rounded-xl
              text-white placeholder-white/40
              focus:outline-none focus:ring-2 focus:ring-cred-purple/50 focus:border-transparent
              transition-all duration-200
            "
          />
        </div>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center space-x-4">
        {/* Settings Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="
            w-12 h-12 rounded-xl bg-white/5 border border-white/10
            flex items-center justify-center text-white/60 hover:text-white
            hover:bg-white/10 transition-all duration-200
          "
        >
          <Settings size={20} />
        </motion.button>

        {/* Notifications Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="
            relative w-12 h-12 rounded-xl bg-white/5 border border-white/10
            flex items-center justify-center text-white/60 hover:text-white
            hover:bg-white/10 transition-all duration-200
          "
        >
          <Bell size={20} />
          {/* Notification Badge */}
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-cred-pink to-red-500 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-white">3</span>
          </div>
        </motion.button>

        {/* Wallet Button */}
        <Button
          variant="primary"
          size="md"
          className="flex items-center space-x-2"
          onClick={() => console.log('Wallet clicked')}
        >
          <Wallet size={18} />
          <span>Wallet</span>
        </Button>
      </div>
    </motion.div>
  );
};

export default Topbar;