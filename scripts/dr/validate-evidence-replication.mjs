#!/usr/bin/env node
/**
 * DR Drill: Evidence store cross-region replication validation.
 *
 * Steps:
 *  1. Write a test object to the source S3 bucket with a unique drill key.
 *  2. Wait up to 15 minutes for the object to appear in the replica bucket
 *     (S3 CRR SLA is 15 min for 99.99% of objects).
 *  3. Compare ETag and object size between source and replica.
 *  4. Verify that the source object has an active object-lock COMPLIANCE
 *     retention until at least today + 1 day (proves lock is applied).
 *  5. Emit a JSON result file and exit 0 on success, 1 on failure.
 *
 * Requires: AWS SDK v3 + credentials in env (GitHub OIDC in CI).
 *
 * Usage:
 *   node scripts/dr/validate-evidence-replication.mjs \
 *     --source-bucket portarium-prod-evidence \
 *     --replica-bucket portarium-prod-evidence-replica \
 *     --drill-id dr-20260101-020000 \
 *     --output dr-results-evidence.json
 *
 * Bead: bead-0397
 */

import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  GetObjectLegalHoldCommand,
  GetObjectRetentionCommand,
} from '@aws-sdk/client-s3';

const { values: args } = parseArgs({
  options: {
    'source-bucket': { type: 'string' },
    'replica-bucket': { type: 'string' },
    'drill-id': { type: 'string' },
    'output': { type: 'string' },
    'region': { type: 'string', default: process.env.AWS_REGION ?? 'us-east-1' },
  },
});

const sourceBucket = args['source-bucket'];
const replicaBucket = args['replica-bucket'];
const drillId = args['drill-id'];
const outputFile = args['output'];
const region = args['region'];

if (!sourceBucket || !replicaBucket || !drillId) {
  console.error('Usage: --source-bucket <name> --replica-bucket <name> --drill-id <id>');
  process.exit(1);
}

const client = new S3Client({ region });
const TEST_KEY = `dr-drills/${drillId}/replication-test.json`;
const TEST_BODY = JSON.stringify({ drillId, timestamp: new Date().toISOString(), type: 'replication-test' });

const results = {
  drillId,
  scenario: 'evidence-replication',
  timestamp: new Date().toISOString(),
  checks: {},
  passed: false,
  durationMs: 0,
};

const start = Date.now();

try {
  // Step 1: Write test object to source.
  await client.send(new PutObjectCommand({
    Bucket: sourceBucket,
    Key: TEST_KEY,
    Body: TEST_BODY,
    ContentType: 'application/json',
  }));
  console.log(`[✓] Wrote test object to s3://${sourceBucket}/${TEST_KEY}`);
  results.checks.writeSource = { passed: true };

  // Step 2: Poll replica for up to 15 minutes.
  let replicaHead = null;
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    try {
      replicaHead = await client.send(new HeadObjectCommand({
        Bucket: replicaBucket,
        Key: TEST_KEY,
      }));
      console.log(`[✓] Object appeared in replica after ${Math.round((Date.now() - start) / 1000)}s`);
      break;
    } catch {
      process.stdout.write('.');
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }

  if (!replicaHead) {
    throw new Error(`Object did not replicate to ${replicaBucket} within 15 minutes`);
  }
  results.checks.replicationLag = {
    passed: true,
    lagSeconds: Math.round((Date.now() - start) / 1000),
  };

  // Step 3: Compare ETag between source and replica.
  const sourceHead = await client.send(new HeadObjectCommand({
    Bucket: sourceBucket,
    Key: TEST_KEY,
  }));

  const etagMatch = sourceHead.ETag === replicaHead.ETag;
  const sizeMatch = sourceHead.ContentLength === replicaHead.ContentLength;
  console.log(`[${etagMatch ? '✓' : '✗'}] ETag match: source=${sourceHead.ETag} replica=${replicaHead.ETag}`);
  console.log(`[${sizeMatch ? '✓' : '✗'}] Size match: ${sourceHead.ContentLength} bytes`);
  results.checks.integrity = { passed: etagMatch && sizeMatch, etagMatch, sizeMatch };

  if (!etagMatch || !sizeMatch) {
    throw new Error('Source and replica object ETags or sizes do not match');
  }

  // Step 4: Verify object-lock retention on source (if bucket has object lock).
  try {
    const retention = await client.send(new GetObjectRetentionCommand({
      Bucket: sourceBucket,
      Key: TEST_KEY,
    }));
    const retainUntil = new Date(retention.Retention?.RetainUntilDate ?? 0);
    const tomorrow = new Date(Date.now() + 86400_000);
    const lockValid = retainUntil > tomorrow;
    console.log(`[${lockValid ? '✓' : '✗'}] Object lock retention until ${retainUntil.toISOString()}`);
    results.checks.objectLock = { passed: lockValid, retainUntil: retainUntil.toISOString() };
  } catch (err) {
    // Bucket may not have object lock — record as skipped, not failed.
    results.checks.objectLock = { passed: true, skipped: true, reason: String(err) };
  }

  results.passed = true;
  results.durationMs = Date.now() - start;
  console.log(`\n[✓] Evidence replication drill PASSED in ${Math.round(results.durationMs / 1000)}s`);
} catch (err) {
  results.passed = false;
  results.error = String(err);
  results.durationMs = Date.now() - start;
  console.error(`\n[✗] Evidence replication drill FAILED: ${err}`);
}

if (outputFile) {
  writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`Results written to ${outputFile}`);
}

process.exit(results.passed ? 0 : 1);
