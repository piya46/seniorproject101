import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(__dirname, 'dist');
const INDEX_FILE = join(DIST_DIR, 'index.html');
const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const BACKEND_URL = String(process.env.BACKEND_URL || '').trim().replace(/\/+$/, '');
const TRUSTED_BFF_SHARED_SECRET = String(process.env.TRUSTED_BFF_SHARED_SECRET || '').trim();
const TRUSTED_BFF_AUTH_HEADER_NAME = String(process.env.TRUSTED_BFF_AUTH_HEADER_NAME || 'x-bff-auth').trim();

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp'
};

let cachedIdToken = '';
let cachedIdTokenExpiryMs = 0;

function normalizeBrowserOrigin(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  try {
    return new URL(value.trim()).origin;
  } catch (_error) {
    return '';
  }
}

function deriveBrowserOrigin(req) {
  const explicitOrigin = normalizeBrowserOrigin(req.headers.origin);
  if (explicitOrigin) {
    return explicitOrigin;
  }

  const refererOrigin = normalizeBrowserOrigin(req.headers.referer);
  if (refererOrigin) {
    return refererOrigin;
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'https';
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(req.headers.host || '').trim();

  if (!host) {
    return '';
  }

  return normalizeBrowserOrigin(`${forwardedProto}://${host}`);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function buildStaticHeaders(filePath) {
  return {
    'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': filePath === INDEX_FILE ? 'no-cache' : 'public, max-age=31536000, immutable'
  };
}

async function serveFile(res, filePath) {
  const fileStats = await stat(filePath);
  res.writeHead(200, {
    ...buildStaticHeaders(filePath),
    'Content-Length': fileStats.size
  });
  createReadStream(filePath).pipe(res);
}

async function getCloudRunIdToken(audience) {
  const now = Date.now();
  if (cachedIdToken && cachedIdTokenExpiryMs - now > 60_000) {
    return cachedIdToken;
  }

  const metadataUrl = new URL('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity');
  metadataUrl.searchParams.set('audience', audience);
  metadataUrl.searchParams.set('format', 'full');

  const response = await fetch(metadataUrl, {
    headers: {
      'Metadata-Flavor': 'Google'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Cloud Run ID token: ${response.status}`);
  }

  const token = (await response.text()).trim();
  if (!token) {
    throw new Error('Metadata server returned an empty Cloud Run ID token.');
  }

  try {
    const [, payloadSegment] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));
    cachedIdTokenExpiryMs = Number(payload.exp || 0) * 1000;
  } catch (_error) {
    cachedIdTokenExpiryMs = now + 5 * 60_000;
  }

  cachedIdToken = token;
  return token;
}

function copyResponseHeaders(fromHeaders, toResponse) {
  let contentType = fromHeaders.get('content-type');
  if (contentType) {
    toResponse.setHeader('Content-Type', contentType);
  }

  const contentDisposition = fromHeaders.get('content-disposition');
  if (contentDisposition) {
    toResponse.setHeader('Content-Disposition', contentDisposition);
  }

  const cacheControl = fromHeaders.get('cache-control');
  if (cacheControl) {
    toResponse.setHeader('Cache-Control', cacheControl);
  }

  const location = fromHeaders.get('location');
  if (location) {
    toResponse.setHeader('Location', location);
  }

  if (typeof fromHeaders.getSetCookie === 'function') {
    const setCookies = fromHeaders.getSetCookie();
    if (setCookies.length > 0) {
      toResponse.setHeader('Set-Cookie', setCookies);
    }
  }
}

function buildProxyHeaders(req, idToken) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) {
      continue;
    }

    const lowerKey = key.toLowerCase();
    if (['host', 'connection', 'content-length'].includes(lowerKey)) {
      continue;
    }

    if (Array.isArray(value)) {
      headers.set(key, value.join(', '));
    } else {
      headers.set(key, value);
    }
  }

  headers.set('Authorization', `Bearer ${idToken}`);

  if (TRUSTED_BFF_SHARED_SECRET) {
    headers.set(TRUSTED_BFF_AUTH_HEADER_NAME, TRUSTED_BFF_SHARED_SECRET);
  }

  const browserOrigin = deriveBrowserOrigin(req);
  if (browserOrigin) {
    headers.set('x-browser-origin', browserOrigin);
  }

  return headers;
}

async function proxyApiRequest(req, res) {
  if (!BACKEND_URL) {
    sendJson(res, 500, {
      error: 'BFF misconfiguration',
      message: 'BACKEND_URL is not configured.'
    });
    return;
  }

  const targetUrl = new URL(req.url, `${BACKEND_URL}/`);

  try {
    const idToken = await getCloudRunIdToken(BACKEND_URL);
    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers: buildProxyHeaders(req, idToken),
      body: ['GET', 'HEAD'].includes(req.method || '') ? undefined : req,
      duplex: ['GET', 'HEAD'].includes(req.method || '') ? undefined : 'half',
      redirect: 'manual'
    });

    copyResponseHeaders(upstreamResponse.headers, res);
    res.writeHead(upstreamResponse.status);

    if (!upstreamResponse.body) {
      res.end();
      return;
    }

    Readable.fromWeb(upstreamResponse.body).pipe(res);
  } catch (error) {
    console.error('BFF proxy error:', error);
    sendJson(res, 502, {
      error: 'Bad Gateway',
      message: 'Failed to reach backend from frontend BFF.'
    });
  }
}

function resolveStaticPath(requestPath) {
  const pathname = decodeURIComponent(new URL(requestPath, 'http://localhost').pathname);
  const normalizedPath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const candidatePath = resolve(DIST_DIR, `.${normalizedPath}`);

  if (!candidatePath.startsWith(DIST_DIR)) {
    return null;
  }

  return candidatePath;
}

const server = createServer(async (req, res) => {
  const method = String(req.method || 'GET').toUpperCase();

  if (req.url?.startsWith('/api/')) {
    await proxyApiRequest(req, res);
    return;
  }

  if (!existsSync(DIST_DIR)) {
    sendJson(res, 500, {
      error: 'Frontend build missing',
      message: 'The dist directory does not exist. Build the frontend before starting the BFF server.'
    });
    return;
  }

  const candidatePath = resolveStaticPath(req.url || '/');
  if (!candidatePath) {
    sendJson(res, 400, {
      error: 'Bad Request',
      message: 'Invalid request path.'
    });
    return;
  }

  try {
    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(res, 405, {
        error: 'Method Not Allowed'
      });
      return;
    }

    const fileExists = existsSync(candidatePath) && (await stat(candidatePath)).isFile();
    const fileToServe = fileExists ? candidatePath : INDEX_FILE;
    await serveFile(res, fileToServe);
  } catch (error) {
    console.error('Static file error:', error);
    sendJson(res, 500, {
      error: 'Internal Server Error'
    });
  }
});

server.listen(PORT, () => {
  console.log(`Frontend BFF listening on port ${PORT}`);
});
