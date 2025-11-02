export interface EpgEvent {
  title: string;
  startTime: Date;
  endTime: Date;
  synopsis?: string;
  cast?: string[];
}

export interface Channel {
  name: string;
  logo: string | null;
  url: string;
  group: string | null;
  tvgId: string | null;
  tvgName: string | null;
  currentEpg?: EpgEvent | null;
  epgSchedule?: EpgEvent[];
  type: 'live' | 'vod';
}