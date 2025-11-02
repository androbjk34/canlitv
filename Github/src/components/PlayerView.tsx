import React, { useState, useRef, useEffect, useCallback } from 'react';
// HLS.js ve Capacitor kütüphaneleri
import Hls, { Events, ErrorTypes, type HlsConfig, type ErrorData } from 'hls.js';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

// Bileşenler ve Tipler
import { Channel, EpgEvent } from '../types';
import { BackIcon, HeartIcon, InfoIcon, LockIcon, PlayIcon, PauseIcon, FullscreenEnterIcon, FullscreenExitIcon, RewindIcon, ForwardIcon, TvIcon, AspectRatioIcon, SettingsIcon, ExternalLinkIcon } from './Icons';
import EpgDetailModal from './EpgDetailModal';
import ChannelSwitcher from './ChannelSwitcher';
import TrackSelectionModal, { AudioTrackInfo, SubtitleTrackInfo, QualityLevelInfo } from './TrackSelectionModal';
import WebViewPlayerModal from './WebViewPlayerModal';

const VOD_PROGRESS_STORAGE_KEY = 'iptv_vod_progress';

interface PlayerViewProps {
  channel: Channel;
  onBack: () => void;
  isFavorite: boolean;
  onToggleFavorite: (url: string) => void;
  channelList: Channel[];
  currentIndex: number;
  onChannelSwitch: (newIndex: number) => void;
  playerMode: 'live' | 'vod';
  initialSeekTime?: number;
}

interface PlayerError {
  message: string;
  isCorsError: boolean;
}

// Helper component for displaying a single program in the EPG list
interface EpgProgramItemProps {
  event: EpgEvent;
  isCurrent: boolean;
  isPast: boolean;
  onClick: (event: EpgEvent) => void;
}

const EpgProgramItem: React.FC<EpgProgramItemProps> = ({ event, isCurrent, isPast, onClick }) => {
    const formatTime = (date: Date) => date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    return (
        <button
            onClick={() => onClick(event)}
            disabled={isPast}
            className={`w-full flex items-start p-3 rounded-lg transition-colors text-left disabled:opacity-50 disabled:cursor-default ${isCurrent ? 'bg-accent/10' : ''} enabled:hover:bg-neutral/50`}
        >
            <div className="w-16 flex-shrink-0 font-mono text-sm text-gray-400 text-center">
                {formatTime(event.startTime)}
            </div>
            <div className="flex-grow pl-3">
                <p className={`font-semibold ${isCurrent ? 'text-accent' : 'text-gray-200'}`}>{event.title}</p>
                {isCurrent && <div className="text-xs text-accent mt-1 font-bold">Şimdi Yayında</div>}
            </div>
        </button>
    );
};


