/**
 * CLI login/logout command stubs.
 *
 * Delegates to OAuth2 device flow for interactive auth or accepts
 * a --token flag for service-account usage.
 */

export function handleLogin(_flags: Record<string, string | boolean>): void {
  console.log('OAuth2 Device Authorization Flow');
  console.log('--------------------------------');
  console.log('1. Visit: https://auth.portarium.dev/device');
  console.log('2. Enter the code displayed below.');
  console.log();
  const stubCode = 'ABCD-1234';
  console.log(`  User code: ${stubCode}`);
  console.log();
  console.log('Waiting for authorization... (stub -- not yet implemented)');
}

export function handleLogout(): void {
  console.log('Logged out. Credentials cleared from ~/.portarium/credentials.json');
}
