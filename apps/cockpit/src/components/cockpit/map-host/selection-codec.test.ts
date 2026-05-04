import { describe, expect, it } from 'vitest';
import { decodeMapHostSelection, encodeMapHostSelection } from './selection-codec';

describe('map host selection codec', () => {
  it('round-trips a typed selection', () => {
    const encoded = encodeMapHostSelection({ kind: 'asset', id: 'unit 1' });

    expect(encoded).toBe('asset:unit%201');
    expect(decodeMapHostSelection(encoded, ['asset'])).toEqual({
      kind: 'asset',
      id: 'unit 1',
    });
  });

  it('rejects empty, malformed, and disallowed selections', () => {
    expect(decodeMapHostSelection('')).toBeNull();
    expect(decodeMapHostSelection('asset')).toBeNull();
    expect(decodeMapHostSelection('asset:')).toBeNull();
    expect(decodeMapHostSelection('%:item')).toBeNull();
    expect(decodeMapHostSelection('zone:item', ['asset'])).toBeNull();
  });
});
