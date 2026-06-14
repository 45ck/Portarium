import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EntityIcon } from '@/components/domain/entity-icon';
import { EntityImage } from '@/components/domain/entity-image';

describe('EntityIcon', () => {
  it('renders a crisp UI symbol for known domain entities', () => {
    const html = renderToStaticMarkup(<EntityIcon entityType="robot" />);
    expect(html).toContain('svg');
    expect(html).not.toContain('/assets/icons/domain/robot-ground.png');
  });

  it('renders canonical object symbols without generated PNG assets', () => {
    const html = renderToStaticMarkup(<EntityIcon entityType="party" />);
    expect(html).toContain('svg');
    expect(html).not.toContain('/assets/icons/domain/party.png');
  });

  it('falls back to lucide icon for unknown entity type mapping', () => {
    const html = renderToStaticMarkup(<EntityIcon entityType={'other' as never} />);
    expect(html).toContain('svg');
  });
});

describe('EntityImage', () => {
  it('renders known entity images', () => {
    const html = renderToStaticMarkup(<EntityImage entityId="robot-ground-alpha" />);
    expect(html).toContain('img');
    expect(html).toContain('/assets/images/robots/robot-ground-alpha.png');
  });

  it('falls back to icon placeholder when image id is missing', () => {
    const html = renderToStaticMarkup(<EntityImage entityId="agent-missing" />);
    expect(html).toContain('placeholder');
    expect(html).toContain('svg');
  });
});
