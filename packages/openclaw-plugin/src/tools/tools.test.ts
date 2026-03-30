import { describe, expect, it, vi } from 'vitest';
import { registerGetRunTool } from './get-run.js';
import { registerListApprovalsTool } from './list-approvals.js';
import { registerCapabilityLookupTool } from './capability-lookup.js';
import type { PortariumClient, RunStatus, ApprovalSummary, CapabilityInfo } from '../client/portarium-client.js';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

function captureRegisteredTool(registerFn: (registerTool: (spec: ToolSpec) => void, client: PortariumClient) => void, client: PortariumClient): ToolSpec {
  let spec: ToolSpec | undefined;
  registerFn((s) => { spec = s; }, client);
  if (!spec) throw new Error('Tool was not registered');
  return spec;
}

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
    const tool = captureRegisteredTool(registerGetRunTool, client);

    const result = await tool.handler({ runId: 'run-abc' });
    expect(result).toEqual(runStatus);
    expect(client.getRunStatus).toHaveBeenCalledWith('run-abc');
  });

  it('returns error object when run is not found', async () => {
    const client = {
      getRunStatus: vi.fn().mockResolvedValue(null),
    } as unknown as PortariumClient;
    const tool = captureRegisteredTool(registerGetRunTool, client);

    const result = await tool.handler({ runId: 'run-missing' });
    expect(result).toMatchObject({ error: expect.stringContaining('run-missing') });
  });

  it('returns error object when runId is missing', async () => {
    const client = {
      getRunStatus: vi.fn(),
    } as unknown as PortariumClient;
    const tool = captureRegisteredTool(registerGetRunTool, client);

    const result = await tool.handler({});
    expect(result).toMatchObject({ error: expect.stringContaining('runId') });
    expect(client.getRunStatus).not.toHaveBeenCalled();
  });

  it('registers with correct tool name and required runId input schema', () => {
    const client = { getRunStatus: vi.fn() } as unknown as PortariumClient;
    const tool = captureRegisteredTool(registerGetRunTool, client);

    expect(tool.name).toBe('portarium_get_run');
    expect((tool.inputSchema as { required: string[] }).required).toContain('runId');
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
    const tool = captureRegisteredTool(registerListApprovalsTool, client);

    const result = await tool.handler({});
    expect(result).toEqual({ count: 2, approvals });
  });

  it('returns count 0 and empty array when no pending approvals', async () => {
    const client = {
      listPendingApprovals: vi.fn().mockResolvedValue([]),
    } as unknown as PortariumClient;
    const tool = captureRegisteredTool(registerListApprovalsTool, client);

    const result = await tool.handler({});
    expect(result).toEqual({ count: 0, approvals: [] });
  });

  it('registers with correct tool name', () => {
    const client = { listPendingApprovals: vi.fn() } as unknown as PortariumClient;
    const tool = captureRegisteredTool(registerListApprovalsTool, client);
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
    const tool = captureRegisteredTool(registerCapabilityLookupTool, client);

    const result = await tool.handler({ toolName: 'bash_exec' });
    expect(result).toEqual(info);
    expect(client.lookupCapability).toHaveBeenCalledWith('bash_exec');
  });

  it('returns HumanApprove default with note when tool is not in registry', async () => {
    const client = {
      lookupCapability: vi.fn().mockResolvedValue(null),
    } as unknown as PortariumClient;
    const tool = captureRegisteredTool(registerCapabilityLookupTool, client);

    const result = await tool.handler({ toolName: 'unknown_tool' }) as Record<string, unknown>;
    expect(result.requiredTier).toBe('HumanApprove');
    expect(result.toolName).toBe('unknown_tool');
    expect(result.note).toBeTruthy();
  });

  it('returns error object when toolName is missing', async () => {
    const client = {
      lookupCapability: vi.fn(),
    } as unknown as PortariumClient;
    const tool = captureRegisteredTool(registerCapabilityLookupTool, client);

    const result = await tool.handler({});
    expect(result).toMatchObject({ error: expect.stringContaining('toolName') });
    expect(client.lookupCapability).not.toHaveBeenCalled();
  });

  it('registers with correct tool name and required toolName input schema', () => {
    const client = { lookupCapability: vi.fn() } as unknown as PortariumClient;
    const tool = captureRegisteredTool(registerCapabilityLookupTool, client);

    expect(tool.name).toBe('portarium_capability_lookup');
    expect((tool.inputSchema as { required: string[] }).required).toContain('toolName');
  });
});
