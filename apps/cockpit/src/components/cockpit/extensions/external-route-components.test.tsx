import { describe, expect, it } from 'vitest';
import { INSTALLED_COCKPIT_ROUTE_LOADERS } from '@/lib/extensions/installed';
import { HOSTED_EXTERNAL_ROUTE_COMPONENTS } from './external-route-components';

describe('hosted external route components', () => {
  it('builds hosted route components only from the compile-time installed module catalog', () => {
    expect(Object.keys(HOSTED_EXTERNAL_ROUTE_COMPONENTS).sort()).toEqual(
      Object.keys(INSTALLED_COCKPIT_ROUTE_LOADERS).sort(),
    );
    expect(HOSTED_EXTERNAL_ROUTE_COMPONENTS).not.toHaveProperty('remote-extension-route');
  });
});
