import { describe, expect, it } from 'vitest';
import {
  buildRotationEvent,
  checkSvidRotation,
  getCheckIntervalMs,
  validateRotatedSvid,
  type SvidCertInfo,
  type SvidCertReader,
  type SvidRotationConfig,
} from './svid-rotation.js';

const NOW_SEC = 1_700_000_000;
const clock = () => NOW_SEC;

const HEALTHY_CERT: SvidCertInfo = {
  spiffeId: 'spiffe://portarium.io/ns/portarium-agents/sa/agent-ocr/tenant/ws-1',
  expiresAtEpochSec: NOW_SEC + 3600, // 1 hour remaining
  fingerprint: 'sha256:aa11bb22',
};

const EXPIRING_CERT: SvidCertInfo = {
  ...HEALTHY_CERT,
  expiresAtEpochSec: NOW_SEC + 120, // 2 min remaining (within 5 min buffer)
};

const EXPIRED_CERT: SvidCertInfo = {
  ...HEALTHY_CERT,
  expiresAtEpochSec: NOW_SEC - 60, // expired 60s ago
};

function makeReader(cert: SvidCertInfo | undefined): SvidCertReader {
  return () => cert;
}

function baseConfig(overrides: Partial<SvidRotationConfig> = {}): SvidRotationConfig {
  return {
    svidCertPath: '/run/spire/certs/svid.pem',
    svidKeyPath: '/run/spire/certs/svid-key.pem',
    trustBundlePath: '/run/spire/certs/bundle.pem',
    nowEpochSec: clock,
    ...overrides,
  };
}

describe('checkSvidRotation', () => {
  it('returns "none" for healthy cert with plenty of time remaining', () => {
    const result = checkSvidRotation(baseConfig(), makeReader(HEALTHY_CERT));
    expect(result.action).toBe('none');
    expect(result.reason).toMatch(/healthy/i);
  });

  it('returns "rotate" when cert is within rotation buffer', () => {
    const result = checkSvidRotation(baseConfig(), makeReader(EXPIRING_CERT));
    expect(result.action).toBe('rotate');
    expect(result.reason).toMatch(/rotation buffer/i);
  });

  it('returns "rotate" when cert is already expired', () => {
    const result = checkSvidRotation(baseConfig(), makeReader(EXPIRED_CERT));
    expect(result.action).toBe('rotate');
    expect(result.reason).toMatch(/expired/i);
  });

  it('returns "error" when cert cannot be read', () => {
    const result = checkSvidRotation(baseConfig(), makeReader(undefined));
    expect(result.action).toBe('error');
    expect(result.reason).toMatch(/read/i);
  });

  it('respects custom rotation buffer', () => {
    const cert: SvidCertInfo = { ...HEALTHY_CERT, expiresAtEpochSec: NOW_SEC + 500 };
    // With default 300s buffer: 500s remaining → no rotation
    const result1 = checkSvidRotation(baseConfig(), makeReader(cert));
    expect(result1.action).toBe('none');

    // With 600s buffer: 500s remaining → rotate
    const result2 = checkSvidRotation(baseConfig({ rotationBufferSec: 600 }), makeReader(cert));
    expect(result2.action).toBe('rotate');
  });
});

describe('validateRotatedSvid', () => {
  it('accepts a valid rotated SVID with new fingerprint', () => {
    const newCert: SvidCertInfo = { ...HEALTHY_CERT, fingerprint: 'sha256:new-fp-001' };
    const result = validateRotatedSvid(baseConfig(), makeReader(newCert), 'sha256:old-fp-001');
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error('expected valid');
    expect(result.cert.fingerprint).toBe('sha256:new-fp-001');
  });

  it('rejects when cert cannot be read', () => {
    const result = validateRotatedSvid(baseConfig(), makeReader(undefined));
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    expect(result.reason).toMatch(/read/i);
  });

  it('rejects when SPIFFE ID is missing', () => {
    const badCert: SvidCertInfo = { ...HEALTHY_CERT, spiffeId: '' };
    const result = validateRotatedSvid(baseConfig(), makeReader(badCert));
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    expect(result.reason).toMatch(/SPIFFE ID/i);
  });

  it('rejects when SPIFFE ID does not start with spiffe://', () => {
    const badCert: SvidCertInfo = { ...HEALTHY_CERT, spiffeId: 'http://wrong' };
    const result = validateRotatedSvid(baseConfig(), makeReader(badCert));
    expect(result.valid).toBe(false);
  });

  it('rejects when rotated cert is already expired', () => {
    const result = validateRotatedSvid(baseConfig(), makeReader(EXPIRED_CERT));
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    expect(result.reason).toMatch(/expired/i);
  });

  it('rejects when fingerprint has not changed', () => {
    const result = validateRotatedSvid(
      baseConfig(),
      makeReader(HEALTHY_CERT),
      HEALTHY_CERT.fingerprint,
    );
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('expected invalid');
    expect(result.reason).toMatch(/same fingerprint/i);
  });

  it('accepts without previous fingerprint (first load)', () => {
    const result = validateRotatedSvid(baseConfig(), makeReader(HEALTHY_CERT));
    expect(result.valid).toBe(true);
  });
});

describe('buildRotationEvent', () => {
  it('builds svid_check_error for error results', () => {
    const event = buildRotationEvent({ action: 'error', reason: 'Cannot read file' }, baseConfig());
    expect(event.type).toBe('svid_check_error');
    expect(event.message).toBe('Cannot read file');
  });

  it('builds svid_expired for expired certs', () => {
    const result = checkSvidRotation(baseConfig(), makeReader(EXPIRED_CERT));
    const event = buildRotationEvent(result, baseConfig());
    expect(event.type).toBe('svid_expired');
    expect(event.remainingSec).toBe(0);
  });

  it('builds svid_expiring_soon for certs within buffer', () => {
    const result = checkSvidRotation(baseConfig(), makeReader(EXPIRING_CERT));
    const event = buildRotationEvent(result, baseConfig());
    expect(event.type).toBe('svid_expiring_soon');
    expect(event.remainingSec).toBe(120);
  });

  it('builds svid_rotated for healthy certs (status check)', () => {
    const result = checkSvidRotation(baseConfig(), makeReader(HEALTHY_CERT));
    const event = buildRotationEvent(result, baseConfig());
    expect(event.type).toBe('svid_rotated');
    expect(event.spiffeId).toContain('portarium.io');
  });
});

describe('getCheckIntervalMs', () => {
  it('returns default 60000ms', () => {
    expect(getCheckIntervalMs(baseConfig())).toBe(60_000);
  });

  it('respects custom interval', () => {
    expect(getCheckIntervalMs(baseConfig({ checkIntervalSec: 30 }))).toBe(30_000);
  });
});
