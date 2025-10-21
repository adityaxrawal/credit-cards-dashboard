"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Bell, Wallet, Settings } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Button from '@/components/ui/Button';

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

const Topbar: React.FC<TopbarProps> = ({
  title,
  subtitle,
}) => {
  const pathname = usePathname();
  
  // Define page titles and subtitles based on pathname
  const getPageInfo = () => {
    // Handle dynamic routes first
    if (pathname.startsWith('/card-detail/')) {
      return { title: 'Card Detail', subtitle: 'Know your cards' };
    }
    
    switch (pathname) {
      case '/dashboard':
        return { title: 'Dashboard', subtitle: 'Welcome back' };
      case '/cards':
        return { title: 'Cards', subtitle: 'Manage your cards' };
      case '/transactions':
        return { title: 'Transactions', subtitle: 'Transaction history' };
      case '/statements':
        return { title: 'Statements', subtitle: 'Monthly statements' };
      case '/settings':
        return { title: 'Settings', subtitle: 'Account preferences' };
      default:
        return { title: 'Dashboard', subtitle: 'Welcome back' };
    }
  };

  const pageInfo = getPageInfo();
  const displayTitle = title || pageInfo.title;
  const displaySubtitle = subtitle || pageInfo.subtitle;
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
        <p className="text-white/60 text-sm mb-1">{displaySubtitle}</p>
        <h1 className="text-2xl font-bold text-white">{displayTitle}</h1>
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
      </div>
    </motion.div>
  );
};

export default Topbar;