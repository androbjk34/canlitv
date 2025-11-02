import React from 'react';
import { XIcon } from './Icons';

interface WebViewPlayerModalProps {
  url: string;
  onClose: () => void;
}

const WebViewPlayerModal: React.FC<WebViewPlayerModalProps> = ({ url, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black z-50 animate-fade-in">
       <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full hover:bg-black/80 transition-colors"
        aria-label="Kapat"
      >
        <XIcon className="w-6 h-6 text-white" />
      </button>
      <iframe
        src={url}
        title="Web Player"
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

export default WebViewPlayerModal;