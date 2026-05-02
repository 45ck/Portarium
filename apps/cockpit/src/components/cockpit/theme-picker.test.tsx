// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemePicker, MISSION_CONTROL_THEME_ID, STANDARD_THEME_ID } from './theme-picker';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = '';
});

describe('ThemePicker', () => {
  it('switches between Standard and Mission Control appearance modes', async () => {
    render(<ThemePicker />);

    expect(document.documentElement.classList.contains(STANDARD_THEME_ID)).toBe(true);

    await userEvent.click(
      screen.getByRole('button', { name: /Mission Control Operator density/i }),
    );

    expect(localStorage.getItem('cockpit-theme')).toBe(MISSION_CONTROL_THEME_ID);
    expect(document.documentElement.classList.contains(MISSION_CONTROL_THEME_ID)).toBe(true);
    expect(document.documentElement.classList.contains(STANDARD_THEME_ID)).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /Standard Cockpit default/i }));

    expect(localStorage.getItem('cockpit-theme')).toBe(STANDARD_THEME_ID);
    expect(document.documentElement.classList.contains(STANDARD_THEME_ID)).toBe(true);
    expect(document.documentElement.classList.contains(MISSION_CONTROL_THEME_ID)).toBe(false);
  });

  it('loads the persisted Mission Control theme on first render', () => {
    localStorage.setItem('cockpit-theme', MISSION_CONTROL_THEME_ID);

    render(<ThemePicker />);

    expect(document.documentElement.classList.contains(MISSION_CONTROL_THEME_ID)).toBe(true);
    expect(
      screen
        .getByRole('button', { name: /Mission Control Operator density/i })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });
});
