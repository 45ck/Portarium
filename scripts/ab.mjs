#!/usr/bin/env node
/**
 * ab.mjs — Pure Node.js CLI for agent-browser (bypasses Rust binary).
 *
 * On Windows Enterprise machines AppLocker blocks the unsigned Rust CLI.
 * This wrapper speaks the same TCP protocol to the daemon.
 *
 * Usage (same as agent-browser):
 *   node scripts/ab.mjs open https://localhost:5173 --headed
 *   node scripts/ab.mjs snapshot -i
 *   node scripts/ab.mjs click @e2
 *   node scripts/ab.mjs screenshot ./shot.png
 *   node scripts/ab.mjs close
 */

import * as net from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Daemon discovery (must match daemon.js logic)
// ---------------------------------------------------------------------------

function getAppDir() {
  if (process.env.XDG_RUNTIME_DIR) return path.join(process.env.XDG_RUNTIME_DIR, 'agent-browser');
  const home = os.homedir();
  if (home) return path.join(home, '.agent-browser');
  return path.join(os.tmpdir(), 'agent-browser');
}

function getSocketDir() {
  return process.env.AGENT_BROWSER_SOCKET_DIR ?? getAppDir();
}

const SESSION = process.env.AGENT_BROWSER_SESSION || 'default';

function portForSession(session) {
  let hash = 0;
  for (let i = 0; i < session.length; i++) {
    hash = (hash << 5) - hash + session.charCodeAt(i);
    hash |= 0;
  }
  return 49152 + (Math.abs(hash) % 16383);
}

function getPidFile() {
  return path.join(getSocketDir(), `${SESSION}.pid`);
}

