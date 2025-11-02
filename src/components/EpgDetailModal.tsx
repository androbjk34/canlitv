import React from 'react';
import { EpgEvent } from '../types';
import { XIcon } from './Icons';

interface EpgDetailModalProps {
  event: EpgEvent;
  onClose: () => void;
}

const EpgDetailModal: React.FC<EpgDetailModalProps> = ({ event, onClose }) => {
  const formatTime = (date: Date) => date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-end" onClick={onClose}>
      <style>{`
        @keyframes slide-up-detail {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up-detail { animation: slide-up-detail 0.3s ease-out; }
      `}</style>
      <div
        className="bg-secondary w-full max-h-[80vh] rounded-t-2xl flex flex-col animate-slide-up-detail"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-neutral sticky top-0 bg-secondary">
          <h2 className="text-xl font-bold text-gray-100 truncate pr-4">{event.title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral flex-shrink-0">
            <XIcon className="w-6 h-6 text-gray-400" />
          </button>
        </header>
        <div className="overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-gray-400 text-sm">Yayın Zamanı</p>
            <p className="text-lg text-gray-100">{formatTime(event.startTime)} - {formatTime(event.endTime)}</p>
          </div>

          {event.synopsis && (
            <div>
              <h3 className="text-lg font-bold text-accent mb-2">Konu</h3>
              <p className="text-gray-300 leading-relaxed">{event.synopsis}</p>
            </div>
          )}

          {event.cast && event.cast.length > 0 && (
             <div>
              <h3 className="text-lg font-bold text-accent mb-2">Oyuncular</h3>
              <div className="flex flex-wrap gap-2">
                {event.cast.map((actor, index) => (
                    <span key={index} className="bg-neutral text-gray-200 text-sm font-medium px-3 py-1 rounded-full">
                        {actor}
                    </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EpgDetailModal;