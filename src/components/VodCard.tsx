import React, { useState, useEffect } from 'react';
import { Channel } from '../types';
import { MovieIcon } from './Icons';

interface VodCardProps {
  item: Channel;
  onClick: (item: Channel) => void;
}

const VodCard: React.FC<VodCardProps> = ({ item, onClick }) => {
  const [logoHasError, setLogoHasError] = useState(false);

  useEffect(() => {
    setLogoHasError(false);
  }, [item.logo]);

  const showPlaceholder = !item.logo || logoHasError;

  return (
    <div
      onClick={() => onClick(item)}
      className="aspect-[2/3] bg-secondary rounded-lg overflow-hidden cursor-pointer group relative shadow-lg hover:shadow-accent/20 transition-shadow duration-300"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onClick(item)}
    >
      {showPlaceholder ? (
        <div className="w-full h-full flex items-center justify-center bg-neutral">
          <MovieIcon className="w-12 h-12 text-gray-500" />
        </div>
      ) : (
        <img
          src={item.logo!}
          alt={`${item.name} poster`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setLogoHasError(true)}
          loading="lazy"
        />
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <h3 className="text-white font-semibold truncate group-hover:text-accent transition-colors">{item.name}</h3>
      </div>
    </div>
  );
};

export default VodCard;
