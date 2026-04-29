import { useEffect, useMemo, useRef, useState } from 'react';

export type BeadThreadPolicyTier = 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
export type BeadThreadBlastRadius = 'low' | 'medium' | 'high' | 'critical';
export type BeadThreadEntryStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'awaiting_approval';

export interface BeadThreadEntry {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: BeadThreadEntryStatus;
  policyTier: BeadThreadPolicyTier;
  blastRadius: BeadThreadBlastRadius;
  approvalId?: string;
  policyRuleId?: string;
  rationale?: string;
  message?: string;
  agentId?: string;
  occurredAtIso?: string;
}

export interface BeadThreadStreamState {
  entries: BeadThreadEntry[];
  status: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error';
  error: string | null;
  lastEventId: string | null;
}

interface SseFrame {
  id: string | null;
  event: string | null;
  data: unknown;
}

const RECONNECT_DELAY_MS = 3_000;
const MAX_ENTRIES = 200;

const KNOWN_POLICY_TIERS = new Set(['Auto', 'Assisted', 'HumanApprove', 'ManualOnly']);
const KNOWN_BLAST_RADIUS = new Set(['low', 'medium', 'high', 'critical']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function readRecord(
  record: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> | null {
  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) return value;
  }
  return null;
}

function readArgs(record: Record<string, unknown>): Record<string, unknown> {
  const args = readRecord(record, ['args', 'arguments', 'input', 'params', 'parameters']);
  return args ?? {};
}

function normalizePolicyTier(value: unknown): BeadThreadPolicyTier {
  if (typeof value !== 'string') return 'Auto';
  const compact = value.replace(/[-_\s]/g, '').toLowerCase();
  if (compact === 'auto' || compact === 'autoapproved') return 'Auto';
  if (compact === 'assisted') return 'Assisted';
  if (compact === 'humanapprove' || compact === 'humanapproval' || compact === 'needsapproval') {
    return 'HumanApprove';
  }
  if (compact === 'manualonly' || compact === 'blocked') return 'ManualOnly';
  return KNOWN_POLICY_TIERS.has(value) ? (value as BeadThreadPolicyTier) : 'Auto';
}

function normalizeBlastRadius(value: unknown): BeadThreadBlastRadius {
  if (typeof value === 'string') {
    const compact = value.toLowerCase();
    if (KNOWN_BLAST_RADIUS.has(compact)) return compact as BeadThreadBlastRadius;
    if (compact.includes('critical') || compact.includes('auth') || compact.includes('money')) {
      return 'critical';
    }
    if (compact.includes('high') || compact.includes('production')) return 'high';
    if (compact.includes('medium') || compact.includes('write')) return 'medium';
  }

  if (Array.isArray(value)) {
    if (value.length >= 4) return 'critical';
    if (value.length >= 2) return 'high';
    if (value.length === 1) return 'medium';
  }

  return 'low';
}

function unwrapPayload(data: unknown): Record<string, unknown> | null {
  if (!isRecord(data)) return null;
  const payload = readRecord(data, ['payload', 'data', 'toolCall', 'proposal', 'entry']);
  return payload ? { ...data, ...payload } : data;
}

function statusForEvent(
  eventType: string | null,
  payload: Record<string, unknown>,
): BeadThreadEntryStatus {
  const explicit = readString(payload, ['status', 'state']);
  if (explicit) {
    const compact = explicit.replace(/[-\s]/g, '_').toLowerCase();
    if (compact === 'awaiting_approval' || compact === 'approval_requested')
      return 'awaiting_approval';
    if (compact === 'completed' || compact === 'succeeded' || compact === 'success')
      return 'success';
    if (compact === 'failed' || compact === 'error') return 'error';
    if (compact === 'running' || compact === 'in_progress') return 'running';
    if (compact === 'pending') return 'pending';
  }

  const type = eventType ?? readString(payload, ['type', 'eventType']);
  if (!type) return 'running';
  if (type.includes('ApprovalRequested')) return 'awaiting_approval';
  if (type.includes('Approved')) return 'running';
  if (type.includes('Denied') || type.includes('ExecutionFailed')) return 'error';
  if (type.includes('Executed') || type.includes('Completed')) return 'success';
  if (type.includes('Proposed')) return 'pending';
  return 'running';
}