const PlayerView: React.FC<PlayerViewProps> = ({ channel, onBack, isFavorite, onToggleFavorite, channelList, currentIndex, onChannelSwitch, playerMode, initialSeekTime }) => {
  const [selectedEpgEvent, setSelectedEpgEvent] = useState<EpgEvent | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [playerError, setPlayerError] = useState<PlayerError | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoFit, setVideoFit] = useState<'contain' | 'cover'>('cover');
  const [isWebViewPlayerOpen, setIsWebViewPlayerOpen] = useState(false);


  // State for track selection
  const [isTracksModalOpen, setIsTracksModalOpen] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackInfo[]>([]);
  const [qualityLevels, setQualityLevels] = useState<QualityLevelInfo[]>([]);
  const [currentAudioTrackId, setCurrentAudioTrackId] = useState(-1);
  const [currentSubtitleTrackId, setCurrentSubtitleTrackId] = useState(-1);
  const [currentQualityLevelId, setCurrentQualityLevelId] = useState(-1);

  // Refs
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const progressSaveIntervalRef = useRef<number | null>(null);
  
  const isVod = playerMode === 'vod';

  useEffect(() => {
    // When a CORS error is detected, automatically open the web player.
    if (playerError?.isCorsError) {
        setIsWebViewPlayerOpen(true);
    }
  }, [playerError]);

  useEffect(() => {
    // 1. Reset state for the new channel
    setIsLoading(true);
    setPlayerError(null);
    setIsPlaying(false);
    setCurrentTime(isVod ? initialSeekTime || 0 : 0);
    setDuration(0);
    setAudioTracks([]);
    setSubtitleTracks([]);
    setQualityLevels([]);
    setIsWebViewPlayerOpen(false); // Close webview modal on channel switch
    
    const sourceUrl = channel.url;
    const video = videoRef.current;
    if (!video) return;

    // Unified cleanup function
    const cleanup = () => {
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
        if (progressSaveIntervalRef.current) {
            clearInterval(progressSaveIntervalRef.current);
            progressSaveIntervalRef.current = null;
        }
        video.pause();
        video.removeAttribute('src');
        video.load();
    };
    cleanup();

    const handleCanPlay = () => {
        setIsLoading(false);
        // HLS start position is handled in config. Only seek for non-HLS VODs.
        if (!hlsRef.current && isVod && initialSeekTime && video.seekable) {
             video.currentTime = initialSeekTime;
        }
        video.play().catch(e => console.warn("Autoplay was prevented.", e));
    };
    video.addEventListener('canplay', handleCanPlay);

    const handleVideoError = () => {
      if (video.error && !playerError) {
         setPlayerError({
            message: `Medya Hatası: Desteklenmeyen format veya ağ sorunu (Kod: ${video.error.code})`,
            isCorsError: false
         });
         setIsLoading(false);
      }
    };
    video.addEventListener('error', handleVideoError);
    
    // This handler will be used for native track detection on non-HLS streams
    const handleNativeTracks = () => {
        if (!video || hlsRef.current) return; // HLS is handling its own tracks

        // Audio Tracks - Use a standard for-loop for maximum compatibility
        const audioTrackList = video.audioTracks;
        const newAudioTracks: AudioTrackInfo[] = [];
        if (audioTrackList && audioTrackList.length > 0) {
            for (let i = 0; i < audioTrackList.length; i++) {
                const track = audioTrackList[i];
                newAudioTracks.push({
                    id: i,
                    name: track.label || track.language || `Ses ${i + 1}`,
                    lang: track.language,
                });
            }
            setAudioTracks(newAudioTracks);

            let enabledTrackIndex = -1;
            for (let i = 0; i < audioTrackList.length; i++) {
                if (audioTrackList[i].enabled) {
                    enabledTrackIndex = i;
                    break;
                }
            }
            setCurrentAudioTrackId(enabledTrackIndex > -1 ? enabledTrackIndex : 0);
        } else {
             setAudioTracks([{ id: 0, name: 'Varsayılan Ses' }]);
             setCurrentAudioTrackId(0);
        }

        // Subtitle Tracks - Use a standard for-loop
        const textTrackList = video.textTracks;
        const newSubtitleTracks: SubtitleTrackInfo[] = [];
        let activeSubtitleIndex = -1;
        let subtitleCounter = 0;
        if (textTrackList) {
            for (let i = 0; i < textTrackList.length; i++) {
                const track = textTrackList[i];
                if (track.kind === 'subtitles' || track.kind === 'captions') {
                    newSubtitleTracks.push({
                        id: subtitleCounter, // use a separate counter for the ID
                        name: track.label || track.language || `Altyazı ${subtitleCounter + 1}`,
                        lang: track.language
                    });
                    if (track.mode === 'showing') {
                        activeSubtitleIndex = subtitleCounter;
                    }
                    subtitleCounter++;
                }
            }
        }
        
        if (newSubtitleTracks.length > 0) {
            setSubtitleTracks([{ id: -1, name: 'Kapalı' }, ...newSubtitleTracks]);
            setCurrentSubtitleTrackId(activeSubtitleIndex);
        } else {
            setSubtitleTracks([]);
        }
    };

    video.addEventListener('loadedmetadata', handleNativeTracks);
    // Add event listeners to track lists if they exist
    if (video.audioTracks) video.audioTracks.addEventListener('addtrack', handleNativeTracks);
    if (video.textTracks) video.textTracks.addEventListener('addtrack', handleNativeTracks);
    

    // HLS.js is now used for all platforms
    if (sourceUrl.endsWith('.m3u8')) {
        if (Hls.isSupported()) {
            const hlsConfig: Partial<HlsConfig> = {};
            // Use HLS.js's native startPosition for reliable seeking on VODs
            if (isVod && initialSeekTime && initialSeekTime > 0) {
                hlsConfig.startPosition = initialSeekTime;
            }
            const hls = new Hls(hlsConfig);
            hlsRef.current = hls;

            // --- START: Track update handlers ---
            const updateAudioTracks = () => {
                const audioTracksList = hls.audioTracks;
                if (audioTracksList.length > 0) {
                    setAudioTracks(audioTracksList.map(track => ({ id: track.id, name: track.name, lang: track.lang })));
                } else {
                    setAudioTracks([{ id: 0, name: 'Varsayılan Ses' }]);
                }
                setCurrentAudioTrackId(hls.audioTrack);
            };

            const updateSubtitleTracks = () => {
                const subs = hls.subtitleTracks.map(track => ({ id: track.id, name: track.name, lang: track.lang }));
                setSubtitleTracks([{ id: -1, name: 'Kapalı' }, ...subs]);
                setCurrentSubtitleTrackId(hls.subtitleTrack);
            };
            // --- END: Track update handlers ---

            hls.on(Events.MANIFEST_PARSED, (event, data) => {
                const levels = data.levels.map((level, index) => ({ id: index, name: level.height ? `${level.height}p` : `Oto (${Math.round(level.bitrate / 1000)} kbps)`, bitrate: level.bitrate }));
                setQualityLevels([{ id: -1, name: 'Otomatik' }, ...levels]);
                setCurrentQualityLevelId(hls.currentLevel);
                
                updateAudioTracks();
                updateSubtitleTracks();

                // --- START: Automatic audio track selection logic ---
                const audioTracksList = hls.audioTracks;
                if (audioTracksList.length > 1) {
                    const userLang = navigator.language.split('-')[0] || 'tr'; // e.g., 'tr'
                    let preferredTrackId = -1;

                    // 1. Find track matching browser language (e.g., "tr")
                    const langMatch = audioTracksList.find(track => track.lang && track.lang.toLowerCase().startsWith(userLang));
                    if (langMatch) {
                        preferredTrackId = langMatch.id;
                    } else {
                        // 2. Fallback: Find track with 'Türkçe' in its name if no lang match
                        const nameMatch = audioTracksList.find(track => 
                            track.name.toLowerCase().includes('türkçe') || 
                            track.name.toLowerCase().includes('turkish') ||
                            track.name.toLowerCase().includes('tur')
                        );
                        if (nameMatch) {
                            preferredTrackId = nameMatch.id;
                        }
                    }
                    
                    if (preferredTrackId !== -1 && hls.audioTrack !== preferredTrackId) {
                        hls.audioTrack = preferredTrackId;
                        console.log(`Otomatik ses kanalı seçildi (ID: ${preferredTrackId}) dil: ${userLang}`);
                    }
                }
                // --- END: Automatic audio track selection logic ---
            });

            // FIX: Add listeners for dynamic track updates to ensure all options are caught.
            hls.on(Events.AUDIO_TRACKS_UPDATED, updateAudioTracks);
            hls.on(Events.SUBTITLE_TRACKS_UPDATED, updateSubtitleTracks);

            hls.on(Events.LEVEL_SWITCHED, (event, data) => setCurrentQualityLevelId(data.level));
            hls.on(Events.AUDIO_TRACK_SWITCHED, (event, data) => setCurrentAudioTrackId(data.id));
            hls.on(Events.SUBTITLE_TRACK_SWITCH, (event, data) => setCurrentSubtitleTrackId(data.id));

            hls.loadSource(sourceUrl);
            hls.attachMedia(video);
            
            hls.on(Events.ERROR, (event, data: ErrorData) => {
                if (data.fatal) {
                    console.error(`HLS.js fatal error: ${data.type}`, data);
                    if (data.type === ErrorTypes.NETWORK_ERROR) {
                        setPlayerError({
                            message: "Yayın yüklenemedi. Yayıncı, içeriğin bu uygulamadan oynatılmasına izin vermiyor olabilir (CORS Hatası).",
                            isCorsError: true,
                        });
                    } else {
                        setPlayerError({
                            message: "Yayın yüklenemedi. Format desteklenmiyor veya adres geçersiz.",
                            isCorsError: false,
                        });
                    }
                    setIsLoading(false);
                    cleanup();
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Fallback for Safari/iOS native HLS support
            video.src = sourceUrl;
        } else {
            setPlayerError({
                message: "Tarayıcınız veya cihazınız HLS yayınlarını desteklemiyor.",
                isCorsError: false,
            });
            setIsLoading(false);
        }
    } else { // For non-HLS streams like MP4
        video.src = sourceUrl;
        setQualityLevels([]); // No quality selection for direct files
    }

    return () => { // Cleanup function for the effect
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleVideoError);
        video.removeEventListener('loadedmetadata', handleNativeTracks);
        if (video.audioTracks) video.audioTracks.removeEventListener('addtrack', handleNativeTracks);
        if (video.textTracks) video.textTracks.removeEventListener('addtrack', handleNativeTracks);
        cleanup();
    };
  }, [channel.url, initialSeekTime, isVod]);

  useEffect(() => {
    const video = videoRef.current;
    if (isVod && isPlaying && video) {
        progressSaveIntervalRef.current = window.setInterval(() => {
            const cTime = video.currentTime;
            const cDuration = video.duration;

            // Don't save if it's too short or if it's almost finished
            if (cTime > 5 && cDuration > 0 && (cTime / cDuration) < 0.95) {
                try {
                    const stored = localStorage.getItem(VOD_PROGRESS_STORAGE_KEY);
                    const progressData = stored ? JSON.parse(stored) : {};
                    progressData[channel.url] = { progress: cTime, lastWatched: new Date().toISOString() };
                    localStorage.setItem(VOD_PROGRESS_STORAGE_KEY, JSON.stringify(progressData));
                } catch (e) {
                    console.error("Failed to save VOD progress", e);
                }
            }
        }, 5000); // Save every 5 seconds
    } else {
        if (progressSaveIntervalRef.current) {
            clearInterval(progressSaveIntervalRef.current);
            progressSaveIntervalRef.current = null;
        }
    }

    return () => {
        if (progressSaveIntervalRef.current) {
            clearInterval(progressSaveIntervalRef.current);
        }
    };
  }, [isPlaying, isVod, channel.url]);

  const formatTime = (date: Date) => date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  
  const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    return hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  const hideControls = useCallback(() => {
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => setShowControls(false), 3000);
  }, []);

  const handleMouseMove = useCallback(() => { setShowControls(true); hideControls(); }, [hideControls]);

  useEffect(() => {
    if (showControls) hideControls();
    return () => { if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current); }
  }, [showControls, hideControls]);
  
  const handleFullscreenChange = useCallback(() => {
    const isFs = !!document.fullscreenElement;
    setIsFullscreen(isFs);
    if (isFs) {
      setVideoFit('contain');
      if (Capacitor.isNativePlatform()) StatusBar.hide().catch(err => console.error('Status bar hide failed', err));
    } else {
      setVideoFit('cover');
      if (Capacitor.isNativePlatform()) StatusBar.show().catch(err => console.error('Status bar show failed', err));
    }
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        if (Capacitor.isNativePlatform()) StatusBar.show().catch(err => console.error('Status bar show failed on cleanup', err));
    };
  }, [handleFullscreenChange]);

  useEffect(() => {
    const calculateProgress = () => {
      if (!channel.currentEpg) { setProgress(0); return; }
      const now = new Date().getTime();
      const start = channel.currentEpg.startTime.getTime();
      const end = channel.currentEpg.endTime.getTime();
      if (now < start) setProgress(0);
      else if (now > end) setProgress(100);
      else setProgress(((now - start) / (end - start)) * 100);
    };
    calculateProgress();
    const interval = setInterval(calculateProgress, 10000);
    return () => clearInterval(interval);
  }, [channel.currentEpg]);

  const togglePlayPause = useCallback(() => {
    if (playerError || isLoading) return;
    if (videoRef.current) {
        videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
    }
  }, [playerError, isLoading]);

  const toggleShowControls = useCallback(() => setShowControls(prev => !prev), []);
  const toggleFullscreen = useCallback(() => {
    if (playerContainerRef.current) {
      !document.fullscreenElement ? playerContainerRef.current.requestFullscreen() : document.exitFullscreen();
    }
  }, []);
  
  const handleLoadedMetadata = () => { if (videoRef.current) setDuration(videoRef.current.duration === Infinity ? 0 : videoRef.current.duration); };
  const handleTimeUpdate = () => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value);
  };
  const handleRewind = useCallback(() => {
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
  }, []);
  const handleForward = useCallback(() => {
    if (videoRef.current?.duration) videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10);
  }, []);
  const toggleVideoFit = useCallback(() => setVideoFit(prev => (prev === 'contain' ? 'cover' : 'contain')), []);
  
  const handleSelectAudio = (id: number) => {
    if (hlsRef.current) {
        hlsRef.current.audioTrack = id;
    } else if (videoRef.current && videoRef.current.audioTracks) {
        const audioTrackList = videoRef.current.audioTracks;
        for (let i = 0; i < audioTrackList.length; i++) {
            audioTrackList[i].enabled = (i === id);
        }
        setCurrentAudioTrackId(id);
    }
  };
  
  const handleSelectSubtitle = (id: number) => {
    if (hlsRef.current) {
        hlsRef.current.subtitleTrack = id;
    } else if (videoRef.current && videoRef.current.textTracks) {
        const textTrackList = videoRef.current.textTracks;
        let subtitleIdx = 0;
        for (let i = 0; i < textTrackList.length; i++) {
            const track = textTrackList[i];
            if (track.kind === 'subtitles' || track.kind === 'captions') {
                track.mode = (subtitleIdx === id) ? 'showing' : 'hidden';
                subtitleIdx++;
            }
        }
        setCurrentSubtitleTrackId(id);
    }
  };
  
  const handleSelectQuality = (id: number) => { if (hlsRef.current) hlsRef.current.currentLevel = id; };

  const SWIPE_THRESHOLD = 50;
  const touchStartX = React.useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (isVod && duration > 0) {
        const newTime = currentTime + (deltaX > 0 ? 10 : -10);
        const clampedTime = Math.max(0, Math.min(duration, newTime));
        if (videoRef.current) videoRef.current.currentTime = clampedTime;
      } else if (!isVod && channelList.length > 1) {
        onChannelSwitch(deltaX < 0 ? (currentIndex + 1) % channelList.length : (currentIndex - 1 + channelList.length) % channelList.length);
      }
    }
    touchStartX.current = null;
  };
  
  const currentProgram = channel.currentEpg;
  const seekProgressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  // FIX: Show settings button if there is AT LEAST ONE audio track, not just multiple.
  // This ensures the settings menu is always available on VOD content to see the current track.
  const hasSettings = qualityLevels.length > 1 || audioTracks.length > 0 || subtitleTracks.length > 0;
  
  const renderEpgSchedule = () => {
    const schedule = channel.epgSchedule || [];
    if (schedule.length === 0) {
        return <p className="text-gray-400 p-4 text-center italic">Bu kanal için yayın akışı bilgisi bulunamadı.</p>;
    }

    const now = new Date().getTime();
    let currentProgramIndex = schedule.findIndex(e => now >= e.startTime.getTime() && now < e.endTime.getTime());
    
    // If no current program, maybe we are between programs. Find the next one.
    if (currentProgramIndex === -1) {
        currentProgramIndex = schedule.findIndex(e => e.startTime.getTime() > now);
        // If still not found, it means all programs are in the past. Default to the last one.
        if (currentProgramIndex === -1) currentProgramIndex = schedule.length -1;
        else currentProgramIndex = currentProgramIndex -1; // Show the one right before the next
    }
    
    return (
        <div className="space-y-1 p-2">
            {schedule.map((event, index) => {
                const isCurrent = currentProgramIndex === index && !(event.startTime.getTime() > now);
                const isPast = event.endTime.getTime() < now;
                return (
                    <EpgProgramItem 
                        key={`${event.startTime.toISOString()}-${event.title}`}
                        event={event}
                        isCurrent={isCurrent}
                        isPast={isPast}
                        onClick={setSelectedEpgEvent}
                    />
                )
            })}
        </div>
    );
  };

  return (
    <div className={`absolute inset-0 bg-primary flex flex-col z-20 animate-slide-in ${isFullscreen ? 'bg-black' : ''}`}>
       <style>{`
        @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slide-in 0.2s ease-out; }
        .seek-slider { -webkit-appearance: none; appearance: none; background-color: transparent; cursor: pointer; width: 100%; }
        .seek-slider::-webkit-slider-runnable-track { height: 5px; background: linear-gradient(to right, #22D3EE ${seekProgressPercent}%, #475569 ${seekProgressPercent}%); border-radius: 2px; }
        .seek-slider::-moz-range-track { height: 5px; background: linear-gradient(to right, #22D3EE ${seekProgressPercent}%, #475569 ${seekProgressPercent}%); border-radius: 2px; }
        .seek-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; margin-top: -5.5px; width: 16px; height: 16px; background: #E2E8F0; border-radius: 50%; }
        .seek-slider::-moz-range-thumb { width: 16px; height: 16px; background: #E2E8F0; border-radius: 50%; border: none; }
      `}</style>
      
      <header className={`flex items-center p-3 text-gray-200 bg-secondary/50 ${isFullscreen ? 'hidden' : 'flex'}`}>
        <button onClick={onBack} className="p-2 rounded-full hover:bg-neutral"><BackIcon className="w-6 h-6" /></button>
        <div className="text-center flex-grow min-w-0 px-2"><h2 className="font-bold truncate">{channel.name}</h2><p className="text-sm text-gray-400 truncate">{currentProgram?.title || 'Yayın Bilgisi Yok'}</p></div>
        <div className="flex items-center space-x-2"><button onClick={() => onToggleFavorite(channel.url)} className={`p-2 rounded-full transition-colors ${isFavorite ? 'text-accent' : 'text-gray-400 hover:text-accent'}`}><HeartIcon className="w-6 h-6" fill={isFavorite ? 'currentColor' : 'none'} /></button><button className="p-2 rounded-full hover:bg-neutral"><LockIcon className="w-6 h-6" /></button></div>
      </header>

      <div ref={playerContainerRef} className={`relative bg-black ${isFullscreen ? 'w-full h-full' : 'aspect-video'}`} onMouseMove={handleMouseMove} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <video ref={videoRef} className={`w-full h-full pointer-events-none bg-black object-${videoFit}`} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onLoadedMetadata={handleLoadedMetadata} onTimeUpdate={handleTimeUpdate} playsInline />
        
        {isLoading && <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div></div>}
        
        {playerError && !playerError.isCorsError && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 text-white p-4 text-center">
            <TvIcon className="w-12 h-12 text-gray-500 mb-4" />
            <p className="text-lg font-semibold">{playerError.message}</p>
            <p className="text-sm text-gray-400 mt-2">Lütfen başka bir kanal deneyin.</p>
          </div>
        )}
        
        <div className={`absolute inset-0 transition-opacity duration-300 text-white z-20 ${showControls && !playerError && !isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={toggleShowControls} onDoubleClick={toggleFullscreen}>
            <div className="absolute inset-0 flex items-center justify-center gap-8" onClick={e => e.stopPropagation()}>
                {isVod && duration > 0 && <button onClick={handleRewind} className="bg-black/30 p-4 rounded-full text-white hover:bg-black/60" aria-label="10 saniye geri sar"><RewindIcon className="w-10 h-10" /></button>}
                <div className="bg-black/30 p-4 rounded-full"><button onClick={togglePlayPause} className="w-12 h-12 flex items-center justify-center" aria-label={isPlaying ? "Duraklat" : "Oynat"}>{isPlaying ? <PauseIcon className="w-10 h-10" /> : <PlayIcon className="w-12 h-12" />}</button></div>
                {isVod && duration > 0 && <button onClick={handleForward} className="bg-black/30 p-4 rounded-full text-white hover:bg-black/60" aria-label="10 saniye ileri sar"><ForwardIcon className="w-10 h-10" /></button>}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-1"><button onClick={togglePlayPause} className="p-2" aria-label={isPlaying ? "Duraklat" : "Oynat"}>{isPlaying ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7" />}</button></div>
                {isVod && duration > 0 ? (
                    <div className="flex-grow flex items-center mx-2 gap-2 min-w-0">
                        <span className="text-xs font-mono opacity-80 w-14 text-center shrink-0">{formatDuration(currentTime)}</span>
                        <input type="range" min="0" max={duration} step="1" value={currentTime} onChange={handleSeek} className="seek-slider flex-grow" aria-label="Yayın ilerlemesi" />
                        <span className="text-xs font-mono opacity-80 w-14 text-center shrink-0">{formatDuration(duration)}</span>
                    </div>
                ) : currentProgram ? (
                    <div className="flex-grow flex items-center mx-2 group min-w-0">
                        <span className="text-xs font-mono opacity-80 shrink-0">{formatTime(currentProgram.startTime)}</span>
                        <div className="relative h-1.5 flex-grow mx-3 bg-white/20 rounded-full"><div className="absolute top-0 h-full bg-accent rounded-full" style={{ width: `${progress}%` }}></div></div>
                        <span className="text-xs font-mono opacity-80 shrink-0">{formatTime(currentProgram.endTime)}</span>
                    </div>
                ) : <div className="flex-grow mx-2"></div>}
                <div className="flex items-center gap-1">
                    {hasSettings && <button onClick={() => setIsTracksModalOpen(true)} className="p-2" aria-label="Oynatıcı Ayarları"><SettingsIcon className="w-7 h-7" /></button>}
                    <button onClick={toggleVideoFit} className="p-2" aria-label={`Görüntü Modu: ${videoFit === 'contain' ? 'Sığdır' : 'Doldur'}`} title={`Görüntü Modu: ${videoFit === 'contain' ? 'Sığdır' : 'Doldur'}`}><AspectRatioIcon className="w-7 h-7" /></button>
                    <button onClick={toggleFullscreen} className="p-2" aria-label={isFullscreen ? "Tam ekrandan çık" : "Tam ekrana geç"}>{isFullscreen ? <FullscreenExitIcon className="w-7 h-7" /> : <FullscreenEnterIcon className="w-7 h-7" />}</button>
                </div>
            </div>
            {isFullscreen && !isVod && <div className={`absolute bottom-16 left-0 right-0 z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`} onClick={e => e.stopPropagation()}><ChannelSwitcher channels={channelList} currentIndex={currentIndex} onSelect={onChannelSwitch} /></div>}
        </div>
      </div>
      
      {!isFullscreen && (
        isVod 
        ? (
            <div className="flex-grow p-4 overflow-y-auto bg-primary">
                <h3 className="text-2xl font-bold text-gray-100">{channel.name}</h3>
                <p className="text-gray-400 mt-2 leading-relaxed italic">
                    İçerik açıklaması ve detayları bu alanda gösterilecektir.
                </p>
            </div>
        ) 
        : (
            <>
                <ChannelSwitcher channels={channelList} currentIndex={currentIndex} onSelect={onChannelSwitch} />
                <div className="flex-grow overflow-y-auto">
                    <h4 className="text-lg font-bold p-4 pb-2">{channel.name} Program Akışı</h4>
                    {renderEpgSchedule()}
                </div>
            </>
        )
      )}

       {selectedEpgEvent && <EpgDetailModal event={selectedEpgEvent} onClose={() => setSelectedEpgEvent(null)} />}
       {isTracksModalOpen && hasSettings && (
            <TrackSelectionModal 
                audioTracks={audioTracks}
                subtitleTracks={subtitleTracks}
                qualityLevels={qualityLevels}
                currentAudioTrackId={currentAudioTrackId}
                currentSubtitleTrackId={currentSubtitleTrackId}
                currentQualityLevelId={currentQualityLevelId}
                onSelectAudio={handleSelectAudio}
                onSelectSubtitle={handleSelectSubtitle}
                onSelectQuality={handleSelectQuality}
                onClose={() => setIsTracksModalOpen(false)}
            />
       )}
       {isWebViewPlayerOpen && (
        <WebViewPlayerModal 
            url={channel.url} 
            onClose={onBack} 
        />
       )}
    </div>
  );
};

export default PlayerView;