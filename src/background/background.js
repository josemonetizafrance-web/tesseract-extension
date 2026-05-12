// background.js - TESSERACT v23.0 (Backend Integrado)
const TESSERACT_API = 'https://tesseract-jblo.onrender.com';

chrome.runtime.onInstalled.addListener(() => {
  console.log('TESSERACT v23.0 installed');
});

chrome.runtime.onStartup.addListener(() => {
  checkAuthStatus();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'LOGIN_SUCCESS') {
    console.log('[BG] Login:', message.email);
    sendResponse({ success: true });
  } else if (message.action === 'LOGOUT') {
    chrome.storage.local.clear();
    sendResponse({ success: true });
  } else if (message.action === 'CHECK_AUTH') {
    checkAuthStatus().then(sendResponse);
    return true;
  } else if (message.action === 'GET_SUBSCRIPTION') {
    getSubscriptionInfo().then(sendResponse);
    return true;
  }
  return true;
});

async function checkAuthStatus() {
  try {
    const data = await chrome.storage.local.get(['tess_jwt', 'user_email']);
    if (!data.tess_jwt) return { loggedIn: false };

    const res = await fetch(`${TESSERACT_API}/api/tess/auth/verify`, {
      headers: { 'Authorization': `Bearer ${data.tess_jwt}` }
    });

    if (!res.ok) {
      if (res.status === 401) await chrome.storage.local.remove('tess_jwt');
      return { loggedIn: false };
    }

    const authData = await res.json();
    return {
      loggedIn: true,
      status: authData.subscription?.status || 'expired',
      isPremium: authData.subscription?.isPremium || false,
      timeRemaining: authData.subscription?.timeRemaining || 0
    };
  } catch (e) {
    return { loggedIn: false, error: e.message };
  }
}

async function getSubscriptionInfo() {
  try {
    const data = await chrome.storage.local.get(['tess_jwt']);
    if (!data.tess_jwt) return { status: 'none', isPremium: false, timeRemaining: 0 };

    const res = await fetch(`${TESSERACT_API}/api/tess/auth/verify`, {
      headers: { 'Authorization': `Bearer ${data.tess_jwt}` }
    });

    if (!res.ok) return { status: 'none', isPremium: false, timeRemaining: 0 };

    const authData = await res.json();
    return {
      status: authData.subscription?.status || 'none',
      isPremium: authData.subscription?.isPremium || false,
      timeRemaining: authData.subscription?.timeRemaining || 0
    };
  } catch (e) {
    return { status: 'none', isPremium: false, timeRemaining: 0 };
  }
}

chrome.webNavigation?.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const protectedPages = ['/src/pages/dashboard/', '/src/pages/popup/'];
  const isProtected = protectedPages.some(page => details.url.includes(chrome.runtime.getURL(page)));

  if (isProtected) {
    const auth = await checkAuthStatus();
    if (!auth.loggedIn || auth.status === 'expired') {
      chrome.tabs.update(details.tabId, {
        url: chrome.runtime.getURL('src/pages/login/login.html')
      });
    }
  }
});
