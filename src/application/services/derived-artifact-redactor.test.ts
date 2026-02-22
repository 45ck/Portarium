import { describe, expect, it } from 'vitest';

import { redactEvidenceText, redactMetadata } from './derived-artifact-redactor.js';

describe('redactEvidenceText', () => {
  it('redacts Bearer tokens', () => {
    // cspell:disable-next-line
    const text = 'Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.sig';
    expect(redactEvidenceText(text)).toBe('Authorization: Bearer [REDACTED]');
  });

  it('redacts Basic auth tokens', () => {
    // cspell:disable-next-line
    const text = 'Authorization: Basic dXNlcjpwYXNzd29yZA==';
    expect(redactEvidenceText(text)).toBe('Authorization: Basic [REDACTED]');
  });

  it('redacts AWS access key IDs', () => {
    const text = 'key_id=AKIAIOSFODNN7EXAMPLE and other text';
    expect(redactEvidenceText(text)).toContain('[REDACTED-AWS-KEY]');
    expect(redactEvidenceText(text)).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('redacts PEM private key blocks', () => {
    const pem =
      '-----BEGIN RSA PRIVATE KEY-----\nABCDEFGHIJKL1234==\n-----END RSA PRIVATE KEY-----';
    const result = redactEvidenceText(`Deploy key: ${pem}`);
    expect(result).toContain('[REDACTED-PRIVATE-KEY]');
    expect(result).not.toContain('PRIVATE KEY'); // content was replaced
  });

  it('redacts URL credentials (user:password@host)', () => {
    // cspell:disable-next-line
    const text = 'Connect to postgres://admin:p4ssw0rd@db.internal:5432/appdb';
    const result = redactEvidenceText(text);
    expect(result).toContain('[REDACTED]');
    // cspell:disable-next-line
    expect(result).not.toContain('p4ssw0rd');
  });

  it('redacts GitHub PATs (ghp_ prefix)', () => {
    const text = 'token=ghp_16C7e42F292c6912E7710c838347Ae178B4a';
    const result = redactEvidenceText(text);
    expect(result).toContain('[REDACTED-GH-TOKEN]');
    expect(result).not.toContain('ghp_16C7e42F292c6912E7710c838347Ae178B4a');
  });

  it('redacts generic api_key assignments', () => {
    const text = 'api_key = "sk-prod-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"';
    const result = redactEvidenceText(text);
    expect(result).toContain('[REDACTED-API-KEY]');
  });

  it('leaves safe text unchanged', () => {
    const text = 'Deployment approved. Service version 2.4.1 rolled out to production.';
    expect(redactEvidenceText(text)).toBe(text);
  });

  it('is idempotent — re-applying produces the same result', () => {
    const text = 'token: Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.sig';
    const once = redactEvidenceText(text);
    const twice = redactEvidenceText(once);
    expect(twice).toBe(once);
  });
});

describe('redactMetadata', () => {
  it('redacts values for keys matching sensitive patterns', () => {
    const meta = {
      authorization: 'Bearer abc123',
      token: 'sk-secret-value',
      secret: 'my-secret',
      password: 'hunter2',
      api_key: 'key-value',
      credential: 'cred-value',
    };
    const result = redactMetadata(meta);
    expect(result['authorization']).toBe('[REDACTED]');
    expect(result['token']).toBe('[REDACTED]');
    expect(result['secret']).toBe('[REDACTED]');
    expect(result['password']).toBe('[REDACTED]');
    expect(result['api_key']).toBe('[REDACTED]');
    expect(result['credential']).toBe('[REDACTED]');
  });

  it('preserves safe keys', () => {
    const meta = { workspaceId: 'ws-1', runId: 'run-1', category: 'Approval', count: 42 };
    const result = redactMetadata(meta);
    expect(result).toEqual(meta);
  });

  it('recursively redacts nested sensitive keys', () => {
    const meta = {
      context: {
        auth: { token: 'nested-secret', userId: 'user-1' },
        name: 'deployment',
      },
    };
    const result = redactMetadata(meta) as { context: { auth: { token: string; userId: string } } };
    expect(result.context.auth.token).toBe('[REDACTED]');
    expect(result.context.auth.userId).toBe('user-1');
  });

  it('handles arrays within metadata', () => {
    const meta = { tags: ['production', 'approved'], tokens: ['tok1', 'tok2'] };
    const result = redactMetadata(meta);
    // 'tokens' key matches sensitive pattern → value redacted
    expect(result['tokens']).toBe('[REDACTED]');
    // 'tags' is safe
    expect(result['tags']).toEqual(['production', 'approved']);
  });

  it('does not mutate the input object', () => {
    const meta = { password: 'original', name: 'test' };
    redactMetadata(meta);
    expect(meta.password).toBe('original');
  });

  it('handles empty metadata', () => {
    expect(redactMetadata({})).toEqual({});
  });
});
