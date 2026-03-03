/**
 * H6: Filesystem Watch — Plugin
 *
 * Exports `waitForApproval(approvalId, watchDir)` which uses `fs.watch()`
 * to resolve when `{id}.approved` or `{id}.denied` appears.
 * Default timeout: 30 seconds.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Wait for an approval decision to appear on the filesystem.
 *
 * @param {string} approvalId  — UUID of the pending approval
 * @param {string} watchDir    — directory to watch for decision files
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ approved: boolean; approvalId: string; elapsed: number }>}
 */
export function waitForApproval(approvalId, watchDir, { timeoutMs = 30_000 } = {}) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const approvedFile = path.join(watchDir, `${approvalId}.approved`);
    const deniedFile = path.join(watchDir, `${approvalId}.denied`);

    let settled = false;

    const finish = (approved, watcher, timer) => {
      if (settled) return;
      settled = true;
      watcher.close();
      clearTimeout(timer);
      const elapsed = Date.now() - start;
      resolve({ approved, approvalId, elapsed });
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      watcher.close();
      reject(new Error(`waitForApproval timed out after ${timeoutMs}ms (id: ${approvalId})`));
    }, timeoutMs);

    // Ensure the directory exists before watching
    if (!fs.existsSync(watchDir)) {
      fs.mkdirSync(watchDir, { recursive: true });
    }

    const watcher = fs.watch(watchDir, (eventType, filename) => {
      if (settled || !filename) return;

      if (filename === `${approvalId}.approved`) {
        finish(true, watcher, timer);
      } else if (filename === `${approvalId}.denied`) {
        finish(false, watcher, timer);
      }
    });

    // Check if files already exist (race condition guard)
    setTimeout(() => {
      if (settled) return;
      if (fs.existsSync(approvedFile)) {
        finish(true, watcher, timer);
      } else if (fs.existsSync(deniedFile)) {
        finish(false, watcher, timer);
      }
    }, 10);
  });
}
