// background.js - TESSERACT v24.0 (Backend Integrado + Smart Mailing)
const TESSERACT_API = 'https://tesseract-jblo.onrender.com';

chrome.runtime.onInstalled.addListener(() => {
  console.log('TESSERACT v24.0 installed');
});

chrome.runtime.onStartup.addListener(() => {
  checkAuthStatus();
});

// ============ SMART MAILING ALARM HANDLER ============
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tess-mailing-tick') {
    console.log('[BG] Mailing alarm tick');
    chrome.tabs.query({ url: ['*://talkytimes.com/*', '*://www.talkytimes.com/*'] }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'MAILING_EXECUTE_ROUND' }).catch(() => {});
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'LOGIN_SUCCESS') {
    console.log('[BG] Login:', message.email);
    sendResponse({ success: true });
  } else if (message.action === 'LOGOUT') {
    chrome.storage.local.clear();
    sendResponse({ success: true });
  } else if (message.action === 'CHECK_AUTH') {
    (async () => { sendResponse(await checkAuthStatus()); })();
    return true;
  } else if (message.action === 'GET_SUBSCRIPTION') {
    (async () => { sendResponse(await getSubscriptionInfo()); })();
    return true;
  } else if (message.action === 'MAILING_SETUP_ALARM') {
    const interval = message.intervalMinutes || 60;
    chrome.alarms.create('tess-mailing-tick', { periodInMinutes: interval });
    console.log('[BG] Mailing alarm set:', interval, 'min');
    sendResponse({ success: true });
  } else if (message.action === 'MAILING_CLEAR_ALARM') {
    chrome.alarms.clear('tess-mailing-tick');
    console.log('[BG] Mailing alarm cleared');
    sendResponse({ success: true });
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
  const dashboardUrl = chrome.runtime.getURL('src/pages/dashboard/dashboard.html');
  if (details.url.includes(dashboardUrl)) {
    const auth = await checkAuthStatus();
    if (!auth.loggedIn || auth.status === 'expired') {
      chrome.tabs.update(details.tabId, {
        url: chrome.runtime.getURL('src/pages/login/login.html')
      });
    }
  }
});
