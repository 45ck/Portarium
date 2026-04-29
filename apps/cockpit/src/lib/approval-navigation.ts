export interface ApprovalNavigationTarget {
  to: '/approvals';
  search: {
    focus: string;
    from: 'notification';
  };
}

function parseUrl(input: string, baseOrigin: string): URL | null {
  try {
    return new URL(input, baseOrigin);
  } catch {
    return null;
  }
}

function approvalIdFromPath(url: URL): string | null {
  if (url.protocol === 'portarium:' && url.hostname === 'approvals') {
    return decodeURIComponent(url.pathname.replace(/^\/+/, '').split('/')[0] ?? '').trim() || null;
  }

  const parts = url.pathname.split('/').filter(Boolean);
  const approvalsIndex = parts.indexOf('approvals');
  if (approvalsIndex === -1) return null;
  return decodeURIComponent(parts[approvalsIndex + 1] ?? '').trim() || null;
}

export function parseApprovalNavigationTarget(
  input: string,
  baseOrigin = typeof window === 'undefined' ? 'https://portarium.io' : window.location.origin,
): ApprovalNavigationTarget | null {
  const url = parseUrl(input, baseOrigin);
  if (!url) return null;

  const focus = url.searchParams.get('focus')?.trim() || approvalIdFromPath(url);
  if (!focus) return null;

  return {
    to: '/approvals',
    search: { focus, from: 'notification' },
  };
}
