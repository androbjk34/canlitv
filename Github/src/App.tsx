import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Channel, EpgEvent } from './types';
import { parseM3U } from './utils/m3uParser';
import { parseXMLTV, EpgData } from './utils/xmltvParser';
import PlayerView from './components/PlayerView';
import ChannelListItem from './components/ChannelListItem';
import BottomNavBar, { Tab } from './components/BottomNavBar';
import GroupFilterModal from './components/GroupFilterModal';
import { FilterIcon, SearchIcon, RefreshIcon, WifiOffIcon, HistoryIcon } from './components/Icons';
import VodCard from './components/VodCard';
import Carousel from './components/Carousel';
import CategoryRow from './components/CategoryRow';
import ResumePlaybackModal from './components/ResumePlaybackModal';


// FIX: Using direct raw.githubusercontent.com links to avoid potential redirect issues
// with the native HTTP client on Android.
const M3U_URL_LIVE = 'https://raw.githubusercontent.com/androbjk34/iptv-tr/refs/heads/main/iptv.m3u';
const M3U_URL_MOVIES = 'https://raw.githubusercontent.com/GitLatte/patr0n/refs/heads/site/lists/power-sinema.m3u';
const M3U_URL_SERIES = 'https://raw.githubusercontent.com/androbjk34/dizi/refs/heads/main/yabanci-dizi.m3u';
// BİRDEN FAZLA EPG KAYNAĞI TANIMLANDI
const XMLTV_URLS = [
  'https://raw.githubusercontent.com/braveheart1983/tvg-macther/refs/heads/main/tr-epg.xml',
  'https://raw.githubusercontent.com/androbjk34/epg/main/epg.xml'
];


const LOCAL_STORAGE_KEYS = {
  LIVE_CHANNELS: 'iptv_live_channels',
  MOVIES: 'iptv_movies',
  SERIES: 'iptv_series',
  LAST_UPDATED: 'iptv_last_updated',
  VOD_PROGRESS: 'iptv_vod_progress',
};

const CACHE_EXPIRATION_HOURS = 6;
const ITEMS_PER_PAGE = 20;
const CATEGORIES_PER_PAGE = 4;
const RECENTLY_WATCHED_GROUP = '__SON_IZLEDIKLERIM__';

const jsonReviver = (key: string, value: any) => {
    if (typeof value === 'string' && (key === 'startTime' || key === 'endTime')) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    return value;
};

const mergeEpgData = (channels: Omit<Channel, 'currentEpg' | 'type' | 'epgSchedule'>[], epgData: EpgData): Omit<Channel, 'type'>[] => {
  const now = new Date();
  return channels.map(channel => {
    if (channel.tvgId && epgData.has(channel.tvgId)) {
      const channelEpgs = epgData.get(channel.tvgId) || [];
      const currentEpg = channelEpgs.find(event => now >= event.startTime && now < event.endTime);
      return { ...channel, currentEpg: currentEpg || null, epgSchedule: channelEpgs };
    }
    return { ...channel, currentEpg: null, epgSchedule: [] };
  });
};


