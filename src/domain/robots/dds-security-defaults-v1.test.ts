/**
 * Tests for DDS-Security defaults enforcement (no harden-later).
 *
 * Verifies that robotics gateway configurations are validated against
 * the secure-by-default policy defined in ADR-0103.
 *
 * Bead: bead-fv8i
 */

import { describe, expect, it } from 'vitest';
import {
  validateGatewaySecurityProfile,
  validateAllGatewaySecurityProfiles,
  validateSros2KeystoreConfig,
  isSecureTransport,
  isTransportSecurityMode,
  type GatewaySecurityProfile,
  type Sros2KeystoreConfig,
} from './dds-security-defaults-v1.js';

// ── isTransportSecurityMode ─────────────────────────────────────────────────

describe('isTransportSecurityMode', () => {
  it.each(['mTLS', 'TLS', 'SROS2', 'Insecure'])('accepts valid mode "%s"', (mode) => {
    expect(isTransportSecurityMode(mode)).toBe(true);
  });

  it.each(['plaintext', 'none', '', 'ssl'])('rejects invalid mode "%s"', (mode) => {
    expect(isTransportSecurityMode(mode)).toBe(false);
  });
});

// ── isSecureTransport ───────────────────────────────────────────────────────

describe('isSecureTransport', () => {
  it('considers mTLS secure', () => expect(isSecureTransport('mTLS')).toBe(true));
  it('considers TLS secure', () => expect(isSecureTransport('TLS')).toBe(true));
  it('considers SROS2 secure', () => expect(isSecureTransport('SROS2')).toBe(true));
  it('considers Insecure not secure', () => expect(isSecureTransport('Insecure')).toBe(false));
});

// ── validateGatewaySecurityProfile ──────────────────────────────────────────

describe('validateGatewaySecurityProfile', () => {
  describe('production mode (developmentMode=false)', () => {
    it('accepts gRPC gateway with mTLS', () => {
      const profile: GatewaySecurityProfile = {
        gatewayType: 'grpc',
        transportSecurity: 'mTLS',
        developmentMode: false,
      };
      expect(validateGatewaySecurityProfile(profile)).toEqual({ valid: true });
    });

    it('accepts MQTT gateway with TLS', () => {
      const profile: GatewaySecurityProfile = {
        gatewayType: 'mqtt',
        transportSecurity: 'TLS',
        developmentMode: false,
      };
      expect(validateGatewaySecurityProfile(profile)).toEqual({ valid: true });
    });

    it('accepts ROS 2 bridge with SROS2', () => {
      const profile: GatewaySecurityProfile = {
        gatewayType: 'ros2-bridge',
        transportSecurity: 'SROS2',
        developmentMode: false,
      };
      expect(validateGatewaySecurityProfile(profile)).toEqual({ valid: true });
    });

    it('rejects insecure gRPC gateway in production', () => {
      const profile: GatewaySecurityProfile = {
        gatewayType: 'grpc',
        transportSecurity: 'Insecure',
        developmentMode: false,
      };
      const result = validateGatewaySecurityProfile(profile);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Gateway 'grpc'");
        expect(result.reason).toContain('Insecure');
        expect(result.reason).toContain('developmentMode');
      }
    });

    it('rejects insecure MQTT gateway in production', () => {
      const profile: GatewaySecurityProfile = {
        gatewayType: 'mqtt',
        transportSecurity: 'Insecure',
        developmentMode: false,
      };
      const result = validateGatewaySecurityProfile(profile);
      expect(result.valid).toBe(false);
    });

    it('rejects ROS 2 bridge with plain TLS in production (requires SROS2)', () => {
      const profile: GatewaySecurityProfile = {
        gatewayType: 'ros2-bridge',
        transportSecurity: 'TLS',
        developmentMode: false,
      };
      const result = validateGatewaySecurityProfile(profile);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('SROS2');
        expect(result.reason).toContain('DDS');
      }
    });

    it('rejects ROS 2 bridge with mTLS in production (requires SROS2)', () => {
      const profile: GatewaySecurityProfile = {
        gatewayType: 'ros2-bridge',
        transportSecurity: 'mTLS',
        developmentMode: false,
      };
      const result = validateGatewaySecurityProfile(profile);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('SROS2');
      }
    });
  });

  describe('development mode (developmentMode=true)', () => {
    it('allows insecure gRPC in development mode', () => {
      const profile: GatewaySecurityProfile = {
        gatewayType: 'grpc',
        transportSecurity: 'Insecure',
        developmentMode: true,
      };
      expect(validateGatewaySecurityProfile(profile)).toEqual({ valid: true });
    });

    it('allows insecure MQTT in development mode', () => {
      const profile: GatewaySecurityProfile = {
        gatewayType: 'mqtt',
        transportSecurity: 'Insecure',
        developmentMode: true,
      };
      expect(validateGatewaySecurityProfile(profile)).toEqual({ valid: true });
    });

    it('allows insecure ROS 2 bridge in development mode', () => {
      const profile: GatewaySecurityProfile = {
        gatewayType: 'ros2-bridge',
        transportSecurity: 'Insecure',
        developmentMode: true,
      };
      expect(validateGatewaySecurityProfile(profile)).toEqual({ valid: true });
    });

    it('still accepts secure transport in development mode', () => {
      const profile: GatewaySecurityProfile = {
        gatewayType: 'grpc',
        transportSecurity: 'mTLS',
        developmentMode: true,
      };
      expect(validateGatewaySecurityProfile(profile)).toEqual({ valid: true });
    });
  });
});

