import { describe, expect, it, beforeEach } from 'vitest';

import { RunEmulator } from './run-emulator.js';

describe('RunEmulator', () => {
  let emulator: RunEmulator;

  beforeEach(() => {
    emulator = new RunEmulator();
  });

  it('starts a run in Pending status', async () => {
    const run = await emulator.startRun({
      workspaceId: 'ws-1',
      workflowId: 'wf-1',
    });
    expect(run.status).toBe('Pending');
    expect(run.workspaceId).toBe('ws-1');
    expect(run.workflowId).toBe('wf-1');
    expect(run.runId).toMatch(/^run-/);
  });

  it('transitions Pending -> Executing on Approved', async () => {
    const run = await emulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
    const approved = await emulator.submitApproval(run.runId, 'Approved');
    expect(approved.status).toBe('Executing');
  });

  it('transitions Pending -> Denied on Denied', async () => {
    const run = await emulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
    const denied = await emulator.submitApproval(run.runId, 'Denied');
    expect(denied.status).toBe('Denied');
  });

  it('transitions Executing -> Completed', async () => {
    const run = await emulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
    await emulator.submitApproval(run.runId, 'Approved');
    const completed = emulator.completeRun(run.runId, { output: 42 });
    expect(completed.status).toBe('Completed');
    expect(completed.result).toEqual({ output: 42 });
  });

  it('transitions Executing -> Failed', async () => {
    const run = await emulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
    await emulator.submitApproval(run.runId, 'Approved');
    const failed = emulator.failRun(run.runId, 'timeout');
    expect(failed.status).toBe('Failed');
    expect(failed.error).toBe('timeout');
  });

  it('cancels a Pending run', async () => {
    const run = await emulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
    const cancelled = emulator.cancelRun(run.runId);
    expect(cancelled.status).toBe('Cancelled');
  });

  it('cancels an Executing run', async () => {
    const run = await emulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
    await emulator.submitApproval(run.runId, 'Approved');
    const cancelled = emulator.cancelRun(run.runId);
    expect(cancelled.status).toBe('Cancelled');
  });

  it('rejects cancel on Completed run', async () => {
    const run = await emulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
    await emulator.submitApproval(run.runId, 'Approved');
    emulator.completeRun(run.runId);
    expect(() => emulator.cancelRun(run.runId)).toThrow('cannot cancel');
  });

  it('rejects approval on non-Pending run', async () => {
    const run = await emulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
    await emulator.submitApproval(run.runId, 'Approved');
    await expect(emulator.submitApproval(run.runId, 'Approved')).rejects.toThrow(
      'expected Pending',
    );
  });

  it('rejects complete on non-Executing run', async () => {
    const run = await emulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
    expect(() => emulator.completeRun(run.runId)).toThrow('expected Executing');
  });

  it('throws for unknown run ID', async () => {
    await expect(emulator.submitApproval('run-nonexistent', 'Approved')).rejects.toThrow(
      'not found',
    );
  });

  it('lists all runs', async () => {
    await emulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
    await emulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-2' });
    expect(emulator.listRuns()).toHaveLength(2);
  });

  it('resets all state', async () => {
    await emulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
    emulator.reset();
    expect(emulator.listRuns()).toHaveLength(0);
  });

  describe('autoApprove mode', () => {
    it('auto-approves and transitions to Executing', async () => {
      const autoEmulator = new RunEmulator({ autoApprove: true });
      const run = await autoEmulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
      expect(run.status).toBe('Executing');
    });
  });

  describe('autoApprove + autoComplete mode', () => {
    it('auto-completes the full lifecycle', async () => {
      const fullAutoEmulator = new RunEmulator({ autoApprove: true, autoComplete: true });
      const run = await fullAutoEmulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
      expect(run.status).toBe('Completed');
    });
  });

  it('getRun returns undefined for missing run', () => {
    expect(emulator.getRun('run-missing')).toBeUndefined();
  });

  it('getRun returns a snapshot (not mutable reference)', async () => {
    const run = await emulator.startRun({ workspaceId: 'ws-1', workflowId: 'wf-1' });
    const snapshot = emulator.getRun(run.runId);
    expect(snapshot).toBeDefined();
    expect(snapshot!.status).toBe('Pending');
  });
});
