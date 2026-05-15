// TESSERACT v24 - Smart Mailing Module
// Invitaciones programadas a perfiles usando chrome.alarms
// La generación de mensajes con IA se hace a través del servidor (Groq API Key)
// Fuentes de contactos: Active Limits (MAIL), Messages Active, Contact List (DOM)
// NO se procesan contactos Pinneados o Guardados ni contactos en Blacklist

const MAILING_STORAGE_KEY = 'tess_mailing_config';
const MAILING_QUEUE_KEY = 'tess_mailing_queue';
const ML_CONTACTED_HISTORY_KEY = 'tess_ml_contacted_history';
const TESSERACT_API = window.TESSERACT_API || 'https://tesseract-jblo.onrender.com';

// Variables blacklist
let mlBlacklist = [];

// Cargar blacklist
async function loadMLBlacklist() {
  try {
    const stored = await chrome.storage.local.get(['tess_jwt']);
    if (stored.tess_jwt) {
      const res = await fetch(`${TESSERACT_API}/api/tess/blacklist`, {
        headers: { 'Authorization': 'Bearer ' + stored.tess_jwt }
      });
      const data = await res.json();
      mlBlacklist = data.blacklist || [];
    }
  } catch (e) {}
}

// Verificar blacklist
function isInMLBlacklist(contactId) {
  if (!contactId) return false;
  return mlBlacklist.includes(contactId);
}

// Iniciar carga
loadMLBlacklist();

async function isContactAlreadyContactedML(profileId) {
  try {
    const data = await chrome.storage.local.get([ML_CONTACTED_HISTORY_KEY]);
    const history = data[ML_CONTACTED_HISTORY_KEY] || {};
    return history[profileId] === true;
  } catch (e) { return false; }
}

async function markContactAsContactedML(profileId) {
  try {
    const data = await chrome.storage.local.get([ML_CONTACTED_HISTORY_KEY]);
    const history = data[ML_CONTACTED_HISTORY_KEY] || {};
    history[profileId] = true;
    await chrome.storage.local.set({ [ML_CONTACTED_HISTORY_KEY]: history });
  } catch (e) { console.error('[ML] Error guardando historial:', e); }
}

function isContactPinnedOrSaved(contactEl) {
  try {
    const text = contactEl.textContent.toLowerCase();
    if (text.includes('pin') || text.includes('saved') || text.includes('fijado') || text.includes('guardado')) return true;
    if (contactEl.querySelector('[class*="pin"], [class*="saved"], [class*="star"], [class*="fixed"], [src*="pin"], [src*="star"], [data-pin], [data-saved]')) return true;
    return false;
  } catch (e) { return false; }
}

const DEFAULT_MAILING_CONFIG = {
  enabled: false,
  intervalMinutes: 60,
  maxDaily: 30,
  perRound: 10,
  sentToday: 0,
  lastResetDate: '',
  delay: { min: 2000, max: 5000 },
  sources: {
    useCollectedIds: true,
    useManualList: false,
    manualIds: [],
    domSources: ['active-limits']
  },
  messageTemplate: 'Hola! Me encantaría conocerte mejor. ¿Te gustaría conversar un rato?',
  targetCategories: ['Like', 'Follow', 'Saludo'],
  useAI: false,
  workingHours: { start: 8, end: 22 },
  respectQuietHours: true
};

let mailingConfig = null;
let mailingQueue = [];
let mailingActive = false;
let mailingTimer = null;

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
    console.log('[MAILING] Config guardada OK');
  } catch (e) {
    console.error('[MAILING] Error saving config:', e);
  }
}

async function loadMailingQueue() {
  try {
    const r = await chrome.storage.local.get([MAILING_QUEUE_KEY]);
    mailingQueue = r[MAILING_QUEUE_KEY] || [];
  } catch (e) {
    mailingQueue = [];
  }
  return mailingQueue;
}

