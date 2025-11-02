import { Channel } from '../types';

// FIX: Define a type for the parsed channel before the `type`, `currentEpg`, and `epgSchedule` properties are added.
// This resolves potential type errors where the pushed object was missing required properties.
type ParsedChannel = Omit<Channel, 'type' | 'currentEpg' | 'epgSchedule'>;

// İsimleri temizlemek ve düzenlemek için yardımcı fonksiyon
const formatChannelName = (name: string): string => {
  let formattedName = name;

  // Ülke kodlarını ve parantez içindeki diğer genel ifadeleri kaldır
  formattedName = formattedName.replace(/\s*\(\w{2,3}\)\s*$/, '').trim(); // (TR), (DE) vb.
  
  // Kalite belirteçlerini bul ve sona taşı
  const qualityTags = formattedName.match(/\b(HD|SD|FHD|4K|HEVC)\b/gi);
  if (qualityTags) {
    // Tüm kalite etiketlerini kaldır
    qualityTags.forEach(tag => {
      formattedName = formattedName.replace(new RegExp(`\\s*\\b${tag}\\b\\s*`, 'i'), ' ').trim();
    });
    // Benzersiz etiketleri sona ekle
    const uniqueTags = [...new Set(qualityTags.map(q => q.toUpperCase()))];
    formattedName = `${formattedName} ${uniqueTags.join(' ')}`;
  }
  
  return formattedName.replace(/\s+/g, ' ').trim(); // Fazla boşlukları temizle
};


export const parseM3U = (content: string): ParsedChannel[] => {
  const channels: ParsedChannel[] = [];
  const lines = content.split('\n');

  if (lines[0].trim() !== '#EXTM3U') {
    throw new Error('Geçersiz M3U dosyası formatı. Dosya "#EXTM3U" ile başlamalıdır.');
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const infoLine = line;
      const urlLine = lines[++i]?.trim();

      if (urlLine && !urlLine.startsWith('#')) {
        const nameMatch = infoLine.match(/,(.*)$/);
        const rawName = nameMatch ? nameMatch[1].trim() : 'İsimsiz Kanal';
        
        const logoMatch = infoLine.match(/tvg-logo="([^"]*)"/);
        const logo = logoMatch ? logoMatch[1] : null;

        const groupMatch = infoLine.match(/group-title="([^"]*)"/);
        const group = groupMatch ? groupMatch[1] : null;

        const tvgIdMatch = infoLine.match(/tvg-id="([^"]*)"/);
        const tvgId = tvgIdMatch ? tvgIdMatch[1] : null;

        const tvgNameMatch = infoLine.match(/tvg-name="([^"]*)"/);
        const tvgName = tvgNameMatch ? tvgNameMatch[1] : null;

        channels.push({
          name: formatChannelName(rawName),
          logo,
          url: urlLine,
          group,
          tvgId,
          tvgName,
        });
      }
    }
  }
  return channels;
};