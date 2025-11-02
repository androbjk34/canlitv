import React, { useState, useEffect } from 'react';
import { XIcon } from './Icons';

export type AudioTrackInfo = { id: number; name: string; lang?: string };
export type SubtitleTrackInfo = { id: number; name: string; lang?: string };
export type QualityLevelInfo = { id: number; name: string; bitrate?: number };

interface TrackSelectionModalProps {
  audioTracks: AudioTrackInfo[];
  subtitleTracks: SubtitleTrackInfo[];
  qualityLevels: QualityLevelInfo[];
  currentAudioTrackId: number;
  currentSubtitleTrackId: number;
  currentQualityLevelId: number;
  onSelectAudio: (id: number) => void;
  onSelectSubtitle: (id: number) => void;
  onSelectQuality: (id: number) => void;
  onClose: () => void;
}

type Tab = 'quality' | 'audio' | 'subtitle';

const TrackSelectionModal: React.FC<TrackSelectionModalProps> = ({
  audioTracks, subtitleTracks, qualityLevels,
  currentAudioTrackId, currentSubtitleTrackId, currentQualityLevelId,
  onSelectAudio, onSelectSubtitle, onSelectQuality,
  onClose
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('quality');
    
    // Set initial tab based on available options
    useEffect(() => {
        if (qualityLevels.length > 1) {
            setActiveTab('quality');
        } else if (audioTracks.length > 0) { // FIX: Changed to > 0 to allow audio tab to always be a potential default
            setActiveTab('audio');
        } else if (subtitleTracks.length > 1) {
            setActiveTab('subtitle');
        }
    }, [qualityLevels, audioTracks, subtitleTracks]);

    const renderTabs = () => (
      <div className="flex border-b border-neutral">
        {qualityLevels.length > 1 && (
            <button onClick={() => setActiveTab('quality')} className={`flex-1 p-3 font-bold transition-colors ${activeTab === 'quality' ? 'text-accent border-b-2 border-accent' : 'text-gray-400 hover:text-gray-200'}`}>Kalite</button>
        )}
        {/* FIX: Show audio tab if any audio track exists, not just when there are multiple options. */}
        {audioTracks.length > 0 && (
            <button onClick={() => setActiveTab('audio')} className={`flex-1 p-3 font-bold transition-colors ${activeTab === 'audio' ? 'text-accent border-b-2 border-accent' : 'text-gray-400 hover:text-gray-200'}`}>Ses</button>
        )}
        {subtitleTracks.length > 1 && (
            <button onClick={() => setActiveTab('subtitle')} className={`flex-1 p-3 font-bold transition-colors ${activeTab === 'subtitle' ? 'text-accent border-b-2 border-accent' : 'text-gray-400 hover:text-gray-200'}`}>Altyazı</button>
        )}
      </div>
    );

    const renderContent = () => {
        switch(activeTab) {
            case 'quality':
                return qualityLevels.map(level => (
                    <button key={`q-${level.id}`} onClick={() => { onSelectQuality(level.id); onClose(); }} className={`w-full text-left p-4 rounded-lg text-lg transition-colors ${currentQualityLevelId === level.id ? 'bg-accent/20 text-accent font-bold' : 'text-gray-200 hover:bg-neutral'}`}>
                        {level.name}
                    </button>
                ));
            case 'audio':
                if (audioTracks.length > 1) {
                    return audioTracks.map(track => (
                        <button key={`a-${track.id}`} onClick={() => { onSelectAudio(track.id); onClose(); }} className={`w-full text-left p-4 rounded-lg text-lg transition-colors ${currentAudioTrackId === track.id ? 'bg-accent/20 text-accent font-bold' : 'text-gray-200 hover:bg-neutral'}`}>
                            {track.name} {track.lang && `(${track.lang.toUpperCase()})`}
                        </button>
                    ));
                }
                return (
                    <div className="p-4 text-center text-gray-400">
                        <p className="font-semibold text-lg text-gray-200 mb-1">
                            {audioTracks.length > 0 ? `${audioTracks[0].name} ${audioTracks[0].lang ? `(${audioTracks[0].lang.toUpperCase()})` : ''}` : 'Ses Kanalı Yok'}
                        </p>
                        {audioTracks.length > 0 && <p>Bu yayında değiştirilebilecek başka ses kanalı bulunmuyor.</p>}
                    </div>
                );
            case 'subtitle':
                return subtitleTracks.map(track => (
                    <button key={`s-${track.id}`} onClick={() => { onSelectSubtitle(track.id); onClose(); }} className={`w-full text-left p-4 rounded-lg text-lg transition-colors ${currentSubtitleTrackId === track.id ? 'bg-accent/20 text-accent font-bold' : 'text-gray-200 hover:bg-neutral'}`}>
                        {track.name} {track.lang && `(${track.lang.toUpperCase()})`}
                    </button>
                ));
            default:
                return <div className="p-4 text-center text-gray-400">Seçenek bulunamadı.</div>;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={onClose}>
            <style>{`
                @keyframes slide-up-settings { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .animate-slide-up-settings { animation: slide-up-settings 0.3s ease-out; }
            `}</style>
            <div
                className="bg-secondary w-full max-h-[60vh] rounded-t-2xl flex flex-col animate-slide-up-settings"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-neutral">
                    <h2 className="text-xl font-bold text-gray-100">Oynatıcı Ayarları</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral flex-shrink-0">
                        <XIcon className="w-6 h-6 text-gray-400" />
                    </button>
                </header>
                {renderTabs()}
                <div className="overflow-y-auto p-2">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default TrackSelectionModal;