function isDaemonRunning() {
  const pf = getPidFile();
  if (!fs.existsSync(pf)) return false;
  try {
    const pid = parseInt(fs.readFileSync(pf, 'utf8').trim(), 10);
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Resolve daemon.js from the globally-installed agent-browser package. */
function findDaemonJs() {
  // Try the global npm prefix first
  const candidates = [];
  const npmGlobal = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'npm', 'node_modules', 'agent-browser', 'dist', 'daemon.js')
    : null;
  if (npmGlobal) candidates.push(npmGlobal);

  // Also try relative to this script (in case agent-browser was installed locally)
  candidates.push(path.resolve('node_modules', 'agent-browser', 'dist', 'daemon.js'));

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function ensureDaemon() {
  if (isDaemonRunning()) return;

  const daemonJs = findDaemonJs();
  if (!daemonJs) {
    console.error('Error: cannot find agent-browser daemon.js');
    process.exit(1);
  }

  const dir = getSocketDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const env = { ...process.env, AGENT_BROWSER_SESSION: SESSION };
  const child = spawn(process.execPath, [daemonJs], {
    stdio: 'ignore',
    detached: true,
    env,
  });
  child.unref();

  // Wait for PID file (up to 8 s)
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (isDaemonRunning()) return;
  }
  console.error('Error: daemon did not start in time');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// TCP send / receive
// ---------------------------------------------------------------------------

function sendCommand(cmd) {
  return new Promise((resolve, reject) => {
    const port = portForSession(SESSION);
    const sock = net.createConnection({ port, host: '127.0.0.1' }, () => {
      sock.write(JSON.stringify(cmd) + '\n');
    });
    let buf = '';
    sock.on('data', (d) => {
      buf += d.toString();
      const idx = buf.indexOf('\n');
      if (idx !== -1) {
        const json = buf.slice(0, idx);
        sock.destroy();
        try {
          resolve(JSON.parse(json));
        } catch {
          resolve({ success: false, error: 'Bad JSON' });
        }
      }
    });
    sock.on('error', (err) => reject(err));
    sock.on('close', () => {
      if (buf && !buf.includes('\n')) {
        try {
          resolve(JSON.parse(buf));
        } catch {
          reject(new Error('Incomplete response'));
        }
      }
    });
  });
}

// ---------------------------------------------------------------------------
// CLI → JSON command translation
// ---------------------------------------------------------------------------

function id() {
  return randomUUID().slice(0, 8);
}

function parseArgs(argv) {
  // argv = everything after `node scripts/ab.mjs`
  const cmd = argv[0];
  const rest = argv.slice(1);

  // Helpers
  const flag = (f) => rest.includes(f);
  const flagVal = (f) => {
    const i = rest.indexOf(f);
    return i >= 0 && i + 1 < rest.length ? rest[i + 1] : null;
  };
  const positional = () =>
    rest.filter(
      (a) => !a.startsWith('-') && !rest.some((f, i) => f.startsWith('-') && rest[i + 1] === a),
    );

  switch (cmd) {
    // --- Navigation ---
    case 'open':
    case 'goto':
    case 'navigate': {
      const url = positional()[0];
      if (!url) return usage('open <url>');
      const headless = !flag('--headed');
      // Send launch + navigate
      return [
        { id: id(), action: 'launch', headless, viewport: null },
        {
          id: id(),
          action: 'navigate',
          url: url.startsWith('http') ? url : `https://${url}`,
          waitUntil: flag('--wait') ? 'networkidle' : undefined,
        },
      ];
    }

    case 'back':
      return { id: id(), action: 'back' };
    case 'forward':
      return { id: id(), action: 'forward' };
    case 'reload':
      return { id: id(), action: 'reload' };

    // --- Snapshot ---
    case 'snapshot': {
      const o = { id: id(), action: 'snapshot' };
      if (flag('-i') || flag('--interactive')) o.interactive = true;
      if (flag('-C') || flag('--cursor')) o.cursor = true;
      if (flag('-c') || flag('--compact')) o.compact = true;
      const d = flagVal('-d') || flagVal('--depth');
      if (d) o.maxDepth = parseInt(d, 10);
      const s = flagVal('-s') || flagVal('--selector');
      if (s) o.selector = s;
      return o;
    }

    // --- Screenshot ---
    case 'screenshot': {
      const p = positional();
      const o = { id: id(), action: 'screenshot' };
      if (p[0]) o.path = p[0];
      if (flag('--full') || flag('-f')) o.fullPage = true;
      if (flag('--annotate')) o.annotate = true;
      const sel = flagVal('--selector');
      if (sel) o.selector = sel;
      return o;
    }

    // --- Click / fill / type ---
    case 'click': {
      const sel = positional()[0];
      if (!sel) return usage('click <selector>');
      return { id: id(), action: 'click', selector: sel, newTab: flag('--new-tab') || undefined };
    }
    case 'dblclick': {
      const sel = positional()[0];
      if (!sel) return usage('dblclick <selector>');
      return { id: id(), action: 'dblclick', selector: sel };
    }
    case 'fill': {
      const p = positional();
      if (p.length < 2) return usage('fill <selector> <text>');
      return { id: id(), action: 'fill', selector: p[0], value: p[1] };
    }
    case 'type': {
      const p = positional();
      if (p.length < 2) return usage('type <selector> <text>');
      return {
        id: id(),
        action: 'type',
        selector: p[0],
        text: p[1],
        clear: flag('--clear') || undefined,
      };
    }
    case 'press':
    case 'key': {
      const k = positional()[0];
      if (!k) return usage('press <key>');
      return { id: id(), action: 'press', key: k };
    }

    // --- Keyboard ---
    case 'keyboard': {
      const sub = positional()[0]; // 'type' | 'inserttext'
      const text = positional()[1];
      if (sub === 'type') return { id: id(), action: 'keyboard', subaction: 'type', text };
      if (sub === 'inserttext')
        return { id: id(), action: 'keyboard', subaction: 'insertText', text };
      return { id: id(), action: 'keyboard', subaction: 'press', keys: sub };
    }

    // --- Hover / focus / check ---
    case 'hover':
      return { id: id(), action: 'hover', selector: positional()[0] };
    case 'focus':
      return { id: id(), action: 'focus', selector: positional()[0] };
    case 'check':
      return { id: id(), action: 'check', selector: positional()[0] };
    case 'uncheck':
      return { id: id(), action: 'uncheck', selector: positional()[0] };

    // --- Select ---
    case 'select': {
      const p = positional();
      return { id: id(), action: 'select', selector: p[0], values: p[1] };
    }

    // --- Scroll ---
    case 'scroll': {
      const p = positional();
      const dir = p[0]; // up|down|left|right
      const amt = p[1] ? parseInt(p[1], 10) : undefined;
      return { id: id(), action: 'scroll', direction: dir, amount: amt };
    }
    case 'scrollintoview':
      return { id: id(), action: 'scrollintoview', selector: positional()[0] };

    // --- Wait ---
    case 'wait': {
      const txt = flagVal('--text');
      if (txt) return { id: id(), action: 'wait', selector: `text=${txt}` };
      const url = flagVal('--url');
      if (url) return { id: id(), action: 'waitforurl', url };
      const load = flagVal('--load');
      if (load) return { id: id(), action: 'waitforloadstate', state: load };
      const fn = flagVal('--fn');
      if (fn) return { id: id(), action: 'waitforfunction', expression: fn };
      const sel = positional()[0];
      if (sel && /^\d+$/.test(sel)) return { id: id(), action: 'wait', timeout: parseInt(sel, 10) };
      return { id: id(), action: 'wait', selector: sel };
    }

    // --- Get ---
    case 'get': {
      const sub = positional()[0];
      const sel = positional()[1];
      switch (sub) {
        case 'text':
          return { id: id(), action: 'gettext', selector: sel };
        case 'html':
          return { id: id(), action: 'innerhtml', selector: sel };
        case 'value':
          return { id: id(), action: 'inputvalue', selector: sel };
        case 'attr':
          return { id: id(), action: 'getattribute', selector: sel, attribute: positional()[2] };
        case 'title':
          return { id: id(), action: 'title' };
        case 'url':
          return { id: id(), action: 'url' };
        case 'count':
          return { id: id(), action: 'count', selector: sel };
        case 'box':
          return { id: id(), action: 'boundingbox', selector: sel };
        case 'styles':
          return { id: id(), action: 'styles', selector: sel };
        default:
          return usage('get text|html|value|attr|title|url|count|box|styles <sel>');
      }
    }

    // --- Is ---
    case 'is': {
      const sub = positional()[0];
      const sel = positional()[1];
      switch (sub) {
        case 'visible':
          return { id: id(), action: 'isvisible', selector: sel };
        case 'enabled':
          return { id: id(), action: 'isenabled', selector: sel };
        case 'checked':
          return { id: id(), action: 'ischecked', selector: sel };
        default:
          return usage('is visible|enabled|checked <sel>');
      }
    }

    // --- Find ---
    case 'find': {
      const kind = positional()[0]; // role|text|label|placeholder|alt|title|testid|first|last|nth
      const p = positional();
      const name = flagVal('--name');
      const exact = flag('--exact') || undefined;
      switch (kind) {
        case 'role':
          return {
            id: id(),
            action: 'getbyrole',
            role: p[1],
            subaction: p[2],
            name,
            exact,
            value: p[3],
          };
        case 'text':
          return { id: id(), action: 'getbytext', text: p[1], subaction: p[2], exact };
        case 'label':
          return {
            id: id(),
            action: 'getbylabel',
            label: p[1],
            subaction: p[2],
            exact,
            value: p[3],
          };
        case 'placeholder':
          return {
            id: id(),
            action: 'getbyplaceholder',
            placeholder: p[1],
            subaction: p[2],
            exact,
            value: p[3],
          };
        case 'alt':
          return { id: id(), action: 'getbyalttext', text: p[1], subaction: p[2], exact };
        case 'title':
          return { id: id(), action: 'getbytitle', text: p[1], subaction: p[2], exact };
        case 'testid':
          return { id: id(), action: 'getbytestid', testId: p[1], subaction: p[2], value: p[3] };
        case 'first':
          return {
            id: id(),
            action: 'nth',
            selector: p[1],
            index: 0,
            subaction: p[2],
            value: p[3],
          };
        case 'last':
          return {
            id: id(),
            action: 'nth',
            selector: p[1],
            index: -1,
            subaction: p[2],
            value: p[3],
          };
        case 'nth':
          return {
            id: id(),
            action: 'nth',
            selector: p[2],
            index: parseInt(p[1], 10),
            subaction: p[3],
            value: p[4],
          };
        default:
          return usage('find role|text|label|placeholder|alt|title|testid <val> <action>');
      }
    }

    // --- Eval ---
    case 'eval':
      return { id: id(), action: 'evaluate', script: rest.join(' ') };

    // --- Console / errors ---
    case 'console':
      return { id: id(), action: 'console', clear: flag('--clear') || undefined };
    case 'errors':
      return { id: id(), action: 'errors', clear: flag('--clear') || undefined };

    // --- Upload ---
    case 'upload': {
      const p = positional();
      return { id: id(), action: 'upload', selector: p[0], files: p.slice(1) };
    }

    // --- Drag ---
    case 'drag': {
      const p = positional();
      return { id: id(), action: 'drag', source: p[0], target: p[1] };
    }

    // --- Highlight ---
    case 'highlight':
      return { id: id(), action: 'highlight', selector: positional()[0] };

    // --- Set ---
    case 'set': {
      const sub = positional()[0];
      const p = positional();
      switch (sub) {
        case 'viewport':
          return {
            id: id(),
            action: 'viewport',
            width: parseInt(p[1], 10),
            height: parseInt(p[2], 10),
          };
        case 'device':
          return { id: id(), action: 'device', device: p[1] };
        case 'geo':
          return {
            id: id(),
            action: 'geolocation',
            latitude: parseFloat(p[1]),
            longitude: parseFloat(p[2]),
          };
        case 'offline':
          return { id: id(), action: 'offline', offline: p[1] !== 'off' };
        case 'headers':
          return { id: id(), action: 'headers', headers: JSON.parse(p[1]) };
        case 'credentials':
          return { id: id(), action: 'credentials', username: p[1], password: p[2] };
        case 'media':
          return { id: id(), action: 'emulatemedia', colorScheme: p[1] };
        default:
          return usage('set viewport|device|geo|offline|headers|credentials|media');
      }
    }

    // --- Tabs ---
    case 'tab': {
      const p = positional();
      if (p.length === 0) return { id: id(), action: 'tab_list' };
      if (p[0] === 'new') return { id: id(), action: 'tab_new', url: p[1] };
      if (p[0] === 'close')
        return { id: id(), action: 'tab_close', index: p[1] ? parseInt(p[1], 10) : undefined };
      return { id: id(), action: 'tab_switch', index: parseInt(p[0], 10) };
    }
    case 'window': {
      if (positional()[0] === 'new') return { id: id(), action: 'window_new' };
      return usage('window new');
    }

    // --- Frames ---
    case 'frame': {
      const p = positional()[0];
      if (p === 'main') return { id: id(), action: 'mainframe' };
      return { id: id(), action: 'frame', selector: p };
    }

    // --- Cookies ---
    case 'cookies': {
      const p = positional();
      if (p[0] === 'set')
        return { id: id(), action: 'cookies_set', cookies: [{ name: p[1], value: p[2] }] };
      if (p[0] === 'clear') return { id: id(), action: 'cookies_clear' };
      return { id: id(), action: 'cookies_get' };
    }

    // --- Storage ---
    case 'storage': {
      const p = positional(); // local|session [key] [set k v] [clear]
      const type = p[0] || 'local';
      if (p[1] === 'set') return { id: id(), action: 'storage_set', type, key: p[2], value: p[3] };
      if (p[1] === 'clear') return { id: id(), action: 'storage_clear', type };
      if (p[1]) return { id: id(), action: 'storage_get', type, key: p[1] };
      return { id: id(), action: 'storage_get', type };
    }

    // --- Network ---
    case 'network': {
      const p = positional();
      if (p[0] === 'route') {
        if (flag('--abort')) return { id: id(), action: 'route', url: p[1], abort: true };
        const body = flagVal('--body');
        if (body) return { id: id(), action: 'route', url: p[1], response: { body } };
        return { id: id(), action: 'route', url: p[1] };
      }
      if (p[0] === 'unroute') return { id: id(), action: 'unroute', url: p[1] };
      if (p[0] === 'requests') {
        const filter = flagVal('--filter');
        return { id: id(), action: 'requests', filter, clear: flag('--clear') || undefined };
      }
      return usage('network route|unroute|requests');
    }

    // --- Dialog ---
    case 'dialog': {
      const p = positional();
      if (p[0] === 'accept')
        return { id: id(), action: 'dialog', response: 'accept', promptText: p[1] };
      if (p[0] === 'dismiss') return { id: id(), action: 'dialog', response: 'dismiss' };
      return usage('dialog accept|dismiss');
    }

    // --- Trace ---
    case 'trace': {
      const p = positional();
      if (p[0] === 'start') return { id: id(), action: 'trace_start' };
      if (p[0] === 'stop') return { id: id(), action: 'trace_stop', path: p[1] };
      return usage('trace start|stop');
    }

    // --- Record ---
    case 'record': {
      const p = positional();
      if (p[0] === 'start') return { id: id(), action: 'recording_start', path: p[1] };
      if (p[0] === 'stop') return { id: id(), action: 'recording_stop' };
      if (p[0] === 'restart') return { id: id(), action: 'recording_restart', path: p[1] };
      return usage('record start|stop|restart');
    }

    // --- Profiler ---
    case 'profiler': {
      const p = positional();
      if (p[0] === 'start') return { id: id(), action: 'profiler_start' };
      if (p[0] === 'stop') return { id: id(), action: 'profiler_stop', path: p[1] };
      return usage('profiler start|stop');
    }

    // --- PDF ---
    case 'pdf':
      return { id: id(), action: 'pdf', path: positional()[0] };

    // --- State ---
    case 'state': {
      const p = positional();
      switch (p[0]) {
        case 'save':
          return { id: id(), action: 'state_save', path: p[1] };
        case 'load':
          return { id: id(), action: 'state_load', path: p[1] };
        case 'list':
          return { id: id(), action: 'state_list' };
        case 'show':
          return { id: id(), action: 'state_show', filename: p[1] };
        case 'rename':
          return { id: id(), action: 'state_rename', oldName: p[1], newName: p[2] };
        case 'clear':
          return { id: id(), action: 'state_clear', all: flag('--all') || undefined };
        case 'clean':
          return {
            id: id(),
            action: 'state_clean',
            days: parseInt(flagVal('--older-than') || '30', 10),
          };
        default:
          return usage('state save|load|list|show|rename|clear|clean');
      }
    }

    // --- Session ---
    case 'session': {
      const p = positional();
      if (p[0] === 'list') {
        // List sessions by scanning socketDir for .pid files
        const dir = getSocketDir();
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pid'));
          for (const f of files) {
            const name = f.replace('.pid', '');
            console.log(`  ${name === SESSION ? '* ' : '  '}${name}`);
          }
        }
        process.exit(0);
      }
      console.log(SESSION);
      process.exit(0);
      break; // process.exit() above ensures no fallthrough; break satisfies lint
    }

    // --- Diff ---
    case 'diff': {
      const p = positional();
      if (p[0] === 'snapshot')
        return { id: id(), action: 'diff_snapshot', baseline: flagVal('--baseline') };
      if (p[0] === 'screenshot')
        return { id: id(), action: 'diff_screenshot', baseline: p[1], output: p[2] };
      if (p[0] === 'url') return { id: id(), action: 'diff_url', url1: p[1], url2: p[2] };
      return usage('diff snapshot|screenshot|url');
    }

    // --- Mouse ---
    case 'mouse': {
      const p = positional();
      if (p[0] === 'move')
        return { id: id(), action: 'mousemove', x: parseFloat(p[1]), y: parseFloat(p[2]) };
      if (p[0] === 'down') return { id: id(), action: 'mousedown', button: p[1] };
      if (p[0] === 'up') return { id: id(), action: 'mouseup', button: p[1] };
      if (p[0] === 'wheel')
        return {
          id: id(),
          action: 'wheel',
          deltaY: parseFloat(p[1]),
          deltaX: p[2] ? parseFloat(p[2]) : undefined,
        };
      return usage('mouse move|down|up|wheel');
    }

    // --- Download ---
    case 'download': {
      const p = positional();
      return { id: id(), action: 'download', selector: p[0], path: p[1] };
    }

    // --- Close ---
    case 'close':
    case 'quit':
    case 'exit':
      return { id: id(), action: 'close' };

    default:
      console.error(`Unknown command: ${cmd}`);
      console.error('Usage: node scripts/ab.mjs <command> [args...]');
      console.error(
        'Commands: open, snapshot, click, fill, type, press, screenshot, get, wait, close, ...',
      );
      process.exit(1);
  }
}

function usage(msg) {
  console.error(`Usage: node scripts/ab.mjs ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Output formatting (mimic agent-browser text output)
// ---------------------------------------------------------------------------

function formatOutput(resp) {
  if (!resp.success) {
    console.error(`Error: ${resp.error}`);
    process.exit(1);
  }
  const d = resp.data;
  if (!d) return;

  // Snapshot: print the tree as-is
  if (typeof d.snapshot === 'string') {
    console.log(d.snapshot);
    return;
  }

  // Screenshot
  if (d.path) {
    console.log(`Screenshot saved: ${d.path}`);
    if (d.annotations) {
      for (const a of d.annotations) {
        console.log(`  [${a.index}] @${a.ref} ${a.role} "${a.name}"`);
      }
    }
    return;
  }

  // Text content
  if (typeof d.text === 'string') {
    console.log(d.text);
    return;
  }
  if (typeof d.html === 'string') {
    console.log(d.html);
    return;
  }
  if (typeof d.value === 'string') {
    console.log(d.value);
    return;
  }
  if (typeof d.attribute === 'string') {
    console.log(d.attribute);
    return;
  }
  if (typeof d.title === 'string') {
    console.log(d.title);
    return;
  }
  if (typeof d.url === 'string') {
    console.log(d.url);
    return;
  }
  if (typeof d.count === 'number') {
    console.log(d.count);
    return;
  }
  if (typeof d.visible === 'boolean') {
    console.log(d.visible);
    return;
  }
  if (typeof d.enabled === 'boolean') {
    console.log(d.enabled);
    return;
  }
  if (typeof d.checked === 'boolean') {
    console.log(d.checked);
    return;
  }
  if (d.result !== undefined) {
    console.log(typeof d.result === 'string' ? d.result : JSON.stringify(d.result, null, 2));
    return;
  }

  // Tabs
  if (Array.isArray(d.tabs)) {
    for (const t of d.tabs) {
      console.log(`${t.active ? '* ' : '  '}[${t.index}] ${t.title} — ${t.url}`);
    }
    return;
  }

  // Console / errors
  if (Array.isArray(d.messages)) {
    for (const m of d.messages) console.log(`[${m.type}] ${m.text}`);
    return;
  }
  if (Array.isArray(d.errors)) {
    for (const e of d.errors) console.log(`[error] ${e.message}`);
    return;
  }

  // Cookies
  if (Array.isArray(d.cookies)) {
    for (const c of d.cookies) console.log(`${c.name}=${c.value} (${c.domain})`);
    return;
  }

  // Network requests
  if (Array.isArray(d.requests)) {
    for (const r of d.requests) console.log(`${r.method} ${r.url} → ${r.status}`);
    return;
  }

  // Storage
  if (d.items) {
    for (const [k, v] of Object.entries(d.items)) console.log(`${k}: ${v}`);
    return;
  }

  // Fallback: JSON
  console.log(JSON.stringify(d, null, 2));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node scripts/ab.mjs <command> [args...]');
  console.log('Wrapper for agent-browser that bypasses the Rust binary (AppLocker).');
  console.log('');
  console.log('Commands: open, snapshot, click, fill, type, press, screenshot,');
  console.log('          get, wait, close, set, tab, find, eval, console, errors, ...');
  process.exit(0);
}

const cmds = parseArgs(args);
const cmdList = Array.isArray(cmds) ? cmds : [cmds];

await ensureDaemon();

for (const cmd of cmdList) {
  // Strip undefined values
  const clean = Object.fromEntries(Object.entries(cmd).filter(([, v]) => v !== undefined));
  try {
    const resp = await sendCommand(clean);
    formatOutput(resp);
  } catch (err) {
    // If first command was launch and it failed (already launched), continue
    if (cmd.action === 'launch' && cmdList.length > 1) continue;
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
