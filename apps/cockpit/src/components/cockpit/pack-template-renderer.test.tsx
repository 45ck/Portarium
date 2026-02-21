// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PackTemplateRenderer } from './pack-template-renderer';
import { SCM_CHANGE_REQUEST_TEMPLATE } from '@/mocks/fixtures/pack-ui-runtime';

describe('PackTemplateRenderer', () => {
  it('renders schema-driven fields with accessible labels and responsive layout classes', () => {
    const { container } = render(<PackTemplateRenderer template={SCM_CHANGE_REQUEST_TEMPLATE} />);

    expect(screen.getByLabelText('Change type')).toBeTruthy();
    expect(screen.getByLabelText('Rollback plan reference')).toBeTruthy();
    expect(screen.getByLabelText('Evidence bundle reference')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeTruthy();

    const form = container.querySelector('form');
    expect(form?.className).toContain('grid-cols-1');
    expect(form?.className).toContain('md:grid-cols-2');
  });
});
