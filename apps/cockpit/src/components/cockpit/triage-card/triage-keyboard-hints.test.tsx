// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TriageKeyboardHints } from './triage-keyboard-hints';

describe('TriageKeyboardHints', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows default keyboard hints when rationale not focused', () => {
    render(<TriageKeyboardHints rationaleHasFocus={false} undoAvailable={false} />);
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('D')).toBeTruthy();
    expect(screen.getByText('R')).toBeTruthy();
    expect(screen.getByText('S')).toBeTruthy();
    expect(screen.getByText('V')).toBeTruthy();
  });

  it('shows Esc hint when rationale has focus', () => {
    render(<TriageKeyboardHints rationaleHasFocus={true} undoAvailable={false} />);
    expect(screen.getByText('Esc')).toBeTruthy();
    expect(screen.queryByText('A')).toBeNull();
  });

  it('shows Z (undo) hint when undo is available', () => {
    render(<TriageKeyboardHints rationaleHasFocus={false} undoAvailable={true} />);
    expect(screen.getByText('Z')).toBeTruthy();
    expect(screen.getByText('undo')).toBeTruthy();
  });

  it('hides Z hint when undo is not available', () => {
    render(<TriageKeyboardHints rationaleHasFocus={false} undoAvailable={false} />);
    expect(screen.queryByText('Z')).toBeNull();
  });
});
