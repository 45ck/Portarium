import { chromium } from '@playwright/test';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(
  process.env.PORTARIUM_COCKPIT_PREVIEW_DIST_DIR ?? 'apps/cockpit/dist-live-preview',
);
const host = '127.0.0.1';
const port = Number(process.env.PORTARIUM_COCKPIT_PREVIEW_PORT ?? '4174');
const baseUrl = `http://${host}:${port}`;

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json'],
  ['.woff2', 'font/woff2'],
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function authPayload(pathname) {
  if (
    pathname === '/auth/session' ||
    pathname === '/auth/dev-session' ||
    pathname === '/auth/oidc/callback'
  ) {
    return {
      authenticated: true,
      claims: {
        sub: 'preview-user',
        workspaceId: 'ws-preview',
        roles: ['operator'],
        personas: ['operator'],
        capabilities: ['objects:read'],
        apiScopes: ['runs.read', 'objects.read'],
        displayName: 'Cockpit Preview',
      },
    };
  }

  return null;
}

function apiPayload(pathname) {
  if (pathname === '/v1/workspaces') {
    return {
      items: [
        {
          workspaceId: 'ws-preview',
          name: 'Cockpit Preview',
          slug: 'cockpit-preview',
        },
      ],
    };
  }

  if (/\/v1\/workspaces\/[^/]+$/.test(pathname)) {
    return {
      workspaceId: 'ws-preview',
      name: 'Cockpit Preview',
      slug: 'cockpit-preview',
    };
  }

  return { items: [] };
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url ?? '/', baseUrl);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'cache-control': 'no-store',
    });
    response.end();
    return;
  }

  if (requestUrl.pathname === '/auth/logout') {
    response.writeHead(204, {
      'cache-control': 'no-store',
      'set-cookie': 'portarium_cockpit_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
    });
    response.end();
    return;
  }

  if (requestUrl.pathname.startsWith('/auth/')) {
    const payload = authPayload(requestUrl.pathname);
    if (payload) {
      sendJson(response, 200, payload);
      return;
    }
  }

  if (requestUrl.pathname.startsWith('/v1/')) {
    sendJson(response, 200, apiPayload(requestUrl.pathname));
    return;
  }

  const decodedPath = decodeURIComponent(requestUrl.pathname);
  const candidate = normalize(join(root, decodedPath === '/' ? 'index.html' : decodedPath));
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  const filePath = candidate.startsWith(rootWithSep) ? candidate : join(root, 'index.html');
  const isNavigation = request.headers.accept?.includes('text/html') ?? false;
  const finalPath = existsSync(filePath)
    ? filePath
    : isNavigation
      ? join(root, 'index.html')
      : filePath;

  try {
    const fileStat = await stat(finalPath);
    if (!fileStat.isFile()) {
      response.writeHead(404);
      response.end('not found');
      return;
    }
  } catch {
    response.writeHead(404);
    response.end('not found');
    return;
  }

  response.writeHead(200, {
    'content-type': contentTypes.get(extname(finalPath)) ?? 'application/octet-stream',
  });
  createReadStream(finalPath).pipe(response);
}

async function main() {
  if (!existsSync(join(root, 'index.html'))) {
    throw new Error(
      `Cockpit preview artifact is missing at ${root}. Run npm run cockpit:build:live-preview first.`,
    );
  }

  const server = createServer((request, response) => {
    void serveStatic(request, response).catch((error) => {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(String(error instanceof Error ? error.stack : error));
    });
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, host, resolveListen);
  });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  const severeConsole = [];
  const failedAssets = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') severeConsole.push(message.text());
  });
  page.on('response', (response) => {
    const request = response.request();
    const resourceType = request.resourceType();
    if (
      response.status() >= 400 &&
      ['document', 'script', 'stylesheet', 'image', 'font', 'manifest'].includes(resourceType)
    ) {
      failedAssets.push(`${response.status()} ${resourceType} ${response.url()}`);
    }
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('#root > *', { timeout: 15_000 });
    await page.waitForTimeout(1000);

    if (pageErrors.length > 0 || severeConsole.length > 0 || failedAssets.length > 0) {
      throw new Error(
        [
          'Cockpit preview emitted runtime errors.',
          ...pageErrors.map((entry) => `pageerror: ${entry}`),
          ...severeConsole.map((entry) => `console.error: ${entry}`),
          ...failedAssets.map((entry) => `asset: ${entry}`),
        ].join('\n'),
      );
    }
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }

  console.log(`Cockpit preview smoke passed at ${baseUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
