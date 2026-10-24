import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mymusic.player',
  appName: 'MyMusic',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#121212',
  server: {
    // Allows local network P2P streaming over HTTP LAN without cleartext blocking
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#121212',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
