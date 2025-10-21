import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface TabNavigationComponentProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const TabNavigationComponent: React.FC<TabNavigationComponentProps> = ({
  tabs,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="border-b border-border-primary">
      <nav className="flex space-x-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? "border-primary-blue text-primary-blue"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default TabNavigationComponent;