/**
 * Capacitor configuration for Portarium Cockpit iOS/Android.
 *
 * The native wrapper builds the React SPA (dist/) into a Capacitor shell.
 * All business logic remains in the React app; native plugins are accessed
 * exclusively through src/lib/native-bridge.ts.
 *
 * Bead: bead-0720
 *
 * Setup (once @capacitor/core is installed):
 *   npx cap add ios
 *   npx cap add android
 *   npx cap sync
 */

// CapacitorConfig type defined locally until @capacitor/cli is added as a
// dependency. The shape mirrors @capacitor/cli's CapacitorConfig interface.
interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: Record<string, unknown>;
  plugins?: Record<string, unknown>;
  ios?: Record<string, unknown>;
  android?: Record<string, unknown>;
}

const config: CapacitorConfig = {
  appId: 'com.portarium.cockpit',
  appName: 'Portarium Cockpit',
  webDir: 'dist',

  // Production API server. Override per-environment via capacitor.config.json.
  server: {
    // Allow cleartext traffic in dev only; prod enforces HTTPS.
    allowNavigation: ['api.portarium.io', '*.portarium.io'],
    androidScheme: 'https',
    iosScheme: 'https',
  },

  plugins: {
    // ── Browser (for OIDC in-app flow) ──────────────────────────────────────
    Browser: {
      presentationStyle: 'popover',
    },

    // ── PushNotifications ────────────────────────────────────────────────────
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    // ── Preferences (secure storage) ─────────────────────────────────────────
    // No config needed; uses Keychain (iOS) / EncryptedSharedPreferences (Android).

    // ── SplashScreen ─────────────────────────────────────────────────────────
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0B1220',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },

    // ── StatusBar ────────────────────────────────────────────────────────────
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0B1220',
    },

    // ── App (deep link scheme) ───────────────────────────────────────────────
    // Deep links handled in native-bridge via App.addListener('appUrlOpen').
    // URL scheme: portarium://  (universal links: https://portarium.io/app/*)
  },

  ios: {
    // Minimum iOS version aligned with OIDC PKCE support.
    deploymentTarget: '15.0',
    // Code signing configured in Xcode / fastlane.
    contentInset: 'automatic',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
  },

  android: {
    minSdkVersion: 26,
    targetSdkVersion: 34,
    buildTools: '34.0.0',
  },
};

export default config;
