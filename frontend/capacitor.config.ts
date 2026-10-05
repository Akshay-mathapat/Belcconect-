import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://belcconect.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.cityconnect.app',
  appName: 'BelConnect',
  webDir: 'public',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
  },
  android: {
    path: '../android',
  },
};

export default config;
