"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Bell, User, ChevronDown, Settings, LogOut, CreditCard } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Portal from '@/components/shared/ui/Portal';

interface TopbarProps {
  title?: string;
  subtitle?: string;
}

const Topbar: React.FC<TopbarProps> = ({
  title,
  subtitle,
}) => {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileBtnRef = React.useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  React.useEffect(() => {
    const update = () => {
      const rect = profileBtnRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({ top: rect.bottom + 8, left: rect.right - 256 });
    };
    if (showProfileMenu) {
      update();
      window.addEventListener('resize', update);
      window.addEventListener('scroll', update);
    }
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, [showProfileMenu]);
  
  // Define page titles and subtitles based on pathname
  const getPageInfo = () => {
    // Handle dynamic routes first
    if (pathname.startsWith('/card-detail/')) {
      return { title: 'Card Detail', subtitle: 'Manage your card details' };
    }
    
    switch (pathname) {
      case '/dashboard':
        return { title: 'Dashboard', subtitle: 'Welcome back, Aditya' };
      case '/cards':
        return { title: 'Cards', subtitle: 'Manage your cards' };
      case '/transactions':
        return { title: 'Transactions', subtitle: 'Transaction history' };
      case '/statements':
        return { title: 'Statements', subtitle: 'Monthly statements' };
      case '/settings':
        return { title: 'Settings', subtitle: 'Account preferences' };
      default:
        return { title: 'Dashboard', subtitle: 'Welcome back, Aditya' };
    }
  };

  const pageInfo = getPageInfo();
  const displayTitle = title || pageInfo.title;
  const displaySubtitle = subtitle || pageInfo.subtitle;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-between p-6 glass-card rounded-2xl backdrop-blur-xl border border-white/10 shadow-xl"
    >
      {/* Left Section - Title & Breadcrumb */}
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-mint to-accent-purple flex items-center justify-center shadow-lg">
          <CreditCard className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-white/50 text-sm">CardHub</span>
            <span className="text-white/30">•</span>
            <span className="text-white/70 text-sm">{displayTitle}</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
            {displaySubtitle}
          </h1>
        </div>
      </div>

      {/* Center Section - Enhanced Search */}
      <div className="flex-1 max-w-lg mx-8 hidden md:block">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/40 group-focus-within:text-accent-mint transition-colors duration-200" size={20} />
          <input
            type="text"
            placeholder="Search transactions, cards, or statements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="
              w-full pl-12 pr-4 py-3.5 
              bg-white/5 border border-white/10 rounded-xl
              text-white placeholder-white/40
              focus:outline-none focus:ring-2 focus:ring-accent-mint/50 focus:border-accent-mint/30
              focus:bg-white/10 transition-all duration-300
              backdrop-blur-sm
            "
          />
          {searchQuery && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-4 shadow-2xl"
            >
              <p className="text-white/60 text-sm">No results found for &quot;{searchQuery}&quot;</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Right Section - Enhanced Actions */}
      <div className="flex items-center space-x-3">
        {/* Notifications Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="
            relative w-12 h-12 rounded-xl bg-white/5 border border-white/10
            flex items-center justify-center text-white/60 hover:text-white
            hover:bg-white/10 hover:border-white/20 transition-all duration-300
            backdrop-blur-sm shadow-lg hover:shadow-xl
          "
        >
          <Bell size={20} />
          {/* Enhanced Notification Badge */}
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg"
          >
            <span className="text-xs font-bold text-white">3</span>
          </motion.div>
        </motion.button>

        {/* User Profile Dropdown */}
        <div className="relative">
          <motion.button
            ref={profileBtnRef}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="
              flex items-center space-x-3 px-4 py-2 rounded-xl
              bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20
              transition-all duration-300 backdrop-blur-sm shadow-lg hover:shadow-xl
            "
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-mint to-accent-purple flex items-center justify-center shadow-md">
              <User size={16} className="text-white" />
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-white text-sm font-medium">Aditya Rawal</p>
              <p className="text-white/60 text-xs">Premium Member</p>
            </div>
            <ChevronDown 
              size={16} 
              className={`text-white/60 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} 
            />
          </motion.button>

          {showProfileMenu && (
            <Portal>
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="
                  fixed w-64 
                  bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl 
                  shadow-2xl z-[10000] pointer-events-auto
                "
                style={{ top: menuPos.top, left: menuPos.left }}
              >
                <div className="p-4 border-b border-white/10">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-mint to-accent-purple flex items-center justify-center shadow-lg">
                      <User size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Aditya Rawal</p>
                      <p className="text-white/60 text-sm">aditya@example.com</p>
                      <div className="flex items-center space-x-1 mt-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-green-400 text-xs">Premium Member</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors duration-200 text-white/80 hover:text-white">
                    <Settings size={16} />
                    <span className="text-sm">Account Settings</span>
                  </button>
                  <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors duration-200 text-white/80 hover:text-white">
                    <CreditCard size={16} />
                    <span className="text-sm">Manage Cards</span>
                  </button>
                  <hr className="border-white/10 my-2" />
                  <button className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-red-500/20 transition-colors duration-200 text-red-400 hover:text-red-300">
                    <LogOut size={16} />
                    <span className="text-sm">Sign Out</span>
                  </button>
                </div>
              </motion.div>
            </Portal>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Topbar;