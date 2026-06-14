import { describe, expect, it } from 'vitest';
import { shouldAutoStartDevelopmentSession } from './login-auto-start';

describe('auth login route', () => {
  it('auto-starts a web development session when OIDC is not configured', () => {
    expect(
      shouldAutoStartDevelopmentSession({
        native: false,
        oidcEnabled: false,
        status: 'unauthenticated',
      }),
    ).toBe(true);
  });

  it('does not auto-start when OIDC is configured', () => {
    expect(
      shouldAutoStartDevelopmentSession({
        native: false,
        oidcEnabled: true,
        status: 'unauthenticated',
      }),
    ).toBe(false);
  });

  it('does not auto-start in native shells or while auth is already moving', () => {
    expect(
      shouldAutoStartDevelopmentSession({
        native: true,
        oidcEnabled: false,
        status: 'unauthenticated',
      }),
    ).toBe(false);
    expect(
      shouldAutoStartDevelopmentSession({
        native: false,
        oidcEnabled: false,
        status: 'authenticating',
      }),
    ).toBe(false);
    expect(
      shouldAutoStartDevelopmentSession({
        native: false,
        oidcEnabled: false,
        status: 'authenticated',
      }),
    ).toBe(false);
  });
});
