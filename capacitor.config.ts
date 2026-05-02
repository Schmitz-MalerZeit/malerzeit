import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.26af7f2189ad49998a6de5a11c2a2ca1',
  appName: 'MalerZeit',
  webDir: 'dist',
  server: {
    // Hot-Reload aus dem Lovable-Sandbox-Preview während der Entwicklung.
    // Für den finalen Store-Build diese Zeilen auskommentieren oder entfernen,
    // damit die App den lokal gebauten `dist`-Ordner verwendet.
    url: 'https://26af7f21-89ad-4999-8a6d-e5a11c2a2ca1.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    backgroundColor: '#ffffff',
  },
  ios: {
    backgroundColor: '#1a3a6c',
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#1a3a6c',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
      // iOS verwendet das LaunchScreen-Storyboard, das von @capacitor/assets
      // automatisch mit dem Splash-Bild und der Hintergrundfarbe generiert wird.
      iosSpinnerStyle: 'small',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a3a6c',
      overlaysWebView: false,
    },
  },
};

export default config;