async function saveMailingQueue() {
  try {
    await chrome.storage.local.set({ [MAILING_QUEUE_KEY]: mailingQueue });
  } catch (e) {
    console.error('[MAILING] Error saving queue:', e);
  }
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

// ============ DOM CONTACT FINDER (integrado) ============

// Extraer ID numérico de texto
function _extractIdFromText(text) {
  if (!text) return null;
  const match = text.trim().match(/\b(\d{6,15})\b/);
  return match ? match[1] : null;
}

// Extraer IDs de hrefs de enlaces
function _extractIdsFromHrefs(elements) {
  const ids = new Set();
  for (const el of elements) {
    const href = (el.href || el.getAttribute('href') || '');
    const match = href.match(/\/(\d{6,15})(?:[/?#]|$)/);
    if (match) ids.add(match[1]);
    const textId = _extractIdFromText(el.textContent || '');
    if (textId) ids.add(textId);
  }
  return ids;
}

// Obtener IDs desde Active Limits (MAIL) - excluye pinneados/guardados
function getIdsFromMailingActiveLimits() {
  const ids = new Set();
  const allAnchors = document.querySelectorAll('a[href]');
  allAnchors.forEach(a => {
    const href = a.href || '';
    const match = href.match(/\/(\d{6,15})(?:[/?#]|$)/);
    if (match) {
      const parent = a.closest('[class*="active"], [class*="limit"], [class*="Active"], [id*="active"]');
      if (parent) {
        if (isContactPinnedOrSaved(parent)) return;
        ids.add(match[1]);
      }
    }
  });
  console.log('[ML] Active Limits IDs:', ids.size);
  return Array.from(ids);
}

// Obtener IDs desde Messages - Active conversations - excluye pinneados/guardados
function getIdsFromMessagesActive() {
  const ids = new Set();
  const containerSelectors = [
    '[class*="message"][class*="active"]',
    '[class*="conversation"][class*="active"]',
    '[class*="mailbox"]',
    '[class*="inbox"]',
    '[id*="messages"]',
    '[id*="mailbox"]'
  ];
  const linkSelectors = [
    'a[href*="/member/"]',
    'a[href*="/user/"]',
    'a[href*="/profile/"]'
  ];

  for (const cs of containerSelectors) {
    try {
      const containers = document.querySelectorAll(cs);
      for (const container of containers) {
        if (isContactPinnedOrSaved(container)) continue;
        for (const ls of linkSelectors) {
          const links = container.querySelectorAll(ls);
          for (const link of links) {
            const href = link.href || '';
            const match = href.match(/\/(\d{6,15})(?:[/?#]|$)/);
            if (match) ids.add(match[1]);
          }
        }
      }
    } catch (e) {}
  }

  // También todos los enlaces con IDs numéricos dentro de contenedores de mensajes
  try {
    const msgAreas = document.querySelectorAll('[class*="message"], [class*="conversation"], [class*="inbox"]');
    for (const area of msgAreas) {
      const allLinks = area.querySelectorAll('a[href]');
      for (const link of allLinks) {
        const href = link.href || '';
        const match = href.match(/\/(\d{6,15})(?:[/?#]|$)/);
        if (match) ids.add(match[1]);
      }
    }
  } catch (e) {}

  console.log('[ML] Messages Active IDs:', ids.size);
  return Array.from(ids);
}

// Obtener IDs desde Contact List (DOM general) - excluye pinneados/guardados
function getIdsFromContactList() {
  const ids = new Set();
  try {
    const allLinks = document.querySelectorAll('a[href]');
    for (const link of allLinks) {
      const parent = link.closest('[class*="contact"], [class*="member"], [class*="profile"], [class*="item"]');
      if (parent && isContactPinnedOrSaved(parent)) continue;
      const href = link.href || '';
      const match = href.match(/\/(\d{6,15})(?:[/?#]|$)/);
      if (match) ids.add(match[1]);
    }
  } catch (e) {}
  console.log('[ML] Contact List IDs:', ids.size);
  return Array.from(ids);
}

// Función principal de recolección DOM
function collectIDsFromDOM(domSources) {
  const ids = new Set();
  const sources = Array.isArray(domSources) ? domSources : [domSources || 'active-limits'];

  for (const src of sources) {
    switch (src) {
      case 'active-limits':
        getIdsFromMailingActiveLimits().forEach(id => ids.add(id));
        break;
      case 'messages-active':
        getIdsFromMessagesActive().forEach(id => ids.add(id));
        break;
      case 'contact-list':
        getIdsFromContactList().forEach(id => ids.add(id));
        break;
    }
  }
  console.log('[ML] Total DOM IDs recolectados:', ids.size);
  return Array.from(ids);
}

// Genera mensaje AI a través del backend (Groq API Key en servidor Render)
async function generateAIResponse(template) {
  try {
    const token = await new Promise(r => chrome.storage.local.get('tess_jwt', d => r(d.tess_jwt)));
    if (!token) return null;

    const systemMsg = `Eres un asistente de citas. Genera un mensaje breve, atractivo y personal para iniciar una conversación en una app de citas. Responde solo con el mensaje, sin explicaciones.`;
    const userMsg = template
      ? `Genera una variación personalizada de este mensaje de invitación: "${template}"`
      : 'Genera un mensaje de invitación breve, cálido y atractivo para una app de citas.';

    const res = await fetch('https://tesseract-jblo.onrender.com/api/chatgpt/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg }
        ],
        max_tokens: 120,
        temperature: 0.7
      })
    });

    if (!res.ok) {
      console.warn('[MAIL-AI] Backend error:', res.status);
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error('[MAIL-AI] Error:', e.message);
    return null;
  }
}

// Obtiene el mensaje a enviar (con AI o template estático)
async function getMailingMessage() {
  if (mailingConfig.useAI) {
    const aiResponse = await generateAIResponse(mailingConfig.messageTemplate);
    return aiResponse || mailingConfig.messageTemplate;
  }
  return mailingConfig.messageTemplate;
}

async function buildMailingQueue() {
  const queue = [];
  const now = Date.now();

  // 1. IDs recolectados previamente (barrido)
  if (mailingConfig.sources.useCollectedIds) {
    try {
      const data = await chrome.storage.local.get(['tess_ids']);
      const collectedIds = data.tess_ids || {};
      for (const cat of (mailingConfig.targetCategories || ['Like', 'Follow', 'Saludo'])) {
        const ids = collectedIds[cat] || [];
        for (const id of ids) {
          if (id) queue.push({ id, category: cat, source: 'collected', sent: false, attempts: 0 });
        }
      }
    } catch (e) {
      console.error('[MAILING] Error cargando IDs recolectados:', e);
    }
  }

  // 2. IDs desde DOM: Active Limits (MAIL) y Messages Active
  if (mailingConfig.sources.domSources && mailingConfig.sources.domSources.length > 0) {
    try {
      const domIds = collectIDsFromDOM(mailingConfig.sources.domSources);
      for (const id of domIds) {
        if (id && !queue.find(q => q.id === id)) {
          queue.push({ id, category: 'DOM', source: 'dom', sent: false, attempts: 0 });
        }
      }
    } catch (e) {
      console.error('[MAILING] Error cargando IDs del DOM:', e);
    }
  }

  // 3. Lista manual
  if (mailingConfig.sources.useManualList && mailingConfig.sources.manualIds && mailingConfig.sources.manualIds.length > 0) {
    for (const id of mailingConfig.sources.manualIds) {
      if (id && !queue.find(q => q.id === id)) {
        queue.push({ id, category: 'Manual', source: 'manual', sent: false, attempts: 0 });
      }
    }
  }

  console.log('[MAILING] Queue construida con', queue.length, 'perfiles');
  return queue;
}

function findChatInput() {
  const selectors = [
    'textarea[class*="chat"]', 'textarea[class*="message"]', 'textarea[placeholder*="message"]',
    'textarea[placeholder*="escribe"]', 'textarea[placeholder*="type"]',
    'div[contenteditable="true"][class*="chat"]', 'div[contenteditable="true"][class*="message"]',
    'input[class*="chat"]', 'input[class*="message"]',
    '#chatInput', '#messageInput', '#msgInput', 'textarea.chat-input',
    '[class*="chat-input"] textarea', '[class*="chat-input"] input',
    '[class*="message-input"] textarea', '[class*="message-input"] input'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function findSendButton() {
  const selectors = [
    'button[class*="send"]', '[class*="send-btn"]', '[class*="btn-send"]',
    '[type="submit"][class*="chat"]', '[type="submit"][class*="message"]',
    'button[aria-label*="send"]', 'button[aria-label*="enviar"]',
    '#sendButton', '#btnSend', '#chatSend'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  const allButtons = document.querySelectorAll('button, [role="button"]');
  for (const btn of allButtons) {
    const text = (btn.textContent || '').toLowerCase().trim();
    if (text === 'send' || text === 'enviar' || text === '\u2192' || text === '\u25b6') {
      if (btn.offsetParent !== null) return btn;
    }
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
  } catch (e) {
    console.error('[MAILING] Error typing:', e);
    return false;
  }
}

function findProfileLink(profileId) {
  const selectors = [
    'a[href*="' + profileId + '"]',
    '[data-id="' + profileId + '"] a',
    '[class*="profile"][href*="' + profileId + '"]'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

async function openProfileChat(profileId) {
  const link = findProfileLink(profileId);
  if (link) {
    link.click();
    await sleep(2000);
    return true;
  }

  const allLinks = document.querySelectorAll('a[href]');
  for (const link of allLinks) {
    if (link.href.includes(profileId)) {
      link.click();
      await sleep(2000);
      return true;
    }
  }
  return false;
}

async function sendMailingMessage(text, profileId) {
  if (profileId) {
    const opened = await openProfileChat(profileId);
    if (!opened) {
      console.warn('[MAILING] Could not open chat for profile:', profileId);
      return false;
    }
    await sleep(1500);
    const currentUrl = window.location.href;
    if (!currentUrl.includes(profileId) && !currentUrl.includes('/chat/')) {
      console.warn('[MAILING] Chat no se abrió correctamente');
      return false;
    }
  }

  const input = findChatInput();
  if (!input) {
    console.warn('[MAILING] No chat input found');
    return false;
  }

  const sendBtn = findSendButton();
  if (!sendBtn) {
    console.warn('[MAILING] No send button found');
    return false;
  }

  if (!typeIntoInput(input, text)) return false;

  const initialInputValue = input.value;
  await sleep(1500);
  sendBtn.click();
  await sleep(1000);

  if (input.value === initialInputValue) {
    console.warn('[MAILING] Mensaje no se envió - input sin cambios');
    return false;
  }

  console.log('[MAILING] Message sent to profile', profileId || 'current');
  return true;
}

// ============ ALARM MANAGEMENT ============
function setupMailingAlarm() {
  if (!mailingConfig || !mailingConfig.enabled) return;

  const interval = mailingConfig.intervalMinutes || 60;

  chrome.runtime.sendMessage({
    action: 'MAILING_SETUP_ALARM',
    intervalMinutes: interval
  });

  console.log('[MAILING] Alarm set for every', interval, 'minutes');
}

function clearMailingAlarm() {
  chrome.runtime.sendMessage({
    action: 'MAILING_CLEAR_ALARM'
  });
  console.log('[MAILING] Alarm cleared');
}

async function executeMailingRound() {
  if (!mailingConfig || !mailingConfig.enabled) return;
  if (mailingActive) {
    console.log('[MAILING] Already active, skipping round');
    return;
  }

  mailingActive = true;

  try {
    resetMailingDailyCounter();

    if (mailingConfig.maxDaily > 0 && mailingConfig.sentToday >= mailingConfig.maxDaily) {
      console.log('[MAILING] Daily limit reached:', mailingConfig.sentToday);
      mailingActive = false;
      return;
    }

    if (!isWithinWorkingHours()) {
      console.log('[MAILING] Outside working hours, skipping');
      mailingActive = false;
      return;
    }

    const queue = await buildMailingQueue();
    if (queue.length === 0) {
      console.log('[MAILING] No profiles in queue');
      mailingActive = false;
      return;
    }

    const remaining = mailingConfig.maxDaily - mailingConfig.sentToday;
    const perRound = mailingConfig.perRound || 10;
    const toSend = Math.min(perRound, remaining, queue.length);

    for (let i = 0; i < toSend && i < queue.length; i++) {
      if (!mailingConfig.enabled) break;
      if (mailingConfig.maxDaily > 0 && mailingConfig.sentToday >= mailingConfig.maxDaily) break;

      const entry = queue[i];
      
      // Verificar blacklist
      if (isInMLBlacklist(entry.id)) {
        console.log('[ML] ⛔ Saltando (blacklist):', entry.id);
        continue;
      }
      
      if (await isContactAlreadyContactedML(entry.id)) {
        console.log('[ML] Saltando ID ya contactado:', entry.id);
        continue;
      }
      
      let message = await getMailingMessage();

      const success = await sendMailingMessage(message, entry.id);
      if (success) {
        await markContactAsContactedML(entry.id);
        mailingConfig.sentToday++;
        await saveMailingConfig();
      }

      const delayMs = (mailingConfig.delay?.min || 2000) + Math.random() * ((mailingConfig.delay?.max || 5000) - (mailingConfig.delay?.min || 2000));
      await sleep(delayMs);
    }
  } catch (e) {
    console.error('[MAILING] Round error:', e);
  }

  mailingActive = false;
}

// ============ CONFIG UPDATES ============
async function setMailingState(enabled) {
  await loadMailingConfig();
  mailingConfig.enabled = enabled;
  await saveMailingConfig();
  if (enabled) setupMailingAlarm();
  else clearMailingAlarm();
}

async function updateMailingInterval(minutes) {
  await loadMailingConfig();
  mailingConfig.intervalMinutes = minutes;
  await saveMailingConfig();
  if (mailingConfig.enabled) setupMailingAlarm();
}

async function updateMailingMessageTemplate(template) {
  await loadMailingConfig();
  mailingConfig.messageTemplate = template;
  await saveMailingConfig();
}

async function updateMailingMaxDaily(max) {
  await loadMailingConfig();
  mailingConfig.maxDaily = max;
  await saveMailingConfig();
}

async function updateMailingSources(sources) {
  await loadMailingConfig();
  if (sources.useCollectedIds !== undefined) mailingConfig.sources.useCollectedIds = sources.useCollectedIds;
  if (sources.useManualList !== undefined) mailingConfig.sources.useManualList = sources.useManualList;
  if (sources.manualIds !== undefined) mailingConfig.sources.manualIds = sources.manualIds;
  if (sources.targetCategories !== undefined) mailingConfig.sources.targetCategories = sources.targetCategories;
  if (sources.domSources !== undefined) mailingConfig.sources.domSources = sources.domSources;
  await saveMailingConfig();
}

async function updateMailingUseAI(useAI) {
  await loadMailingConfig();
  mailingConfig.useAI = useAI;
  await saveMailingConfig();
}

async function updateMailingWorkingHours(start, end) {
  await loadMailingConfig();
  mailingConfig.workingHours.start = start;
  mailingConfig.workingHours.end = end;
  await saveMailingConfig();
}

function getMailingConfig() {
  return mailingConfig;
}

// ============ INIT ============
async function initSmartMailing() {
  await loadMailingConfig();
  await loadMailingQueue();
  await initContactedHistoryFromCollected();
  if (mailingConfig.enabled) setupMailingAlarm();
  console.log('[MAILING] Module initialized, enabled:', mailingConfig.enabled);
}

async function initContactedHistoryFromCollected() {
  try {
    const data = await chrome.storage.local.get(['tess_ids']);
    const ids = data.tess_ids || {};
    const historyData = await chrome.storage.local.get([ML_CONTACTED_HISTORY_KEY]);
    let history = historyData[ML_CONTACTED_HISTORY_KEY] || {};
    let added = 0;
    for (const cat of ['Like', 'Follow', 'Saludo', 'Cartas']) {
      if (Array.isArray(ids[cat])) {
        for (const id of ids[cat]) {
          if (id && !history[id]) {
            history[id] = true;
            added++;
          }
        }
      }
    }
    if (added > 0) {
      await chrome.storage.local.set({ [ML_CONTACTED_HISTORY_KEY]: history });
      console.log('[ML] Historial inicializado con', added, 'IDs de tess_ids');
    }
  } catch (e) { console.error('[ML] Error inicializando historial:', e); }
}

// ============ GLOBAL ACCESSORS (for panels) ============
window._saveMailingConfigDirect = saveMailingConfig;
window._getMailingConfigDirect = () => mailingConfig;
window._loadMailingConfigDirect = loadMailingConfig;
window._updateMailingInterval = updateMailingInterval;
window._updateMailingMessageTemplate = updateMailingMessageTemplate;
window._updateMailingMaxDaily = updateMailingMaxDaily;
window._updateMailingSources = updateMailingSources;
window._updateMailingUseAI = updateMailingUseAI;
window._updateMailingWorkingHours = updateMailingWorkingHours;
window._setMailingState = setMailingState;