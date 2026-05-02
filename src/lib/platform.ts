import { Capacitor } from '@capacitor/core';

/**
 * True wenn die App in der nativen Capacitor-Hülle (iOS/Android) läuft.
 * Wird genutzt, um Bezahl-/Upgrade-UI in den Stores auszublenden
 * (Reader-App-Modell, Apple/Google-konform).
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPlatform(): 'ios' | 'android' | 'web' {
  const p = Capacitor.getPlatform();
  if (p === 'ios' || p === 'android') return p;
  return 'web';
}
