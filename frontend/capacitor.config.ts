import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = (process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').trim();

if (!serverUrl) {
  throw new Error('FATAL: CAPACITOR_SERVER_URL, NEXT_PUBLIC_APP_URL, or APP_URL environment variable is required to build Capacitor configuration.');
}

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
