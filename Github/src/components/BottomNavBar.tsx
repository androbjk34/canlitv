import React from 'react';
import { TvIcon, HeartIcon, MovieIcon, SeriesIcon } from './Icons';

export type Tab = 'live' | 'movies' | 'series' | 'favorites';

interface BottomNavBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
    
  const NavItem: React.FC<{ icon: React.ReactNode; label: string; tab: Tab; }> = 
  ({ icon, label, tab }) => {
    const isActive = activeTab === tab;
    return (
      <button 
        onClick={() => onTabChange(tab)}
        className={`flex flex-col items-center justify-center w-full pt-2 pb-1 transition-colors duration-200 ${isActive ? 'text-accent' : 'text-gray-400 hover:text-gray-200'}`}
        aria-current={isActive ? 'page' : undefined}
      >
        {icon}
        <span className="text-xs mt-1">{label}</span>
      </button>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-secondary/80 backdrop-blur-lg border-t border-neutral z-20">
      <div className="flex justify-around items-center h-16">
        <NavItem 
          icon={<TvIcon className="w-6 h-6" />} 
          label="Canlı TV" 
          tab="live"
        />
        <NavItem 
          icon={<SeriesIcon className="w-6 h-6" />} 
          label="Diziler" 
          tab="series"
        />
        <NavItem 
          icon={<MovieIcon className="w-6 h-6" />} 
          label="Filmler" 
          tab="movies"
        />
        <NavItem 
          icon={<HeartIcon className="w-6 h-6" />} 
          label="Favoriler" 
          tab="favorites"
        />
      </div>
    </div>
  );
};

export default BottomNavBar;