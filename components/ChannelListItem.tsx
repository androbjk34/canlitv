import React, { useState, useEffect } from 'react';
import { Channel } from '../types';
import { ChevronDownIcon, HeartIcon, LockIcon, TvIcon } from './Icons';

interface ChannelListItemProps {
  channel: Channel;
  onClick: (channel: Channel) => void;
  isFavorite: boolean;
  onToggleFavorite: (url: string) => void;
}

const ChannelListItem: React.FC<ChannelListItemProps> = ({ channel, onClick, isFavorite, onToggleFavorite }) => {
  const { currentEpg } = channel;
  const [progress, setProgress] = useState(0);
  const [logoHasError, setLogoHasError] = useState(false);

  // Reset error state if channel logo url changes
  useEffect(() => {
    setLogoHasError(false);
  }, [channel.logo]);

  useEffect(() => {
    const calculateProgress = () => {
      if (!currentEpg) return 0;
      
      const now = new Date().getTime();
      const start = currentEpg.startTime.getTime();
      const end = currentEpg.endTime.getTime();

      if (now < start) return 0;
      if (now > end) return 100;

      const duration = end - start;
      const elapsed = now - start;
      
      return (elapsed / duration) * 100;
    };

    setProgress(calculateProgress());

    // Update progress every minute
    const interval = setInterval(() => {
      setProgress(calculateProgress());
    }, 60000);

    return () => clearInterval(interval);
  }, [currentEpg]);
  
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(channel.url);
  };
  
  const showPlaceholder = !channel.logo || logoHasError;

  return (
    <div
      onClick={() => onClick(channel)}
      className="flex items-center p-2 rounded-lg hover:bg-secondary cursor-pointer transition-colors duration-200"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onClick(channel)}
    >
      {/* Logo */}
      <div className="flex-shrink-0 w-14 h-14 bg-neutral rounded-md overflow-hidden flex items-center justify-center mr-4">
        {showPlaceholder ? (
            <div className="w-full h-full flex items-center justify-center bg-secondary">
              <TvIcon className="w-6 h-6 text-gray-400" />
            </div>
        ) : (
            <img
                src={channel.logo!}
                alt={`${channel.name} logo`}
                className="w-full h-full object-contain"
                onError={() => setLogoHasError(true)}
            />
        )}
      </div>
      
      {/* Channel Info */}
      <div className="flex-grow min-w-0 mr-3">
        <p className="font-semibold text-gray-100 truncate">{channel.name}</p>
        {currentEpg ? (
          <>
            <p className="text-sm text-gray-400 truncate mt-0.5">
              {currentEpg.title}
            </p>
            <div className="w-full bg-neutral rounded-full h-1 mt-1.5" title={`${Math.round(progress)}% tamamlandı`}>
              <div 
                className="bg-accent h-1 rounded-full transition-all duration-500" 
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Yayın ilerlemesi"
              ></div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 italic">Yayın bilgisi yok</p>
        )}
      </div>

      {/* Action Icons */}
      <div className="flex items-center space-x-3">
        <button 
            onClick={handleFavoriteClick}
            className={`p-1 rounded-full transition-colors ${isFavorite ? 'text-accent' : 'text-gray-400 hover:text-accent'} focus:outline-none`}
            aria-label={isFavorite ? 'Favorilerden kaldır' : 'Favorilere ekle'}
        >
            <HeartIcon className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'}/>
        </button>
        <button className="p-1 text-gray-400 hover:text-gray-200 focus:text-gray-200 focus:outline-none">
            <LockIcon className="w-5 h-5" />
        </button>
        <ChevronDownIcon className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  );
};

export default ChannelListItem;