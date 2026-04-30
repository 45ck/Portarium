export const COCKPIT_EXTENSION_BROWSER_EGRESS_POLICY_ID = 'cockpit-extension-browser-egress';
export const COCKPIT_EXTENSION_BROWSER_EGRESS_POLICY_VERSION = '1';

export type CockpitExtensionBrowserEgressRequestKind =
  | 'fetch'
  | 'xml-http-request'
  | 'websocket'
  | 'event-source'
  | 'send-beacon'
  | 'worker'
  | 'link'
  | 'form';

export type CockpitExtensionBrowserEgressDecisionReason =
  | 'approved-host-api-origin'
  | 'forbidden-origin'
  | 'forbidden-path'
  | 'invalid-url'
  | 'missing-policy';

export interface CockpitExtensionBrowserEgressPolicy {
  policyId: string;
  policyVersion: string;
  allowedOrigins: readonly string[];
  allowedPathPrefixes: readonly string[];
}

export interface CockpitExtensionBrowserEgressContext {
  extensionId: string;
  routeId?: string;
  commandId?: string;
  workspaceId?: string;
  principalId?: string;
  correlationId?: string;
}

export interface CockpitExtensionBrowserEgressDecisionInput {
  url: RequestInfo | URL;
  method?: string;
  requestKind?: CockpitExtensionBrowserEgressRequestKind;
  context: CockpitExtensionBrowserEgressContext;
  policy?: CockpitExtensionBrowserEgressPolicy;
  baseOrigin?: string;
  nowIso?: string;
}

export interface CockpitExtensionBrowserEgressAudit {
  decision: 'allow' | 'deny';
  reason: CockpitExtensionBrowserEgressDecisionReason;
  surface: 'extension-browser-egress';
  policyId: string;
  policyVersion: string;
  extensionId: string;
  routeId?: string;
  commandId?: string;
  workspaceId?: string;
  principalId?: string;
  correlationId?: string;
  requestKind: CockpitExtensionBrowserEgressRequestKind;
  method: string;
  attemptedOrigin?: string;
  attemptedPath?: string;
  attemptedUrl?: string;
  allowedOrigins: readonly string[];
  allowedPathPrefixes: readonly string[];
  timestampIso: string;
}

export interface CockpitExtensionBrowserEgressDecision {
  allowed: boolean;
  audit: CockpitExtensionBrowserEgressAudit;
}

export class CockpitExtensionBrowserEgressError extends Error {
  public readonly audit: CockpitExtensionBrowserEgressAudit;

  constructor(audit: CockpitExtensionBrowserEgressAudit) {
    super(`Cockpit extension browser egress denied: ${audit.reason}`);
    this.name = 'CockpitExtensionBrowserEgressError';
    this.audit = audit;
  }
}

export function getDefaultCockpitExtensionBrowserEgressPolicy(
  baseOrigin = getBrowserOrigin(),
): CockpitExtensionBrowserEgressPolicy {
  const configuredApiBaseUrl = (import.meta.env.VITE_PORTARIUM_API_BASE_URL ?? '').trim();
  const origins = new Set<string>();

  if (baseOrigin) origins.add(baseOrigin);
  const configuredApiOrigin = originFromUrl(configuredApiBaseUrl, baseOrigin);
  if (configuredApiOrigin) origins.add(configuredApiOrigin);

  return {
    policyId: COCKPIT_EXTENSION_BROWSER_EGRESS_POLICY_ID,
    policyVersion: COCKPIT_EXTENSION_BROWSER_EGRESS_POLICY_VERSION,
    allowedOrigins: [...origins].sort(),
    allowedPathPrefixes: ['/auth/', '/v1/'],
  };
}

