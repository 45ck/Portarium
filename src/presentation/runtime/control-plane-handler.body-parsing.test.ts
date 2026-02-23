import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';

import { PayloadTooLargeError, readJsonBody } from './control-plane-handler.shared.js';

/**
 * Create a fake IncomingMessage-like readable stream from a Buffer or string.
 */
function fakeReq(body: string | Buffer): IncomingMessage {
  const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
  const stream = new Readable({
    read() {
      this.push(buf);
      this.push(null);
    },
  });
  return stream as unknown as IncomingMessage;
}

function emptyReq(): IncomingMessage {
  const stream = new Readable({
    read() {
      this.push(null);
    },
  });
  return stream as unknown as IncomingMessage;
}

// ---------------------------------------------------------------------------
// readJsonBody — existing behaviour preserved
// ---------------------------------------------------------------------------

describe('readJsonBody', () => {
  it('parses valid JSON', async () => {
    const body = await readJsonBody(fakeReq('{"key":"value"}'));
    expect(body).toEqual({ key: 'value' });
  });

  it('returns null for empty body', async () => {
    const body = await readJsonBody(emptyReq());
    expect(body).toBeNull();
  });

  it('returns null for whitespace-only body', async () => {
    const body = await readJsonBody(fakeReq('   '));
    expect(body).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    const body = await readJsonBody(fakeReq('not json'));
    expect(body).toBeNull();
  });

  it('parses arrays', async () => {
    const body = await readJsonBody(fakeReq('[1,2,3]'));
    expect(body).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// Body size limit enforcement
// ---------------------------------------------------------------------------

describe('readJsonBody size limit', () => {
  it('accepts a body within the limit', async () => {
    const payload = JSON.stringify({ data: 'x'.repeat(100) });
    const body = await readJsonBody(fakeReq(payload), 1024);
    expect(body).toEqual({ data: 'x'.repeat(100) });
  });

  it('throws PayloadTooLargeError when body exceeds limit', async () => {
    const payload = JSON.stringify({ data: 'x'.repeat(200) });
    await expect(readJsonBody(fakeReq(payload), 50)).rejects.toThrow(PayloadTooLargeError);
  });

  it('PayloadTooLargeError includes maxBytes', async () => {
    const payload = 'x'.repeat(100);
    try {
      await readJsonBody(fakeReq(payload), 50);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PayloadTooLargeError);
      expect((err as PayloadTooLargeError).maxBytes).toBe(50);
    }
  });

  it('accepts body exactly at the limit', async () => {
    const payload = '{"a":1}'; // 7 bytes
    const body = await readJsonBody(fakeReq(payload), 7);
    expect(body).toEqual({ a: 1 });
  });

  it('rejects body one byte over the limit', async () => {
    const payload = '{"a":1}'; // 7 bytes
    await expect(readJsonBody(fakeReq(payload), 6)).rejects.toThrow(PayloadTooLargeError);
  });

  it('uses default limit (1 MiB) when no limit specified', async () => {
    // A body under 1 MiB should succeed with default limit
    const payload = JSON.stringify({ data: 'x'.repeat(1000) });
    const body = await readJsonBody(fakeReq(payload));
    expect(body).toHaveProperty('data');
  });

  it('rejects multi-chunk bodies that cumulatively exceed the limit', async () => {
    // Create a stream that sends multiple small chunks
    const chunkSize = 30;
    const numChunks = 5; // 150 bytes total
    const limit = 100;
    let chunksSent = 0;

    const stream = new Readable({
      read() {
        if (chunksSent < numChunks) {
          this.push(Buffer.alloc(chunkSize, 0x41)); // 'A' bytes
          chunksSent++;
        } else {
          this.push(null);
        }
      },
    });

    await expect(readJsonBody(stream as unknown as IncomingMessage, limit)).rejects.toThrow(
      PayloadTooLargeError,
    );
  });
});

// ---------------------------------------------------------------------------
// PayloadTooLargeError class
// ---------------------------------------------------------------------------

describe('PayloadTooLargeError', () => {
  it('has correct name', () => {
    const err = new PayloadTooLargeError(1024);
    expect(err.name).toBe('PayloadTooLargeError');
  });

  it('includes limit in message', () => {
    const err = new PayloadTooLargeError(1024);
    expect(err.message).toContain('1024');
  });

  it('is an instance of Error', () => {
    const err = new PayloadTooLargeError(1024);
    expect(err).toBeInstanceOf(Error);
  });
});
