import { EpgEvent } from '../types';

export type EpgData = Map<string, EpgEvent[]>;

/**
 * XMLTV formatındaki tarih/saat string'ini JavaScript Date objesine çevirir.
 * Zaman dilimi bilgisini doğru bir şekilde işler.
 * Örnek format: "20240101180000 +0300"
 * @param dateString Çevrilecek tarih string'i.
 * @returns JavaScript Date objesi. Geçersiz format durumunda invalid Date döner.
 */
const parseXmltvDate = (dateString: string): Date => {
  if (dateString.length < 14) {
    return new Date(NaN); // Geçersiz format
  }

  const year = dateString.substring(0, 4);
  const month = dateString.substring(4, 6);
  const day = dateString.substring(6, 8);
  const hour = dateString.substring(8, 10);
  const minute = dateString.substring(10, 12);
  const second = dateString.substring(12, 14);

  let isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

  // Zaman dilimi bilgisini (offset) işle
  const tzMatch = dateString.match(/\s([+-])(\d{2})(\d{2})$/);
  if (tzMatch) {
    const [, sign, tzHour, tzMinute] = tzMatch;
    isoString += `${sign}${tzHour}:${tzMinute}`;
  } else {
    // Zaman dilimi belirtilmemişse, belirsizliği önlemek için UTC olarak kabul et.
    isoString += 'Z';
  }

  const date = new Date(isoString);
  
  if (isNaN(date.getTime())) {
      console.warn(`XMLTV tarihini ayrıştırma başarısız: "${dateString}"`);
      return new Date(NaN);
  }

  return date;
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

    const startTime = parseXmltvDate(startTimeStr);
    const endTime = parseXmltvDate(endTimeStr);

    // Ayrıştırılan tarihin geçerli olup olmadığını kontrol et
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      console.warn(`Atlanan program: geçersiz tarih. Kanal: ${channelId}, Başlangıç: "${startTimeStr}", Bitiş: "${endTimeStr}"`);
      continue;
    }

    const titleNode = programmeNode.getElementsByTagName('title')[0];
    const descNode = programmeNode.getElementsByTagName('desc')[0];

    const event: EpgEvent = {
      title: titleNode ? titleNode.textContent || 'Başlıksız Program' : 'Başlıksız Program',
      startTime,
      endTime,
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