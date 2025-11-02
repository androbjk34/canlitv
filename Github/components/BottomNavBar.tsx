import React from 'react';
import { HomeIcon, SearchIcon, TvIcon, UserIcon, HeartIcon } from './Icons';

interface BottomNavBarProps {
  onHomeClick: () => void;
  onSearchClick: () => void;
  onFavoritesClick: () => void;
  selectedGroup: string;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ 
  onHomeClick, 
  onSearchClick, 
  onFavoritesClick,
  selectedGroup 
}) => {
    
  const NavItem: React.FC<{ icon: React.ReactNode; label: string; isActive?: boolean; onClick?: () => void; }> = 
  ({ icon, label, isActive, onClick }) => (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full pt-2 pb-1 transition-colors duration-200 ${isActive ? 'text-accent' : 'text-gray-400 hover:text-gray-200'}`}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-secondary/80 backdrop-blur-lg border-t border-neutral z-20">
      <div className="flex justify-around items-center h-16">
        <NavItem 
          icon={<HomeIcon className="w-6 h-6" />} 
          label="Anasayfa" 
          onClick={onHomeClick}
          isActive={selectedGroup === 'Tüm Kanallar'}
        />
        <NavItem 
          icon={<SearchIcon className="w-6 h-6" />} 
          label="Ara" 
          onClick={onSearchClick}
        />
        
        {/* Active TV Button */}
        <div className="-mt-8">
            <button className="w-16 h-16 bg-accent rounded-full flex items-center justify-center shadow-lg shadow-accent/30 border-4 border-primary" aria-label="Mevcut Görünüm: Kanallar">
                <TvIcon className="w-8 h-8 text-primary" />
            </button>
        </div>

        <NavItem 
          icon={<HeartIcon className="w-6 h-6" />} 
          label="Favoriler" 
          onClick={onFavoritesClick}
          isActive={selectedGroup === 'Favoriler'}
        />
        <NavItem 
          icon={<UserIcon className="w-6 h-6" />} 
          label="Hesabım"
          onClick={() => alert('Hesabım ve Ayarlar bölümü yakında eklenecektir.')}
        />
      </div>
    </div>
  );
};

export default BottomNavBar;