import React from 'react';
import { XIcon, PlayIcon, RefreshIcon } from './Icons';

interface ResumePlaybackModalProps {
  onResume: () => void;
  onStartOver: () => void;
  onClose: () => void;
}

const ResumePlaybackModal: React.FC<ResumePlaybackModalProps> = ({ onResume, onStartOver, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 z-30 flex items-center justify-center p-4" onClick={onClose}>
      <style>{`
        @keyframes fade-in-scale {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-scale { animation: fade-in-scale 0.2s ease-out; }
      `}</style>
      <div
        className="bg-secondary w-full max-w-sm rounded-2xl flex flex-col animate-fade-in-scale shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-neutral">
          <h2 className="text-xl font-bold text-gray-100">Kaldığın Yerden Devam Et</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral">
            <XIcon className="w-6 h-6 text-gray-400" />
          </button>
        </header>
        <div className="p-6 text-center">
            <p className="text-gray-300 mb-6">Bu içeriği daha önce izlemeye başlamıştın. İzlemeye devam etmek ister misin?</p>
            <div className="flex flex-col gap-3">
                <button
                    onClick={onResume}
                    className="w-full flex items-center justify-center gap-3 bg-accent text-primary font-bold py-3 px-4 rounded-lg transition-transform hover:scale-105"
                >
                    <PlayIcon className="w-6 h-6" />
                    <span>Devam Et</span>
                </button>
                 <button
                    onClick={onStartOver}
                    className="w-full flex items-center justify-center gap-3 bg-neutral text-gray-200 font-semibold py-3 px-4 rounded-lg transition-colors hover:bg-neutral/70"
                >
                    <RefreshIcon className="w-6 h-6" />
                    <span>Baştan Başla</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ResumePlaybackModal;
