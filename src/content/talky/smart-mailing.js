const MAILING_STORAGE_KEY = 'tess_mailing_config';
const ML_CONTACTED_HISTORY_KEY = 'tess_ml_contacted_history';
var TESSERACT_API = 'https://tesseract-jblo.onrender.com';

// Silenciar error de MessagePort cerrado por wake-up del service worker
window.addEventListener('unhandledrejection', function(e) {
  var msg = e.reason ? (e.reason.message || e.reason) : '';
  if (msg && typeof msg === 'string' && msg.toLowerCase().includes('message port closed')) {
    e.preventDefault();
  }
});

let mlBlacklist = [];
let mlBlacklistLoaded = false;
let mlBlacklistLoadPromise = null;
let scrapedContactIds = [];

async function loadMLBlacklist(retries) {
  if (retries === undefined) retries = 2;
  if (mlBlacklistLoadPromise) return mlBlacklistLoadPromise;
  mlBlacklistLoadPromise = (async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const stored = await chrome.storage.local.get(['tess_jwt']);
        if (!stored.tess_jwt) { mlBlacklistLoadPromise = null; return; }
        const res = await fetch(`${TESSERACT_API}/api/tess/blacklist`, {
          headers: { 'Authorization': 'Bearer ' + stored.tess_jwt }
        });
        if (!res.ok && attempt < retries) { await sleep(1000); continue; }
        if (res.ok) {
          const data = await res.json();
          mlBlacklist = (data.blacklist || []).map(String);
          mlBlacklistLoaded = true;
        }
        break;
      } catch (e) {
        if (attempt >= retries) break;
        await sleep(1000);
      }
    }
    mlBlacklistLoadPromise = null;
  })();
  return mlBlacklistLoadPromise;
}

async function reloadMLBlacklist() {
  console.log('[ML] reloadMLBlacklist start, current:', mlBlacklist.length);
  mlBlacklist = []; mlBlacklistLoaded = false; mlBlacklistLoadPromise = null;
  await loadMLBlacklist();
  console.log('[ML] reloadMLBlacklist done, loaded:', mlBlacklist.length, 'ok:', mlBlacklistLoaded);
}

function isInMLBlacklist(contactId) {
  if (!contactId) return true;
  return mlBlacklist.includes(String(contactId));
}

async function isContactAlreadyContactedML(profileId) {
  try {
    const data = await chrome.storage.local.get([ML_CONTACTED_HISTORY_KEY]);
    const history = data[ML_CONTACTED_HISTORY_KEY] || {};
    return history[String(profileId)] === true;
  } catch (e) { return false; }
}

async function markContactAsContactedML(profileId) {
  try {
    const data = await chrome.storage.local.get([ML_CONTACTED_HISTORY_KEY]);
    const history = data[ML_CONTACTED_HISTORY_KEY] || {};
    history[String(profileId)] = true;
    await chrome.storage.local.set({ [ML_CONTACTED_HISTORY_KEY]: history });
  } catch (e) { logError('ml-history', e); }
}

async function markContactAsContactedML(profileId) {
  try {
    const data = await chrome.storage.local.get([ML_CONTACTED_HISTORY_KEY]);
    const history = data[ML_CONTACTED_HISTORY_KEY] || {};
    history[String(profileId)] = true;
    await chrome.storage.local.set({ [ML_CONTACTED_HISTORY_KEY]: history });
  } catch (e) { logError('ml-mark-contacted', e); }
}

const DEFAULT_MAILING_CONFIG = {
  enabled: false,
  maxDaily: 30,
  sentToday: 0,
  lastResetDate: '',
  delay: { min: 1500, max: 4000 },
  messageTemplate: 'Hola! Me encantaría conocerte mejor. ¿Te gustaría conversar un rato?',
  useAI: false,
  workingHours: { start: 8, end: 22 },
  respectQuietHours: true,
  skipPinned: true,
  stopOnBlacklistHit: false,
  scheduleEnabled: false,
  scheduleStartDate: '',
  scheduleFrequency: 'daily',
  scheduleCycles: 30,
  scheduleRemaining: 30,
  templatesNew: 'Hola! Vi tu perfil y me pareciste interesante. ¿Te gustaría conversar?',
  blockActiveDialogue: true,
  activeDialogueHours: 48,
  multiProfileEnabled: false,
  currentProfile: '',
  useEmailSection: false
};

let mailingConfig = null;
let mailingActive = false;
let mailingAbort = false;
let lastScrapedCount = 0;

function cloneMailingConfig(cfg) {
  return JSON.parse(JSON.stringify(cfg || DEFAULT_MAILING_CONFIG));
}

async function loadMailingConfig() {
  try {
    const r = await chrome.storage.local.get([MAILING_STORAGE_KEY]);
    if (r[MAILING_STORAGE_KEY]) {
      mailingConfig = Object.assign({}, DEFAULT_MAILING_CONFIG, r[MAILING_STORAGE_KEY]);
    } else {
      mailingConfig = cloneMailingConfig(DEFAULT_MAILING_CONFIG);
    }
  } catch (e) {
    mailingConfig = cloneMailingConfig(DEFAULT_MAILING_CONFIG);
  }
  resetMailingDailyCounter();
  return mailingConfig;
}

async function saveMailingConfig() {
  try {
    await chrome.storage.local.set({ [MAILING_STORAGE_KEY]: mailingConfig });
  } catch (e) { logError('ml-save-config', e); }
}

function resetMailingDailyCounter() {
  const today = new Date().toISOString().slice(0, 10);
  if (mailingConfig.lastResetDate !== today) {
    mailingConfig.sentToday = 0;
    mailingConfig.lastResetDate = today;
    saveMailingConfig();
  }
}