function fallbackToolName(eventType: string | null): string {
  if (!eventType) return 'tool call';
  const tail = eventType.split('.').pop() ?? eventType;
  return tail.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

function mergeEntry(
  previous: BeadThreadEntry | undefined,
  next: Partial<BeadThreadEntry> & Pick<BeadThreadEntry, 'id'>,
): BeadThreadEntry {
  const merged: BeadThreadEntry = {
    id: next.id,
    toolName: next.toolName ?? previous?.toolName ?? 'tool call',
    args: next.args ?? previous?.args ?? {},
    status: next.status ?? previous?.status ?? 'running',
    policyTier: next.policyTier ?? previous?.policyTier ?? 'Auto',
    blastRadius: next.blastRadius ?? previous?.blastRadius ?? 'low',
  };

  for (const key of [
    'approvalId',
    'policyRuleId',
    'rationale',
    'message',
    'agentId',
    'occurredAtIso',
  ] as const) {
    const value = next[key] ?? previous?.[key];
    if (value !== undefined) merged[key] = value;
  }

  return merged;
}

export function parseSseFrames(chunk: string): SseFrame[] {
  const frames: SseFrame[] = [];
  for (const rawFrame of chunk.split(/\r?\n\r?\n/)) {
    if (!rawFrame.trim() || rawFrame.trimStart().startsWith(':')) continue;

    let id: string | null = null;
    let event: string | null = null;
    const dataLines: string[] = [];

    for (const rawLine of rawFrame.split(/\r?\n/)) {
      if (!rawLine || rawLine.startsWith(':')) continue;
      const separator = rawLine.indexOf(':');
      const field = separator === -1 ? rawLine : rawLine.slice(0, separator);
      const value = separator === -1 ? '' : rawLine.slice(separator + 1).replace(/^ /, '');

      if (field === 'id') id = value;
      if (field === 'event') event = value;
      if (field === 'data') dataLines.push(value);
    }

    const dataText = dataLines.join('\n');
    let data: unknown = null;
    if (dataText) {
      try {
        data = JSON.parse(dataText) as unknown;
      } catch {
        data = dataText;
      }
    }

    frames.push({ id, event, data });
  }
  return frames;
}

export function normalizeBeadThreadFrame(frame: SseFrame): BeadThreadEntry | null {
  const payload = unwrapPayload(frame.data);
  if (!payload) return null;

  const eventType = frame.event ?? readString(payload, ['type', 'eventType']) ?? null;
  const id =
    readString(payload, [
      'toolCallId',
      'tool_call_id',
      'proposalId',
      'approvalId',
      'id',
      'eventId',
    ]) ?? frame.id;
  if (!id) return null;

  const policyRule = readRecord(payload, ['policyRule', 'rule']);
  const policyTierSource =
    payload['policyTier'] ??
    payload['executionTier'] ??
    payload['blastRadiusTier'] ??
    policyRule?.['tier'];
  const blastSource =
    payload['blastRadiusLevel'] ??
    payload['blastRadius'] ??
    policyRule?.['blastRadius'] ??
    payload['blast'];

  const approvalId = readString(payload, ['approvalId']);
  const policyRuleId = readString(policyRule ?? payload, ['ruleId', 'policyRuleId']);
  const rationale = readString(payload, ['rationale', 'policyRationale', 'reason']);
  const message = readString(payload, ['message', 'prompt', 'error']);
  const agentId = readString(payload, ['agentId', 'actorUserId', 'actor']);
  const occurredAtIso = readString(payload, [
    'occurredAtIso',
    'requestedAtIso',
    'time',
    'timestamp',
  ]);

  return mergeEntry(undefined, {
    id,
    toolName:
      readString(payload, ['toolName', 'tool', 'name', 'action']) ?? fallbackToolName(eventType),
    args: readArgs(payload),
    status: statusForEvent(eventType, payload),
    policyTier: normalizePolicyTier(policyTierSource),
    blastRadius: normalizeBlastRadius(blastSource),
    ...(approvalId ? { approvalId } : {}),
    ...(policyRuleId ? { policyRuleId } : {}),
    ...(rationale ? { rationale } : {}),
    ...(message ? { message } : {}),
    ...(agentId ? { agentId } : {}),
    ...(occurredAtIso ? { occurredAtIso } : {}),
  });
}

function normalizeSnapshot(value: unknown): BeadThreadEntry[] {
  const items = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value['items'])
      ? value['items']
      : isRecord(value) && Array.isArray(value['entries'])
        ? value['entries']
        : [];

  return items
    .map((item, index) =>
      normalizeBeadThreadFrame({
        id: `snapshot-${index}`,
        event: null,
        data: item,
      }),
    )
    .filter((entry): entry is BeadThreadEntry => entry !== null);
}