export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [liveChannels, setLiveChannels] = useState<Channel[]>([]);
  const [movies, setMovies] = useState<Channel[]>([]);
  const [series, setSeries] = useState<Channel[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('live');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedChannelIndex, setSelectedChannelIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedGroup, setSelectedGroup] = useState<string>('Tüm Kanallar');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [visibleItemsCount, setVisibleItemsCount] = useState(ITEMS_PER_PAGE);
  const [visibleCategoriesCount, setVisibleCategoriesCount] = useState(CATEGORIES_PER_PAGE);
  
  const [contentOpacity, setContentOpacity] = useState(1);
  const [isSwitchingTabs, setIsSwitchingTabs] = useState(false);
  
  // Resume Playback State
  const [resumeInfo, setResumeInfo] = useState<{ channel: Channel; time: number } | null>(null);
  const [initialSeekTime, setInitialSeekTime] = useState<number | undefined>();
  const [progressVersion, setProgressVersion] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const playerOpenRef = useRef(false);
  const backButtonLastPress = useRef<number>(0);
  
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    try {
      const storedFavorites = localStorage.getItem('favoriteChannels');
      if (storedFavorites) {
        setFavorites(new Set(JSON.parse(storedFavorites)));
      }
    } catch (e) {
      console.error("Failed to parse favorites from localStorage", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('favoriteChannels', JSON.stringify(Array.from(favorites)));
    } catch (e) {
      console.error("Failed to save favorites to localStorage", e);
    }
  }, [favorites]);

  const fetchAndProcessList = useCallback(async (m3uUrl: string, withEpg: boolean, type: 'live' | 'vod'): Promise<Channel[]> => {
    let m3uContent: string;
    
    try {
        const response = await fetch(m3uUrl, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Liste alınamadı (Status: ${response.status}). URL: ${m3uUrl}`);
        }
        const responseText = await response.text();
        m3uContent = responseText;

        if (!m3uContent || m3uContent.trim() === '') {
            console.error(`'${m3uUrl}' adresinden boş içerik alındı.`);
            throw new Error(`'${m3uUrl}' listesi boş.`);
        }
    } catch (err) {
        const errorMessage = (err instanceof Error) ? err.message : String(err);
        console.error(`URL fetch error for ${m3uUrl}:`, err);
        throw new Error(`Ağ hatası: ${errorMessage}`);
    }
    
    const parsedChannels = parseM3U(m3uContent);
    let channelsWithEpg: Omit<Channel, 'type'>[];

    if (!withEpg || XMLTV_URLS.length === 0) {
      channelsWithEpg = parsedChannels.map(c => ({ ...c, currentEpg: null, epgSchedule: [] }));
    } else {
      const mergedEpgData: EpgData = new Map();

      const epgPromises = XMLTV_URLS.map(url =>
        fetch(url, { cache: 'no-store' })
          .then(res => {
            if (res.ok) return res.text();
            console.warn(`EPG alınamadı (${res.status}): ${url}`);
            return null;
          })
          .then(xmlContent => {
            if (xmlContent && xmlContent.trim() !== '') {
              try {
                return parseXMLTV(xmlContent);
              } catch (parseErr) {
                console.error(`EPG parse hatası: ${url}`, parseErr);
                return null;
              }
            }
            return null;
          })
          .catch(fetchErr => {
            console.error(`EPG fetch hatası: ${url}`, fetchErr);
            return null;
          })
      );

      const epgResults = await Promise.allSettled(epgPromises);

      for (const result of epgResults) {
        if (result.status === 'fulfilled' && result.value) {
          const epgData = result.value;
          for (const [channelId, events] of epgData.entries()) {
            const existingEvents = mergedEpgData.get(channelId);
            if (existingEvents) {
              // Use a Map for efficient de-duplication based on start time and title
              const uniqueEvents = new Map(existingEvents.map(e => [`${e.startTime.getTime()}-${e.title}`, e]));
              events.forEach(newEvent => {
                const key = `${newEvent.startTime.getTime()}-${newEvent.title}`;
                if (!uniqueEvents.has(key)) {
                  uniqueEvents.set(key, newEvent);
                }
              });
              mergedEpgData.set(channelId, Array.from(uniqueEvents.values()));
            } else {
              mergedEpgData.set(channelId, events);
            }
          }
        }
      }

      // Sort all event lists after merging is complete
      for (const events of mergedEpgData.values()) {
        events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      }

      if (mergedEpgData.size > 0) {
        channelsWithEpg = mergeEpgData(parsedChannels, mergedEpgData);
      } else {
        // If all EPG fetches fail, just return channels without any EPG data.
        channelsWithEpg = parsedChannels.map(c => ({ ...c, currentEpg: null, epgSchedule: [] }));
      }
    }
    return channelsWithEpg.map(c => ({ ...c, type }));
  }, []);

  const forceRefreshData = useCallback(async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) {
      setIsLoading(true);
      setError(null);
    }
    
    const results = await Promise.allSettled([
      fetchAndProcessList(M3U_URL_LIVE, true, 'live'),
      fetchAndProcessList(M3U_URL_MOVIES, false, 'vod'),
      fetchAndProcessList(M3U_URL_SERIES, false, 'vod'),
    ]);

    let liveSuccess = false;
    let vodSuccess = false;

    if (results[0].status === 'fulfilled') {
      const data = results[0].value;
      setLiveChannels(data);
      try {
        // Canlı TV kanalları, hızlı başlangıç için önbelleğe alınmaya devam eder.
        localStorage.setItem(LOCAL_STORAGE_KEYS.LIVE_CHANNELS, JSON.stringify(data));
      } catch (e) {
        console.error("Canlı TV listesi kaydedilemedi (muhtemelen kota aşıldı):", e);
      }
      liveSuccess = true;
    } else { console.error('Canlı TV listesi yüklenemedi:', results[0].reason); }

    if (results[1].status === 'fulfilled') {
      setMovies(results[1].value);
      vodSuccess = true;
    } else { console.error('Film listesi yüklenemedi:', results[1].reason); }
    
    if (results[2].status === 'fulfilled') {
      setSeries(results[2].value);
      vodSuccess = true; // Mark success even if only one VOD list loads.
    } else { console.error('Dizi listesi yüklenemedi:', results[2].reason); }

    if (liveSuccess) {
      const now = new Date();
      localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_UPDATED, now.toISOString());
      setLastUpdated(now.toLocaleString('tr-TR'));
    }

    // Eski, büyük VOD önbellek verilerini temizle
    try {
        localStorage.removeItem(LOCAL_STORAGE_KEYS.MOVIES);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.SERIES);
    } catch(e) {
        console.error("Eski VOD önbelleği temizlenemedi:", e);
    }

    if (!liveSuccess && !vodSuccess && !isBackgroundRefresh) {
      const firstError = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
      const errorMessage = firstError ? firstError.reason.message : "Bilinmeyen bir hata oluştu.";
      setError(`İçerik listeleri yüklenemedi: ${errorMessage}. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.`);
    }

    if (!isBackgroundRefresh) {
      setIsLoading(false);
    }
  }, [fetchAndProcessList]);

  useEffect(() => {
    const loadInitialData = async () => {
      let hasLoadedFromCache = false;
      try {
        const storedLive = localStorage.getItem(LOCAL_STORAGE_KEYS.LIVE_CHANNELS);
        if (storedLive) {
          setLiveChannels(JSON.parse(storedLive, jsonReviver));
          const storedLastUpdated = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_UPDATED);
          if (storedLastUpdated) {
            setLastUpdated(new Date(storedLastUpdated).toLocaleString('tr-TR'));
          }
          hasLoadedFromCache = true;
        }
      } catch (e) {
        console.error("Failed to load or parse data from localStorage", e);
        // Clear potentially corrupted cache
        localStorage.removeItem(LOCAL_STORAGE_KEYS.LIVE_CHANNELS);
      }

      if (!isOnline) {
        if (!hasLoadedFromCache) {
          setError("Çevrimdışı moddasınız ve başlangıç verileri yüklenemedi. İnternet bağlantınızı kontrol edin.");
        } else {
          // Offline but we have live channels, this is a usable state.
          setError(null);
        }
        setIsLoading(false);
        return;
      }
      
      const storedLastUpdated = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_UPDATED);
      let isCacheStale = true;
      if (storedLastUpdated) {
        const lastUpdatedDate = new Date(storedLastUpdated);
        const now = new Date();
        const ageHours = (now.getTime() - lastUpdatedDate.getTime()) / (1000 * 60 * 60);
        isCacheStale = ageHours >= CACHE_EXPIRATION_HOURS;
      }

      if (!hasLoadedFromCache || isCacheStale) {
        console.log(`Fetching all data. Reason: ${!hasLoadedFromCache ? 'No cache' : 'Cache stale'}`);
        await forceRefreshData(false);
      } else {
        // We have fresh live channels. Show them and fetch VOD in the background.
        console.log("Cached live channels are fresh. Fetching VOD content.");
        setIsLoading(false); // Allow UI to render with cached live channels
        await forceRefreshData(true); // Fetch everything in background, which will update VOD state.
      }
    };
    
    loadInitialData();
  }, [isOnline, forceRefreshData]);
  
  const allContentMap = useMemo(() => {
    const map = new Map<string, Channel>();
    [...liveChannels, ...movies, ...series].forEach(c => {
        if (!map.has(c.url)) {
            map.set(c.url, c);
        }
    });
    return map;
  }, [liveChannels, movies, series]);

  const currentTabGroups = useMemo(() => {
    let sourceData: Channel[];
    switch(activeTab) {
        case 'live': sourceData = liveChannels; break;
        case 'movies': sourceData = movies; break;
        case 'series': sourceData = series; break;
        default: return ['Tüm Kanallar', 'Favoriler'];
    }
    if (!sourceData) {
        return ['Tüm Kanallar', 'Favoriler'];
    }

    const uniqueGroups = [...new Set(sourceData.map(c => c.group).filter((g): g is string => !!g))].sort();
    return ['Tüm Kanallar', 'Favoriler', ...uniqueGroups];
  }, [activeTab, liveChannels, movies, series]);

  const toggleFavorite = useCallback((channelUrl: string) => {
    setFavorites(prevFavorites => {
      const newFavorites = new Set(prevFavorites);
      if (newFavorites.has(channelUrl)) {
        newFavorites.delete(channelUrl);
      } else {
        newFavorites.add(channelUrl);
      }
      return newFavorites;
    });
  }, []);

  const handleBack = useCallback(() => {
    setSelectedChannel(null);
    setSelectedChannelIndex(null);
    setInitialSeekTime(undefined); // Clear seek time on back
    setProgressVersion(v => v + 1); // Force re-calculation of recently watched
  }, []);

  playerOpenRef.current = !!selectedChannel;

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const listenerPromise = CapacitorApp.addListener('backButton', () => {
        if (playerOpenRef.current) {
          handleBack();
        } else {
          const now = Date.now();
          if (now - backButtonLastPress.current < 2000) { // 2 seconds threshold
            CapacitorApp.exitApp();
          } else {
            backButtonLastPress.current = now;
            setToastMessage("Çıkmak için tekrar basın");
            setTimeout(() => setToastMessage(null), 2000);
          }
        }
      });
      return () => { listenerPromise.then(l => l.remove()); };
    }
  }, [handleBack]);
  
  useEffect(() => {
    setVisibleItemsCount(ITEMS_PER_PAGE);
    setVisibleCategoriesCount(CATEGORIES_PER_PAGE);
    listContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab, selectedGroup, searchTerm]);

  const recentlyWatchedItems = useMemo(() => {
    try {
        const storedProgress = localStorage.getItem(LOCAL_STORAGE_KEYS.VOD_PROGRESS);
        if (!storedProgress) return [];
        const progressData: Record<string, { progress: number; lastWatched: string }> = JSON.parse(storedProgress);

        return Object.entries(progressData)
            .sort(([, a], [, b]) => new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime())
            .map(([url]) => allContentMap.get(url))
            .filter((channel): channel is Channel => !!channel);
    } catch (e) {
        console.error("Failed to get recently watched items", e);
        return [];
    }
  }, [allContentMap, progressVersion]);

  const recentlyWatchedMovies = useMemo(() => {
    const movieUrls = new Set(movies.map(m => m.url));
    return recentlyWatchedItems.filter(item => movieUrls.has(item.url));
  }, [recentlyWatchedItems, movies]);
  
  const recentlyWatchedSeries = useMemo(() => {
    const seriesUrls = new Set(series.map(s => s.url));
    return recentlyWatchedItems.filter(item => seriesUrls.has(item.url));
  }, [recentlyWatchedItems, series]);

  const filteredContent = useMemo(() => {
    if (selectedGroup === RECENTLY_WATCHED_GROUP) {
        if (activeTab === 'movies') return recentlyWatchedMovies;
        if (activeTab === 'series') return recentlyWatchedSeries;
        return [];
    }
    
    let sourceData: Channel[];
    switch(activeTab) {
        case 'live': sourceData = liveChannels; break;
        case 'movies': sourceData = movies; break;
        case 'series': sourceData = series; break;
        case 'favorites': 
            const favoriteChannels: Channel[] = [];
            favorites.forEach(url => {
                if (allContentMap.has(url)) {
                    favoriteChannels.push(allContentMap.get(url)!);
                }
            });
            sourceData = favoriteChannels;
            break;
        default: sourceData = [];
    }

    let groupFiltered = sourceData;
    if (activeTab !== 'favorites') {
        if (selectedGroup === 'Favoriler') {
            groupFiltered = sourceData.filter(channel => favorites.has(channel.url));
        } else if (selectedGroup !== 'Tüm Kanallar') {
            groupFiltered = sourceData.filter(channel => channel.group === selectedGroup);
        }
    }

    if (searchTerm) {
        return groupFiltered.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    return groupFiltered;
  }, [activeTab, liveChannels, movies, series, selectedGroup, searchTerm, favorites, allContentMap, recentlyWatchedMovies, recentlyWatchedSeries]);
  
  const groupedVodContent = useMemo(() => {
    const sourceData = activeTab === 'movies' ? movies : series;
    if (!sourceData) return { groups: new Map(), groupOrder: [] };

    const groups = new Map<string, Channel[]>();
    sourceData.forEach(item => {
        const groupName = item.group || 'Diğer';
        if (!groups.has(groupName)) {
            groups.set(groupName, []);
        }
        groups.get(groupName)!.push(item);
    });
    
    const groupOrder = Array.from(groups.keys()).sort((a,b) => a.localeCompare(b, 'tr'));
    return { groups, groupOrder };
  }, [movies, series, activeTab]);

  const carouselItems = useMemo(() => {
    const sourceData = activeTab === 'movies' ? movies : series;
    if (!sourceData || sourceData.length === 0) {
        return [];
    }
    // Create a copy, shuffle it, and take up to 10 items.
    const shuffled = [...sourceData].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 10);
  }, [activeTab, movies, series]);

  const itemsToRender = useMemo(() => {
    // Paginate for grid views or infinite scroll for live tv list.
    const isPaginatedGrid = (activeTab === 'movies' || activeTab === 'series') && (selectedGroup !== 'Tüm Kanallar' || searchTerm || selectedGroup === RECENTLY_WATCHED_GROUP);
    const isLiveOrFavsList = (activeTab === 'live' || activeTab === 'favorites') && !searchTerm;

    if (isPaginatedGrid || isLiveOrFavsList) {
        return filteredContent.slice(0, visibleItemsCount);
    }
    
    // Show all results for searches, or let discovery view handle its own rendering.
    return filteredContent;
  }, [filteredContent, visibleItemsCount, activeTab, selectedGroup, searchTerm]);
  
  const loadMoreRef = useCallback(node => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && filteredContent.length > visibleItemsCount) {
            setVisibleItemsCount(prev => prev + 30);
        }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, filteredContent.length, visibleItemsCount]);

  const startPlayback = useCallback((channel: Channel, startTime?: number) => {
    const listForIndexing = (selectedGroup === 'Tüm Kanallar' && (activeTab === 'movies' || activeTab === 'series'))
        ? (activeTab === 'movies' ? movies : series)
        : filteredContent;

    const index = listForIndexing.findIndex(c => c.url === channel.url);
    setSelectedChannel(channel);
    setSelectedChannelIndex(index !== -1 ? index : 0);
    setInitialSeekTime(startTime);
  }, [activeTab, movies, series, selectedGroup, filteredContent]);

  const handleChannelClick = useCallback((channel: Channel) => {
    if (channel.type === 'vod') {
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.VOD_PROGRESS);
            const progress = stored ? JSON.parse(stored) : {};
            if (progress[channel.url] && progress[channel.url].progress > 10) { // Only ask if progress is > 10s
                setResumeInfo({ channel, time: progress[channel.url].progress });
                return;
            }
        } catch (e) { console.error("Error reading VOD progress", e); }
    }
    
    startPlayback(channel);
  }, [startPlayback]);

  const handleChannelSwitch = useCallback((newIndex: number) => {
      const listForSwitching = (selectedGroup === 'Tüm Kanallar' && (activeTab === 'movies' || activeTab === 'series'))
        ? (activeTab === 'movies' ? movies : series)
        : filteredContent;
        
      if (newIndex >= 0 && newIndex < listForSwitching.length) {
          setSelectedChannel(listForSwitching[newIndex]);
          setSelectedChannelIndex(newIndex);
      }
  }, [filteredContent, selectedGroup, activeTab, movies, series]);

  const handleSelectGroup = (group: string) => {
    setSelectedGroup(group);
    setIsFilterModalOpen(false);
  };

  const handleRecentlyWatchedClick = useCallback(() => {
    setSelectedGroup(prev => prev === RECENTLY_WATCHED_GROUP ? 'Tüm Kanallar' : RECENTLY_WATCHED_GROUP);
  }, []);
  
  const handleTabChange = (tab: Tab) => {
    if (tab === activeTab) return;
    setContentOpacity(0);
    setIsSwitchingTabs(true);
    setTimeout(() => {
        setActiveTab(tab);
        setSearchTerm('');
        setSelectedGroup('Tüm Kanallar');
        setIsSwitchingTabs(false);
        setContentOpacity(1);
    }, 150);
  };

  const handleCategoryTitleClick = useCallback((group: string) => {
    setSelectedGroup(group);
    listContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  
  // Resume Modal Handlers
  const handleResumePlayback = useCallback(() => {
    if (!resumeInfo) return;
    startPlayback(resumeInfo.channel, resumeInfo.time);
    setResumeInfo(null);
  }, [resumeInfo, startPlayback]);
  
  const handleStartOver = useCallback(() => {
    if (!resumeInfo) return;
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.VOD_PROGRESS);
        if (stored) {
            const progress = JSON.parse(stored);
            delete progress[resumeInfo.channel.url];
            localStorage.setItem(LOCAL_STORAGE_KEYS.VOD_PROGRESS, JSON.stringify(progress));
        }
    } catch(e) { console.error("Failed to clear progress", e); }
    
    startPlayback(resumeInfo.channel, 0);
    setResumeInfo(null);
  }, [resumeInfo, startPlayback]);

  const getHeaderTitle = () => {
    switch(activeTab) {
      case 'live': return 'Canlı TV';
      case 'movies': return 'Filmler';
      case 'series': return 'Diziler';
      case 'favorites': return 'Favorilerim';
      default: return 'Canlı TV';
    }
  };
  
  const renderContent = () => {
    const isDiscoveryView = (activeTab === 'movies' || activeTab === 'series') && selectedGroup === 'Tüm Kanallar' && !searchTerm;

    const renderGridOrList = () => {
        const showLoadMoreButton =
            (activeTab === 'movies' || activeTab === 'series') &&
            (selectedGroup !== 'Tüm Kanallar' || searchTerm || selectedGroup === RECENTLY_WATCHED_GROUP) &&
            filteredContent.length > visibleItemsCount;

        const showInfiniteScrollLoader =
            (activeTab === 'live' || activeTab === 'favorites') &&
            !searchTerm &&
            filteredContent.length > visibleItemsCount;

        return (
            <>
                {filteredContent.length > 0 ? (
                    <>
                        {(activeTab === 'movies' || activeTab === 'series' || activeTab === 'favorites') ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
                                {itemsToRender.map((item, index) => (
                                <VodCard key={`${item.url}-${index}`} item={item} onClick={handleChannelClick} />
                                ))}
                            </div>
                        ) : (
                            <div className="px-2 space-y-1">
                                {itemsToRender.map((channel, index) => (
                                <ChannelListItem 
                                    key={`${channel.url}-${index}`} 
                                    channel={channel} 
                                    onClick={handleChannelClick}
                                    isFavorite={favorites.has(channel.url)}
                                    onToggleFavorite={toggleFavorite}
                                />
                                ))}
                            </div>
                        )}
                        
                        {showLoadMoreButton && (
                            <div className="p-4 flex justify-center">
                                <button
                                    onClick={() => setVisibleItemsCount(prev => prev + ITEMS_PER_PAGE)}
                                    className="bg-secondary hover:bg-neutral text-gray-200 font-bold py-3 px-8 rounded-full transition-colors duration-200"
                                >
                                    Daha Fazla Yükle
                                </button>
                            </div>
                        )}
                        
                        {showInfiniteScrollLoader && (
                            <div ref={loadMoreRef} className="flex justify-center items-center p-4 h-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center text-gray-400 py-16 px-4">
                        <p className="text-lg">
                            {searchTerm ? `"${searchTerm}" için sonuç bulunamadı.` : "Bu kategoride gösterilecek içerik bulunamadı."}
                        </p>
                    </div>
                )}
            </>
        );
    };

    const renderDiscoveryView = () => {
        const { groups, groupOrder } = groupedVodContent;
        const visibleCategories = groupOrder.slice(0, visibleCategoriesCount);
        const showLoadMoreCategories = groupOrder.length > visibleCategoriesCount;
        const recentlyWatched = activeTab === 'movies' ? recentlyWatchedMovies : recentlyWatchedSeries;
        
        return (
             <>
                <Carousel 
                    items={carouselItems}
                    onItemClick={handleChannelClick}
                    onToggleFavorite={toggleFavorite}
                    favorites={favorites}
                    activeTab={activeTab === 'movies' ? 'movies' : 'series'}
                />
                <div className="space-y-8 py-4">
                    {recentlyWatched.length > 0 && (
                        <CategoryRow
                            title="Son İzlediklerim"
                            items={recentlyWatched}
                            onItemClick={handleChannelClick}
                            onTitleClick={() => handleRecentlyWatchedClick()}
                         />
                    )}
                    {visibleCategories.map(groupName => (
                       <CategoryRow
                            key={groupName}
                            title={groupName}
                            items={groups.get(groupName) || []}
                            onItemClick={handleChannelClick}
                            onTitleClick={handleCategoryTitleClick}
                        />
                    ))}
                </div>
                {showLoadMoreCategories && (
                    <div className="p-4 flex justify-center">
                        <button
                            onClick={() => setVisibleCategoriesCount(prev => prev + CATEGORIES_PER_PAGE)}
                            className="bg-secondary hover:bg-neutral text-gray-200 font-bold py-3 px-8 rounded-full transition-colors duration-200"
                        >
                            Daha Fazla Kategori
                        </button>
                    </div>
                )}
            </>
        );
    };
      
    return (
      <div 
        ref={listContainerRef} 
        className="flex-grow overflow-y-auto pb-24 transition-opacity duration-150"
        style={{ opacity: contentOpacity }}
      >
        <header className="py-4 px-2 sticky top-0 bg-primary/80 backdrop-blur-md z-10">
          <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-100">{getHeaderTitle()}</h1>
              <div className="text-right">
                  <button
                      onClick={() => forceRefreshData(false)}
                      disabled={isLoading}
                      className="flex items-center gap-2 bg-secondary hover:bg-neutral text-gray-200 font-semibold py-2 px-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Listeyi Yenile"
                  >
                      <RefreshIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>Yenile</span>
                  </button>
                   {lastUpdated && !isLoading && (
                      <p className="text-xs text-gray-400 mt-1">Son Güncelleme: {lastUpdated}</p>
                  )}
              </div>
          </div>
        </header>
        
        {(activeTab === 'live' || activeTab === 'movies' || activeTab === 'series' || activeTab === 'favorites') && (
          <div className="px-2 pt-2 pb-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <SearchIcon className="w-5 h-5 text-gray-400" />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder={activeTab === 'live' ? "Kanal ara..." : "İçerik ara..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-secondary text-gray-200 placeholder-gray-400 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent transition"
              />
            </div>
          </div>
        )}
        
        {activeTab !== 'favorites' && (
          <div className={`px-2 pb-2 flex items-center gap-2 ${
              (activeTab === 'movies' || activeTab === 'series') ? 'justify-between' : 'justify-start'
          }`}>
             <button 
                onClick={() => setIsFilterModalOpen(true)}
                className="bg-secondary hover:bg-neutral text-gray-200 font-semibold py-2 px-4 rounded-full inline-flex items-center transition-colors"
             >
                <span>{selectedGroup === RECENTLY_WATCHED_GROUP ? 'Tüm Kanallar' : selectedGroup}</span>
                <FilterIcon className="w-4 h-4 ml-3" />
            </button>
            {(activeTab === 'movies' || activeTab === 'series') && (
                <button
                    onClick={handleRecentlyWatchedClick}
                    title="Son İzlediklerim"
                    className={`bg-secondary hover:bg-neutral font-semibold py-2 px-4 rounded-full inline-flex items-center gap-2 transition-colors ${selectedGroup === RECENTLY_WATCHED_GROUP ? 'text-accent' : 'text-gray-200'}`}
                >
                    <HistoryIcon className="w-5 h-5" />
                    <span>Son İzlediklerim</span>
                </button>
            )}
          </div>
        )}
  
        {(isLoading || isSwitchingTabs) && (
          <div className="absolute inset-0 flex flex-col justify-center items-center bg-primary/50 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
            <p className="text-gray-300 text-lg mt-4">{isLoading ? 'İçerikler Yükleniyor...' : 'Yükleniyor...'}</p>
          </div>
        )}
  
        {error && !isLoading && !isSwitchingTabs && (
          <div className="text-center py-16 px-4 text-red-400">
            <p className="text-xl font-bold">Bir Hata Oluştu</p>
            <p className="mt-2">{error}</p>
            <button 
              onClick={() => forceRefreshData(false)}
              className="mt-6 bg-accent hover:bg-accent/80 text-primary font-bold py-2 px-6 rounded-lg transition"
            >
              Tekrar Dene
            </button>
          </div>
        )}
        
        {!isLoading && !error && !isSwitchingTabs && (isDiscoveryView ? renderDiscoveryView() : renderGridOrList())}
      </div>
    );
  };
  

  const OfflineScreen = () => (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center text-center p-4 max-w-lg mx-auto">
      <WifiOffIcon className="w-24 h-24 text-gray-500 mb-6" />
      <h1 className="text-3xl font-bold text-gray-100">İnternet Bağlantısı Yok</h1>
      <p className="text-lg text-gray-400 mt-2">Uygulamayı kullanmak için lütfen internet bağlantınızı kontrol edin.</p>
    </div>
  );

  if (!isOnline && !liveChannels.length && !movies.length && !series.length) {
    return <OfflineScreen />;
  }

  return (
    <div className="min-h-screen bg-primary font-sans flex flex-col max-w-lg mx-auto shadow-2xl shadow-black relative">
        <style>{`
            @keyframes fade-in-out {
                0%, 100% { opacity: 0; transform: translateY(20px); }
                10%, 90% { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in-out {
                animation: fade-in-out 2s ease-in-out forwards;
            }
        `}</style>
        {selectedChannel && selectedChannelIndex !== null ? (
            <PlayerView 
              channel={selectedChannel} 
              onBack={handleBack} 
              isFavorite={favorites.has(selectedChannel.url)}
              onToggleFavorite={toggleFavorite}
              channelList={activeTab === 'live' ? filteredContent : (activeTab === 'movies' ? movies : series)}
              currentIndex={selectedChannelIndex}
              onChannelSwitch={handleChannelSwitch}
              playerMode={selectedChannel.type}
              initialSeekTime={initialSeekTime}
            />
        ) : (
            <>
                {renderContent()}
                <BottomNavBar 
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                />
            </>
        )}
        {isFilterModalOpen && (
            <GroupFilterModal
                groups={currentTabGroups.filter(g => g !== 'Favoriler' || activeTab !== 'favorites')}
                selectedGroup={selectedGroup}
                onSelect={handleSelectGroup}
                onClose={() => setIsFilterModalOpen(false)}
            />
        )}
        {resumeInfo && (
            <ResumePlaybackModal
                onResume={handleResumePlayback}
                onStartOver={handleStartOver}
                onClose={() => setResumeInfo(null)}
            />
        )}
        {toastMessage && (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-neutral text-white px-4 py-2 rounded-full shadow-lg z-50 animate-fade-in-out">
                {toastMessage}
            </div>
        )}
    </div>
  );
}