// ── validateAllGatewaySecurityProfiles ───────────────────────────────────────

describe('validateAllGatewaySecurityProfiles', () => {
  it('passes when all profiles are valid', () => {
    const profiles: GatewaySecurityProfile[] = [
      { gatewayType: 'grpc', transportSecurity: 'mTLS', developmentMode: false },
      { gatewayType: 'mqtt', transportSecurity: 'TLS', developmentMode: false },
      { gatewayType: 'ros2-bridge', transportSecurity: 'SROS2', developmentMode: false },
    ];
    expect(validateAllGatewaySecurityProfiles(profiles)).toEqual({ valid: true });
  });

  it('fails on first invalid profile', () => {
    const profiles: GatewaySecurityProfile[] = [
      { gatewayType: 'grpc', transportSecurity: 'mTLS', developmentMode: false },
      { gatewayType: 'mqtt', transportSecurity: 'Insecure', developmentMode: false },
      { gatewayType: 'ros2-bridge', transportSecurity: 'SROS2', developmentMode: false },
    ];
    const result = validateAllGatewaySecurityProfiles(profiles);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('mqtt');
    }
  });

  it('passes for empty array', () => {
    expect(validateAllGatewaySecurityProfiles([])).toEqual({ valid: true });
  });
});

// ── validateSros2KeystoreConfig ─────────────────────────────────────────────

describe('validateSros2KeystoreConfig', () => {
  const validConfig: Sros2KeystoreConfig = {
    keystorePath: '/etc/portarium/sros2_keystore',
    domainId: 42,
    enclaveName: 'portarium_bridge',
    certTtlDays: 90,
    renewalLeadDays: 30,
  };

  it('accepts a valid SROS2 keystore configuration', () => {
    expect(validateSros2KeystoreConfig(validConfig)).toEqual({ valid: true });
  });

  it('rejects empty keystorePath', () => {
    const result = validateSros2KeystoreConfig({ ...validConfig, keystorePath: '' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('keystorePath');
  });

  it('rejects whitespace-only keystorePath', () => {
    const result = validateSros2KeystoreConfig({ ...validConfig, keystorePath: '   ' });
    expect(result.valid).toBe(false);
  });

  it('rejects negative domainId', () => {
    const result = validateSros2KeystoreConfig({ ...validConfig, domainId: -1 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('domainId');
  });

  it('rejects domainId > 232', () => {
    const result = validateSros2KeystoreConfig({ ...validConfig, domainId: 300 });
    expect(result.valid).toBe(false);
  });

  it('rejects non-integer domainId', () => {
    const result = validateSros2KeystoreConfig({ ...validConfig, domainId: 42.5 });
    expect(result.valid).toBe(false);
  });

  it('rejects empty enclaveName', () => {
    const result = validateSros2KeystoreConfig({ ...validConfig, enclaveName: '' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('enclaveName');
  });

  it('rejects certTtlDays <= 0', () => {
    const result = validateSros2KeystoreConfig({ ...validConfig, certTtlDays: 0 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('certTtlDays');
  });

  it('rejects renewalLeadDays >= certTtlDays', () => {
    const result = validateSros2KeystoreConfig({ ...validConfig, renewalLeadDays: 90 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toContain('renewalLeadDays');
  });

  it('rejects negative renewalLeadDays', () => {
    const result = validateSros2KeystoreConfig({ ...validConfig, renewalLeadDays: -1 });
    expect(result.valid).toBe(false);
  });

  it('accepts edge case: domainId=0', () => {
    expect(validateSros2KeystoreConfig({ ...validConfig, domainId: 0 })).toEqual({ valid: true });
  });

  it('accepts edge case: renewalLeadDays=0 (no auto-renewal)', () => {
    expect(validateSros2KeystoreConfig({ ...validConfig, renewalLeadDays: 0 })).toEqual({
      valid: true,
    });
  });
});
