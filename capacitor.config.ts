import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.canlitv.player',
  appName: 'Canlı TV',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    // Eski Android cihazlarda live-reload için gereklidir.
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
  // HTTP üzerinden yayın yapan IPTV kanallarının çalışabilmesi için
  // bu ayar gereklidir. Bu ayar AndroidManifest.xml dosyasına
  // android:usesCleartextTraffic="true" özelliğini ekler.
  android: {
    allowMixedContent: true,
  },
};

export default config;
