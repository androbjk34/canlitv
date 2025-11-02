import { EpgEvent } from '../types';

export type EpgData = Map<string, EpgEvent[]>;

/**
 * XMLTV formatındaki tarih/saat string'ini JavaScript Date objesine çevirir.
 * Örnek format: "20240101180000 +0300"
 * @param dateString Çevrilecek tarih string'i.
 * @returns JavaScript Date objesi.
 */
const parseXmltvDate = (dateString: string): Date => {
  const year = parseInt(dateString.substring(0, 4), 10);
  const month = parseInt(dateString.substring(4, 6), 10) - 1; // Month is 0-indexed
  const day = parseInt(dateString.substring(6, 8), 10);
  const hour = parseInt(dateString.substring(8, 10), 10);
  const minute = parseInt(dateString.substring(10, 12), 10);
  const second = parseInt(dateString.substring(12, 14), 10);

  // Timezone offset'i de hesaba katabiliriz, ancak basitlik adına şimdilik
  // yerel saate göre parse ediyoruz. Tarayıcı genellikle bunu doğru yönetir.
  // Daha robust bir çözüm için timezone offset'ini ayrıştırıp kullanmak gerekir.
  return new Date(year, month, day, hour, minute, second);
};

/**
 * XMLTV formatındaki içeriği ayrıştırır ve kanal ID'lerine göre gruplanmış EPG verisi döndürür.
 * @param content XMLTV formatında string içerik.
 * @returns Kanal ID'si (tvg-id) ile EPG olayları dizisini eşleyen bir Map.
 */
export const parseXMLTV = (content: string): EpgData => {
  const epgData: EpgData = new Map();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(content, "application/xml");

  const errorNode = xmlDoc.querySelector("parsererror");
  if (errorNode) {
    console.error("XML parse hatası:", errorNode.textContent);
    throw new Error("Geçersiz XMLTV dosyası formatı.");
  }

  const programmes = xmlDoc.getElementsByTagName('programme');

  for (let i = 0; i < programmes.length; i++) {
    const programmeNode = programmes[i];
    const channelId = programmeNode.getAttribute('channel');
    const startTimeStr = programmeNode.getAttribute('start');
    const endTimeStr = programmeNode.getAttribute('stop');

    if (!channelId || !startTimeStr || !endTimeStr) {
      continue; // Gerekli bilgiler eksikse atla
    }

    const titleNode = programmeNode.getElementsByTagName('title')[0];
    const descNode = programmeNode.getElementsByTagName('desc')[0];

    const event: EpgEvent = {
      title: titleNode ? titleNode.textContent || 'Başlıksız Program' : 'Başlıksız Program',
      startTime: parseXmltvDate(startTimeStr),
      endTime: parseXmltvDate(endTimeStr),
      synopsis: descNode ? descNode.textContent || undefined : undefined,
      cast: [], // XMLTV'de cast bilgisi genellikle <credits> içinde olur, bu basit parser'da eklenmedi.
    };

    if (!epgData.has(channelId)) {
      epgData.set(channelId, []);
    }
    epgData.get(channelId)?.push(event);
  }

  // Her kanal için EPG verilerini başlangıç zamanına göre sırala
  epgData.forEach((events) => {
    events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  });

  return epgData;
};
