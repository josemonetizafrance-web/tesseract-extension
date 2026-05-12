// auth.js - TESSERACT v23.0 (Backend Integrado)
const TESSERACT_API = 'https://tesseract-jblo.onrender.com';

function getToken() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['tess_jwt'], (r) => resolve(r.tess_jwt || null));
    } catch (e) { resolve(null); }
  });
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${TESSERACT_API}${path}`, { ...options, headers });

  if (res.status === 401) {
    try {
      const body = await res.json();
      if (body.code === 'TOKEN_EXPIRED') {
        await chrome.storage.local.remove('tess_jwt');
        try { chrome.runtime.sendMessage({ action: 'SESSION_EXPIRED' }); } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }

  return res.json();
}

export async function getCurrentUser() {
  const data = await apiFetch('/api/tess/auth/verify');
  if (!data) return null;

  return {
    email: data.email,
    uid: data.email,
    token: await getToken(),
    isAdmin: data.isAdmin,
    isDeveloper: data.isDeveloper,
    subscriptionStatus: data.subscription?.status || 'expired',
    isPremium: data.subscription?.isPremium || false,
    timeRemaining: data.subscription?.timeRemaining || 0
  };
}

export async function isLoggedIn() {
  const user = await getCurrentUser();
  return user !== null && user.subscriptionStatus !== 'expired';
}

export async function isAdmin() {
  const user = await getCurrentUser();
  return user?.isAdmin || false;
}

export async function getSubscriptionStatus() {
  const data = await apiFetch('/api/tess/auth/verify');
  if (!data) return { status: 'none', isPremium: false, timeRemaining: 0 };

  return {
    status: data.subscription?.status || 'none',
    isPremium: data.subscription?.isPremium || false,
    timeRemaining: data.subscription?.timeRemaining || 0,
    expiry: 0
  };
}

export async function logout() {
  await chrome.storage.local.clear();
  try {
    chrome.runtime.sendMessage({ action: 'LOGOUT' });
  } catch (e) {}
  window.location.href = '/src/pages/login/login.html';
}

export function formatTimeRemaining(ms) {
  if (ms <= 0 || ms === Infinity) return ms === Infinity ? 'Ilimitado' : 'Expired';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export async function syncMetrics(stats, collectedIds, action, count) {
  try {
    await apiFetch('/api/tess/metrics/sync', {
      method: 'POST',
      body: JSON.stringify({ stats, collectedIds, action, count })
    });
  } catch (e) {
    console.warn('[AUTH] syncMetrics error:', e.message);
  }
}
