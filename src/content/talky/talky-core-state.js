// TESSERACT v24.0 - Estado global + Blacklist + Icebreakers (extraído de talky-bot-panel.js)
var TESSERACT_API = 'https://tesseract-jblo.onrender.com';
const ALLOWED_DOMAIN = 'talkytimes.com';

let isAuthenticated = false;
let eaterActive = false;
let clonacionActiva = true;
let eaterResponse = '';
let isUsingAI = false;
let _processedTexts = new Set();
// Response timer por conversación
let _responseTimers = new Map(); // clientName -> { timerId, startTime }
const RESPONSE_ALERT_SECONDS = 90;
const TIMER_DISPLAY_SECONDS = 120;
// Blacklist - contactos protegidos
let blacklist = [];

// Cargar blacklist desde servidor (con reintentos)
async function loadBlacklist(retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const stored = await chrome.storage.local.get(['tess_jwt']);
      if (stored.tess_jwt) {
        const res = await fetch(`${TESSERACT_API}/api/tess/blacklist`, {
          headers: { 'Authorization': 'Bearer ' + stored.tess_jwt }
        });
        if (!res.ok && attempt < retries) continue;
        const data = await res.json();
        blacklist = data.blacklist || [];
        console.log('[BLACKLIST] Cargada:', blacklist.length, 'contactos');
      }
      return;
    } catch (e) {
      console.log('[BLACKLIST] Error (intento '+(attempt+1)+'/'+(retries+1)+'):', e.message);
      if (attempt >= retries) return;
    }
  }
}

// Verificar si contacto está en blacklist
function isBlacklisted(contactId) {
  if (!contactId) return false;
  return blacklist.includes(contactId);
}

