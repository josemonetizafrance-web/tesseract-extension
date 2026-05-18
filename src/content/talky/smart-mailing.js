// TESSERACT v24 - Smart Mailing Module
// Barrido de cartas en Active Limits (seccion MAIL de talkytimes)
// Condicion principal: BLOQUEA envio a IDs en blacklist
// La generacion de mensajes con IA se hace a traves del servidor (Groq API Key)

const MAILING_STORAGE_KEY = 'tess_mailing_config';
const ML_CONTACTED_HISTORY_KEY = 'tess_ml_contacted_history';
var TESSERACT_API = 'https://tesseract-jblo.onrender.com';

// Variables blacklist
let mlBlacklist = [];
let mlBlacklistLoaded = false;
let mlBlacklistLoadPromise = null;

// Cargar blacklist desde servidor (con deduplicacion de llamadas)
async function loadMLBlacklist() {
  if (mlBlacklistLoadPromise) return mlBlacklistLoadPromise;
  mlBlacklistLoadPromise = (async () => {
    try {
      const stored = await chrome.storage.local.get(['tess_jwt']);
      if (!stored.tess_jwt) {
        console.log('[ML] Sin token JWT, blacklist pendiente de login');
        mlBlacklistLoadPromise = null;
        return;
      }
      const res = await fetch(`${TESSERACT_API}/api/tess/blacklist`, {
        headers: { 'Authorization': 'Bearer ' + stored.tess_jwt }
      });
      if (res.ok) {
        const data = await res.json();
        mlBlacklist = (data.blacklist || []).map(String);
        mlBlacklistLoaded = true;
        console.log('[ML] Blacklist cargada:', mlBlacklist.length, 'contactos');
      } else {
        console.warn('[ML] Error HTTP cargando blacklist:', res.status);
      }
    } catch (e) {
      console.warn('[ML] Error cargando blacklist:', e.message);
    }
    mlBlacklistLoadPromise = null;
  })();
  return mlBlacklistLoadPromise;
}

// Recargar blacklist (llamar despues del login o al modificar blacklist)
async function reloadMLBlacklist() {
  mlBlacklist = [];
  mlBlacklistLoaded = false;
  mlBlacklistLoadPromise = null;
  await loadMLBlacklist();
}

