import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cityconnect.app',
  appName: 'CityConnect',
  webDir: 'public',
  ...(process.env.CAPACITOR_SERVER_URL
    ? {
        server: {
          url: process.env.CAPACITOR_SERVER_URL,
          cleartext: process.env.CAPACITOR_SERVER_URL.startsWith('http://'),
        },
      }
    : {}),
};

export default config;
