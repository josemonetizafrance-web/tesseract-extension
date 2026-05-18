const MAILING_STORAGE_KEY = 'tess_mailing_config';
const ML_CONTACTED_HISTORY_KEY = 'tess_ml_contacted_history';
var TESSERACT_API = 'https://tesseract-jblo.onrender.com';

let mlBlacklist = [];
let mlBlacklistLoaded = false;
let mlBlacklistLoadPromise = null;

async function loadMLBlacklist() {
  if (mlBlacklistLoadPromise) return mlBlacklistLoadPromise;
  mlBlacklistLoadPromise = (async () => {
    try {
      const stored = await chrome.storage.local.get(['tess_jwt']);
      if (!stored.tess_jwt) { mlBlacklistLoadPromise = null; return; }
      const res = await fetch(`${TESSERACT_API}/api/tess/blacklist`, {
        headers: { 'Authorization': 'Bearer ' + stored.tess_jwt }
      });
      if (res.ok) {
        const data = await res.json();
        mlBlacklist = (data.blacklist || []).map(String);
        mlBlacklistLoaded = true;
      }
    } catch (e) {}
    mlBlacklistLoadPromise = null;
  })();
  return mlBlacklistLoadPromise;
}

async function reloadMLBlacklist() {
  mlBlacklist = []; mlBlacklistLoaded = false; mlBlacklistLoadPromise = null;
  await loadMLBlacklist();
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
  } catch (e) {}
}

function isContactPinnedOrSaved(contactEl) {
  try {
    const text = contactEl.textContent.toLowerCase();
    if (text.includes('pin') || text.includes('saved') || text.includes('fijado') || text.includes('guardado')) return true;
    if (contactEl.querySelector('[class*="pin"], [class*="saved"], [class*="star"], [class*="fixed"]')) return true;
    return false;
  } catch (e) { return false; }
}

const DEFAULT_MAILING_CONFIG = {
  enabled: false,
  maxDaily: 30,
  sentToday: 0,
  lastResetDate: '',
  delay: { min: 3000, max: 7000 },
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
  templatesRecurring: 'Hola! ¿Cómo estás? Hace tiempo que no hablamos, me encantaría retomar la conversación.',
  blockActiveDialogue: true,
  activeDialogueHours: 48,
  multiProfileEnabled: false,
  currentProfile: ''
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
  } catch (e) {}
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
    const signals = ['respondió', 'respondio', 'replied', 'contestó', 'contesto', 'te escribió', 'wrote to you',
      'nuevo mensaje', 'new message', 'te ha escrito', 'has written', 'respondiste', 'you replied',
      'conversación activa', 'active conversation', 'chat activo', 'active chat'];
    for (const s of signals) {
      if (text.includes(s)) return true;
    }
    const timeEl = contactEl.querySelector('[class*="time"], [class*="date"], [class*="updated"], small, time');
    if (timeEl) {
      const timeText = timeEl.textContent.toLowerCase();
      if (timeText.includes('min') || timeText.includes('hour') || timeText.includes('hora') || timeText.includes('minuto')) return true;
    }
    return false;
  } catch (e) { return false; }
}

function detectContactType(contactEl, contactId) {
  if (hasActiveDialogue(contactEl)) return 'active';
  if (contactId && isContactAlreadyContactedML(contactId)) return 'recurring';
  return 'new';
}

