import React from 'react';
import { XIcon } from './Icons';

interface GroupFilterModalProps {
  groups: string[];
  selectedGroup: string;
  onSelect: (group: string) => void;
  onClose: () => void;
}

const GroupFilterModal: React.FC<GroupFilterModalProps> = ({ groups, selectedGroup, onSelect, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 z-30 flex items-end" onClick={onClose}>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
      <div
        className="bg-secondary w-full max-h-[70vh] rounded-t-2xl flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-neutral">
          <h2 className="text-xl font-bold text-gray-100">Kategoriler</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral">
            <XIcon className="w-6 h-6 text-gray-400" />
          </button>
        </header>
        <div className="overflow-y-auto p-2">
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => onSelect(group)}
              className={`w-full text-left p-4 rounded-lg text-lg transition-colors ${
                selectedGroup === group
                  ? 'bg-accent/20 text-accent font-bold'
                  : 'text-gray-200 hover:bg-neutral'
              }`}
            >
              {group}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GroupFilterModal;