export function resolveCockpitExtensionBrowserEgressDecision({
  url,
  method = 'GET',
  requestKind = 'fetch',
  context,
  policy = getDefaultCockpitExtensionBrowserEgressPolicy(),
  baseOrigin = getBrowserOrigin(),
  nowIso = new Date().toISOString(),
}: CockpitExtensionBrowserEgressDecisionInput): CockpitExtensionBrowserEgressDecision {
  const normalizedMethod = method.toUpperCase();
  const allowedOrigins = [...policy.allowedOrigins].sort();
  const allowedPathPrefixes = [...policy.allowedPathPrefixes].sort();
  const parsedUrl = parseUrl(url, baseOrigin);
  const baseAudit = {
    surface: 'extension-browser-egress',
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    extensionId: context.extensionId,
    routeId: context.routeId,
    commandId: context.commandId,
    workspaceId: context.workspaceId,
    principalId: context.principalId,
    correlationId: context.correlationId,
    requestKind,
    method: normalizedMethod,
    allowedOrigins,
    allowedPathPrefixes,
    timestampIso: nowIso,
  } satisfies Omit<
    CockpitExtensionBrowserEgressAudit,
    'decision' | 'reason' | 'attemptedOrigin' | 'attemptedPath' | 'attemptedUrl'
  >;

  if (allowedOrigins.length === 0 || allowedPathPrefixes.length === 0) {
    return deny('missing-policy', baseAudit, parsedUrl);
  }

  if (!parsedUrl) {
    return deny('invalid-url', baseAudit);
  }

  if (!allowedOrigins.includes(parsedUrl.origin)) {
    return deny('forbidden-origin', baseAudit, parsedUrl);
  }

  if (!allowedPathPrefixes.some((prefix) => parsedUrl.pathname.startsWith(prefix))) {
    return deny('forbidden-path', baseAudit, parsedUrl);
  }

  return {
    allowed: true,
    audit: {
      ...baseAudit,
      decision: 'allow',
      reason: 'approved-host-api-origin',
      attemptedOrigin: parsedUrl.origin,
      attemptedPath: parsedUrl.pathname,
      attemptedUrl: redactUrl(parsedUrl),
    },
  };
}

export function assertCockpitExtensionBrowserEgressAllowed(
  input: CockpitExtensionBrowserEgressDecisionInput,
): CockpitExtensionBrowserEgressAudit {
  const decision = resolveCockpitExtensionBrowserEgressDecision(input);
  if (!decision.allowed) {
    throw new CockpitExtensionBrowserEgressError(decision.audit);
  }
  return decision.audit;
}

export function createCockpitExtensionFetch(
  context: CockpitExtensionBrowserEgressContext,
  options: {
    policy?: CockpitExtensionBrowserEgressPolicy;
    baseOrigin?: string;
    fetchImpl?: typeof fetch;
  } = {},
): typeof fetch {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    assertCockpitExtensionBrowserEgressAllowed({
      url: input,
      method: init?.method ?? methodFromRequest(input),
      requestKind: 'fetch',
      context,
      policy: options.policy,
      baseOrigin: options.baseOrigin,
    });

    return fetchImpl(input, init);
  }) as typeof fetch;
}

function deny(
  reason: CockpitExtensionBrowserEgressDecisionReason,
  baseAudit: Omit<
    CockpitExtensionBrowserEgressAudit,
    'decision' | 'reason' | 'attemptedOrigin' | 'attemptedPath' | 'attemptedUrl'
  >,
  parsedUrl?: URL | null,
): CockpitExtensionBrowserEgressDecision {
  return {
    allowed: false,
    audit: {
      ...baseAudit,
      decision: 'deny',
      reason,
      ...(parsedUrl
        ? {
            attemptedOrigin: parsedUrl.origin,
            attemptedPath: parsedUrl.pathname,
            attemptedUrl: redactUrl(parsedUrl),
          }
        : {}),
    },
  };
}

function parseUrl(input: RequestInfo | URL, baseOrigin?: string): URL | null {
  const raw = urlString(input);
  if (!raw) return null;

  try {
    if (baseOrigin) return new URL(raw, baseOrigin);
    return new URL(raw);
  } catch {
    return null;
  }
}

function urlString(input: RequestInfo | URL): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return null;
}

function methodFromRequest(input: RequestInfo | URL): string {
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method;
  return 'GET';
}

function redactUrl(url: URL): string {
  return `${url.origin}${url.pathname}`;
}

function getBrowserOrigin(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.location.origin;
}

function originFromUrl(url: string, baseOrigin?: string): string | null {
  if (!url) return null;

  try {
    return new URL(url, baseOrigin).origin;
  } catch {
    return null;
  }
}