async function getMessageForContact(contactType) {
  var template = mailingConfig.messageTemplate;
  if (contactType === 'new' && mailingConfig.templatesNew) template = mailingConfig.templatesNew;
  else if (contactType === 'recurring' && mailingConfig.templatesRecurring) template = mailingConfig.templatesRecurring;
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

function scrapeActiveLimitsIds() {
  const ids = [];
  const seen = new Set();
  const sectionSelectors = [
    '[class*="active-limit"]', '[class*="activeLimit"]', '[class*="ActiveLimit"]',
    '[class*="active"][class*="limit"]', '[id*="active-limit"]', '[id*="activeLimit"]',
    'table[class*="mail"]', 'table[class*="message"]', '[class*="mail-list"]', '[class*="message-list"]',
    '[class*="contact-list"]', '[class*="user-list"]',
    'section', 'div[class*="list"]', 'div[class*="table"]',
  ];
  for (const sel of sectionSelectors) {
    try {
      const sections = document.querySelectorAll(sel);
      for (const section of sections) {
        if (mailingConfig.skipPinned && isContactPinnedOrSaved(section)) continue;
        if (mailingConfig.blockActiveDialogue && hasActiveDialogue(section)) continue;
        const links = section.querySelectorAll('a[href]');
        for (const link of links) {
          const id = extractIdFromHref(link.href) || extractIdFromHref(link.getAttribute('href'));
          if (id && !seen.has(id)) {
            seen.add(id);
            ids.push({ id, element: link, source: sel, contactType: detectContactType(section, id) });
          }
        }
      }
    } catch (e) {}
  }
  if (ids.length === 0) {
    try {
      const allLinks = document.querySelectorAll('a[href]');
      for (const link of allLinks) {
        const id = extractIdFromHref(link.href);
        if (id && !seen.has(id)) {
          const parent = link.closest('[class*="contact"], [class*="user"], [class*="member"], [class*="profile"], [class*="item"], [class*="row"], tr');
          if (parent) {
            if (mailingConfig.skipPinned && isContactPinnedOrSaved(parent)) continue;
            if (mailingConfig.blockActiveDialogue && hasActiveDialogue(parent)) continue;
          }
          seen.add(id);
          ids.push({ id, element: link, source: 'global-fallback', contactType: 'new' });
        }
      }
    } catch (e) {}
  }
  lastScrapedCount = ids.length;
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
  const allButtons = document.querySelectorAll('button, [role="button"]');
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
    const allLinks = document.querySelectorAll('a[href]');
    for (const link of allLinks) {
      if ((link.href || '').includes(profileId)) return link;
    }
  } catch (e) {}
  try {
    const elements = document.querySelectorAll(`[data-id="${profileId}"], [data-user-id="${profileId}"], [data-contact-id="${profileId}"]`);
    if (elements.length > 0) return elements[0].querySelector('a[href]') || elements[0];
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
    const altBtn = document.querySelector('[class*="send"]:not(button), [class*="submit"]:not(button)');
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

  mailingActive = true;
  mailingAbort = false;
  resetMailingDailyCounter();

  if (mailingConfig.maxDaily > 0 && mailingConfig.sentToday >= mailingConfig.maxDaily) {
    mailingActive = false; return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };
  }
  if (!isWithinWorkingHours()) { mailingActive = false; return { sent: 0, skipped: 0, blacklisted: 0, total: 0 }; }
  if (!mlBlacklistLoaded) await loadMLBlacklist();

  const contacts = scrapeActiveLimitsIds();
  if (contacts.length === 0) { mailingActive = false; return { sent: 0, skipped: 0, blacklisted: 0, total: 0 }; }

  let sent = 0, skipped = 0, blacklisted = 0, alreadyContacted = 0, activeSkipped = 0;

  for (let i = 0; i < contacts.length; i++) {
    if (!mailingConfig.enabled || mailingAbort) break;
    if (mailingConfig.maxDaily > 0 && mailingConfig.sentToday >= mailingConfig.maxDaily) break;

    const contact = contacts[i];
    const contactId = contact.id;
    const contactType = contact.contactType || 'new';

    if (contactType === 'active') { activeSkipped++; skipped++; continue; }
    if (isInMLBlacklist(contactId)) { blacklisted++; continue; }
    if (await isContactAlreadyContactedML(contactId)) { alreadyContacted++; skipped++; continue; }

    if (mailingConfig.skipPinned && contact.element) {
      const parent = contact.element.closest('[class*="contact"], [class*="user"], [class*="member"], [class*="profile"], [class*="item"], [class*="row"], tr');
      if (parent && isContactPinnedOrSaved(parent)) { skipped++; continue; }
    }

    const message = await getMessageForContact(contactType);
    if (!message) { skipped++; continue; }

    const success = await sendMailingMessage(message, contactId);
    if (success) {
      await markContactAsContactedML(contactId);
      mailingConfig.sentToday++;
      await saveMailingConfig();
      sent++;
    } else { skipped++; }

    const delayMs = (mailingConfig.delay?.min || 3000) + Math.random() * ((mailingConfig.delay?.max || 7000) - (mailingConfig.delay?.min || 3000));
    await sleep(delayMs);
  }

  if (sent > 0) consumeScheduleCycle();
  mailingActive = false;
  const result = { sent, skipped, blacklisted, alreadyContacted, activeSkipped, total: contacts.length };
  return result;
}

function abortMailingRound() { mailingAbort = true; }

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
async function updateMailingTemplates(newTmpl, recurringTmpl) {
  await loadMailingConfig();
  if (newTmpl !== undefined) mailingConfig.templatesNew = newTmpl;
  if (recurringTmpl !== undefined) mailingConfig.templatesRecurring = recurringTmpl;
  await saveMailingConfig();
}
async function updateMailingBlockActiveDialogue(block, hours) {
  await loadMailingConfig();
  mailingConfig.blockActiveDialogue = block;
  mailingConfig.activeDialogueHours = hours || 48;
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
window._setMailingState = setMailingState;
window._executeMailingRound = executeMailingRound;
window._abortMailingRound = abortMailingRound;
window._reloadMLBlacklist = reloadMLBlacklist;
window._getMailingStats = getMailingStats;
window._scrapeActiveLimitsIds = scrapeActiveLimitsIds;
