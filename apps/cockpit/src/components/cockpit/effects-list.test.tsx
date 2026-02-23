// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PlanEffect, PredictedPlanEffect } from '@portarium/cockpit-types';
import { EffectsList } from './effects-list';

const makeEffect = (id: string, op: PlanEffect['operation'] = 'CREATE'): PlanEffect => ({
  effectId: id,
  operation: op,
  target: { sorName: 'odoo', externalType: 'invoice' },
  summary: `Effect ${id}`,
});

const makePredicted = (id: string): PredictedPlanEffect => ({
  effectId: id,
  operation: 'UPDATE',
  target: { sorName: 'odoo', externalType: 'account' },
  summary: `Predicted ${id}`,
  confidence: 0.85,
});

describe('EffectsList', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders planned section when planned effects exist', () => {
    render(<EffectsList planned={[makeEffect('e1'), makeEffect('e2')]} />);
    expect(screen.getByText('Planned')).toBeTruthy();
    expect(screen.getByText('Effect e1')).toBeTruthy();
    expect(screen.getByText('Effect e2')).toBeTruthy();
  });

  it('renders nothing when all arrays are empty', () => {
    const { container } = render(<EffectsList planned={[]} />);
    expect(container.textContent).toBe('');
  });

  it('renders predicted section with confidence percentage', () => {
    render(<EffectsList planned={[]} predicted={[makePredicted('p1')]} />);
    expect(screen.getByText('Predicted')).toBeTruthy();
    expect(screen.getByText('Predicted p1')).toBeTruthy();
    expect(screen.getByText('85%')).toBeTruthy();
  });

  it('renders verified section', () => {
    render(<EffectsList planned={[]} verified={[makeEffect('v1')]} />);
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('Effect v1')).toBeTruthy();
  });

  it('renders all three sections simultaneously', () => {
    render(
      <EffectsList
        planned={[makeEffect('e1')]}
        predicted={[makePredicted('p1')]}
        verified={[makeEffect('v1')]}
      />,
    );
    expect(screen.getByText('Planned')).toBeTruthy();
    expect(screen.getByText('Predicted')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
  });

  it('shows operation badge', () => {
    render(<EffectsList planned={[makeEffect('e1', 'DELETE')]} />);
    expect(screen.getByText('DELETE')).toBeTruthy();
  });

  it('shows target SOR name and type', () => {
    render(<EffectsList planned={[makeEffect('e1')]} />);
    expect(screen.getByText('odoo:invoice')).toBeTruthy();
  });
});
