// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MobileBottomSheet } from './mobile-bottom-sheet';

describe('MobileBottomSheet', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the title', () => {
    render(
      <MobileBottomSheet title="Fleet">
        <p>content</p>
      </MobileBottomSheet>,
    );
    expect(screen.getByText('Fleet')).toBeTruthy();
  });

  it('renders the count alongside the title', () => {
    render(
      <MobileBottomSheet title="Fleet" count={12}>
        <p>content</p>
      </MobileBottomSheet>,
    );
    expect(screen.getByText('(12)')).toBeTruthy();
  });

  it('starts collapsed by default — content is hidden', () => {
    render(
      <MobileBottomSheet title="Fleet">
        <p>inner content</p>
      </MobileBottomSheet>,
    );
    // Content wrapper should have h-0 class when collapsed
    const sheet = screen.getByText('inner content').parentElement;
    expect(sheet?.className).toContain('h-0');
  });

  it('starts in the specified default snap', () => {
    render(
      <MobileBottomSheet title="Fleet" defaultSnap="half">
        <p>visible content</p>
      </MobileBottomSheet>,
    );
    const sheet = screen.getByText('visible content').parentElement;
    expect(sheet?.className).not.toContain('h-0');
  });

  it('expands when the drag handle area is clicked', () => {
    render(
      <MobileBottomSheet title="Fleet">
        <p>content here</p>
      </MobileBottomSheet>,
    );
    const handle = screen.getByRole('button', { name: /Fleet panel/i });
    fireEvent.click(handle);
    const content = screen.getByText('content here').parentElement;
    expect(content?.className).not.toContain('h-0');
  });

  it('shows more buttons when onClose is provided', () => {
    const { container: withClose } = render(
      <MobileBottomSheet title="Detail" onClose={vi.fn()}>
        <p>detail</p>
      </MobileBottomSheet>,
    );
    const withCloseButtons = withClose.querySelectorAll('button').length;
    cleanup();

    const { container: withoutClose } = render(
      <MobileBottomSheet title="Detail">
        <p>detail</p>
      </MobileBottomSheet>,
    );
    const withoutCloseButtons = withoutClose.querySelectorAll('button').length;

    // With onClose there should be one extra button (the X)
    expect(withCloseButtons).toBe(withoutCloseButtons + 1);
  });

  it('calls onClose when the extra close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <MobileBottomSheet title="Detail" onClose={onClose}>
        <p>detail</p>
      </MobileBottomSheet>,
    );
    // The close button is the last button in the header area (after handle + chevron)
    const buttons = screen.getAllByRole('button');
    // The close button is the last non-handle button
    // Handle has role="button" + tabIndex, chevron is another, close is last
    const lastButton = buttons[buttons.length - 1];
    fireEvent.click(lastButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('collapses on Escape key when expanded', () => {
    render(
      <MobileBottomSheet title="Fleet" defaultSnap="half">
        <p>test content</p>
      </MobileBottomSheet>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    const content = screen.getByText('test content').parentElement;
    expect(content?.className).toContain('h-0');
  });

  it('has an accessible drag handle with aria-label', () => {
    render(
      <MobileBottomSheet title="Fleet">
        <p>content</p>
      </MobileBottomSheet>,
    );
    const handle = screen.getByRole('button', { name: /Fleet panel/i });
    expect(handle).toBeTruthy();
    expect(handle.getAttribute('tabindex')).toBe('0');
  });
});
