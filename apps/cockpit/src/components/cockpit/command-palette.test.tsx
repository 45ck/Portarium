// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

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

vi.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    themes: ['light', 'dark'],
  }),
}));

vi.mock('@/hooks/queries/use-cockpit-extension-context', () => ({
  useCockpitExtensionContext: mockUseCockpitExtensionContext,
}));

vi.mock('@/lib/extensions/access-context', () => ({
  resolveCockpitExtensionServerAccess: mockResolveCockpitExtensionServerAccess,
}));

vi.mock('@/components/domain/entity-icon', () => ({
  EntityIcon: ({ entityType }: { entityType: string }) => <span>{entityType}</span>,
}));

vi.mock('@/components/ui/command', () => ({
  CommandDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="command-dialog">{children}</div> : null,
  CommandInput: ({ placeholder }: { placeholder?: string }) => (
    <input aria-label={placeholder ?? 'command input'} />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ heading, children }: { heading: string; children: React.ReactNode }) => (
    <section aria-label={heading}>{children}</section>
  ),
  CommandItem: ({ onSelect, children }: { onSelect?: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
  CommandShortcut: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  CommandSeparator: () => <hr />,
}));

import { CommandPalette } from '@/components/cockpit/command-palette';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

function buildServerAccess(
  overrides?: Partial<ReturnType<typeof mockResolveCockpitExtensionServerAccess>>,
) {
  return {
    activePackIds: ['example.reference'],
    quarantinedExtensionIds: [] as string[],
    accessContext: {
      availableCapabilities: ['extension:read', 'extension:inspect'],
      availableApiScopes: ['extensions.read', 'extensions.inspect'],
      availablePrivacyClasses: ['internal', 'restricted'],
      availablePersonas: ['Operator'],
    },
    ...overrides,
  };
}

describe('CommandPalette', () => {
  beforeEach(() => {
    cleanup();
    mockNavigate.mockReset();
    mockUseCockpitExtensionContext.mockReset();
    mockResolveCockpitExtensionServerAccess.mockReset();

    useUIStore.setState({
      commandPaletteOpen: true,
      activePersona: 'Operator',
      activeWorkspaceId: 'ws-demo',
    });
    useAuthStore.setState({
      status: 'authenticated',
      token: 'token-1',
      claims: {
        sub: 'user-1',
        workspaceId: 'ws-demo',
        roles: ['operator'],
        personas: ['Operator'],
        capabilities: ['extension:read', 'extension:inspect'],
        apiScopes: ['extensions.read', 'extensions.inspect'],
      },
      error: null,
    });

    mockUseCockpitExtensionContext.mockReturnValue({ data: { workspaceId: 'ws-demo' } });
    mockResolveCockpitExtensionServerAccess.mockReturnValue(buildServerAccess());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders activated extension commands and navigates to the compiled external route', () => {
    render(<CommandPalette />);

    expect(mockUseCockpitExtensionContext).toHaveBeenCalledWith('ws-demo', 'user-1');

    const extensionCommand = screen.getByRole('button', { name: /open extension reference/i });
    expect(extensionCommand).toBeTruthy();
    expect(screen.getByText('G X')).toBeTruthy();

    fireEvent.click(extensionCommand);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/external/example-reference/overview' });
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('omits commands for quarantined extensions', () => {
    mockResolveCockpitExtensionServerAccess.mockReturnValue(
      buildServerAccess({
        quarantinedExtensionIds: ['example.reference'],
      }),
    );

    render(<CommandPalette />);

    expect(screen.queryByRole('button', { name: /open extension reference/i })).toBeNull();
  });

  it('omits commands for installed extensions without workspace activation', () => {
    mockResolveCockpitExtensionServerAccess.mockReturnValue(
      buildServerAccess({
        activePackIds: [],
      }),
    );

    render(<CommandPalette />);

    expect(screen.queryByRole('button', { name: /open extension reference/i })).toBeNull();
    expect(screen.queryByText('G X')).toBeNull();
    expect(screen.getByRole('button', { name: /inbox/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^extensions$/i })).toBeTruthy();
  });

  it('omits commands when the referenced route guard denies privacy class access', () => {
    mockResolveCockpitExtensionServerAccess.mockReturnValue(
      buildServerAccess({
        accessContext: {
          availableCapabilities: ['extension:read', 'extension:inspect'],
          availableApiScopes: ['extensions.read', 'extensions.inspect'],
          availablePrivacyClasses: [],
          availablePersonas: ['Operator'],
        },
      }),
    );

    render(<CommandPalette />);

    expect(screen.queryByRole('button', { name: /open extension reference/i })).toBeNull();
    expect(screen.queryByText('G X')).toBeNull();
    expect(screen.getByRole('button', { name: /^extensions$/i })).toBeTruthy();
  });

  it('omits extension commands when server-issued persona grants deny the active persona', () => {
    mockResolveCockpitExtensionServerAccess.mockReturnValue(
      buildServerAccess({
        accessContext: {
          availableCapabilities: ['extension:read', 'extension:inspect'],
          availableApiScopes: ['extensions.read', 'extensions.inspect'],
          availablePrivacyClasses: ['internal', 'restricted'],
          availablePersonas: ['Auditor'],
        },
      }),
    );

    render(<CommandPalette />);

    expect(screen.queryByRole('button', { name: /open extension reference/i })).toBeNull();
    expect(screen.queryByText('G X')).toBeNull();
    expect(screen.getByRole('button', { name: /inbox/i })).toBeTruthy();
  });

  it('omits robotics commands in dev-live mode', () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'false');

    render(<CommandPalette />);

    expect(screen.queryByRole('button', { name: /robots/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /missions/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /safety/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /gateways/i })).toBeNull();
  });

  it('hides global actions excluded by the active shell profile', () => {
    vi.stubEnv('VITE_COCKPIT_SHELL_MODE', 'reference-operator');

    render(<CommandPalette />);

    expect(screen.queryByRole('button', { name: /^new run$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /plan new beads/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /register agent/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /switch dataset/i })).toBeNull();
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /toggle sidebar/i })).toBeTruthy();
  });
});