function isWithinWorkingHours() {
  if (!mailingConfig.respectQuietHours) return true;
  const hour = new Date().getHours();
  return hour >= mailingConfig.workingHours.start && hour < mailingConfig.workingHours.end;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isScheduleActive() {
  if (!mailingConfig.scheduleEnabled) return true;
  if (mailingConfig.scheduleRemaining <= 0) return false;
  if (mailingConfig.scheduleStartDate) {
    const start = new Date(mailingConfig.scheduleStartDate);
    if (start > new Date()) return false;
  }
  return true;
}

function consumeScheduleCycle() {
  if (!mailingConfig.scheduleEnabled) return;
  mailingConfig.scheduleRemaining = Math.max(0, (mailingConfig.scheduleRemaining || 0) - 1);
  saveMailingConfig();
}

function hasActiveDialogue(contactEl) {
  if (!mailingConfig.blockActiveDialogue) return false;
  try {
    const text = contactEl.textContent.toLowerCase();

    // Señales de conversación activa (chat y email)
    const signals = [
      'respondió', 'respondio', 'replied', 'contestó', 'contesto',
      'te escribió', 'wrote to you', 'te ha escrito', 'has written',
      'respondiste', 'you replied', 'nuevo mensaje', 'new message',
      'conversación activa', 'active conversation', 'chat activo', 'active chat',
      'respondio a tu carta', 'replied to your letter', 'respondió a tu carta',
      'te respondió', 'has responded', 'nueva carta', 'new letter',
      'intercambio de cartas', 'letter exchange'
    ];
    for (const s of signals) {
      if (text.includes(s)) return true;
    }

    // Verificar si hay indicador de tiempo reciente (minutos/horas)
    const timeEl = contactEl.querySelector(TALK_Y.TIME_ELEMENT);
    if (timeEl) {
      const timeText = timeEl.textContent.toLowerCase();
      if (timeText.includes('min') || timeText.includes('hour') || timeText.includes('hora') || timeText.includes('minuto')) return true;
    }

    // Verificar atributos data que indiquen estado activo
    const activeAttr = contactEl.getAttribute('data-active') || contactEl.getAttribute('data-status') || '';
    if (activeAttr.includes('active') || activeAttr.includes('responded') || activeAttr.includes('replied')) return true;

    // Verificar si tiene clase que indique conversación activa
    if (contactEl.className && typeof contactEl.className === 'string') {
      if (/active|responded|replied|unread/i.test(contactEl.className)) return true;
    }

    return false;
  } catch (e) { return false; }
}

function detectContactType(contactEl, contactId) {
  if (hasActiveDialogue(contactEl)) return 'active';
  if (contactId && isContactAlreadyContactedML(contactId)) return 'recurring';
  if (contactEl && getLetterCount(contactEl) >= 3) return 'excess_letters';
  return 'new';
}

function getLetterCount(el) {
  try {
    var container = el.closest('[class*="active-limit"], [class*="activeLimit"], tr, [class*="row"], [class*="item"], [class*="contact"], [class*="mail"], li') || el;
    var text = container.textContent || '';
    var match = text.match(/(\d+)\s*letter\s*total/i);
    if (match) return parseInt(match[1], 10);
  } catch (e) {}
  return 0;
}

async function getMessageForContact() {
  var template = mailingConfig.messageTemplate || mailingConfig.templatesNew || 'Hola! Vi tu perfil y me pareciste interesante. ¿Te gustaría conversar?';
  if (mailingConfig.useAI) {
    const aiResponse = await generateAIResponse(template);
    return aiResponse || template;
  }
  return template;
}

function extractIdFromHref(href) {
  if (!href) return null;
  const match = String(href).match(/\/(\d{5,15})(?:[/?#]|$)/);
  return match ? match[1] : null;
}

function extractIdFromText(text) {
  if (!text) return null;
  const match = text.match(/\b(\d{6,15})\b/);
  return match ? match[1] : null;
}

var _mlCachedUserId = null;

function mlGetUserId() {
  if (_mlCachedUserId) return _mlCachedUserId;
  _mlCachedUserId = mlGetCurrentUserId();
  return _mlCachedUserId;
}

function scrapeActiveLimitsIds() {
  if (!mlIsOnActiveLimitsList()) { lastScrapedCount = 0; return []; }
  const ids = [];
  const seen = new Set();

  function tryAddFromLink(link, source) {
    try {
      var href = link.href || link.getAttribute('href') || '';
      var id = extractIdFromHref(href);
      if (id && !seen.has(id)) {
        seen.add(id);
        var parent = link.closest('[class*="contact"], [class*="user"], [class*="member"], [class*="profile"], [class*="item"], [class*="row"], tr, li, [class*="mail"], [class*="conversation"], [class*="thread"], [class*="inbox"]');
        var contactType = 'new';
        if (parent) {
          contactType = detectContactType(parent, id);
        }
        ids.push({ id: id, element: link, source: source, contactType: contactType });
      }
    } catch (e) {}
  }

  function tryAddId(id, el, source) {
    if (id && !seen.has(id)) {
      seen.add(id);
      var contactType = detectContactType(el, id);
      ids.push({ id: id, element: el, source: source, contactType: contactType });
    }
  }

  // 1. Extraer IDs de data-test-uid (formato: id1_id2)
  try {
    var uidElements = document.querySelectorAll(TALK_Y.DATA_UID);
    var selfId = mlGetUserId();
    if (!selfId && uidElements.length >= 2) {
      var freq = {};
      for (var uiTmp = 0; uiTmp < uidElements.length; uiTmp++) {
        var uidTmp = uidElements[uiTmp].getAttribute('data-test-uid') || '';
        var partsTmp = String(uidTmp).split('_');
        for (var pt = 0; pt < partsTmp.length; pt++) {
          if (partsTmp[pt] && partsTmp[pt].match(/^\d{5,15}$/)) freq[partsTmp[pt]] = (freq[partsTmp[pt]] || 0) + 1;
        }
      }
      for (var id in freq) {
        if (freq[id] === uidElements.length) selfId = id;
      }
    }
    for (var ui = 0; ui < uidElements.length; ui++) {
      var uid = uidElements[ui].getAttribute('data-test-uid') || '';
      var parts = String(uid).split('_');
      var contactEl = mlGetMailBoxItemClickable(uidElements[ui]);
      for (var pi = 0; pi < parts.length; pi++) {
        if (parts[pi] && parts[pi].match(/^\d{5,15}$/) && parts[pi] !== selfId) {
          var cType = detectContactType(uidElements[ui], parts[pi]);
          if (!seen.has(parts[pi])) {
            seen.add(parts[pi]);
            ids.push({ id: parts[pi], element: contactEl, source: 'data-test-uid', contactType: cType });
          }
        }
      }
    }
  } catch (e) {}

  // 2. Buscar en elementos mail-box-item
  try {
    var mailItems = document.querySelectorAll(TALK_Y.SECTION_MAIL_BOX_ITEM);
    for (var mi = 0; mi < mailItems.length; mi++) {
      var innerLinks = mailItems[mi].querySelectorAll(TALK_Y.ALL_LINKS);
      for (var il = 0; il < innerLinks.length; il++) {
        tryAddFromLink(innerLinks[il], 'mail-box-item-links');
      }
    }
  } catch (e) {}

  // 3. Secciones de lista con links
  var sectionSelectors = [
    '[class*="active-limit"]', '[class*="activeLimit"]', '[class*="ActiveLimit"]',
    '[class*="active"][class*="limit"]', '[id*="active-limit"]', '[id*="activeLimit"]',
    'table[class*="mail"]', 'table[class*="message"]', '[class*="mail-list"]', '[class*="message-list"]',
    '[class*="contact-list"]', '[class*="user-list"]',
    'section', 'div[class*="list"]', 'div[class*="table"]',
    '[class*="inbox"]', '[class*="conversation"]', '[class*="thread"]', '[class*="mail-item"]',
    '[class*="msg-list"]', '[class*="chat-list"]', '[class*="feed"]',
    '[class*="letter-wrap"]', '[class*="mail-box"]',
  ];
  for (var si = 0; si < sectionSelectors.length; si++) {
    try {
      var sections = document.querySelectorAll(sectionSelectors[si]);
      for (var sj = 0; sj < sections.length; sj++) {
        var links = sections[sj].querySelectorAll(TALK_Y.ALL_LINKS);
        for (var sk = 0; sk < links.length; sk++) {
          tryAddFromLink(links[sk], sectionSelectors[si]);
        }
      }
    } catch (e) {}
  }

  // 4. Links con /profile/ en la URL
  try {
    var allLinks = document.querySelectorAll(TALK_Y.LINKS_WITH_PROFILE);
    for (var li = 0; li < allLinks.length; li++) {
      tryAddFromLink(allLinks[li], 'profile-link');
    }
  } catch (e) {}

  // 5. Fallback: cualquier link con ID numérico
  try {
    var allLinks2 = document.querySelectorAll(TALK_Y.ALL_LINKS);
    for (var li2 = 0; li2 < allLinks2.length; li2++) {
      tryAddFromLink(allLinks2[li2], 'global-fallback');
    }
  } catch (e) {}

  // 6. Email section fallback
  try {
    var emailContainer = document.querySelector('[class*="active-limit"] table, [class*="active-limit"] [class*="list"], [class*="active-limit"] [class*="table"], [class*="active-limit"] tbody');
    if (emailContainer) {
      var dataEls = emailContainer.querySelectorAll('[data-id], [data-user-id], [data-contact-id], [data-member-id], [data-profile-id], [data-test-id]');
      for (var de = 0; de < dataEls.length; de++) {
        var dataId = dataEls[de].getAttribute('data-id') || dataEls[de].getAttribute('data-user-id') || dataEls[de].getAttribute('data-contact-id') || dataEls[de].getAttribute('data-member-id') || dataEls[de].getAttribute('data-profile-id') || '';
        if (dataId && dataId.match(/^\d{5,15}$/)) tryAddId(dataId, dataEls[de], 'email-data-fallback');
        var testId = dataEls[de].getAttribute('data-test-id') || '';
          var idMatch = testId.match(/\/(\d{5,15})/);
          if (idMatch) tryAddId(idMatch[1], dataEls[de], 'email-data-test-id-fallback');
        }
        var allRows = emailContainer.querySelectorAll('tr, [class*="row"], [class*="item"]');
        for (var rr = 0; rr < allRows.length; rr++) {
          var rowText = allRows[rr].textContent || '';
          var idFound = rowText.match(/\b(\d{6,15})\b/);
          if (idFound && !seen.has(idFound[1])) {
            seen.add(idFound[1]);
            tryAddId(idFound[1], allRows[rr], 'email-text-fallback');
          }
        }
      }
    } catch (e) {}

  // 7. Busqueda en toda la pagina si hay paginacion visible
  try {
      if (document.querySelector(TALK_Y.NEXT_PAGE_BTNS) || document.querySelector('[class*="page-buttons"]')) {
        var anyBtns = document.querySelectorAll('button, a, [role="button"]');
        for (var ab = 0; ab < anyBtns.length; ab++) {
          var text = (anyBtns[ab].textContent || '').trim();
          var idCandidate = anyBtns[ab].getAttribute('data-id') || anyBtns[ab].getAttribute('href') || '';
          var extr = extractIdFromHref(idCandidate) || extractIdFromText(text + ' ' + (anyBtns[ab].getAttribute('data-user-id') || ''));
          if (extr && !seen.has(extr)) {
            seen.add(extr);
            tryAddId(extr, anyBtns[ab], 'page-wide-fallback');
          }
        }
      }
    } catch (e) {}

  lastScrapedCount = ids.length;
  scrapedContactIds = ids;
  return ids;
}

function findChatInput() {
  const selectors = [
    'textarea[class*="chat"]', 'textarea[class*="message"]', 'textarea[placeholder*="message"]',
    'textarea[placeholder*="escribe"]', 'textarea[placeholder*="type"]', 'textarea[placeholder*="Write"]',
    'div[contenteditable="true"][class*="chat"]', 'div[contenteditable="true"][class*="message"]',
    'input[class*="chat"]', 'input[class*="message"]',
    '#chatInput', '#messageInput', '#msgInput', 'textarea.chat-input',
    '[class*="chat-input"] textarea', '[class*="chat-input"] input',
    '[class*="message-input"] textarea', '[class*="message-input"] input',
    'textarea',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}

function findSendButton() {
  const selectors = [
    'button[class*="send"]', '[class*="send-btn"]', '[class*="btn-send"]',
    '[type="submit"][class*="chat"]', '[type="submit"][class*="message"]',
    'button[aria-label*="send"]', 'button[aria-label*="enviar"]',
    '#sendButton', '#btnSend', '#chatSend',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) return el;
  }
  const allButtons = document.querySelectorAll(TALK_Y.ALL_BUTTONS);
  for (const btn of allButtons) {
    const text = (btn.textContent || '').toLowerCase().trim();
    if ((text === 'send' || text === 'enviar' || text === '\u2192' || text === '\u25b6') && btn.offsetParent !== null) return btn;
  }
  return null;
}

function typeIntoInput(input, text) {
  if (!input) return false;
  try {
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (input.isContentEditable) {
      input.textContent = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return true;
  } catch (e) { return false; }
}

function findProfileLink(profileId) {
  try {
    const allLinks = document.querySelectorAll(TALK_Y.ALL_LINKS);
    for (const link of allLinks) {
      if ((link.href || '').includes(profileId)) return link;
    }
  } catch (e) {}
  try {
    const elements = document.querySelectorAll(`[data-id="${profileId}"], [data-user-id="${profileId}"], [data-contact-id="${profileId}"]`);
    if (elements.length > 0) return elements[0].querySelector(TALK_Y.ALL_LINKS) || elements[0];
  } catch (e) {}
  return null;
}

async function openProfileChat(profileId) {
  const link = findProfileLink(profileId);
  if (link) { link.click(); await sleep(2000); return true; }
  return false;
}

async function sendMailingMessage(text, profileId) {
  if (profileId) {
    const opened = await openProfileChat(profileId);
    if (!opened) return false;
    await sleep(1500);
  }
  const input = findChatInput();
  const sendBtn = findSendButton();
  if (!input || !sendBtn) return false;
  if (!typeIntoInput(input, text)) return false;
  const beforeValue = input.value || input.textContent || '';
  await sleep(1500);
  sendBtn.click();
  await sleep(1500);
  const afterValue = input.value || input.textContent || '';
  if (afterValue === beforeValue && beforeValue !== '') {
    const altBtn = document.querySelector(TALK_Y.SEND_BTN_ALT_FALLBACK);
    if (altBtn) { altBtn.click(); await sleep(1500); const afterValue2 = input.value || input.textContent || ''; if (afterValue2 === beforeValue) return false; }
    else return false;
  }
  return true;
}

async function generateAIResponse(template) {
  try {
    const token = await new Promise(r => chrome.storage.local.get('tess_jwt', d => r(d.tess_jwt)));
    if (!token) return null;
    const systemMsg = 'Eres un asistente de citas. Genera un mensaje breve, atractivo y personal para iniciar una conversación en una app de citas. Responde solo con el mensaje, sin explicaciones.';
    const userMsg = template
      ? `Genera una variación personalizada de este mensaje: "${template}"`
      : 'Genera un mensaje de invitación breve, cálido y atractivo para una app de citas.';
    const res = await fetch(`${TESSERACT_API}/api/chatgpt/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }], max_tokens: 120, temperature: 0.7 })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) { return null; }
}

async function executeMailingRound() {
  if (!mailingConfig || !mailingConfig.enabled) return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };
  if (mailingActive) return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };
  if (!isScheduleActive()) return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };

  // Redirect to email mailing if useEmailSection is enabled
  if (mailingConfig.useEmailSection) {
    return await executeEmailMailingRound();
  }

  mailingActive = true;
  mailingAbort = false;
  resetMailingDailyCounter();

  if (mailingConfig.maxDaily > 0 && mailingConfig.sentToday >= mailingConfig.maxDaily) {
    mailingActive = false; return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };
  }
  if (!isWithinWorkingHours()) { mailingActive = false; return { sent: 0, skipped: 0, blacklisted: 0, total: 0 }; }
  if (!mlBlacklistLoaded) await loadMLBlacklist();

  var contacts2 = scrapedContactIds.length > 0 ? scrapedContactIds : scrapeActiveLimitsIds();
  if (contacts2.length === 0) { mailingActive = false; return { sent: 0, skipped: 0, blacklisted: 0, total: 0 }; }

  let sent = 0, skipped = 0, blacklisted = 0, alreadyContacted = 0, activeSkipped = 0;

  for (let i = 0; i < contacts2.length; i++) {
    if (!mailingConfig.enabled || mailingAbort) break;
    if (mailingConfig.maxDaily > 0 && mailingConfig.sentToday >= mailingConfig.maxDaily) break;

    const contactId = contacts2[i].id || contacts2[i];
    const contactType = contacts2[i].contactType || 'new';

    if (mailingConfig.blockActiveDialogue && contactType === 'active') { activeSkipped++; skipped++; continue; }
    if (isInMLBlacklist(contactId)) { blacklisted++; continue; }
    if (await isContactAlreadyContactedML(contactId)) { alreadyContacted++; skipped++; continue; }
    if (contactType === 'excess_letters') { skipped++; continue; }

    const message = await getMessageForContact();
    if (!message) { skipped++; continue; }

    const success = await sendMailingMessage(message, contactId);
    if (success) {
      await markContactAsContactedML(contactId);
      mailingConfig.sentToday++;
      await saveMailingConfig();
      sent++;
      if (typeof botStats !== 'undefined') botStats.mailingSent = (botStats.mailingSent || 0) + 1;
      if (typeof window._updateMLTabUI === 'function') window._updateMLTabUI();
    } else { skipped++; }

    const delayMs = (mailingConfig.delay?.min || 3000) + Math.random() * ((mailingConfig.delay?.max || 7000) - (mailingConfig.delay?.min || 3000));
    await sleep(delayMs);
  }

  if (sent > 0) consumeScheduleCycle();
  mailingActive = false;
  const result = { sent, skipped, blacklisted, alreadyContacted, activeSkipped, total: contacts2.length };
  return result;
}

function abortMailingRound() { mailingAbort = true; }

// ─── EMAIL SECTION NAVIGATION ───
function mlIsInEmailSection() {
  return window.location.href.includes('/mails/has_limits/') || window.location.href.includes('/mail/has_limits/') || !!document.querySelector(TALK_Y.ACTIVE_LIMIT_CONTACTS) || !!document.querySelector(TALK_Y.NEXT_PAGE_BTNS) || !!document.querySelector(TALK_Y.MAIL_BOX_ITEM);
}

function mlIsOnThreadView() {
  return window.location.href.includes('/mails/view/');
}

function mlClickEmailIcon() {
  var svg = document.querySelector(TALK_Y.EMAIL_ICON_SVG);
  if (svg) {
    var btn = svg.closest('button, a, [role="button"], [class*="nav-item"], [class*="menu-item"]') || svg.parentElement;
    if (btn) { try { btn.click(); } catch (e) {} return true; }
  }
  var fallback = document.querySelector(TALK_Y.LINKS_WITH_MAIL);
  if (fallback) { try { fallback.click(); } catch (e) {} return true; }
  return false;
}

async function mlWaitForActiveLimitsUrl(timeout) {
  var start = Date.now();
  while (Date.now() - start < timeout) {
    if (window.location.href.includes('/mails/has_limits/') || window.location.href.includes('/mail/has_limits/')) return true;
    if (document.querySelector(TALK_Y.MAIL_BOX_ITEM)) return true;
    await sleep(500);
  }
  return false;
}

function mlGetCurrentPage() {
  try {
    var filled = document.querySelector('[data-test-id*="change-page-n"][data-type="filled"], [data-test-id*="change-page-n"][data-color="brand"]');
    if (filled) {
      var match = filled.getAttribute('data-test-id').match(/change-page-n\s+(\d+)/);
      if (match) return parseInt(match[1]);
    }
  } catch (e) {}
  return 1;
}

function mlGetMaxPage() {
  try {
    var btns = document.querySelectorAll(TALK_Y.NEXT_PAGE_BTNS);
    var max = 1;
    for (var i = 0; i < btns.length; i++) {
      var match = btns[i].getAttribute('data-test-id').match(/change-page-n\s+(\d+)/);
      if (match) max = Math.max(max, parseInt(match[1]));
    }
    return max;
  } catch (e) { return 1; }
}

function mlGoToPage(n) {
  try {
    var btn = document.querySelector(TALK_Y.NEXT_PAGE_BTN + n + '"]');
    if (btn) { btn.click(); return true; }
  } catch (e) {}
  return false;
}

function mlClickActiveLimitsTab() {
  var tab = document.querySelector(TALK_Y.DATA_LIMITS_TAB);
  if (tab) { try { tab.click(); } catch (e) {} return true; }
  var tab2 = document.querySelector(TALK_Y.DATA_LIMITS_TAB_FALLBACK);
  if (tab2) { try { tab2.click(); } catch (e) {} return true; }
  return false;
}

async function mlWaitForEmailContacts(timeout) {
  var start = Date.now();
  while (Date.now() - start < timeout) {
    if (document.querySelectorAll(TALK_Y.ACTIVE_LIMIT_CONTACTS).length > 0) return true;
    if (document.querySelectorAll(TALK_Y.MAIL_BOX_ITEM).length > 0) return true;
    if (document.querySelectorAll('[data-test-uid]').length > 0) return true;
    await sleep(500);
  }
  return false;
}

function mlGetCurrentUserId() {
  try {
    var idEl = document.getElementById('profileId');
    if (idEl) {
      var text = idEl.textContent || '';
      var m = text.match(/(\d{5,15})/);
      if (m) return m[1];
    }
  } catch (e) {}
  return null;
}

function mlGetMailBoxItemClickable(item) {
  if (!item) return null;
  var clickable = item.querySelector(TALK_Y.MAIL_BOX_OPEN_THREAD);
  return clickable || item;
}

function findEmailInput() {
  var selectors = [
    'textarea[class*="letter"], textarea[class*="email"], textarea[class*="mail"], textarea[class*="carta"]',
    'textarea[placeholder*="letter"], textarea[placeholder*="email"], textarea[placeholder*="carta"]',
    'div[contenteditable="true"][class*="letter"], div[contenteditable="true"][class*="email"]',
    '[class*="compose"] textarea, [class*="compose"] [contenteditable="true"]',
    '[class*="email-body"] textarea, [class*="email-body"] [contenteditable="true"]',
    '[class*="mail-body"] textarea, [class*="mail-body"] [contenteditable="true"]',
    '.letter-content textarea, .letter-content [contenteditable="true"]',
    'textarea',
  ];
  for (var i = 0; i < selectors.length; i++) {
    var el = document.querySelector(selectors[i]);
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}

function findEmailSendButton() {
  var selectors = [
    '[data-test-id*="send-mail"]',
    'button[class*="send-letter"], button[class*="send-email"], button[class*="send-mail"]',
    'button.send-button',
    'button[aria-label*="send letter"], button[aria-label*="send email"], button[aria-label*="enviar carta"]',
    '[class*="letter"] button[class*="send"], [class*="email"] button[class*="send"], [class*="mail"] button[class*="send"]',
    'button[type="submit"][class*="letter"], button[type="submit"][class*="email"]',
    '#sendLetterBtn', '#sendEmailBtn',
  ];
  for (var i = 0; i < selectors.length; i++) {
    var el = document.querySelector(selectors[i]);
    if (el && el.offsetParent !== null) return el;
  }
  // Segunda pasada: ignorar offsetParent
  for (var i2 = 0; i2 < selectors.length; i2++) {
    var el2 = document.querySelector(selectors[i2]);
    if (el2) return el2;
  }
  // Buscar por texto del boton
  var all = document.querySelectorAll(TALK_Y.ALL_BUTTONS);
  for (var j = 0; j < all.length; j++) {
    var t = (all[j].textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if ((t === 'send letter' || t === 'enviar carta' || t === 'send' || t === 'enviar' || t === '\u2192' || t.includes('send') || t.includes('enviar')) && all[j].offsetParent !== null) return all[j];
  }
  // Sin filtro offsetParent
  for (var j2 = 0; j2 < all.length; j2++) {
    var t2 = (all[j2].textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (t2 === 'send letter' || t2 === 'enviar carta' || t2 === 'send' || t2 === 'enviar' || t2 === '\u2192' || t2.includes('send') || t2.includes('enviar')) return all[j2];
  }
  // Buscar boton que contenga un elemento .label con texto "Send Letter"
  var labelBtns = document.querySelectorAll('button .label, button [class*="label"]');
  for (var k = 0; k < labelBtns.length; k++) {
    var btn = labelBtns[k].closest('button');
    if (btn) {
      var lt = (labelBtns[k].textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (lt === 'send letter' || lt === 'enviar carta' || lt === 'send' || lt === 'enviar') return btn;
    }
  }
  return null;
}

function typeIntoEmailInput(input, text) {
  if (!input) return false;
  try {
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('compositionend', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ', keyCode: 32 }));
    } else if (input.isContentEditable) {
      input.textContent = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('compositionend', { bubbles: true }));
    }
    return true;
  } catch (e) { return false; }
}

async function sendEmailLetter(text, profileId, contactEl) {
  if (contactEl) {
    var target = contactEl.querySelector(TALK_Y.MAIL_BOX_OPEN_THREAD) || contactEl;
    target.click();
    await sleep(800);
    if (mlIsOnActiveLimitsList()) return false;
    if (!findEmailInput() && !findChatInput()) {
      var parentRow = contactEl.closest('tr, [class*="row"], [class*="item"], li, [class*="contact"], [class*="user"], [class*="mail-box-item"]');
      if (parentRow && parentRow !== contactEl) {
        parentRow.click();
        await sleep(800);
      }
    }
  } else if (profileId) {
    var link = document.querySelector('a[href*="/profile/' + profileId + '"], a[href*="/' + profileId + '"], a[href*="' + profileId + '"]');
    if (link) { link.click(); await sleep(800); }
    else { return false; }
  }

  if (mlIsOnThreadView()) {
    var threadSendBtn = document.querySelector('[data-test-id*="send-letter"], [data-test-id*="compose"], [data-test-id*="reply"]');
    if (!threadSendBtn) {
      var allThreadBtns = document.querySelectorAll(TALK_Y.ALL_BUTTONS);
      for (var tb = 0; tb < allThreadBtns.length; tb++) {
        var tbt = (allThreadBtns[tb].textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if ((tbt.includes('send letter') || tbt.includes('reply') || tbt.includes('new letter') || tbt.includes('compose')) && allThreadBtns[tb].offsetParent !== null) { threadSendBtn = allThreadBtns[tb]; break; }
      }
    }
    if (threadSendBtn) {
      threadSendBtn.click();
      await sleep(800);
    }
  }

  var input = findEmailInput();
  var sendBtn = findEmailSendButton();
  if (!input) {
    input = findChatInput();
  }
  if (!sendBtn) {
    sendBtn = findSendButton();
  }
  if (!input || !sendBtn) return false;
  if (!typeIntoEmailInput(input, text)) return false;
  await sleep(300);

  var form = sendBtn.closest('form');
  if (form) {
    try { form.requestSubmit(); } catch (e) { try { form.requestSubmit(sendBtn); } catch (e2) {} }
    await sleep(1500);
  } else {
    sendBtn.removeAttribute('disabled');
    sendBtn.disabled = false;
    sendBtn.click();
    await sleep(1500);
  }
  return true;
}

// ─── EMAIL MAILING ROUND ───
async function mlEnsureActiveLimitsPage(page) {
  if (mlIsOnActiveLimitsList()) {
    if (document.querySelectorAll(TALK_Y.ACTIVE_LIMIT_CONTACTS).length > 0) {
      if (page && page > 1) { mlGoToPage(page); await sleep(800); await mlWaitForEmailContacts(3000); }
      return;
    }
  }
  if (mlIsOnThreadView()) {
    window.history.back();
    await sleep(800);
  }
  if (mlIsOnActiveLimitsList()) {
    await mlWaitForEmailContacts(3000);
    if (page && page > 1) { mlGoToPage(page); await sleep(800); await mlWaitForEmailContacts(3000); }
    return;
  }
  var attempts = 0;
  while (attempts < 5) {
    attempts++;
    if (mlIsOnActiveLimitsList()) break;
    if (!mlIsInEmailSection()) mlClickEmailIcon();
    await sleep(700);
    if (mlIsOnActiveLimitsList()) break;
    if (mlIsInEmailSection()) mlClickActiveLimitsTab();
    await sleep(800);
    if (await mlWaitForActiveLimitsUrl(2000)) {
      var urlWait = 0;
      while (urlWait < 1000 && !mlIsOnActiveLimitsList()) { await sleep(200); urlWait += 200; }
      break;
    }
  }
  await mlWaitForEmailContacts(3000);
  if (page && page > 1) {
    mlGoToPage(page);
    await sleep(800);
    await mlWaitForEmailContacts(3000);
  }
}

function mlIsOnActiveLimitsList() {
  return window.location.href.includes('/mails/has_limits/') || window.location.href.includes('/mail/has_limits/');
}

function mlReportProgress(msg) {
  if (typeof window._mlProgressCallback === 'function') {
    try { window._mlProgressCallback(msg); } catch (e) {}
  }
}

async function executeEmailMailingRound() {
  if (!mailingConfig || !mailingConfig.enabled) return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };
  if (mailingActive) return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };
  if (!isScheduleActive()) return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };

  mailingActive = true;
  mailingAbort = false;
  resetMailingDailyCounter();

  if (mailingConfig.maxDaily > 0 && mailingConfig.sentToday >= mailingConfig.maxDaily) {
    mailingActive = false; return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };
  }
  if (!isWithinWorkingHours()) { mailingActive = false; return { sent: 0, skipped: 0, blacklisted: 0, total: 0 }; }
  if (!mlBlacklistLoaded) await loadMLBlacklist();

  mlReportProgress('Navegando a seccion de correo...');
  await mlEnsureActiveLimitsPage(1);

  var maxPage = mlGetMaxPage();
  mlReportProgress('Paginas encontradas: ' + maxPage + '. Procesando...');

  var sent = 0, skipped = 0, blacklisted = 0, alreadyContacted = 0, activeSkipped = 0;
  var totalProcessed = 0;

  for (var page = 1; page <= maxPage; page++) {
    if (!mailingConfig.enabled || mailingAbort) break;
    if (mailingConfig.maxDaily > 0 && mailingConfig.sentToday >= mailingConfig.maxDaily) break;

    if (page > 1) {
      mlReportProgress('Pagina ' + page + '/' + maxPage + ' - navegando...');
      await mlEnsureActiveLimitsPage(page);
    }

    var pageContacts = scrapeActiveLimitsIds();
    if (pageContacts.length === 0) continue;

    for (var i = 0; i < pageContacts.length; i++) {
      if (!mailingConfig.enabled || mailingAbort) break;
      if (mailingConfig.maxDaily > 0 && mailingConfig.sentToday >= mailingConfig.maxDaily) break;

      var contactId = pageContacts[i].id || pageContacts[i];
      var contactType = pageContacts[i].contactType || 'new';

      if (mailingConfig.blockActiveDialogue && contactType === 'active') { activeSkipped++; skipped++; continue; }
      if (isInMLBlacklist(contactId)) { blacklisted++; continue; }
      if (await isContactAlreadyContactedML(contactId)) { alreadyContacted++; skipped++; continue; }
      if (contactType === 'excess_letters') { skipped++; continue; }

      var message = await getMessageForContact();
      if (!message) { skipped++; continue; }

      totalProcessed++;
      mlReportProgress('Enviando carta ' + totalProcessed + ' (pagina ' + page + '/' + maxPage + ') ID: ' + contactId);

      await mlEnsureActiveLimitsPage(page);

      var freshContacts = scrapeActiveLimitsIds();
      var freshContact = null;
      for (var fc = 0; fc < freshContacts.length; fc++) {
        if (freshContacts[fc].id === contactId) { freshContact = freshContacts[fc]; break; }
      }

      var success = await sendEmailLetter(message, contactId, freshContact ? freshContact.element : null);
      if (success) {
        await markContactAsContactedML(contactId);
        mailingConfig.sentToday++;
        await saveMailingConfig();
        sent++;
        if (typeof botStats !== 'undefined') botStats.mailingSent = (botStats.mailingSent || 0) + 1;
        if (typeof window._updateMLTabUI === 'function') window._updateMLTabUI();
      } else { skipped++; }

      var delayMs = (mailingConfig.delay?.min || 1000) + Math.random() * ((mailingConfig.delay?.max || 2500) - (mailingConfig.delay?.min || 1000));
      await sleep(delayMs);
    }
  }

  if (sent > 0) consumeScheduleCycle();
  mailingActive = false;
  mlReportProgress('Completado: ' + sent + ' cartas enviadas de ' + totalProcessed + ' contactos (' + maxPage + ' paginas)');
  return { sent: sent, skipped: skipped, blacklisted: blacklisted, alreadyContacted: alreadyContacted, activeSkipped: activeSkipped, total: totalProcessed };
}

async function setMailingState(enabled) {
  await loadMailingConfig();
  mailingConfig.enabled = enabled;
  await saveMailingConfig();
  if (enabled) { console.log('[ML] Activado'); }
  else { mailingAbort = true; mailingActive = false; }
}

async function updateMailingMessageTemplate(template) { await loadMailingConfig(); mailingConfig.messageTemplate = template; await saveMailingConfig(); }
async function updateMailingMaxDaily(max) { await loadMailingConfig(); mailingConfig.maxDaily = max; await saveMailingConfig(); }
async function updateMailingDelay(min, max) { await loadMailingConfig(); mailingConfig.delay = { min, max }; await saveMailingConfig(); }
async function updateMailingUseAI(useAI) { await loadMailingConfig(); mailingConfig.useAI = useAI; await saveMailingConfig(); }
async function updateMailingWorkingHours(start, end) { await loadMailingConfig(); mailingConfig.workingHours = { start, end }; await saveMailingConfig(); }
async function updateMailingRespectQuietHours(respect) { await loadMailingConfig(); mailingConfig.respectQuietHours = respect; await saveMailingConfig(); }
async function updateMailingSkipPinned(skip) { await loadMailingConfig(); mailingConfig.skipPinned = skip; await saveMailingConfig(); }
async function updateMailingStopOnBlacklist(stop) { await loadMailingConfig(); mailingConfig.stopOnBlacklistHit = stop; await saveMailingConfig(); }
async function updateMailingSchedule(enabled, startDate, frequency, cycles) {
  await loadMailingConfig();
  mailingConfig.scheduleEnabled = enabled;
  mailingConfig.scheduleStartDate = startDate || '';
  mailingConfig.scheduleFrequency = frequency || 'daily';
  mailingConfig.scheduleCycles = cycles || 30;
  mailingConfig.scheduleRemaining = cycles || 30;
  await saveMailingConfig();
}
async function updateMailingTemplates(newTmpl) {
  await loadMailingConfig();
  if (newTmpl !== undefined) mailingConfig.templatesNew = newTmpl;
  mailingConfig.messageTemplate = newTmpl || mailingConfig.messageTemplate;
  await saveMailingConfig();
}
async function updateMailingBlockActiveDialogue(block, hours) {
  await loadMailingConfig();
  mailingConfig.blockActiveDialogue = block;
  mailingConfig.activeDialogueHours = hours || 48;
  await saveMailingConfig();
}

async function updateMailingUseEmailSection(useEmail) {
  await loadMailingConfig();
  mailingConfig.useEmailSection = useEmail;
  await saveMailingConfig();
}

function getMailingConfig() { return mailingConfig; }

function getMailingStats() {
  return {
    active: mailingActive,
    sentToday: mailingConfig?.sentToday || 0,
    maxDaily: mailingConfig?.maxDaily || 0,
    blacklistSize: mlBlacklist.length,
    blacklistLoaded: mlBlacklistLoaded,
    lastScrapedCount,
    scheduleEnabled: mailingConfig?.scheduleEnabled || false,
    scheduleRemaining: mailingConfig?.scheduleRemaining || 0,
    scheduleCycles: mailingConfig?.scheduleCycles || 0,
    blockActiveDialogue: mailingConfig?.blockActiveDialogue || false
  };
}

async function initSmartMailing() {
  await loadMailingConfig();
  await loadMLBlacklist();
  console.log('[ML] Module initialized, enabled:', mailingConfig.enabled, '| Blacklist:', mlBlacklist.length, 'contactos');
  if (mailingConfig.scheduleEnabled && mailingConfig.scheduleRemaining > 0) {
    console.log('[ML] Schedule: ' + mailingConfig.scheduleRemaining + '/' + mailingConfig.scheduleCycles + ' ciclos restantes (' + mailingConfig.scheduleFrequency + ')');
  }
  if (mlIsOnActiveLimitsList()) {
    let attempts = 0;
    const maxAttempts = 8;
    const retryScrape = () => {
      attempts++;
      const result = scrapeActiveLimitsIds();
      if (result.length > 0 || attempts >= maxAttempts) return;
      setTimeout(retryScrape, 2000);
    };
    setTimeout(retryScrape, 3000);
  }
}

window._saveMailingConfigDirect = saveMailingConfig;
window._getMailingConfigDirect = () => mailingConfig;
window._loadMailingConfigDirect = loadMailingConfig;
window._updateMailingMessageTemplate = updateMailingMessageTemplate;
window._updateMailingMaxDaily = updateMailingMaxDaily;
window._updateMailingDelay = updateMailingDelay;
window._updateMailingUseAI = updateMailingUseAI;
window._updateMailingWorkingHours = updateMailingWorkingHours;
window._updateMailingRespectQuietHours = updateMailingRespectQuietHours;
window._updateMailingSkipPinned = updateMailingSkipPinned;
window._updateMailingStopOnBlacklist = updateMailingStopOnBlacklist;
window._updateMailingSchedule = updateMailingSchedule;
window._updateMailingTemplates = updateMailingTemplates;
window._updateMailingBlockActiveDialogue = updateMailingBlockActiveDialogue;
window._updateMailingUseEmailSection = updateMailingUseEmailSection;
window._setMailingState = setMailingState;
window._executeMailingRound = executeMailingRound;
window._executeEmailMailingRound = executeEmailMailingRound;
window._abortMailingRound = abortMailingRound;
window._isInMLBlacklist = isInMLBlacklist;
window._reloadMLBlacklist = reloadMLBlacklist;
window._addToMLBlacklist = async function(id) {
  if (!id || mlBlacklist.includes(String(id))) return;
  mlBlacklist.push(String(id));
  console.log('[ML] Added to blacklist:', id, 'total:', mlBlacklist.length);
  try {
    const stored = await chrome.storage.local.get(['tess_jwt']);
    if (!stored.tess_jwt) return;
    await fetch(TESSERACT_API + '/api/tess/blacklist/add', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + stored.tess_jwt, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: String(id) })
    });
  } catch (e) {
    console.error('[ML] Error persisting blacklist:', e);
  }
};
window._removeFromMLBlacklist = function(id) {
  if (!id) return;
  const s = String(id);
  const idx = mlBlacklist.indexOf(s);
  if (idx !== -1) {
    mlBlacklist.splice(idx, 1);
    console.log('[ML] Removed from blacklist:', id);
  }
};
window._getMailingAbortState = function() { return mailingAbort; };
window._getMailingStats = getMailingStats;
window._scrapeActiveLimitsIds = scrapeActiveLimitsIds;
