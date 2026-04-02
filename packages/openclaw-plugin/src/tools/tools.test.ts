import { describe, expect, it, vi } from 'vitest';
import { createGetRunTool } from './get-run.js';
import { createListApprovalsTool } from './list-approvals.js';
import { createCapabilityLookupTool } from './capability-lookup.js';
import type {
  PortariumClient,
  RunStatus,
  ApprovalSummary,
  CapabilityInfo,
} from '../client/portarium-client.js';

// ──────────────────────────────────────────────
// portarium_get_run
// ──────────────────────────────────────────────

describe('portarium_get_run', () => {
  it('returns run status for a valid runId', async () => {
    const runStatus: RunStatus = {
      runId: 'run-abc',
      stage: 'running',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T01:00:00Z',
    };
    const client = {
      getRunStatus: vi.fn().mockResolvedValue(runStatus),
    } as unknown as PortariumClient;
    const tool = createGetRunTool(client);

    const result = await tool.execute('tc-1', { runId: 'run-abc' });
    expect(result).toEqual(runStatus);
    expect(client.getRunStatus).toHaveBeenCalledWith('run-abc');
  });

  it('returns error object when run is not found', async () => {
    const client = {
      getRunStatus: vi.fn().mockResolvedValue(null),
    } as unknown as PortariumClient;
    const tool = createGetRunTool(client);

    const result = await tool.execute('tc-2', { runId: 'run-missing' });
    expect(result).toMatchObject({ error: expect.stringContaining('run-missing') });
  });

  it('returns error object when runId is missing', async () => {
    const client = {
      getRunStatus: vi.fn(),
    } as unknown as PortariumClient;
    const tool = createGetRunTool(client);

    const result = await tool.execute('tc-3', {});
    expect(result).toMatchObject({ error: expect.stringContaining('runId') });
    expect(client.getRunStatus).not.toHaveBeenCalled();
  });

  it('registers with correct tool name', () => {
    const client = { getRunStatus: vi.fn() } as unknown as PortariumClient;
    const tool = createGetRunTool(client);
    expect(tool.name).toBe('portarium_get_run');
  });
});

// ──────────────────────────────────────────────
// portarium_list_approvals
// ──────────────────────────────────────────────

describe('portarium_list_approvals', () => {
  it('returns count and approvals when items exist', async () => {
    const approvals: ApprovalSummary[] = [
      {
        approvalId: 'appr-1',
        toolName: 'bash_exec',
        status: 'pending',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        approvalId: 'appr-2',
        toolName: 'write_file',
        status: 'pending',
        createdAt: '2026-01-01T00:01:00Z',
      },
    ];
    const client = {
      listPendingApprovals: vi.fn().mockResolvedValue(approvals),
    } as unknown as PortariumClient;
    const tool = createListApprovalsTool(client);

    const result = await tool.execute('tc-4', {});
    expect(result).toEqual({ count: 2, approvals });
  });

  it('returns count 0 and empty array when no pending approvals', async () => {
    const client = {
      listPendingApprovals: vi.fn().mockResolvedValue([]),
    } as unknown as PortariumClient;
    const tool = createListApprovalsTool(client);

    const result = await tool.execute('tc-5', {});
    expect(result).toEqual({ count: 0, approvals: [] });
  });

  it('registers with correct tool name', () => {
    const client = { listPendingApprovals: vi.fn() } as unknown as PortariumClient;
    const tool = createListApprovalsTool(client);
    expect(tool.name).toBe('portarium_list_approvals');
  });
});

// ──────────────────────────────────────────────
// portarium_capability_lookup
// ──────────────────────────────────────────────

describe('portarium_capability_lookup', () => {
  it('returns capability info when tool is found in registry', async () => {
    const info: CapabilityInfo = {
      capabilityId: 'bash_exec',
      requiredTier: 'HumanApprove',
      riskClass: 'Dangerous',
    };
    const client = {
      lookupCapability: vi.fn().mockResolvedValue(info),
    } as unknown as PortariumClient;
    const tool = createCapabilityLookupTool(client);

    const result = await tool.execute('tc-6', { toolName: 'bash_exec' });
    expect(result).toEqual(info);
    expect(client.lookupCapability).toHaveBeenCalledWith('bash_exec');
  });

  it('returns HumanApprove default with note when tool is not in registry', async () => {
    const client = {
      lookupCapability: vi.fn().mockResolvedValue(null),
    } as unknown as PortariumClient;
    const tool = createCapabilityLookupTool(client);

    const result = (await tool.execute('tc-7', { toolName: 'unknown_tool' })) as Record<
      string,
      unknown
    >;
    expect(result.requiredTier).toBe('HumanApprove');
    expect(result.toolName).toBe('unknown_tool');
    expect(result.note).toBeTruthy();
  });

  it('returns error object when toolName is missing', async () => {
    const client = {
      lookupCapability: vi.fn(),
    } as unknown as PortariumClient;
    const tool = createCapabilityLookupTool(client);

    const result = await tool.execute('tc-8', {});
    expect(result).toMatchObject({ error: expect.stringContaining('toolName') });
    expect(client.lookupCapability).not.toHaveBeenCalled();
  });

  it('registers with correct tool name', () => {
    const client = { lookupCapability: vi.fn() } as unknown as PortariumClient;
    const tool = createCapabilityLookupTool(client);
    expect(tool.name).toBe('portarium_capability_lookup');
  });
});
