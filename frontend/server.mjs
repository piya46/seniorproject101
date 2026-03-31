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
const TRUSTED_BFF_IDENTITY_TOKEN_HEADER = String(process.env.TRUSTED_BFF_IDENTITY_TOKEN_HEADER || 'x-bff-identity-token').trim();
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

function redirect(res, location, statusCode = 302) {
  res.writeHead(statusCode, {
    Location: location
  });
  res.end();
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

function parseCookieHeader(cookieHeader) {
  const cookies = new Map();

  for (const part of String(cookieHeader || '').split(';')) {
    const [rawName, ...rawValueParts] = part.split('=');
    const name = String(rawName || '').trim();
    if (!name) {
      continue;
    }

    cookies.set(name, rawValueParts.join('=').trim());
  }

  return cookies;
}

function getCookieValue(req, cookieName) {
  return parseCookieHeader(req.headers.cookie).get(cookieName) || '';
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
  headers.set(TRUSTED_BFF_IDENTITY_TOKEN_HEADER, idToken);

  if (TRUSTED_BFF_SHARED_SECRET) {
    headers.set(TRUSTED_BFF_AUTH_HEADER_NAME, TRUSTED_BFF_SHARED_SECRET);
  }

  const browserOrigin = deriveBrowserOrigin(req);
  if (browserOrigin) {
    headers.set('x-browser-origin', browserOrigin);
  }

  if (STATE_CHANGING_METHODS.has(String(req.method || '').toUpperCase()) && !headers.has('x-csrf-token')) {
    const csrfToken = getCookieValue(req, 'sci_csrf_token');
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken);
    }
  }

  return headers;
}

function buildBffRequestHeaders(req, idToken) {
  const headers = new Headers({
    Authorization: `Bearer ${idToken}`
  });
  headers.set(TRUSTED_BFF_IDENTITY_TOKEN_HEADER, idToken);

  if (TRUSTED_BFF_SHARED_SECRET) {
    headers.set(TRUSTED_BFF_AUTH_HEADER_NAME, TRUSTED_BFF_SHARED_SECRET);
  }

  const browserOrigin = deriveBrowserOrigin(req);
  if (browserOrigin) {
    headers.set('x-browser-origin', browserOrigin);
  }

  return headers;
}

async function callBackendBff(req, backendPath) {
  const idToken = await getCloudRunIdToken(BACKEND_URL);
  return fetch(new URL(backendPath, `${BACKEND_URL}/`), {
    method: 'GET',
    headers: buildBffRequestHeaders(req, idToken),
    redirect: 'manual'
  });
}

function resolveReturnTo(req) {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const requestedReturnTo = String(requestUrl.searchParams.get('return_to') || '').trim();

  if (!requestedReturnTo) {
    const browserOrigin = deriveBrowserOrigin(req);
    return browserOrigin || '/';
  }

  if (/^https?:\/\//i.test(requestedReturnTo)) {
    return requestedReturnTo;
  }

  const browserOrigin = deriveBrowserOrigin(req);
  if (!browserOrigin) {
    return '/';
  }

  return new URL(requestedReturnTo, `${browserOrigin}/`).toString();
}

async function handleLogin(req, res) {
  if (!BACKEND_URL) {
    sendJson(res, 500, {
      error: 'BFF misconfiguration',
      message: 'BACKEND_URL is not configured.'
    });
    return;
  }

  try {
    const returnTo = resolveReturnTo(req);
    const backendResponse = await callBackendBff(
      req,
      `/api/v1/oidc/bff/google/login-url?return_to=${encodeURIComponent(returnTo)}`
    );

    if (!backendResponse.ok) {
      copyResponseHeaders(backendResponse.headers, res);
      res.writeHead(backendResponse.status);
      const responseText = await backendResponse.text();
      res.end(responseText);
      return;
    }

    const payload = await backendResponse.json();
    if (!payload?.login_url) {
      sendJson(res, 502, {
        error: 'Bad Gateway',
        message: 'Backend did not provide a Google login URL.'
      });
      return;
    }

    redirect(res, payload.login_url);
  } catch (error) {
    console.error('BFF login redirect error:', error);
    sendJson(res, 502, {
      error: 'Bad Gateway',
      message: 'Failed to initialize Google login.'
    });
  }
}

async function handleCallback(req, res) {
  if (!BACKEND_URL) {
    sendJson(res, 500, {
      error: 'BFF misconfiguration',
      message: 'BACKEND_URL is not configured.'
    });
    return;
  }

  try {
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const code = String(requestUrl.searchParams.get('code') || '').trim();
    const state = String(requestUrl.searchParams.get('state') || '').trim();

    if (!code || !state) {
      sendJson(res, 400, {
        error: 'Invalid callback request',
        message: 'Missing authorization code or state.'
      });
      return;
    }

    const backendResponse = await callBackendBff(
      req,
      `/api/v1/oidc/bff/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
    );

    copyResponseHeaders(backendResponse.headers, res);

    if (!backendResponse.ok) {
      const responseText = await backendResponse.text();
      let authError = 'login_failed';

      try {
        const payload = JSON.parse(responseText);
        const message = String(payload?.message || payload?.error || '').toLowerCase();
        if (
          backendResponse.status === 401 ||
          backendResponse.status === 403 ||
          message.includes('domain is not allowed') ||
          message.includes('account domain is not allowed')
        ) {
          authError = 'unauthorized_account';
        }
      } catch (_error) {
        // Fall back to a generic login error when the upstream error is not JSON.
      }

      redirect(res, `/login?auth_error=${encodeURIComponent(authError)}`);
      return;
    }

    const payload = await backendResponse.json();
    const redirectTarget = payload?.return_to || '/';
    redirect(res, redirectTarget);
  } catch (error) {
    console.error('BFF callback error:', error);
    sendJson(res, 502, {
      error: 'Bad Gateway',
      message: 'Failed to complete Google login.'
    });
  }
}

async function handleLogout(req, res) {
  if (!BACKEND_URL) {
    sendJson(res, 500, {
      error: 'BFF misconfiguration',
      message: 'BACKEND_URL is not configured.'
    });
    return;
  }

  try {
    const idToken = await getCloudRunIdToken(BACKEND_URL);
    const backendResponse = await fetch(new URL('/api/v1/oidc/logout', `${BACKEND_URL}/`), {
      method: 'POST',
      headers: buildProxyHeaders(req, idToken),
      redirect: 'manual'
    });

    copyResponseHeaders(backendResponse.headers, res);

    if (!backendResponse.ok) {
      res.writeHead(backendResponse.status);
      const responseText = await backendResponse.text();
      res.end(responseText);
      return;
    }

    redirect(res, '/');
  } catch (error) {
    console.error('BFF logout error:', error);
    sendJson(res, 502, {
      error: 'Bad Gateway',
      message: 'Failed to complete logout.'
    });
  }
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

  if (method === 'GET' && req.url?.startsWith('/auth/login')) {
    await handleLogin(req, res);
    return;
  }

  if (method === 'GET' && req.url?.startsWith('/auth/callback')) {
    await handleCallback(req, res);
    return;
  }

  if (method === 'POST' && req.url === '/auth/logout') {
    await handleLogout(req, res);
    return;
  }

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
