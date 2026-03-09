import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

describe('prepare-release', () => {
  describe('version bump logic (dry-run)', () => {
    it('computes patch bump correctly', () => {
      const output = execSync('node scripts/release/prepare-release.mjs --dry-run patch', {
        cwd: ROOT,
        encoding: 'utf-8',
      });
      expect(output).toMatch(/→.*\d+\.\d+\.\d+/);
      expect(output).toMatch(/\(patch\)/);
      expect(output).toContain('[dry-run]');
    });

    it('computes minor bump correctly', () => {
      const output = execSync('node scripts/release/prepare-release.mjs --dry-run minor', {
        cwd: ROOT,
        encoding: 'utf-8',
      });
      expect(output).toMatch(/→.*\d+\.\d+\.0/);
      expect(output).toMatch(/\(minor\)/);
      expect(output).toContain('[dry-run]');
    });

    it('computes major bump correctly', () => {
      const output = execSync('node scripts/release/prepare-release.mjs --dry-run major', {
        cwd: ROOT,
        encoding: 'utf-8',
      });
      expect(output).toMatch(/→.*\d+\.0\.0/);
      expect(output).toMatch(/\(major\)/);
      expect(output).toContain('[dry-run]');
    });

    it('rejects missing bump type', () => {
      expect(() =>
        execSync('node scripts/release/prepare-release.mjs --dry-run', {
          cwd: ROOT,
          encoding: 'utf-8',
          stdio: 'pipe',
        }),
      ).toThrow();
    });
  });

  describe('changelog collection (dry-run)', () => {
    it('includes changelog entries in dry-run output', () => {
      const output = execSync('node scripts/release/prepare-release.mjs --dry-run patch', {
        cwd: ROOT,
        encoding: 'utf-8',
      });
      // Should show either changelog entries or "No changelog entries"
      expect(output.includes('Changelog entries:') || output.includes('No changelog entries')).toBe(
        true,
      );
    });
  });

  describe('collect-changelog CLI', () => {
    it('runs without error in markdown mode', () => {
      const output = execSync('node scripts/release/collect-changelog.mjs', {
        cwd: ROOT,
        encoding: 'utf-8',
      });
      expect(typeof output).toBe('string');
    });

    it('runs without error in JSON mode', () => {
      const output = execSync('node scripts/release/collect-changelog.mjs --json', {
        cwd: ROOT,
        encoding: 'utf-8',
      });
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('categories');
      expect(parsed).toHaveProperty('since');
    });
  });
});