// Verificar blacklist — condicion principal de bloqueo
function isInMLBlacklist(contactId) {
  if (!contactId) return true;
  const idStr = String(contactId);
  const blocked = mlBlacklist.includes(idStr);
  if (blocked) console.log('[ML] ⛔ BLACKLIST HIT:', idStr);
  return blocked;
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
  maxDaily: 30,
  sentToday: 0,
  lastResetDate: '',
  delay: { min: 3000, max: 7000 },
  messageTemplate: 'Hola! Me encantaría conocerte mejor. ¿Te gustaría conversar un rato?',
  useAI: false,
  workingHours: { start: 8, end: 22 },
  respectQuietHours: true,
  skipPinned: true,
  stopOnBlacklistHit: false
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
  } catch (e) {
    console.error('[ML] Error saving config:', e);
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

// ============ SCRAPE ACTIVE LIMITS (MAIL) ============

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

// Scrapea IDs de la sección Active Limits en la página MAIL
function scrapeActiveLimitsIds() {
  console.log('[ML-DEBUG] scrapeActiveLimitsIds llamado');
  const ids = [];
  const seen = new Set();
  console.log('[ML-DEBUG] Total links en pagina:', document.querySelectorAll('a[href]').length);

  // Dump de la estructura del body para entender el DOM
  if (!window._mlDomDumped) {
    window._mlDomDumped = true;
    const allElements = document.querySelectorAll('body *');
    console.log('[ML-DEBUG] Total elementos en body:', allElements.length);
    const tags = {};
    allElements.forEach(el => { tags[el.tagName] = (tags[el.tagName] || 0) + 1; });
    console.log('[ML-DEBUG] Tags en body:', tags);
    const classesWithContent = [];
    allElements.forEach(el => {
      if (el.children.length === 0 && el.textContent.trim().length > 3) {
        const cls = el.className ? (typeof el.className === 'string' ? el.className : '') : '';
        if (cls && (cls.includes('list') || cls.includes('mail') || cls.includes('active') || cls.includes('limit') || cls.includes('contact') || cls.includes('user'))) {
          classesWithContent.push({ tag: el.tagName, class: cls, text: el.textContent.trim().slice(0, 80) });
        }
      }
    });
    console.log('[ML-DEBUG] Elementos con texto y clases relevantes:', classesWithContent);

    // Buscar contenedores de Active Limits y verificar visibilidad
    const alContainers = document.querySelectorAll('[class*="active-limit"], [class*="activeLimit"], [class*="ActiveLimit"], [id*="active-limit"], [id*="activeLimit"]');
    console.log('[ML-DEBUG] Contenedores Active Limits encontrados:', alContainers.length);
    alContainers.forEach((c, i) => {
      const style = window.getComputedStyle(c);
      console.log(`[ML-DEBUG] AL[${i}] tag=${c.tagName} class=${c.className} display=${style.display} visibility=${style.visibility} opacity=${style.opacity} height=${style.height} innerHTML=${c.innerHTML.slice(0, 200)}`);
    });

    // Buscar cualquier elemento con texto "Patricia" o "Active limits"
    const allText = document.querySelectorAll('*');
    let found = 0;
    allText.forEach(el => {
      if (el.children.length === 0 && /Patricia|Active\s*limit|active\s*limit/i.test(el.textContent) && found < 5) {
        const style = window.getComputedStyle(el);
        console.log(`[ML-DEBUG] TEXTO ENCONTRADO: "${el.textContent.trim().slice(0, 60)}" en ${el.tagName}.${el.className} display=${style.display} visibility=${style.visibility}`);
        found++;
      }
    });
  }

  // Estrategia 1: Buscar contenedores con clase "active" o "limit" y extraer links
  const sectionSelectors = [
    '[class*="active-limit"]',
    '[class*="activeLimit"]',
    '[class*="ActiveLimit"]',
    '[class*="active"][class*="limit"]',
    '[id*="active-limit"]',
    '[id*="activeLimit"]',
    // Fallback: tablas de mailing
    'table[class*="mail"]',
    'table[class*="message"]',
    '[class*="mail-list"]',
    '[class*="message-list"]',
    // Fallback: cualquier lista de contactos
    '[class*="contact-list"]',
    '[class*="user-list"]',
    // Fallback generico: secciones y listas genericas
    'section', 'div[class*="list"]', 'div[class*="table"]',
  ];

  for (const sel of sectionSelectors) {
    try {
      const sections = document.querySelectorAll(sel);
      if (sections.length > 0) console.log('[ML] DEBUG - Selector', sel, 'encontro', sections.length, 'elementos');
      for (const section of sections) {
        if (sel === 'div[class*="list"]' || sel === 'section') {
          console.log('[ML] DEBUG - innerHTML del contenedor', sel, ':', section.innerHTML.slice(0, 500));
          console.log('[ML] DEBUG - childNodes.length:', section.childNodes.length);
          console.log('[ML] DEBUG - children.length:', section.children.length);
          if (section.shadowRoot) {
            console.log('[ML] DEBUG - SHADOW ROOT encontrado!', section.shadowRoot.innerHTML.slice(0, 500));
          }
          const iframes = section.querySelectorAll('iframe');
          console.log('[ML] DEBUG - iframes dentro:', iframes.length);
        }
        if (mailingConfig.skipPinned && isContactPinnedOrSaved(section)) continue;
        const links = section.querySelectorAll('a[href]');
        for (const link of links) {
          const id = extractIdFromHref(link.href) || extractIdFromHref(link.getAttribute('href'));
          if (id && !seen.has(id)) {
            seen.add(id);
            ids.push({ id, element: link, source: sel });
          }
        }
      }
    } catch (e) {}
  }

  // Estrategia 2: Si no se encontró nada, buscar TODOS los links con IDs numéricos
  if (ids.length === 0) {
    try {
      const allLinks = document.querySelectorAll('a[href]');
      const sampleHrefs = [];
      for (const link of allLinks) {
        const href = link.href || link.getAttribute('href') || '';
        if (href && sampleHrefs.length < 10) sampleHrefs.push(href);
        const id = extractIdFromHref(href);
        if (id && !seen.has(id)) {
          const parent = link.closest('[class*="contact"], [class*="user"], [class*="member"], [class*="profile"], [class*="item"], [class*="row"], tr');
          if (parent && mailingConfig.skipPinned && isContactPinnedOrSaved(parent)) continue;
          seen.add(id);
          ids.push({ id, element: link, source: 'global-fallback' });
        }
      }
      if (ids.length === 0 && sampleHrefs.length > 0) {
        console.log('[ML] DEBUG - Sample hrefs en pagina:');
        sampleHrefs.forEach((h, i) => console.log(`  [${i}] ${h}`));
      }
    } catch (e) {}
  }

  console.log('[ML] Active Limits scraped:', ids.length, 'IDs');
  lastScrapedCount = ids.length;
  return ids;
}

// ============ ENVIAR MENSAJE ============

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
    if ((text === 'send' || text === 'enviar' || text === '\u2192' || text === '\u25b6') && btn.offsetParent !== null) {
      return btn;
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
    console.error('[ML] Error typing:', e);
    return false;
  }
}

