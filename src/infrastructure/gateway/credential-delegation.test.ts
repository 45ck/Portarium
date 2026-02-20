import { describe, expect, it } from 'vitest';

import {
  InMemoryCredentialDelegation,
  redactToken,
  type CredentialScope,
} from './credential-delegation.js';

const futureIso = new Date(Date.now() + 3_600_000).toISOString();
const pastIso = new Date(Date.now() - 3_600_000).toISOString();

function scope(provider = 'github', workspaceId = 'ws-1'): CredentialScope {
  return { workspaceId, provider };
}

describe('InMemoryCredentialDelegation', () => {
  it('returns a credential when seeded and not expired', async () => {
    const delegation = new InMemoryCredentialDelegation();
    delegation.seed(scope(), { token: 'ghp_abc123xyz', expiresAtIso: futureIso });

    const result = await delegation.acquireCredential(scope());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.credential.token).toBe('ghp_abc123xyz');
      expect(result.credential.provider).toBe('github');
    }
  });

  it('returns failure when no credential exists', async () => {
    const delegation = new InMemoryCredentialDelegation();
    const result = await delegation.acquireCredential(scope('jira'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('jira');
    }
  });

  it('returns failure when credential is expired', async () => {
    const delegation = new InMemoryCredentialDelegation();
    delegation.seed(scope(), { token: 'expired-token', expiresAtIso: pastIso });

    const result = await delegation.acquireCredential(scope());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('expired');
    }
  });

  it('isolates credentials by workspace', async () => {
    const delegation = new InMemoryCredentialDelegation();
    delegation.seed(scope('github', 'ws-1'), { token: 'token-ws1', expiresAtIso: futureIso });
    delegation.seed(scope('github', 'ws-2'), { token: 'token-ws2', expiresAtIso: futureIso });

    const r1 = await delegation.acquireCredential(scope('github', 'ws-1'));
    const r2 = await delegation.acquireCredential(scope('github', 'ws-2'));

    expect(r1.ok && r1.credential.token).toBe('token-ws1');
    expect(r2.ok && r2.credential.token).toBe('token-ws2');
  });

  it('isolates credentials by provider', async () => {
    const delegation = new InMemoryCredentialDelegation();
    delegation.seed(scope('github'), { token: 'gh-token', expiresAtIso: futureIso });
    delegation.seed(scope('jira'), { token: 'jira-token', expiresAtIso: futureIso });

    const gh = await delegation.acquireCredential(scope('github'));
    const jira = await delegation.acquireCredential(scope('jira'));

    expect(gh.ok && gh.credential.token).toBe('gh-token');
    expect(jira.ok && jira.credential.token).toBe('jira-token');
  });

  it('revokes credentials', async () => {
    const delegation = new InMemoryCredentialDelegation();
    delegation.seed(scope(), { token: 'token', expiresAtIso: futureIso });

    await delegation.revokeCredential(scope());
    const result = await delegation.acquireCredential(scope());
    expect(result.ok).toBe(false);
  });

  it('supports resource-scoped credentials', async () => {
    const delegation = new InMemoryCredentialDelegation();
    const resourceScope: CredentialScope = {
      workspaceId: 'ws-1',
      provider: 'github',
      resource: 'repo:my-org/my-repo',
    };
    delegation.seed(resourceScope, { token: 'repo-token', expiresAtIso: futureIso });

    // General scope should not match
    const general = await delegation.acquireCredential(scope('github'));
    expect(general.ok).toBe(false);

    // Resource-scoped should match
    const specific = await delegation.acquireCredential(resourceScope);
    expect(specific.ok).toBe(true);
    if (specific.ok) {
      expect(specific.credential.token).toBe('repo-token');
    }
  });
});

describe('redactToken', () => {
  it('redacts long tokens showing first and last 4 chars', () => {
    expect(redactToken('ghp_abc123xyz789')).toBe('ghp_********z789');
  });

  it('fully masks short tokens', () => {
    expect(redactToken('abc')).toBe('****');
    expect(redactToken('12345678')).toBe('****');
  });
});
