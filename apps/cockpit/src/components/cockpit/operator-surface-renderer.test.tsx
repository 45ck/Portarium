// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OperatorSurface, OperatorSurfaceAction } from '@portarium/cockpit-types';
import { OperatorSurfaceRenderer } from './operator-surface-renderer';

afterEach(() => cleanup());

const SURFACE: OperatorSurface = {
  schemaVersion: 1,
  surfaceId: 'surface-1',
  workspaceId: 'ws-1',
  correlationId: 'corr-1',
  surfaceKind: 'Form',
  context: { kind: 'Approval', runId: 'run-1', approvalId: 'approval-1' },
  title: 'Supplier reply taste',
  description: 'Capture the operator preference before the run resumes.',
  attribution: {
    proposedBy: { kind: 'Machine', machineId: 'machine-1' },
    proposedAtIso: '2026-04-02T10:00:00.000Z',
    rationale: 'The standard approval panel cannot capture wording taste.',
  },
  lifecycle: {
    status: 'Approved',
    proposedAtIso: '2026-04-02T10:00:00.000Z',
    approvedAtIso: '2026-04-02T10:01:00.000Z',
  },
  blocks: [
    { blockType: 'text', text: 'Pick the tone and add a note.', tone: 'info' },
    {
      blockType: 'metric',
      label: 'Invoice variance',
      value: '420',
      unit: 'USD',
      tone: 'warning',
    },
    {
      blockType: 'form',
      fields: [
        { fieldId: 'note', label: 'Operator note', widget: 'textarea', required: true },
        { fieldId: 'urgent', label: 'Urgent follow-up', widget: 'checkbox' },
      ],
    },
    {
      blockType: 'actions',
      actions: [
        { actionId: 'record-taste', label: 'Record taste', intentKind: 'Taste', submitsForm: true },
      ],
    },
  ],
};

describe('OperatorSurfaceRenderer', () => {
  it('renders approved structured cards and forms without executable code', () => {
    render(
      <OperatorSurfaceRenderer
        surface={SURFACE}
        operatorUserId="user-operator"
        nowIso={() => '2026-04-02T10:03:00.000Z'}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Supplier reply taste' })).toBeTruthy();
    expect(screen.getByText('Invoice variance')).toBeTruthy();
    expect(screen.getByLabelText('Operator note *')).toBeTruthy();
    expect(screen.getByLabelText('Urgent follow-up')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Record taste' })).toBeTruthy();
  });

  it('emits a structured operator interaction for intent, taste, or insight feedback', async () => {
    const user = userEvent.setup();
    const onInteraction = vi.fn();
    render(
      <OperatorSurfaceRenderer
        surface={SURFACE}
        operatorUserId="user-operator"
        nowIso={() => '2026-04-02T10:03:00.000Z'}
        onInteraction={onInteraction}
      />,
    );

    await user.type(screen.getByLabelText('Operator note *'), 'Use a direct but polite reply.');
    await user.click(screen.getByLabelText('Urgent follow-up'));
    await user.click(screen.getByRole('button', { name: 'Record taste' }));

    expect(onInteraction).toHaveBeenCalledWith({
      schemaVersion: 1,
      surfaceId: 'surface-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      approvalId: 'approval-1',
      actionId: 'record-taste',
      intentKind: 'Taste',
      submittedByUserId: 'user-operator',
      submittedAtIso: '2026-04-02T10:03:00.000Z',
      values: {
        note: 'Use a direct but polite reply.',
        urgent: true,
      },
    });
  });

  it('does not render proposed surfaces as usable UI', () => {
    render(
      <OperatorSurfaceRenderer
        surface={{
          ...SURFACE,
          lifecycle: { status: 'Proposed', proposedAtIso: '2026-04-02T10:00:00.000Z' },
        }}
        operatorUserId="user-operator"
      />,
    );

    expect(screen.getByText('Generated operator surface awaiting approval.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Record taste' })).toBeNull();
  });

  it('renders suspicious text as text content instead of HTML', () => {
    const surface: OperatorSurface = {
      ...SURFACE,
      blocks: [{ blockType: 'text', text: '<img src=x onerror=alert(1)>', tone: 'critical' }],
    };
    const { container } = render(
      <OperatorSurfaceRenderer surface={surface} operatorUserId="user-operator" />,
    );

    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders suspicious action labels as inert text and dispatches only schema fields', async () => {
    const user = userEvent.setup();
    const onInteraction = vi.fn();
    const surface: OperatorSurface = {
      ...SURFACE,
      blocks: [
        {
          blockType: 'actions',
          actions: [
            {
              actionId: 'record-taste',
              label: '<img src=x onerror=alert(1)>',
              intentKind: 'Taste',
              privilegedCommandId: 'workspace.emergency-disable',
            } as OperatorSurfaceAction & { privilegedCommandId: string },
          ],
        },
      ],
    };
    const { container } = render(
      <OperatorSurfaceRenderer
        surface={surface}
        operatorUserId="user-operator"
        nowIso={() => '2026-04-02T10:03:00.000Z'}
        onInteraction={onInteraction}
      />,
    );

    await user.click(screen.getByRole('button', { name: '<img src=x onerror=alert(1)>' }));

    expect(container.querySelector('img')).toBeNull();
    expect(onInteraction).toHaveBeenCalledWith({
      schemaVersion: 1,
      surfaceId: 'surface-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      approvalId: 'approval-1',
      actionId: 'record-taste',
      intentKind: 'Taste',
      submittedByUserId: 'user-operator',
      submittedAtIso: '2026-04-02T10:03:00.000Z',
      values: {},
    });
  });
});
