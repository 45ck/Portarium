// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, renderHook } from '@testing-library/react';

const { mockNavigate, mockUseCockpitExtensionContext, mockResolveCockpitExtensionServerAccess } =
  vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockUseCockpitExtensionContext: vi.fn(),
    mockResolveCockpitExtensionServerAccess: vi.fn(),
  }));

vi.mock('@/router', () => ({
  router: {
    navigate: mockNavigate,
  },
}));

vi.mock('@/hooks/queries/use-cockpit-extension-context', () => ({
  useCockpitExtensionContext: mockUseCockpitExtensionContext,
}));

vi.mock('@/lib/extensions/access-context', () => ({
  resolveCockpitExtensionServerAccess: mockResolveCockpitExtensionServerAccess,
}));

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

function buildServerAccess(
  overrides?: Partial<ReturnType<typeof mockResolveCockpitExtensionServerAccess>>,
) {
  return {
    activePackIds: ['example.reference'],
    quarantinedExtensionIds: [] as string[],
    accessContext: {
      availableCapabilities: ['extension:read', 'extension:review', 'evidence:read'],
      availableApiScopes: ['extensions.read', 'approvals.read', 'evidence.read'],
      availablePrivacyClasses: ['internal', 'restricted'],
      availablePersonas: ['Operator'],
    },
    ...overrides,
  };
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    cleanup();
    mockNavigate.mockReset();
    mockUseCockpitExtensionContext.mockReset();
    mockResolveCockpitExtensionServerAccess.mockReset();

    useUIStore.setState({
      activePersona: 'Operator',
      activeWorkspaceId: 'ws-demo',
      keyboardCheatsheetOpen: false,
    });
    useAuthStore.setState({
      status: 'authenticated',
      token: 'token-1',
      claims: {
        sub: 'user-1',
        workspaceId: 'ws-demo',
        roles: ['operator'],
        personas: ['Operator'],
        capabilities: ['extension:read', 'extension:review', 'evidence:read'],
        apiScopes: ['extensions.read', 'approvals.read', 'evidence.read'],
      },
      error: null,
    });

    mockUseCockpitExtensionContext.mockReturnValue({ data: { workspaceId: 'ws-demo' } });
    mockResolveCockpitExtensionServerAccess.mockReturnValue(buildServerAccess());
  });

  it('routes G shortcuts to active extension commands from the server-scoped registry', () => {
    renderHook(() => useKeyboardShortcuts());

    expect(mockUseCockpitExtensionContext).toHaveBeenCalledWith('ws-demo', 'user-1');

    fireEvent.keyDown(document.body, { key: 'g' });
    fireEvent.keyDown(document.body, { key: 'x' });

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/external/example-reference/overview' });
  });

  it('does not route shortcuts for quarantined extensions', () => {
    mockResolveCockpitExtensionServerAccess.mockReturnValue(
      buildServerAccess({
        quarantinedExtensionIds: ['example.reference'],
      }),
    );

    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: 'g' });
    fireEvent.keyDown(document.body, { key: 'x' });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not route shortcuts for installed extensions without workspace activation', () => {
    mockResolveCockpitExtensionServerAccess.mockReturnValue(
      buildServerAccess({
        activePackIds: [],
      }),
    );

    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: 'g' });
    fireEvent.keyDown(document.body, { key: 'x' });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('keeps core G shortcuts active when installed extensions are disabled', () => {
    mockResolveCockpitExtensionServerAccess.mockReturnValue(
      buildServerAccess({
        activePackIds: [],
      }),
    );

    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: 'g' });
    fireEvent.keyDown(document.body, { key: 'i' });

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/inbox' });
  });

  it('does not route shortcuts when the referenced route guard denies privacy class access', () => {
    mockResolveCockpitExtensionServerAccess.mockReturnValue(
      buildServerAccess({
        accessContext: {
          availableCapabilities: ['extension:read', 'extension:review', 'evidence:read'],
          availableApiScopes: ['extensions.read', 'approvals.read', 'evidence.read'],
          availablePrivacyClasses: [],
          availablePersonas: ['Operator'],
        },
      }),
    );

    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: 'g' });
    fireEvent.keyDown(document.body, { key: 'x' });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not route extension shortcuts when server-issued persona grants deny the active persona', () => {
    mockResolveCockpitExtensionServerAccess.mockReturnValue(
      buildServerAccess({
        accessContext: {
          availableCapabilities: ['extension:read', 'extension:review', 'evidence:read'],
          availableApiScopes: ['extensions.read', 'approvals.read', 'evidence.read'],
          availablePrivacyClasses: ['internal', 'restricted'],
          availablePersonas: ['Auditor'],
        },
      }),
    );

    renderHook(() => useKeyboardShortcuts());

    fireEvent.keyDown(document.body, { key: 'g' });
    fireEvent.keyDown(document.body, { key: 'x' });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