function findProfileLink(profileId) {
  try {
    const allLinks = document.querySelectorAll('a[href]');
    for (const link of allLinks) {
      const href = link.href || link.getAttribute('href') || '';
      if (href.includes(profileId)) return link;
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
  if (link) {
    link.click();
    await sleep(2000);
    return true;
  }
  return false;
}

async function sendMailingMessage(text, profileId) {
  if (profileId) {
    const opened = await openProfileChat(profileId);
    if (!opened) {
      console.warn('[ML] No se pudo abrir chat para:', profileId);
      return false;
    }
    await sleep(1500);
  }

  const input = findChatInput();
  if (!input) {
    console.warn('[ML] No chat input found');
    return false;
  }

  const sendBtn = findSendButton();
  if (!sendBtn) {
    console.warn('[ML] No send button found');
    return false;
  }

  if (!typeIntoInput(input, text)) return false;

  const beforeValue = input.value || input.textContent || '';
  await sleep(1500);
  sendBtn.click();
  await sleep(1500);

  const afterValue = input.value || input.textContent || '';
  if (afterValue === beforeValue && beforeValue !== '') {
    console.warn('[ML] Mensaje no se envió - input sin cambios, intentando alternativo');
    const altBtn = document.querySelector('[class*="send"]:not(button), [class*="submit"]:not(button)');
    if (altBtn) {
      altBtn.click();
      await sleep(1500);
      const afterValue2 = input.value || input.textContent || '';
      if (afterValue2 === beforeValue) return false;
    } else {
      return false;
    }
  }

  console.log('[ML] Mensaje enviado a profile', profileId || 'actual');
  return true;
}

// ============ GENERAR MENSAJE ============

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
      body: JSON.stringify({
        messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }],
        max_tokens: 120,
        temperature: 0.7
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.warn('[ML-AI] Error:', e.message);
    return null;
  }
}

async function getMailingMessage() {
  if (mailingConfig.useAI) {
    const aiResponse = await generateAIResponse(mailingConfig.messageTemplate);
    return aiResponse || mailingConfig.messageTemplate;
  }
  return mailingConfig.messageTemplate;
}

// ============ BARRIDO PRINCIPAL DE CARTAS ============

async function executeMailingRound() {
  if (!mailingConfig || !mailingConfig.enabled) {
    console.log('[ML] Mailing no activado');
    return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };
  }
  if (mailingActive) {
    console.log('[ML] Barrido ya en progreso, saltando');
    return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };
  }

  mailingActive = true;
  mailingAbort = false;

  resetMailingDailyCounter();

  if (mailingConfig.maxDaily > 0 && mailingConfig.sentToday >= mailingConfig.maxDaily) {
    console.log('[ML] Límite diario alcanzado:', mailingConfig.sentToday);
    mailingActive = false;
    return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };
  }

  if (!isWithinWorkingHours()) {
    console.log('[ML] Fuera de horario laboral');
    mailingActive = false;
    return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };
  }

  // Recargar blacklist antes del barrido para tener datos frescos
  if (!mlBlacklistLoaded) {
    await loadMLBlacklist();
  }

  // Scrapear IDs de Active Limits
  const contacts = scrapeActiveLimitsIds();
  if (contacts.length === 0) {
    console.log('[ML] No se encontraron contactos en Active Limits');
    mailingActive = false;
    return { sent: 0, skipped: 0, blacklisted: 0, total: 0 };
  }

  console.log('[ML] Iniciando barrido de cartas con', contacts.length, 'contactos');

  let sent = 0;
  let skipped = 0;
  let blacklisted = 0;
  let alreadyContacted = 0;

  for (let i = 0; i < contacts.length; i++) {
    if (!mailingConfig.enabled || mailingAbort) {
      console.log('[ML] Barrido detenido');
      break;
    }
    if (mailingConfig.maxDaily > 0 && mailingConfig.sentToday >= mailingConfig.maxDaily) {
      console.log('[ML] Límite diario alcanzado');
      break;
    }

    const contact = contacts[i];
    const contactId = contact.id;

    // === CONDICIÓN PRINCIPAL: BLACKLIST ===
    if (isInMLBlacklist(contactId)) {
      console.log('[ML] ⛔ BLOQUEADO por blacklist:', contactId);
      blacklisted++;
      if (mailingConfig.stopOnBlacklistHit) {
        console.log('[ML] stopOnBlacklistHit=true, deteniendo barrido');
        break;
      }
      continue;
    }

    // Verificar historial
    if (await isContactAlreadyContactedML(contactId)) {
      console.log('[ML] Ya contactado:', contactId);
      alreadyContacted++;
      skipped++;
      continue;
    }

    // Verificar pinned/saved
    if (mailingConfig.skipPinned && contact.element) {
      const parent = contact.element.closest('[class*="contact"], [class*="user"], [class*="member"], [class*="profile"], [class*="item"], [class*="row"], tr');
      if (parent && isContactPinnedOrSaved(parent)) {
        console.log('[ML] Saltando (pinned/saved):', contactId);
        skipped++;
        continue;
      }
    }

    // Generar mensaje
    const message = await getMailingMessage();
    if (!message) {
      console.warn('[ML] No se pudo generar mensaje');
      skipped++;
      continue;
    }

    // Enviar
    const success = await sendMailingMessage(message, contactId);
    if (success) {
      await markContactAsContactedML(contactId);
      mailingConfig.sentToday++;
      await saveMailingConfig();
      sent++;
      console.log('[ML] ✅ Carta enviada a', contactId, `(${sent}/${mailingConfig.maxDaily})`);
    } else {
      skipped++;
      console.warn('[ML] Fallo al enviar a', contactId);
    }

    // Delay entre mensajes
    const delayMs = (mailingConfig.delay?.min || 3000) + Math.random() * ((mailingConfig.delay?.max || 7000) - (mailingConfig.delay?.min || 3000));
    await sleep(delayMs);
  }

  const result = { sent, skipped, blacklisted, alreadyContacted, total: contacts.length };
  console.log('[ML] Barrido completado:', result);
  mailingActive = false;
  return result;
}

