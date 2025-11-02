import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Channel } from '../types';
import { PlayIcon, PlusIcon, InfoIcon, HeartIcon, MovieIcon, SeriesIcon } from './Icons';

interface CarouselProps {
  items: Channel[];
  onItemClick: (item: Channel) => void;
  onToggleFavorite: (url: string) => void;
  favorites: Set<string>;
  activeTab: 'movies' | 'series';
}

const Carousel: React.FC<CarouselProps> = ({ items, onItemClick, onToggleFavorite, favorites, activeTab }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const timeoutRef = useRef<number | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleImageError = (url: string) => {
    setImageErrors(prev => ({ ...prev, [url]: true }));
  };

  useEffect(() => {
    // When items change, reset the errors
    setImageErrors({});
  }, [items]);
  
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    
    resetTimeout();
    timeoutRef.current = window.setTimeout(
      () => setCurrentIndex((prevIndex) => (prevIndex === items.length - 1 ? 0 : prevIndex + 1)),
      5000
    );

    return () => {
      resetTimeout();
    };
  }, [currentIndex, items.length, resetTimeout]);

  if (!items || items.length === 0) {
    return null;
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (items.length <= 1) return;
    touchStartX.current = e.targetTouches[0].clientX;
    resetTimeout();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (items.length <= 1) return;
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (items.length <= 1) return;
    if (touchStartX.current - touchEndX.current > 75) {
      // Swiped left
      setCurrentIndex((prev) => (prev === items.length - 1 ? 0 : prev + 1));
    }

    if (touchStartX.current - touchEndX.current < -75) {
      // Swiped right
      setCurrentIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1));
    }
  };

  return (
    <div className="relative w-full aspect-video overflow-hidden" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {/* Slides container */}
      <div
        className="flex transition-transform duration-500 ease-in-out h-full"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {items.map((item) => {
          const hasError = !item.logo || imageErrors[item.url];
          return (
            <div key={item.url} className="flex-shrink-0 w-full h-full relative bg-secondary">
              {hasError ? (
                <div className="w-full h-full flex items-center justify-center bg-neutral">
                  {activeTab === 'movies'
                    ? <MovieIcon className="w-24 h-24 text-gray-500" />
                    : <SeriesIcon className="w-24 h-24 text-gray-500" />
                  }
                </div>
              ) : (
                <img
                  src={item.logo!}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(item.url)}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 text-white">
                <h2 className="text-2xl lg:text-3xl font-bold truncate">{item.name}</h2>
                <div className="flex items-center space-x-3 mt-3">
                  <button
                    onClick={() => onItemClick(item)}
                    className="flex items-center justify-center gap-2 bg-white text-black font-bold py-2 px-5 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    <PlayIcon className="w-5 h-5" />
                    <span>Hemen İzle</span>
                  </button>
                  <button
                    onClick={() => onToggleFavorite(item.url)}
                    className="w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/40 transition-colors"
                    aria-label="Listeye Ekle"
                  >
                    {favorites.has(item.url) ? (
                       <HeartIcon className="w-5 h-5" fill="currentColor"/>
                    ) : (
                      <PlusIcon className="w-6 h-6" />
                    )}
                  </button>
                   <button className="w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/40 transition-colors" aria-label="Daha Fazla Bilgi">
                      <InfoIcon className="w-5 h-5"/>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination dots */}
      {items.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-2">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                currentIndex === index ? 'bg-white' : 'bg-white/50'
              }`}
              aria-label={`Slayt ${index + 1}'e git`}
            ></button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Carousel;
