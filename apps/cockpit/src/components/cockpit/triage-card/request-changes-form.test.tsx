// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequestChangesForm } from './request-changes-form';

describe('RequestChangesForm', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with disabled submit when message is empty', () => {
    render(
      <RequestChangesForm
        message=""
        onMessageChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const submitBtn = screen.getByRole('button', { name: /submit request/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('enables submit when message has content', () => {
    render(
      <RequestChangesForm
        message="Please fix the dates"
        onMessageChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const submitBtn = screen.getByRole('button', { name: /submit request/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
  });

  it('calls onCancel when cancel is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <RequestChangesForm
        message=""
        onMessageChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onSubmit with RequestChanges when submit is clicked', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <RequestChangesForm
        message="Fix deployment window"
        onMessageChange={vi.fn()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /submit request/i }));
    expect(onSubmit).toHaveBeenCalledWith('RequestChanges');
  });
});