function reduceEntries(entries: BeadThreadEntry[], next: BeadThreadEntry): BeadThreadEntry[] {
  const existingIndex = entries.findIndex(
    (entry) =>
      entry.id === next.id ||
      (next.approvalId !== undefined && entry.approvalId === next.approvalId),
  );

  if (existingIndex === -1) return [...entries, next].slice(-MAX_ENTRIES);

  const merged = mergeEntry(entries[existingIndex], next);
  return entries.map((entry, index) => (index === existingIndex ? merged : entry));
}

export function useBeadThreadStream(workspaceId: string, beadId: string): BeadThreadStreamState {
  const [entries, setEntries] = useState<BeadThreadEntry[]>([]);
  const [status, setStatus] = useState<BeadThreadStreamState['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setEntries([]);
    setLastEventId(null);
    setError(null);

    if (!workspaceId || !beadId || typeof fetch === 'undefined') {
      setStatus('idle');
      return;
    }

    let disposed = false;
    let controller: AbortController | null = null;

    const beadPath = `/v1/workspaces/${encodeURIComponent(workspaceId)}/beads/${encodeURIComponent(
      beadId,
    )}`;

    async function hydrate() {
      try {
        const response = await fetch(`${beadPath}/thread`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return;
        const snapshot = normalizeSnapshot(await response.json());
        if (!disposed && snapshot.length > 0) {
          setEntries((current) => snapshot.reduce(reduceEntries, current));
        }
      } catch {
        // The snapshot endpoint may not be available while the SSE backend is rolling out.
      }
    }

    function scheduleReconnect() {
      if (disposed || reconnectTimerRef.current) return;
      setStatus('reconnecting');
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        void hydrate();
        void connect();
      }, RECONNECT_DELAY_MS);
    }

    async function connect() {
      if (disposed) return;

      controller = new AbortController();
      setStatus((current) => (current === 'reconnecting' ? 'reconnecting' : 'connecting'));

      try {
        const response = await fetch(`${beadPath}/events`, {
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          setError(`Stream failed with status ${response.status}`);
          scheduleReconnect();
          return;
        }

        setStatus('open');
        setError(null);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split(/\r?\n\r?\n/);
          buffer = parts.pop() ?? '';

          for (const frame of parseSseFrames(parts.join('\n\n'))) {
            if (frame.id) setLastEventId(frame.id);
            const entry = normalizeBeadThreadFrame(frame);
            if (entry) setEntries((current) => reduceEntries(current, entry));
          }
        }

        if (buffer.trim()) {
          for (const frame of parseSseFrames(buffer)) {
            if (frame.id) setLastEventId(frame.id);
            const entry = normalizeBeadThreadFrame(frame);
            if (entry) setEntries((current) => reduceEntries(current, entry));
          }
        }

        scheduleReconnect();
      } catch (caught) {
        if (!disposed && !(caught instanceof DOMException && caught.name === 'AbortError')) {
          setError(caught instanceof Error ? caught.message : 'Stream failed');
          setStatus('error');
          scheduleReconnect();
        }
      }
    }

    void hydrate();
    void connect();

    return () => {
      disposed = true;
      controller?.abort();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [workspaceId, beadId]);

  return useMemo(
    () => ({ entries, status, error, lastEventId }),
    [entries, status, error, lastEventId],
  );
}
