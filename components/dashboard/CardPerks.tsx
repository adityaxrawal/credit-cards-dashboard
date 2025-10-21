"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star,
  Gift,
  Plane,
  Car,
  Coffee,
  ShoppingBag,
  CreditCard,
  Percent,
  Award,
  Zap,
  Shield,
  Clock,
  ChevronRight,
  Filter,
  Search,
  MoreHorizontal,
  TrendingUp,
  Calendar,
  MapPin
} from 'lucide-react';
import { getSampleCardPerks, getSampleCreditCards } from '@/lib/sampleData';
import type { CardPerk, CreditCard as CreditCardType } from '@/lib/sampleData';

interface CardPerksProps {
  className?: string;
  cardId?: string;
  showFilters?: boolean;
}

const CardPerks: React.FC<CardPerksProps> = ({ 
  className = '', 
  cardId,
  showFilters = true 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCard, setSelectedCard] = useState<string>(cardId || 'all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const allPerks = getSampleCardPerks(cardId);
  const creditCards = getSampleCreditCards();
  
  // Filter perks
  const filteredPerks = allPerks.filter((perk: CardPerk) => {
    const matchesSearch = perk.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         perk.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         perk.perk_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || perk.category === selectedCategory;
    const matchesCard = selectedCard === 'all' || perk.card_id === selectedCard;
    
    return matchesSearch && matchesCategory && matchesCard && perk.is_active;
  });

  // Get unique categories for filter
  const categories = Array.from(new Set(allPerks.map((p: CardPerk) => p.category)));

  // Get perk type icon
  const getPerkIcon = (perkType: string, category: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      'cashback': Percent,
      'points': Star,
      'miles': Plane,
      'discount': Gift,
      'bonus': Award,
      'protection': Shield,
      'access': Zap,
      'travel': Plane,
      'dining': Coffee,
      'gas': Car,
      'groceries': ShoppingBag,
      'shopping': ShoppingBag,
      'entertainment': Gift,
      'general': CreditCard
    };
    
    return iconMap[perkType.toLowerCase()] || 
           iconMap[category.toLowerCase()] || 
           iconMap.general;
  };

  // Get perk color scheme
  const getPerkColors = (perkType: string) => {
    const colorMap: Record<string, { bg: string; text: string; accent: string }> = {
      'cashback': { bg: 'bg-green-500/20', text: 'text-green-400', accent: 'border-green-500/30' },
      'points': { bg: 'bg-blue-500/20', text: 'text-blue-400', accent: 'border-blue-500/30' },
      'miles': { bg: 'bg-purple-500/20', text: 'text-purple-400', accent: 'border-purple-500/30' },
      'discount': { bg: 'bg-orange-500/20', text: 'text-orange-400', accent: 'border-orange-500/30' },
      'bonus': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', accent: 'border-yellow-500/30' },
      'protection': { bg: 'bg-red-500/20', text: 'text-red-400', accent: 'border-red-500/30' },
      'access': { bg: 'bg-indigo-500/20', text: 'text-indigo-400', accent: 'border-indigo-500/30' }
    };
    
    return colorMap[perkType.toLowerCase()] || colorMap.points;
  };

  // Get card info
  const getCardInfo = (cardId: string) => {
    return creditCards.find((card: CreditCardType) => card.id === cardId);
  };

  // Format reward rate
  const formatRewardRate = (rate: number, perkType: string) => {
    if (perkType.toLowerCase() === 'cashback') {
      return `${rate}% Cash Back`;
    } else if (perkType.toLowerCase() === 'points') {
      return `${rate}x Points`;
    } else if (perkType.toLowerCase() === 'miles') {
      return `${rate}x Miles`;
    }
    return `${rate}x Rewards`;
  };

  return (
    <div className={`glass-card rounded-2xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Card Perks & Benefits</h3>
          <p className="text-gray-400 text-sm">
            Maximize your rewards and benefits
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 bg-gray-800/50 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            {viewMode === 'grid' ? <MoreHorizontal className="w-4 h-4" /> : <MoreHorizontal className="w-4 h-4 rotate-90" />}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 bg-gray-800/50 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <Filter className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Search and Filters */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search perks and benefits..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          {/* Card Filter */}
          {!cardId && (
            <select
              value={selectedCard}
              onChange={(e) => setSelectedCard(e.target.value)}
              className="bg-gray-800/50 border border-gray-600/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">All Cards</option>
              {creditCards.map((card: CreditCardType) => (
                <option key={card.id} value={card.id}>
                  {card.bank_name} •••• {card.card_last_4}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Perks Grid/List */}
      <div className={`${
        viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
          : 'space-y-4'
      }`}>
        <AnimatePresence>
          {filteredPerks.map((perk: CardPerk, index: number) => {
            const PerkIcon = getPerkIcon(perk.perk_type, perk.category);
            const colors = getPerkColors(perk.perk_type);
            const cardInfo = getCardInfo(perk.card_id);

            return (
              <motion.div
                key={perk.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                className={`${
                  viewMode === 'grid' 
                    ? 'p-6' 
                    : 'p-4 flex items-center space-x-4'
                } bg-gray-800/30 rounded-xl hover:bg-gray-800/50 transition-all duration-200 group cursor-pointer border border-gray-700/50 hover:border-gray-600/50`}
              >
                {/* Icon and Header */}
                <div className={`${viewMode === 'grid' ? 'mb-4' : 'flex-shrink-0'}`}>
                  <div className={`${
                    viewMode === 'grid' ? 'w-12 h-12 mb-3' : 'w-10 h-10'
                  } ${colors.bg} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <PerkIcon className={`${
                      viewMode === 'grid' ? 'w-6 h-6' : 'w-5 h-5'
                    } ${colors.text}`} />
                  </div>
                  
                  {viewMode === 'grid' && (
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                        {perk.perk_type}
                      </span>
                      <span className="text-gray-400 text-xs">{perk.category}</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className={`${viewMode === 'grid' ? '' : 'flex-1 min-w-0'}`}>
                  <div className={`${viewMode === 'grid' ? 'mb-3' : 'mb-1'}`}>
                    <h4 className={`${
                      viewMode === 'grid' ? 'text-lg' : 'text-base'
                    } font-semibold text-white group-hover:text-blue-400 transition-colors`}>
                      {formatRewardRate(perk.reward_rate, perk.perk_type)}
                    </h4>
                    <p className={`${
                      viewMode === 'grid' ? 'text-sm' : 'text-xs'
                    } text-gray-400 line-clamp-2`}>
                      {perk.description}
                    </p>
                  </div>

                  {/* Card Info and Benefits */}
                  <div className={`${
                    viewMode === 'grid' ? 'space-y-2' : 'flex items-center justify-between'
                  }`}>
                    {cardInfo && (
                      <div className="flex items-center space-x-2">
                        <CreditCard className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-500">
                          {cardInfo.bank_name} •••• {cardInfo.card_last_4}
                        </span>
                      </div>
                    )}

                    {perk.max_monthly_benefit && (
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-500">
                          Up to ${perk.max_monthly_benefit}/month
                        </span>
                      </div>
                    )}

                    {viewMode === 'list' && (
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                          {perk.category}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                      </div>
                    )}
                  </div>

                  {viewMode === 'grid' && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        <TrendingUp className="w-3 h-3 text-green-400" />
                        <span className="text-xs text-green-400">Active</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredPerks.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="w-8 h-8 text-gray-400" />
          </div>
          <h4 className="text-white font-medium mb-2">No perks found</h4>
          <p className="text-gray-400 text-sm">
            Try adjusting your search or filter criteria
          </p>
        </motion.div>
      )}

      {/* Summary Stats */}
      {filteredPerks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 pt-6 border-t border-gray-700/50"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-1">
                {filteredPerks.length}
              </div>
              <div className="text-xs text-gray-400">Active Perks</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400 mb-1">
                {filteredPerks.filter((p: CardPerk) => p.perk_type.toLowerCase() === 'cashback').length}
              </div>
              <div className="text-xs text-gray-400">Cashback</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400 mb-1">
                {filteredPerks.filter((p: CardPerk) => p.perk_type.toLowerCase() === 'points').length}
              </div>
              <div className="text-xs text-gray-400">Points</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">
                {filteredPerks.filter((p: CardPerk) => p.perk_type.toLowerCase() === 'miles').length}
              </div>
              <div className="text-xs text-gray-400">Miles</div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CardPerks;