// Guardar blacklist en servidor (sin cronizar IDs)
async function saveBlacklist() {
  // Sincronizar con todos los modulos (incluso si API falla)
  if (typeof window._addToMLBlacklist === 'function') {
    blacklist.forEach(function(id) { window._addToMLBlacklist(id); });
  }
  if (typeof window._addToAABlacklist === 'function') {
    blacklist.forEach(function(id) { window._addToAABlacklist(id); });
  }
  if (typeof window._addToLFPBlacklist === 'function') {
    blacklist.forEach(function(id) { window._addToLFPBlacklist(id); });
  }

  try {
    const stored = await chrome.storage.local.get(['tess_jwt']);
    if (stored.tess_jwt) {
      const res = await fetch(`${TESSERACT_API}/api/tess/blacklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + stored.tess_jwt },
        body: JSON.stringify({ blacklist })
      });
      if (!res.ok) {
        const errText = await res.text();
        logError('blacklist', 'POST status: ' + res.status + ' - ' + errText, 'warn');
        return;
      }
      console.log('[BLACKLIST] POST OK, enviados:', blacklist.length);
      const data = await res.json();
      if (data.blacklist) blacklist = data.blacklist;
      if (typeof reloadMLBlacklist === 'function') await reloadMLBlacklist();
      if (typeof loadAABlacklist === 'function') await loadAABlacklist();
      if (typeof reloadLFPBlacklist === 'function') await reloadLFPBlacklist();
      if (typeof populateMLPanel === 'function') populateMLPanel();
    }
  } catch (e) {
    logError('blacklist', e);
  }
}

// Renderizar pestaña blacklist
function renderBlacklistTab() {
  const listEl = document.getElementById('blList');
  const countEl = document.getElementById('blCount');
  if (!listEl) return;
  if (countEl) countEl.textContent = blacklist.length + ' contactos';
  
  if (blacklist.length === 0) {
    listEl.innerHTML = '<p style="color:#666;text-align:center;">No hay contactos bloqueados</p>';
    return;
  }
  
  listEl.innerHTML = blacklist.map((id, i) => 
    `<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid rgba(139,92,246,0.15);">
      <span style="color:#888;font-size:9px;width:20px;">${i+1}</span>
      <span style="flex:1;font-size:12px;font-weight:bold;letter-spacing:1px;color:#ef4444;">${id}</span>
      <button class="bl-remove" data-idx="${i}" style="background:rgba(239,68,68,0.2);border:1px solid #ef4444;color:#ef4444;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:9px;">✕</button>
    </div>`
  ).join('');
  
  listEl.querySelectorAll('.bl-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      blacklist.splice(idx, 1);
      saveBlacklist();
      renderBlacklistTab();
    });
  });
}

// Iniciar carga de blacklist
loadBlacklist();

// ============ ICEBREAKERS ============
const icebreakersPool = [
  '¿Qué te define en 3 palabras?',
  '¿Cuál es tu mayor talento oculto?',
  '¿Café o té? ☕',
  '¿Playa o montaña? 🏖️',
  '¿Película o serie? 🎬',
  '¿Cuál ha sido tu viaje más increíble?',
  '¿Destino soñado?',
  '¿Cómo es tu día perfecto?',
  '¿Qué haces los domingos?',
  '¿Madrugar o trasnochar? 🌙',
  '¿De qué no puedes parar de hablar?',
  '¿Qué te hace reír? 😄',
  '¿Qué te inspira actualmente?',
  '¿Qué lección reciente aprendiste?',
  '¿Qué valoras más en una persona?',
  '¿Tu comida favorita? 🍕',
  '¿Qué serie recomiendas? 📺',
  '¿Qué música escuchas? 🎵',
  '¿Prefieres ciudad o campo?',
  '¿Qué haces para relajarte?'
];

let icebreakersAvailable = [];

function shuffleIcebreakers() {
  icebreakersAvailable = [...icebreakersPool].sort(() => Math.random() - 0.5);
}

function initIcebreakers() {
  const container = document.getElementById('icebreakersList');
  if (!container) return;
  
  shuffleIcebreakers();
  renderIcebreakers(container);
  
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('.ice-btn');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx);
    const text = icebreakersAvailable[idx];
    if (!text) return;
    
    const input = findChatInput();
    if (input) {
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('keyup', { bubbles: true }));
      input.focus();
      console.log('[ICEBREAKER] Texto colocado:', text);
      
      icebreakersAvailable.splice(idx, 1);
      const newItem = icebreakersPool[Math.floor(Math.random() * icebreakersPool.length)];
      icebreakersAvailable.push(newItem);
      
      renderIcebreakers(container);
    }
  });
}

function renderIcebreakers(container) {
  const show = icebreakersAvailable.slice(0, 8);
  container.innerHTML = show.map((ib, i) => 
    `<button class="ice-btn" data-idx="${i}" style="background:rgba(139,92,246,0.2);border:1px solid #8b5cf6;color:#fff;padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer;font-family:'Orbitron',sans-serif;">
      ${ib.substring(0, 18)}${ib.length > 18 ? '..' : ''}
    </button>`
  ).join('');
}

// Variables de estado global
let collectedIds = { Saludo: [], Like: [], Follow: [], LFP: [], Cartas: [] };
let botStats = { likesGiven: 0, followsGiven: 0, cartasSent: 0, contactsProcessed: 0, repliesReceived: 0, repliesResponded: 0, icebreakersSent: 0 };
let currentTab = 'main';
let currentStarFilter = 'all';
let currentUser = null;
let currentClientName = 'Cliente';
let likesActive = false;
let followsActive = false;
let likeFollowActive = false;
// Variables para Saludos Masivos (deshabilitado UI, código disponible)
let saludosActive = false;
// Variables para Cartas (deshabilitado UI, código disponible)
let cartasActive = false;
let lastGeneratedMessage = '';
let isEnglishMode = false;
let selectedLangCode = 'en';
const translateLanguages = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'pt', label: 'PT', name: 'Português' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
  { code: 'it', label: 'IT', name: 'Italiano' },
  { code: 'nl', label: 'NL', name: 'Nederlands' },
  { code: 'es', label: 'ES', name: 'Español' }
];
let clientDetectedLang = null; // null = no detectado, 'en'/'fr'/'pt'/'es'

// Mensajes predefinidos para barridos
let saludoMessages = [
  'Hola, ¿cómo estás? Espero que tengas un lindo día.',
  '¡Hola! Me encantaría conocerte, tu perfil me llamó mucho la atención.',
  'Saludos, ¿cómo va todo? Me gustaría charlar contigo.',
  '¡Hey! Vi tu perfil y no pude resistirme a escribirte.',
  'Hola, un placer saludarte. ¿Te gustaría conversar un rato?',
  '¡Qué gusto verte por aquí! Tu perfil tiene una vibra muy especial.',
  'Hola, hola. Algo me dijo que valía la pena escribirte.',
  'Me gustó mucho tu estilo, quería conocerte un poco más.',
  'Hola, me pareció interesante tu perfil y aquí estoy.',
  '¡Holaaaa! Espero que estés teniendo un gran día.',
  'Hola, vi tu perfil y pensé que podríamos congeniar.',
  'Un saludo para ti. ¿Cómo va tu semana?',
  '¡Hey! No podía irme sin decirte hola.',
  'Hola, ¿sabes? Tu sonrisa ilumina todo el día.',
  'Qué alegría encontrarte, se nota que eres alguien auténtico.',
  'Buenas, no pude evitar fijarme en ti.',
  'Hola, ¿qué tal? Me encantó la energía de tu perfil.',
  'Vine a saludar y espero quedarme un rato.',
  '¡Hola hermosa! Tenía que escribirte hoy.',
  'Hola, ¿crees en las casualidades? Yo creo que esto es una señal.'
];

let cartaMessages = [
  'Querido/a amigo/a,\n\nTe escribo porque tu perfil me pareció muy interesante y me encantaría tener la oportunidad de conocerte mejor. Creo que podríamos tener una linda amistad.\n\nEspero tu respuesta con ansias.\n\nUn abrazo.',
  'Hola,\n\nHe visto tu perfil y me ha parecido fascinante. Me encantaría saber más sobre ti y lo que te apasiona.\n\nOjalá podamos conectar y compartir buenos momentos.\n\nCon cariño.',
  '¡Saludos!\n\nNo pude evitar escribirte al ver lo especial que parece tu perfil. Me gustaría mucho tener la oportunidad de conocerte y ver si hay química entre nosotros.\n\nEspero tener noticias tuyas pronto.\n\nUn beso.'
];

function detectLanguage(text) {
  if (!text) return null;
  var t = text.toLowerCase().trim();
  var words = t.split(/\s+/).filter(function(w) { return w.length > 2; });
  var scores = { en: 0, es: 0, fr: 0, pt: 0 };
  var dicts = {
    en: ['the','you','and','for','are','but','not','was','have','has','had','your','with','from','they','this','that','she','her','what','all','can'],
    es: ['que','las','los','por','para','con','del','como','mas','pero','esta','este','esto','muy','todo','bien','cuando','si','solo','cada'],
    fr: ['les','des','que','pas','pour','dans','avec','vous','elle','ils','sur','nous','plus','tout','mais','fait','faire'],
    pt: ['que','para','com','dos','das','mais','como','muito','isso','esta','este','aqui','tudo','bem','sua','seu','voce','ela']
  };
  for (var wi = 0; wi < words.length; wi++) {
    for (var lang in dicts) {
      if (dicts[lang].indexOf(words[wi]) !== -1) scores[lang]++;
    }
  }
  // Ignorar si predomina español (las sugerencias ya están en español)
  if (scores.en > scores.es && scores.en >= 1) return 'en';
  if (scores.fr > scores.es && scores.fr >= 1) return 'fr';
  if (scores.pt > scores.es && scores.pt >= 1) return 'pt';
  return null;
}
