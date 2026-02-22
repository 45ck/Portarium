// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { MOCK_USERS } from '@/mocks/fixtures/users';
import type { UserSummary } from '@/mocks/fixtures/users';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let mockUsers: UserSummary[] = [...MOCK_USERS];

function createFetchMock() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    const pathname = url.pathname;

    if (pathname === '/v1/workspaces') {
      return Promise.resolve(json({ items: [{ workspaceId: 'ws-test', name: 'Test Workspace' }] }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/users$/.test(pathname) && init?.method !== 'POST') {
      return Promise.resolve(json({ items: mockUsers }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/users\/invite$/.test(pathname) && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { email: string; role: string };
      const newUser: UserSummary = {
        userId: `user-new-${Date.now()}`,
        name: body.email.split('@')[0] ?? 'New User',
        email: body.email,
        role: body.role as UserSummary['role'],
        status: 'active',
        lastActiveIso: new Date().toISOString(),
      };
      mockUsers = [newUser, ...mockUsers];
      return Promise.resolve(json(newUser, 201));
    }

    const patchMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/users\/([^/]+)$/);
    if (patchMatch && init?.method === 'PATCH') {
      const userId = patchMatch[1];
      const patch = JSON.parse(String(init.body)) as Partial<UserSummary>;
      mockUsers = mockUsers.map((u) => (u.userId === userId ? { ...u, ...patch } : u));
      const updated = mockUsers.find((u) => u.userId === userId);
      return Promise.resolve(json(updated));
    }

    return Promise.resolve(json({ items: [] }));
  });
}

async function renderUsersRoute() {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: ['/config/users'] }),
  });
  render(<RouterProvider router={router} />);
  await router.load();
}

beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
  if (!window.matchMedia) {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
  }
  vi.stubGlobal('localStorage', createMemoryStorage());
  if (typeof ResizeObserver === 'undefined') {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  }
});

beforeEach(() => {
  mockUsers = [...MOCK_USERS];
  queryClient.clear();
  localStorage.clear();
  vi.stubGlobal('fetch', createFetchMock());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Users/RBAC management page', () => {
  it('renders the Users heading and user table', async () => {
    await renderUsersRoute();

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeTruthy();
  });

  it('displays users from the API with name, role, and status', async () => {
    await renderUsersRoute();

    const alice = MOCK_USERS.find((u) => u.name === 'Alice Chen');
    expect(alice).toBeDefined();

    expect(await screen.findByText('Alice Chen')).toBeTruthy();
    expect(await screen.findByText(alice!.email)).toBeTruthy();
  });

  it('shows the Invite User button', async () => {
    await renderUsersRoute();

    expect(await screen.findByRole('button', { name: /invite user/i })).toBeTruthy();
  });

  it('opens the invite dialog when Invite User is clicked', async () => {
    await renderUsersRoute();

    const btn = await screen.findByRole('button', { name: /invite user/i });
    await userEvent.click(btn);

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(await screen.findByLabelText(/email/i)).toBeTruthy();
  });

  it('submits invite and closes the dialog on success', async () => {
    await renderUsersRoute();

    const inviteBtn = await screen.findByRole('button', { name: /invite user/i });
    await userEvent.click(inviteBtn);

    const emailInput = await screen.findByLabelText(/email/i);
    await userEvent.type(emailInput, 'new.user@example.com');

    const sendBtn = screen.getByRole('button', { name: /send invite/i });
    await userEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('shows Suspend button for active users', async () => {
    await renderUsersRoute();

    const suspendBtns = await screen.findAllByRole('button', { name: /suspend/i });
    expect(suspendBtns.length).toBeGreaterThan(0);
  });

  it('opens role assignment sheet when a user row is clicked', async () => {
    await renderUsersRoute();

    const aliceCell = await screen.findByText('Alice Chen');
    await userEvent.click(aliceCell);

    const aliceUser = MOCK_USERS.find((u) => u.name === 'Alice Chen');
    expect(await screen.findByText(aliceUser!.email, { selector: '*' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: /update role/i })).toBeTruthy();
  });

  it('disables Update Role button when role is unchanged', async () => {
    await renderUsersRoute();

    const aliceCell = await screen.findByText('Alice Chen');
    await userEvent.click(aliceCell);

    await waitFor(() => {
      const updateBtn = screen.getByRole('button', { name: /update role/i });
      expect(updateBtn).toBeDisabled();
    });
  });

  it('suspends a user and invalidates the users query', async () => {
    await renderUsersRoute();

    // Find first active user's Suspend button
    const suspendBtns = await screen.findAllByRole('button', { name: /suspend/i });
    const firstSuspend = suspendBtns[0];
    expect(firstSuspend).toBeTruthy();

    await userEvent.click(firstSuspend!);

    // After mutation, query should be invalidated (data refetched)
    await waitFor(() => {
      expect(mockUsers.some((u) => u.status === 'suspended')).toBe(true);
    });
  });
});
