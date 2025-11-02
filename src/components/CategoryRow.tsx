

import React from 'react';
import { Channel } from '../types';
import VodCard from './VodCard';
import { ChevronRightIcon } from './Icons';

interface CategoryRowProps {
  title: string;
  items: Channel[];
  onItemClick: (item: Channel) => void;
  onTitleClick: (title: string) => void;
}

const MAX_INITIAL_ITEMS = 15;

const CategoryRow: React.FC<CategoryRowProps> = ({ title, items, onItemClick, onTitleClick }) => {
  if (!items || items.length === 0) {
    return null;
  }

  const showSeeAll = items.length > MAX_INITIAL_ITEMS;
  const itemsToShow = showSeeAll ? items.slice(0, MAX_INITIAL_ITEMS) : items;

  return (
    <div className="w-full">
        <style>{`
        .category-row::-webkit-scrollbar {
          display: none;
        }
        .category-row {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <button
        onClick={() => onTitleClick(title)}
        className="w-full flex items-center justify-between px-4 mb-3 group"
        aria-label={`${title} kategorisindeki tüm içeriği gör`}
      >
        <h3 className="text-xl font-bold text-gray-100 group-hover:text-accent transition-colors">{title}</h3>
        <div className="flex items-center text-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="text-sm font-semibold mr-1">Tümünü Gör</span>
          <ChevronRightIcon className="w-5 h-5" />
        </div>
      </button>
      <div className="category-row flex gap-4 overflow-x-auto px-4">
        {itemsToShow.map((item) => (
          <div key={item.url} className="flex-shrink-0 w-36">
            <VodCard item={item} onClick={onItemClick} />
          </div>
        ))}
        {showSeeAll && (
          <div className="flex-shrink-0 w-36">
             <button
                onClick={() => onTitleClick(title)}
                className="w-full h-full aspect-[2/3] bg-secondary rounded-lg flex flex-col items-center justify-center text-gray-300 hover:bg-neutral hover:text-accent transition-all duration-300 group"
                aria-label={`${title} kategorisindeki tüm içeriği gör`}
             >
                <ChevronRightIcon className="w-10 h-10 mb-2 transition-transform group-hover:translate-x-1" />
                <span className="font-semibold">Tümünü Gör</span>
             </button>
          </div>
        )}
        <div className="flex-shrink-0 w-1 h-1"></div>
      </div>
    </div>
  );
};

export default CategoryRow;