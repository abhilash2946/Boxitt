import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.boxitt.app',
  appName: 'boxitt',
  webDir: 'dist',
  plugins: {
    EdgeToEdge: {
      backgroundColor: '#000000',
    },
  },
  android: {
    backgroundColor: '#000000',
  },
};

export default config;
