import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const abModule = await import(pathToFileURL(resolve(ROOT, 'scripts/ab.mjs')).href);

const tempDirs: string[] = [];

function tempFile(relativePath: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'portarium-ab-'));
  tempDirs.push(dir);
  const filePath = join(dir, relativePath);
  writeFileSync(filePath, '');
  return filePath;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('agent-browser wrapper', () => {
  it('resolves daemon.js from an explicit host override', () => {
    const daemonJs = tempFile('daemon.js');

    expect(
      abModule.findDaemonJs({
        env: { AGENT_BROWSER_DAEMON_JS: daemonJs },
        cwd: ROOT,
      }),
    ).toBe(daemonJs);
  });

  it('includes Windows global npm agent-browser locations in daemon candidates', () => {
    const appData = resolve('C:/Users/example/AppData/Roaming');
    const candidates = abModule.daemonCandidates({
      env: { APPDATA: appData },
      cwd: ROOT,
    }) as string[];

    expect(candidates).toContain(
      join(appData, 'npm', 'node_modules', 'agent-browser', 'dist', 'daemon.js'),
    );
  });

  it('resolves Chrome from explicit host overrides before platform defaults', () => {
    const chromeExe = tempFile('chrome.exe');

    expect(
      abModule.findBrowserExecutable({
        env: { AGENT_BROWSER_CHROME_EXECUTABLE: chromeExe },
      }),
    ).toBe(chromeExe);
  });

  it('parses mobile viewport and browser executable flags for open commands', () => {
    const [launch, navigate] = abModule.parseArgs([
      'open',
      'http://cockpit.localhost:1355',
      '--headed',
      '--viewport',
      '390x844',
      '--chrome-path',
      'C:/Chrome/chrome.exe',
    ]) as Record<string, unknown>[];

    expect(launch).toMatchObject({
      action: 'launch',
      headless: false,
      viewport: { width: 390, height: 844 },
      executablePath: 'C:/Chrome/chrome.exe',
    });
    expect(navigate).toMatchObject({
      action: 'navigate',
      url: 'http://cockpit.localhost:1355',
    });
  });
});
