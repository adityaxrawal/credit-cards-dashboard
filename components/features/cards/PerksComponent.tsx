import React from 'react';
import { Gift, Star, Zap, Shield, Percent } from 'lucide-react';

const PerksComponent: React.FC = () => {
  const perks = [
    {
      id: 1,
      title: "Cashback Rewards",
      description: "Earn 2% cashback on all purchases, 5% on dining and entertainment",
      icon: <Percent className="w-6 h-6" />,
      color: "text-green-400",
      bgColor: "bg-green-400/20",
    },
    {
      id: 2,
      title: "Premium Benefits",
      description: "Airport lounge access, travel insurance, and concierge services",
      icon: <Star className="w-6 h-6" />,
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/20",
    },
    {
      id: 3,
      title: "Security Features",
      description: "Advanced fraud protection and zero liability on unauthorized charges",
      icon: <Shield className="w-6 h-6" />,
      color: "text-blue-400",
      bgColor: "bg-blue-400/20",
    },
    {
      id: 4,
      title: "Instant Rewards",
      description: "Redeem points instantly for purchases, gift cards, or statement credits",
      icon: <Zap className="w-6 h-6" />,
      color: "text-purple-400",
      bgColor: "bg-purple-400/20",
    },
  ];

  return (
    <div className="bg-gray-900/95 rounded-2xl p-8 border border-gray-800 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gray-800 rounded-lg">
          <Gift className="w-5 h-5 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-white">
          Card Perks & Benefits
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {perks.map((perk) => (
          <div
            key={perk.id}
            className="group p-6 rounded-xl bg-gray-800/60 hover:bg-gray-800/80 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 ${perk.bgColor} rounded-lg group-hover:scale-110 transition-transform duration-200`}>
                <div className={perk.color}>
                  {perk.icon}
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white group-hover:text-gray-100 transition-colors duration-200 mb-2">
                  {perk.title}
                </h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {perk.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Additional benefits section */}
      <div className="mt-8 p-6 rounded-xl bg-gray-800/40 border border-gray-700/50">
        <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-gray-400" />
          Exclusive Member Benefits
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span className="text-gray-400">No Annual Fee</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span className="text-gray-400">24/7 Customer Support</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span className="text-gray-400">Mobile App Access</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span className="text-gray-400">Purchase Protection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span className="text-gray-400">Extended Warranty</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span className="text-gray-400">Price Protection</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerksComponent;