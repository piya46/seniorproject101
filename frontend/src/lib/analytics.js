const CONSENT_STORAGE_KEY = 'cookie_preferences_v1';
const APP_CONFIG_URL = '/__app-config';

const ANALYTICS_EVENT_SCHEMAS = {
  degree_selected: ['degree_level'],
  form_selected: ['form_code', 'degree_level', 'has_sub_types'],
  form_subtype_selected: ['form_code', 'degree_level', 'sub_type'],
  form_step_viewed: ['form_code', 'degree_level', 'sub_type', 'step'],
  chat_opened: ['has_cached_usage'],
  chat_message_sent: ['message_length_bucket'],
  validation_started: ['form_code', 'degree_level', 'sub_type', 'required_document_count'],
  validation_succeeded: ['form_code', 'degree_level', 'sub_type', 'required_document_count'],
  validation_failed: ['form_code', 'degree_level', 'sub_type', 'required_document_count', 'failure_stage'],
  merge_started: ['form_code', 'degree_level', 'sub_type'],
  merge_succeeded: ['form_code', 'degree_level', 'sub_type', 'has_download_url', 'has_directory_fallback'],
  merge_failed: ['form_code', 'degree_level', 'sub_type'],
  login_started: ['provider'],
  unauthorized_viewed: []
};

const ALLOWED_PAGE_PATHS = ['/', '/aboutus', '/contactus'];
const ALLOWED_DYNAMIC_PAGE_PREFIXES = ['/form/'];
const BLOCKED_PAGE_PATHS = ['/login', '/unauthorized', '/privacy', '/terms', '/cookies'];

let appConfigPromise = null;
let gaInitialized = false;
let gaMeasurementId = '';
let lastTrackedPagePath = '';

function getDefaultConsentState() {
  return {
    necessary: true,
    analytics: false,
    updatedAt: null
  };
}

export function getCookieConsent() {
  if (typeof window === 'undefined') {
    return getDefaultConsentState();
  }

  try {
    const rawValue = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!rawValue) {
      return getDefaultConsentState();
    }

    const parsed = JSON.parse(rawValue);
    return {
      necessary: true,
      analytics: Boolean(parsed?.analytics),
      updatedAt: parsed?.updatedAt || null
    };
  } catch (_error) {
    return getDefaultConsentState();
  }
}

export function hasCookieConsentDecision() {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(window.localStorage.getItem(CONSENT_STORAGE_KEY));
}

export function saveCookieConsent(nextConsent) {
  if (typeof window === 'undefined') {
    return getDefaultConsentState();
  }

  const normalized = {
    necessary: true,
    analytics: Boolean(nextConsent?.analytics),
    updatedAt: new Date().toISOString()
  };

  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent('cookie-consent-updated', { detail: normalized }));
  return normalized;
}

async function fetchAppConfig() {
  const response = await fetch(APP_CONFIG_URL, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch app config: ${response.status}`);
  }

  return response.json();
}

export async function getAnalyticsMeasurementId() {
  if (!appConfigPromise) {
    appConfigPromise = fetchAppConfig().catch((error) => {
      appConfigPromise = null;
      throw error;
    });
  }

  const config = await appConfigPromise;
  return String(config?.ga_measurement_id || '').trim();
}

function createGtagScriptTag() {
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`;
  script.dataset.gaManaged = 'true';
  return script;
}

function ensureDataLayer() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
}

export async function initializeAnalyticsIfConsented() {
  if (typeof window === 'undefined') {
    return false;
  }

  const consent = getCookieConsent();
  if (!consent.analytics) {
    return false;
  }

  if (gaInitialized && gaMeasurementId) {
    return true;
  }

  gaMeasurementId = await getAnalyticsMeasurementId();
  if (!gaMeasurementId) {
    return false;
  }

  if (!document.querySelector('script[data-ga-managed="true"]')) {
    document.head.appendChild(createGtagScriptTag());
  }

  ensureDataLayer();
  window.gtag('js', new Date());
  window.gtag('config', gaMeasurementId, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: false
  });

  gaInitialized = true;
  return true;
}

export async function trackPageView(pathname) {
  const initialized = await initializeAnalyticsIfConsented();
  if (!initialized || typeof window === 'undefined') {
    return;
  }

  const path = String(pathname || `${window.location.pathname}${window.location.search}`).trim();
  if (!path) {
    return;
  }

  const pathWithoutQuery = path.split('?')[0];
  const isBlocked = BLOCKED_PAGE_PATHS.includes(pathWithoutQuery);
  const isAllowedStatic = ALLOWED_PAGE_PATHS.includes(pathWithoutQuery);
  const isAllowedDynamic = ALLOWED_DYNAMIC_PAGE_PREFIXES.some((prefix) => pathWithoutQuery.startsWith(prefix));

  if (isBlocked || (!isAllowedStatic && !isAllowedDynamic)) {
    return;
  }

  if (lastTrackedPagePath === path) {
    return;
  }

  lastTrackedPagePath = path;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: document.title
  });
}

export async function trackAnalyticsEvent(eventName, params = {}) {
  const initialized = await initializeAnalyticsIfConsented();
  if (!initialized || !eventName || typeof window === 'undefined') {
    return;
  }

  const allowedParams = ANALYTICS_EVENT_SCHEMAS[eventName];
  if (!allowedParams) {
    return;
  }

  const sanitizedParams = allowedParams.reduce((acc, key) => {
    const value = params[key];
    if (value === undefined || value === null) {
      return acc;
    }

    if (typeof value === 'boolean') {
      acc[key] = value;
      return acc;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      acc[key] = value;
      return acc;
    }

    if (typeof value === 'string') {
      acc[key] = value.replace(/\s+/g, ' ').trim().slice(0, 64);
    }

    return acc;
  }, {});

  window.gtag('event', eventName, sanitizedParams);
}
