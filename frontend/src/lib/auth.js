import axios from 'axios';

function buildReturnToUrl() {
  return window.location.href;
}

export function redirectToLogin(returnTo = buildReturnToUrl()) {
  window.location.assign(`/auth/login?return_to=${encodeURIComponent(returnTo)}`);
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
