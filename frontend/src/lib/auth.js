import axios from 'axios';

const PUBLIC_PATH_PREFIXES = ['/login', '/auth/login', '/privacy', '/terms', '/cookies', '/unauthorized'];

function buildReturnToUrl() {
  return window.location.href;
}

let sessionRedirectInFlight = false;

function isPublicPath(path) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function redirectToLogin(returnTo = buildReturnToUrl()) {
  window.location.assign(`/login?return_to=${encodeURIComponent(returnTo)}`);
}

export function clearClientSessionState() {
  sessionStorage.clear();
}

export function isSessionExpiryResponse(response) {
  const status = Number(response?.status || 0);
  const error = String(response?.data?.error || '').trim().toLowerCase();
  const message = String(response?.data?.message || '').trim().toLowerCase();

  if (status === 401) {
    return true;
  }

  if (status === 403 && (message.includes('expired token') || error.includes('invalid or expired token'))) {
    return true;
  }

  return error === 'session revoked' || message.includes('session has been terminated');
}

export function handleExpiredSessionRedirect() {
  if (sessionRedirectInFlight) {
    return;
  }

  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (isPublicPath(currentPath)) {
    return;
  }

  sessionRedirectInFlight = true;
  clearClientSessionState();
  redirectToLogin();
}

export function installSessionExpiryInterceptor() {
  if (axios.__sessionExpiryInterceptorInstalled) {
    return;
  }

  axios.__sessionExpiryInterceptorInstalled = true;

  axios.interceptors.response.use(
    (response) => {
      if (isSessionExpiryResponse(response)) {
        handleExpiredSessionRedirect();
      }
      return response;
    },
    (error) => {
      if (isSessionExpiryResponse(error?.response)) {
        handleExpiredSessionRedirect();
      }
      return Promise.reject(error);
    }
  );
}

export async function getAuthenticatedUser() {
  try {
    const response = await axios.get('/api/v1/oidc/me', {
      withCredentials: true,
      validateStatus: (status) => status < 500
    });

    if (response.status === 200 && response.data?.authenticated) {
      return response.data;
    }
  } catch (error) {
    console.error('Auth bootstrap failed:', error);
  }

  return null;
}

export async function ensureAuthenticatedOrRedirect() {
  const authenticatedUser = await getAuthenticatedUser();
  if (authenticatedUser) {
    return authenticatedUser;
  }

  redirectToLogin();
  return null;
}

export async function logout() {
  const response = await axios.post('/auth/logout', null, {
    withCredentials: true,
    validateStatus: (status) => status < 500,
  });

  if (response.status >= 400) {
    throw new Error(response.data?.message || 'Failed to logout.');
  }

  clearClientSessionState();
  return response.data;
}
