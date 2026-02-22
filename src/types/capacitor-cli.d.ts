/**
 * Minimal type declaration for @capacitor/cli.
 *
 * This stub satisfies the TypeScript compiler until `@capacitor/cli` is
 * installed. Add `@capacitor/cli` to apps/cockpit/package.json devDependencies
 * and remove this file once the package is available in node_modules.
 */
declare module '@capacitor/cli' {
  export interface CapacitorConfig {
    appId: string;
    appName: string;
    webDir: string;
    server?: {
      androidScheme?: string;
      iosScheme?: string;
      cleartext?: boolean;
      allowNavigation?: string[];
    };
    plugins?: Record<string, Record<string, unknown>>;
    ios?: Record<string, unknown>;
    android?: Record<string, unknown>;
  }
}