function abortMailingRound() {
  mailingAbort = true;
  console.log('[ML] Abort solicitado');
}

// ============ CONFIG UPDATES ============

async function setMailingState(enabled) {
  await loadMailingConfig();
  mailingConfig.enabled = enabled;
  await saveMailingConfig();
  if (enabled) {
    console.log('[ML] Activado — listo para barrido');
  } else {
    mailingAbort = true;
    mailingActive = false;
    console.log('[ML] Desactivado');
  }
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

async function updateMailingDelay(min, max) {
  await loadMailingConfig();
  mailingConfig.delay = { min, max };
  await saveMailingConfig();
}

async function updateMailingUseAI(useAI) {
  await loadMailingConfig();
  mailingConfig.useAI = useAI;
  await saveMailingConfig();
}

async function updateMailingWorkingHours(start, end) {
  await loadMailingConfig();
  mailingConfig.workingHours = { start, end };
  await saveMailingConfig();
}

async function updateMailingRespectQuietHours(respect) {
  await loadMailingConfig();
  mailingConfig.respectQuietHours = respect;
  await saveMailingConfig();
}

async function updateMailingSkipPinned(skip) {
  await loadMailingConfig();
  mailingConfig.skipPinned = skip;
  await saveMailingConfig();
}

async function updateMailingStopOnBlacklist(stop) {
  await loadMailingConfig();
  mailingConfig.stopOnBlacklistHit = stop;
  await saveMailingConfig();
}

function getMailingConfig() {
  return mailingConfig;
}

function getMailingStats() {
  return {
    active: mailingActive,
    sentToday: mailingConfig?.sentToday || 0,
    maxDaily: mailingConfig?.maxDaily || 0,
    blacklistSize: mlBlacklist.length,
    blacklistLoaded: mlBlacklistLoaded,
    lastScrapedCount
  };
}

// ============ INIT ============

async function initSmartMailing() {
  await loadMailingConfig();
  await loadMLBlacklist();
  console.log('[ML] Module initialized, enabled:', mailingConfig.enabled, '| Blacklist:', mlBlacklist.length, 'contactos');

  // Auto-scrape con reintentos hasta que la pagina renderice los contactos
  let attempts = 0;
  const maxAttempts = 8;
  const retryScrape = () => {
    attempts++;
    const result = scrapeActiveLimitsIds();
    if (result.length > 0 || attempts >= maxAttempts) {
      console.log('[ML] Auto-scrape completado en intento', attempts, ':', result.length, 'IDs');
      return;
    }
    console.log('[ML] Auto-scrape intento', attempts, '- 0 IDs, reintentando en 2s...');
    setTimeout(retryScrape, 2000);
  };
  setTimeout(retryScrape, 3000);
}

// ============ GLOBAL ACCESSORS (for panels) ============
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
window._setMailingState = setMailingState;
window._executeMailingRound = executeMailingRound;
window._abortMailingRound = abortMailingRound;
window._reloadMLBlacklist = reloadMLBlacklist;
window._getMailingStats = getMailingStats;
window._scrapeActiveLimitsIds = scrapeActiveLimitsIds;
