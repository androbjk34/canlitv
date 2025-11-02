import React, { useRef, useEffect, useState } from 'react';
import { Channel } from '../types';
import { TvIcon } from './Icons';

interface ChannelSwitcherProps {
  channels: Channel[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

// A new sub-component to handle the state of each individual logo.
// This is more efficient and follows React best practices.
const ChannelSwitcherItem: React.FC<{
  channel: Channel;
  isActive: boolean;
}> = ({ channel, isActive }) => {
  const [hasError, setHasError] = useState(false);

  // Reset error state if the logo URL changes
  useEffect(() => {
    setHasError(false);
  }, [channel.logo]);

  const showPlaceholder = !channel.logo || hasError;

  return (
    <>
      {showPlaceholder ? (
        <div className={`w-full h-full flex items-center justify-center bg-secondary rounded-full`}>
          <TvIcon className={`${isActive ? 'w-8 h-8' : 'w-6 h-6'} text-gray-400`} />
        </div>
      ) : (
        <img
          src={channel.logo!}
          alt={`${channel.name} logo`}
          className="w-full h-full object-contain bg-neutral rounded-full"
          onError={() => setHasError(true)}
        />
      )}
    </>
  );
};

const ChannelSwitcher: React.FC<ChannelSwitcherProps> = ({ channels, currentIndex, onSelect }) => {
  const activeChannelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeChannelRef.current) {
      activeChannelRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  return (
    <div className="relative py-3 bg-primary border-y border-neutral/50">
       <style>{`
        .channel-switcher::-webkit-scrollbar {
          display: none;
        }
        .channel-switcher {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <div className="absolute inset-0 flex justify-between items-center pointer-events-none z-10">
        <div className="w-12 h-full bg-gradient-to-r from-primary to-transparent"></div>
        <div className="w-12 h-full bg-gradient-to-l from-primary to-transparent"></div>
      </div>
      <div
        className="channel-switcher flex items-center gap-4 px-4 overflow-x-auto"
      >
        {channels.map((channel, index) => {
          const isActive = index === currentIndex;
          return (
            <button
              key={`${channel.url}-${index}`}
              ref={isActive ? activeChannelRef : null}
              onClick={() => onSelect(index)}
              className={`flex-shrink-0 transition-all duration-300 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary focus:ring-accent ${
                isActive ? 'w-20 h-20 border-4 border-accent shadow-lg shadow-accent/20' : 'w-16 h-16 opacity-60 hover:opacity-100'
              }`}
              aria-label={`Kanala geç: ${channel.name}`}
              aria-current={isActive}
            >
              <ChannelSwitcherItem channel={channel} isActive={isActive} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChannelSwitcher;