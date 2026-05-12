// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GSLR_STATIC_ENGINEERING_EVIDENCE_CARD_EXPORTS } from './gslr-static-evidence-card-fixtures';
import { GslrStaticEvidenceCardView } from './gslr-static-evidence-card-view';

afterEach(() => {
  cleanup();
});

describe('GslrStaticEvidenceCardView', () => {
  it('renders promoted and blocked GSLR fixture cards without action controls', () => {
    render(<GslrStaticEvidenceCardView cards={GSLR_STATIC_ENGINEERING_EVIDENCE_CARD_EXPORTS} />);

    expect(screen.getByText('Fixture-backed Cockpit proof')).toBeTruthy();
    expect(screen.getByText('gslr8-route-record-compiler')).toBeTruthy();
    expect(screen.getByText('gslr7-scaffolded-route-record')).toBeTruthy();
    expect(screen.getByText('Route: local-screen via local-only')).toBeTruthy();
    expect(screen.getByText('Route: frontier-baseline via local-only')).toBeTruthy();
    expect(screen.getByText('Boundary: research-only')).toBeTruthy();
    expect(screen.getByText('Boundary: blocked')).toBeTruthy();
    expect(
      screen.getAllByText('No live prompt-language manifest ingestion is implied by this export.'),
    ).toHaveLength(2);
    expect(
      screen.getAllByText(
        'No MacquarieCollege connector observation, source-system read, write, or raw data movement is authorized.',
      ),
    ).toHaveLength(2);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
