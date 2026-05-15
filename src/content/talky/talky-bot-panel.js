// TESSERACT v24.0 - JARVIS STAR TOOLS + AUTO-ANSWER + SMART MAILING (SERVER AUTH)
// TESSERACT - Sistema completo con Eater Learning, IDs, Auto-respuesta, Mailings
var TESSERACT_API = 'https://tesseract-jblo.onrender.com';
const ALLOWED_DOMAIN = 'talkytimes.com';

let isAuthenticated = false;
let eaterActive = false;
let eaterRefreshCount = 0;
let eaterSuggestions = [];
let isUsingAI = false;

// Blacklist - contactos protegidos
let blacklist = [];

// Cargar blacklist desde servidor
async function loadBlacklist() {
  try {
    const stored = await chrome.storage.local.get(['tess_jwt']);
    if (stored.tess_jwt) {
      const res = await fetch(`${TESSERACT_API}/api/tess/blacklist`, {
        headers: { 'Authorization': 'Bearer ' + stored.tess_jwt }
      });
      const data = await res.json();
      blacklist = data.blacklist || [];
      console.log('[BLACKLIST] Cargada:', blacklist.length, 'contactos');
    }
  } catch (e) {
    console.log('[BLACKLIST] Error al cargar:', e.message);
  }
}

// Verificar si contacto está en blacklist
function isBlacklisted(contactId) {
  if (!contactId) return false;
  return blacklist.includes(contactId);
}

// Guardar blacklist en servidor
async function saveBlacklist() {
  try {
    const stored = await chrome.storage.local.get(['tess_jwt']);
    if (stored.tess_jwt) {
      await fetch(`${TESSERACT_API}/api/tess/blacklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + stored.tess_jwt },
        body: JSON.stringify({ blacklist })
      });
    }
  } catch (e) {
    console.log('[BLACKLIST] Error guardando:', e.message);
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
      
      const sendBtn = findSendButton();
      if (sendBtn) {
        sendBtn.click();
        botStats.icebreakersSent++;
        console.log('[ICEBREAKER] Enviado:', text, '| Total:', botStats.icebreakersSent);
        
        // Eliminar el icebreaker usado y agregar uno nuevo
        icebreakersAvailable.splice(idx, 1);
        const newItem = icebreakersPool[Math.floor(Math.random() * icebreakersPool.length)];
        icebreakersAvailable.push(newItem);
        
        renderIcebreakers(container);
      }
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
let collectedIds = { Saludo: [], Like: [], Follow: [], Cartas: [] };
let botStats = { likesGiven: 0, followsGiven: 0, messagesSent: 0, cartasSent: 0, contactsProcessed: 0, repliesReceived: 0, repliesResponded: 0, icebreakersSent: 0 };
let currentTab = 'main';
let currentStarFilter = 'all';
let currentUser = null;
let currentClientName = 'Cliente';
let likesActive = false;
let followsActive = false;
// Variables para Saludos Masivos (deshabilitado UI, código disponible)
let saludosActive = false;
// Variables para Cartas (deshabilitado UI, código disponible)
let cartasActive = false;
let lastGeneratedMessage = '';
let isEnglishMode = false;

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

// ============ FUNCIÓN CENTRAL: Registrar ID en Star Tools ============
function registerIdInStarTools(id, category) {
  // FIX: TalkyTimes usa IDs de longitud variable (6-15 dígitos), no solo 12
  if (!id || !/^\d{6,15}$/.test(String(id).trim())) return false;
  id = String(id).trim();
  if (!collectedIds[category]) collectedIds[category] = [];
  if (collectedIds[category].includes(id)) return false;
  
  collectedIds[category].push(id);
  console.log('[STAR-TOOLS] ✅ ID registrado en ' + category + ':', id, '| Total ' + category + ':', collectedIds[category].length);
  
  // Actualizar UI solo si estamos en la pestaña Star Tools
  if (currentTab === 'star') {
    renderStarIds();
  }
  
  saveAllStates();
  return true;
}

// ============ INICIALIZACIÓN ============
async function initTesseract() {
  try {
    console.log('[TESSERACT] 🚀 Inicializando sistema...');
  createMainPanel();
  createEaterBar();
  initIcebreakers();
  createSaludosModal();
  createCartasModal();
  setupAllEvents();
  loadAllStates();
  startChatWatcher();
  startBackgroundIdCapture(); // Captura en segundo plano
  startProfileWatcher(); // Detectar perfil activo

  // Inicializar módulos v24
  if (typeof initAutoAnswer === 'function') await initAutoAnswer();
  if (typeof initSmartMailing === 'function') await initSmartMailing();

  // Verificar que storage funciona
  chrome.storage.local.set({ tess_heartbeat: Date.now() }, () => {
    if (chrome.runtime.lastError) {
      console.error('[TESSERACT] ❌ Error de storage:', chrome.runtime.lastError);
    } else {
      console.log('[TESSERACT] ✅ Storage OK');
    }
  });
  console.log('[TESSERACT] ✅ Sistema listo - JARVIS activo');
  } catch (e) {
    console.error('[TESSERACT] ❌ ERROR:', e);
  }
}

// ============ CAPTURA DE IDs EN SEGUNDO PLANO ============
function startBackgroundIdCapture() {
  console.log('[STAR-TOOLS] 👁️ Captura de IDs en segundo plano iniciada');
  
  // Escanear cada 3 segundos mientras haya barridos activos
  setInterval(() => {
    if (!isAuthenticated) return;
    if (!likesActive && !followsActive) return;
    
    const ids = scanPageForIds();
    
    ids.forEach(id => {
      if (likesActive) registerIdInStarTools(id, 'Like');
      if (followsActive) registerIdInStarTools(id, 'Follow');
    });
  }, 3000);
  
  // Solo capturar IDs si hay barridos activos y cambió la URL
  let lastUrl = location.href;
  setInterval(() => {
    if (!isAuthenticated) return;
    if (!likesActive && !followsActive) return;
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => {
        if (!isAuthenticated) return;
        if (!likesActive && !followsActive) return;
        const ids = scanPageForIds();
        ids.forEach(id => {
          if (likesActive) registerIdInStarTools(id, 'Like');
          if (followsActive) registerIdInStarTools(id, 'Follow');
        });
      }, 1500);
    }
  }, 2000);
}

// ============ PANEL PRINCIPAL HTML (CON PESTAÑAS) ============
function createMainPanel() {
  if (document.getElementById('tesseract-main-panel')) return;
  
  const p = document.createElement('div');
  p.id = 'tesseract-main-panel';
  p.innerHTML = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
#tesseract-main-panel{position:fixed;bottom:20px;right:20px;z-index:999999;font-family:'Orbitron','Segoe UI',sans-serif;}
.tess-box{width:420px;min-width:280px;background:linear-gradient(145deg,#0a0a0a,#1a1a2e);border-radius:16px;border:2px solid #8b5cf6;box-shadow:0 0 40px rgba(139,92,246,0.3),0 10px 40px rgba(0,0,0,0.9);color:#e0e0e0;max-height:720px;overflow-y:auto;position:relative;}
.tess-resize{position:absolute;width:14px;height:14px;z-index:20;}.tess-resize.se{bottom:0;right:0;cursor:se-resize;}.tess-resize.sw{bottom:0;left:0;cursor:sw-resize;}.tess-resize.ne{top:0;right:0;cursor:ne-resize;}.tess-resize.nw{top:0;left:0;cursor:nw-resize;}
.tess-header{background:linear-gradient(135deg,#1e1b4b,#8b5cf6,#7c3aed,#8b5cf6,#1e1b4b);padding:14px 18px;display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:18px;letter-spacing:2px;border-bottom:2px solid #8b5cf6;cursor:move;text-shadow:0 0 10px #8b5cf6;text-transform:uppercase;position:sticky;top:0;z-index:10;}
.tess-header button{background:rgba(0,0,0,0.6);border:1px solid #8b5cf6;color:#8b5cf6;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;margin-left:5px;transition:all 0.3s;}
.tess-header button:hover{background:#7c3aed;color:#fff;box-shadow:0 0 15px #8b5cf6;}
.tess-header button.active-tab{background:#8b5cf6;color:#000;}
.profile-badge{display:none;padding:4px 14px;background:rgba(15,15,30,0.9);border-bottom:1px solid rgba(139,92,246,0.15);font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:1px;color:#8888a0;align-items:center;gap:10px;position:sticky;top:56px;z-index:9;}
.profile-badge .pb-name{color:#e0e0e0;font-weight:bold;letter-spacing:0.5px;}
.profile-badge .pb-id{color:#8b5cf6;font-size:10px;}

/* PESTAÑAS */
.tab-nav{display:flex;background:#0a0a0a;border-bottom:2px solid #8b5cf6;}
.tab-btn{flex:1;padding:10px 6px;background:rgba(30,27,75,0.5);border:none;border-right:1px solid #8b5cf6;color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;transition:all 0.3s;}
.tab-btn:last-child{border-right:none;}
.tab-btn:hover{background:rgba(139,92,246,0.2);}
.tab-btn.active{background:#8b5cf6;color:#fff;font-weight:bold;}
.tab-content{display:none;padding:14px;background:linear-gradient(180deg,#0a0a0a,#0a0a0f);}
.tab-content.active{display:block;}

.tess-box::-webkit-scrollbar{width:6px;}
.tess-box::-webkit-scrollbar-track{background:#0a0a0a;}
.tess-box::-webkit-scrollbar-thumb{background:#8b5cf6;border-radius:3px;}

.auth-section{text-align:center;padding:10px;}
.auth-icon{font-size:44px;display:block;margin-bottom:8px;filter:drop-shadow(0 0 15px #8b5cf6);}
.auth-brand{font-size:24px;font-weight:900;letter-spacing:4px;background:linear-gradient(180deg,#8b5cf6,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:3px;}
.auth-group{font-size:11px;letter-spacing:3px;color:#ffffff;margin-bottom:10px;text-transform:uppercase;}
.auth-sub{font-size:10px;color:#e0e0e0;opacity:0.7;letter-spacing:1px;margin-bottom:15px;text-transform:uppercase;}
.auth-err{color:#ffffff;font-size:11px;margin:8px 0;padding:8px;background:rgba(139,92,246,0.1);border:1px solid #ffffff;border-radius:6px;display:none;letter-spacing:1px;}
.auth-hint{font-size:10px;color:#666;margin-top:3px;text-align:right;}
.inp-grp{margin-bottom:10px;text-align:left;}
.inp-lbl{display:block;font-size:11px;letter-spacing:2px;color:#e0e0e0;margin-bottom:4px;text-transform:uppercase;}
.t-input{width:100%;padding:10px;background:#000;border:1px solid #8b5cf6;border-radius:6px;color:#e0e0e0;font-family:'Share Tech Mono',monospace;font-size:14px;letter-spacing:1px;box-sizing:border-box;}
.t-input:focus{outline:none;border-color:#8b5cf6;box-shadow:0 0 15px rgba(139,92,246,0.5);}
.t-input::placeholder{color:#444;}
.btn-auth{width:100%;padding:12px;border:1px solid #8b5cf6;border-radius:8px;background:linear-gradient(180deg,#1e1b4b,#0a0a0f);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:15px;font-weight:900;letter-spacing:3px;text-transform:uppercase;transition:all 0.3s;margin-top:10px;}
.btn-auth:hover{background:linear-gradient(180deg,#8b5cf6,#6d28d9);color:#000;box-shadow:0 0 30px #8b5cf6;}
.net-bar{margin-top:12px;padding:10px;background:rgba(0,0,0,0.5);border:1px solid #8b5cf6;border-radius:6px;font-size:11px;letter-spacing:2px;text-align:center;}
.net-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#8b5cf6;margin-right:6px;animation:blink 1s infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
.auth-foot{margin-top:12px;font-size:10px;color:#666;letter-spacing:2px;}
.user-bar{margin-bottom:10px;padding:8px 12px;background:rgba(0,0,0,0.3);border:1px solid #8b5cf6;border-radius:6px;font-size:11px;text-align:center;color:#e0e0e0;}

.mod-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}
.mod-card{padding:10px;background:rgba(30,27,75,0.5);border:1px solid #8b5cf6;border-radius:10px;text-align:center;}
.mod-card h4{font-size:12px;letter-spacing:1px;margin:0 0 6px 0;text-transform:uppercase;color:#e0e0e0;}
.mod-card .st{font-size:11px;margin-bottom:6px;}
.mod-card button{width:100%;padding:8px;border:1px solid #8b5cf6;border-radius:6px;background:rgba(0,0,0,0.5);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;transition:all 0.3s;margin:2px 0;}
.mod-card button:hover{background:#7c3aed;color:#fff;box-shadow:0 0 10px #8b5cf6;}
.mod-card button.on{background:#4CAF50;color:#fff;}
.mod-card button.cfg{background:rgba(139,92,246,0.2);}
.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0;}
.stat-mini{text-align:center;padding:8px 4px;background:rgba(0,0,0,0.5);border:1px solid #8b5cf6;border-radius:6px;font-size:11px;text-transform:uppercase;color:#e0e0e0;}
.stat-mini .val{display:block;font-size:18px;font-weight:900;color:#ffffff;text-shadow:0 0 10px #8b5cf6;}

.eater-box{margin-top:8px;padding:10px;background:#000;border:1px solid #8b5cf6;border-radius:8px;}
.eater-box h4{font-size:11px;letter-spacing:1px;margin:0 0 8px 0;text-align:center;color:#e0e0e0;}
.eater-btn{width:100%;padding:12px;border:1px solid #8b5cf6;border-radius:6px;background:linear-gradient(180deg,rgba(139,92,246,0.3),rgba(30,27,75,0.7));color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;transition:all 0.3s;}
.eater-btn.on{background:#8b5cf6;color:#000;box-shadow:0 0 30px #8b5cf6;animation:eater-glow 2s infinite;}
@keyframes eater-glow{0%,100%{box-shadow:0 0 10px #8b5cf6;}50%{box-shadow:0 0 30px #8b5cf6,0 0 60px #8b5cf6;}}
.eater-sugs-hdr{background:#1e1b4b;padding:8px 10px;font-size:10px;letter-spacing:1px;display:flex;justify-content:space-between;align-items:center;color:#e0e0e0;}
.eater-sugs-list{max-height:160px;overflow-y:auto;}
.eater-row{padding:8px 8px;border-bottom:1px solid rgba(139,92,246,0.1);font-size:11px;cursor:pointer;color:#e0e0e0;display:flex;justify-content:space-between;align-items:center;transition:all 0.2s;}
.eater-row:hover{background:rgba(139,92,246,0.2);}
.eater-row .sn{color:#ffffff;font-weight:bold;margin-right:4px;}
.eater-row .sc{font-size:9px;color:#666;margin-left:5px;display:none;}
.eater-row:hover .sc{display:inline;}
.eater-row .tr-btn{padding:4px 8px;border:1px solid #8b5cf6;border-radius:3px;background:rgba(0,0,0,0.5);color:#e0e0e0;cursor:pointer;font-size:9px;margin-left:5px;}
.eater-row .tr-btn:hover{background:#7c3aed;color:#fff;}
.logout-link{margin-top:10px;font-size:10px;letter-spacing:2px;color:#8b5cf6;cursor:pointer;text-align:center;text-decoration:underline;}
.logout-link:hover{color:#ffffff;}

/* STAR TOOLS DENTRO DEL PANEL */
.st-tbar{display:flex;gap:2px;padding:4px;background:#0a0a0a;border-bottom:1px solid rgba(139,92,246,0.3);flex-wrap:wrap;}
.st-fb{padding:4px 8px;border:1px solid #8b5cf6;border-radius:4px;background:rgba(30,27,75,0.5);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:7px;letter-spacing:1px;text-transform:uppercase;}
.st-fb:hover{background:#7c3aed;color:#fff;}
.st-fb.sel{background:#7c3aed;color:#fff;font-weight:bold;box-shadow:0 0 10px #8b5cf6;}
.st-fb .cnt{color:#666;font-size:7px;margin-left:3px;}
.st-out{max-height:350px;overflow-y:auto;font-size:10px;background:#000;padding:4px;border-radius:4px;}
.st-out .idhdr{display:flex;justify-content:space-between;padding:4px 6px;background:rgba(30,27,75,0.7);border-bottom:2px solid #8b5cf6;font-weight:bold;font-size:9px;position:sticky;top:0;z-index:5;text-transform:uppercase;color:#e0e0e0;}
.st-out .idrow{padding:3px 6px;border-bottom:1px solid rgba(139,92,246,0.08);display:flex;align-items:center;gap:6px;}
.st-out .idrow:hover{background:rgba(139,92,246,0.1);}
.st-out .idnum{color:#666;font-size:8px;width:25px;}
.st-out .idval{color:#ffffff;font-size:13px;font-weight:bold;letter-spacing:2px;flex:1;font-family:'Share Tech Mono',monospace;}
.st-out .idtag{font-size:7px;padding:2px 6px;border-radius:8px;text-transform:uppercase;font-weight:bold;}
.st-out .idtag.Like{background:#ec4899;color:#fff;}
.st-out .idtag.Follow{background:#3b82f6;color:#fff;}
.st-out .idtag.Saludo{background:#22c55e;color:#000;}
.st-out .idtag.Cartas{background:#f59e0b;color:#000;}
.st-out .empty{text-align:center;padding:20px;color:#666;font-size:10px;letter-spacing:1px;}
.st-out::-webkit-scrollbar{width:3px;}
.st-out::-webkit-scrollbar-track{background:#000;}
.st-out::-webkit-scrollbar-thumb{background:#8b5cf6;border-radius:2px;}
.st-bar{padding:6px 8px;background:#0a0a0a;border-top:1px solid #8b5cf6;font-size:8px;display:flex;justify-content:space-between;align-items:center;}
.st-bar button{background:rgba(30,27,75,0.7);border:1px solid #8b5cf6;color:#e0e0e0;padding:4px 8px;border-radius:4px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:7px;}
.st-bar button:hover{background:#7c3aed;color:#fff;}
</style>
<div class="tess-box">
<div class="tess-resize se"></div><div class="tess-resize sw"></div><div class="tess-resize ne"></div><div class="tess-resize nw"></div>
<div class="tess-header"><span>🤖 TESSERACT</span><div><button id="btnMin" title="Minimizar">_</button><button id="btnClose" title="Cerrar">×</button></div></div>

<!-- PERFIL ACTIVO -->
<div class="profile-badge" id="profileBadge"><span>🎯 <span class="pb-name" id="profileName">—</span></span><span class="pb-id" id="profileId">ID: —</span> <input id="manualProfileName" placeholder="Name" style="width:60px;background:#0a0a0f;border:1px solid #333350;color:#e0e0e0;font-size:8px;padding:2px 4px;border-radius:2px;"> <input id="manualProfileId" placeholder="ID" style="width:60px;background:#0a0a0f;border:1px solid #333350;color:#e0e0e0;font-size:8px;padding:2px 4px;border-radius:2px;"> <button id="btnSetProfile" style="background:#8b5cf6;border:none;color:#fff;font-size:8px;padding:2px 6px;border-radius:2px;cursor:pointer;">SET</button></div>

<!-- PESTAÑAS -->
<div class="tab-nav">
  <button class="tab-btn active" data-tab="main">🎮 BOT</button>
  <button class="tab-btn" data-tab="star">⭐ STAR TOOLS</button>
  <button class="tab-btn" data-tab="aa">🤖 AUTO-ANSWER</button>
  <button class="tab-btn" data-tab="mailing">📬 MAILING</button>
  <button class="tab-btn" data-tab="blacklist">🚫 BLACKLIST</button>
</div>

<!-- PESTAÑA BOT -->
<div id="tabMain" class="tab-content active">
<div id="loginScreen" class="auth-section">
<span class="auth-icon">🔐</span>
<div class="auth-brand">TESSERACT</div>
<div class="auth-group">AUTENTICACIÓN SEGURA</div>
<div class="auth-sub">Solo usuarios @tesseract.com</div>
<div class="auth-err" id="authError"></div>
<div class="inp-grp"><label class="inp-lbl">IDENTIFICADOR DE AGENTE</label><input type="text" id="agentId" class="t-input" placeholder="usuario@tesseract.com" autocomplete="off" /><div class="auth-hint">Debe terminar en @tesseract.com</div></div>
<div class="inp-grp"><label class="inp-lbl">CLAVE DE CIFRADO</label><input type="password" id="encryptKey" class="t-input" placeholder="••••••••*+" autocomplete="off" /><div class="auth-hint">Debe terminar en *+</div></div>
<button class="btn-auth" id="btnLogin">INICIALIZAR SESIÓN</button>
<div class="net-bar"><span class="net-dot"></span>TESSERACT NETWORK</div>
<div class="auth-foot">v24.0 — JARVIS IA</div>
</div>

<div id="mainScreen" style="display:none;">
<div class="user-bar">👤 <strong id="currentUserDisplay"></strong></div>
<div class="mod-grid">
<div class="mod-card"><h4>❤️ LIKES</h4><div class="st" id="likesStatus" style="color:#ffffff;">INACTIVO</div><button id="btnLikesToggle">▶ INICIAR</button></div>
<div class="mod-card"><h4>➕ FOLLOWS</h4><div class="st" id="followsStatus" style="color:#ffffff;">INACTIVO</div><button id="btnFollowsToggle">▶ INICIAR</button></div>
</div>
<div class="stats-row">
<div class="stat-mini"><span class="val" id="vLikes">0</span>LIKES</div>
<div class="stat-mini"><span class="val" id="vFollows">0</span>FOLLOW</div>
<div class="stat-mini"><span class="val" id="vMsgs">0</span>MSGS</div>
</div>
<div class="eater-box">
<h4>🧠 EATER (Click = Copiar al chat)</h4>
<button class="eater-btn" id="btnEaterToggle">🧠 EATER: OFF</button>
<div class="eater-sugs" id="eaterSuggestions">
<div class="eater-sugs-hdr"><span>🎯 SUGERENCIAS PARA EL CLIENTE</span><span id="eaterClientName" style="font-size:7px;"></span></div>
<div class="eater-sugs-list" id="eaterSugList"></div>
</div>
</div>

<!-- ICEBREAKERS -->
<div class="eater-box" style="margin-top:8px;background:#000;border:1px solid #8b5cf6;border-radius:8px;">
<h4 style="font-size:11px;letter-spacing:1px;margin:8px 0;text-align:center;color:#8b5cf6;">🎯 ICEBREAKERS (Click = Enviar)</h4>
<div id="icebreakersList" style="display:flex;flex-wrap:wrap;gap:4px;padding:4px;justify-content:center;max-height:80px;overflow-y:auto;">
</div>
</div>
</div>
<div style="display:flex;gap:8px;justify-content:center;margin-top:8px;">
<div class="logout-link" id="btnLogout" style="flex:1;">CERRAR SESIÓN</div>
<button class="logout-link" id="btnAdminPanel" style="flex:1;background:#8b5cf6;border:1px solid #8b5cf6;color:#fff;text-align:center;padding:8px 12px;border-radius:6px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:1px;">⚙ ADMIN PANEL</button>
</div>
</div>
</div>

<!-- PESTAÑA STAR TOOLS -->
<div id="tabStar" class="tab-content">
<div class="user-bar">⭐ STAR TOOLS — <span id="starTotalLive">0 IDs capturados</span></div>
<div class="st-tbar">
<button class="st-fb sel" data-f="all">TODOS <span class="cnt" id="cntAll">0</span></button>
<button class="st-fb" data-f="Like">❤️ <span class="cnt" id="cntLike">0</span></button>
<button class="st-fb" data-f="Follow">➕ <span class="cnt" id="cntFollow">0</span></button>
<button class="st-fb" data-f="Saludo">👋 <span class="cnt" id="cntSaludo">0</span></button>
<button class="st-fb" data-f="Cartas">📨 <span class="cnt" id="cntCartas">0</span></button>
</div>
<div class="st-out" id="stOutput"><div class="empty">⭐ SIN IDs RECOLECTADOS<br><small>Ejecuta un barrido para ver IDs</small></div></div>
<div class="st-bar"><span id="stCount">TOTAL: 0 IDs</span><div><button id="btnClear">🧹 LIMPIAR</button><button id="btnExport">📋 EXPORTAR</button><button id="btnCopy">📝 COPIAR</button></div></div>
</div>

<!-- PESTAÑA AUTO-ANSWER -->
<div id="tabAA" class="tab-content">
<div class="user-bar">🤖 AUTO-ANSWER — <span id="aaStatusInline">INACTIVO</span></div>
<div style="padding:10px;">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
    <div class="mod-card"><h4>❤️ LIKE</h4><div class="st" id="aaLikeStatus" style="color:#666;">DESACTIVADO</div></div>
    <div class="mod-card"><h4>😉 WINK</h4><div class="st" id="aaWinkStatus" style="color:#666;">DESACTIVADO</div></div>
    <div class="mod-card"><h4>💬 COMMENT</h4><div class="st" id="aaCommentStatus" style="color:#666;">DESACTIVADO</div></div>
    <div class="mod-card"><h4>🎁 GIFT</h4><div class="st" id="aaGiftStatus" style="color:#666;">DESACTIVADO</div></div>
  </div>
  <div class="stats-row">
    <div class="stat-mini"><span class="val" id="aaTodayResp">0</span>HOY</div>
    <div class="stat-mini"><span class="val" id="aaDailyLimit">50</span>LÍMITE</div>
  </div>
  <button class="btn-auth" id="btnOpenAAConfig" style="margin-top:8px;">⚙ CONFIGURAR AUTO-ANSWER</button>
</div>
</div>

<!-- PESTAÑA SMART MAILING -->
<div id="tabMailing" class="tab-content">
<div class="user-bar">📬 SMART MAILING — <span id="mlStatusInline">INACTIVO</span></div>
<div style="padding:10px;">
  <div class="stats-row">
    <div class="stat-mini"><span class="val" id="mlSentTodayInline">0</span>ENVIADOS HOY</div>
    <div class="stat-mini"><span class="val" id="mlDailyLimitInline">30</span>LÍMITE</div>
    <div class="stat-mini"><span class="val" id="mlQueueCountInline">0</span>EN COLA</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
    <div class="mod-card"><h4>⏱ Intervalo</h4><div class="st" id="mlIntervalDisplay">60 min</div></div>
    <div class="mod-card"><h4>💬 Mensaje</h4><div class="st" id="mlMsgPreview" style="font-size:8px;">—</div></div>
  </div>
  <button class="btn-auth" id="btnOpenMLConfig" style="margin-top:8px;">⚙ CONFIGURAR SMART MAILING</button>
</div>
</div>

<!-- PESTAÑA BLACKLIST -->
<div id="tabBlacklist" class="tab-content">
<div class="user-bar">🚫 BLACKLIST — <span id="blCount">0 contactos</span></div>
<div style="padding:10px;">
  <div class="inp-grp"><label class="inp-lbl">AGREGAR ID A BLACKLIST</label><input type="text" id="blInput" class="t-input" placeholder="ID del contacto" /></div>
  <button class="btn-auth" id="btnBlAdd" style="margin-top:4px;">🚫 BLOQUEAR</button>
  <div style="margin-top:10px;max-height:250px;overflow-y:auto;background:#0a0a0a;padding:8px;border:1px solid #333;border-radius:4px;">
    <div id="blList" style="font-size:10px;color:#ccc;">
      <p style="color:#666;text-align:center;">Cargando...</p>
    </div>
  </div>
</div>
</div>

</div></div>`;
  document.body.appendChild(p);
  console.log('[TESSERACT] ✅ Panel principal creado');
}

// ============ EATER BAR FLOTANTE ============
function createEaterBar() {
  if (document.getElementById('eaterFloatBar')) return;
  const b = document.createElement('div');
  b.id = 'eaterFloatBar';
  b.innerHTML = `
<style>
#eaterFloatBar{position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:999998;display:none;}
.ef-in{background:#0a0a0a;border:2px solid #8b5cf6;border-radius:12px;padding:10px 20px;box-shadow:0 0 30px rgba(139,92,246,0.5);display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;cursor:move;position:relative;min-width:200px;}
.ef-drag{cursor:move;font-size:12px;color:#8b5cf6;user-select:none;padding:0 4px;}
.ef-resize{position:absolute;width:12px;height:12px;z-index:20;}.ef-resize.se{bottom:-6px;right:-6px;cursor:se-resize;}.ef-resize.sw{bottom:-6px;left:-6px;cursor:sw-resize;}
.ef-in span{color:#e0e0e0;font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:1px;}
.ef-in button{padding:6px 12px;border:1px solid #8b5cf6;border-radius:6px;background:rgba(30,27,75,0.5);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px;transition:all 0.3s;}
.ef-in button:hover{background:#7c3aed;color:#fff;}
.ef-in button.emerg{background:#8b5cf6;animation:eflash 1s infinite;color:#000;}
.ef-in button.tr{background:rgba(33,150,243,0.5);border-color:#2196F3;}
@keyframes eflash{0%,100%{box-shadow:0 0 5px #8b5cf6}50%{box-shadow:0 0 20px #8b5cf6}}
</style>
<div class="ef-in" id="eaterDragHandle">
<span class="ef-drag">⣿</span>
<span>🧠 EATER</span>
<button id="eq1">💬 SUG 1</button>
<button id="eq2">💬 SUG 2</button>
<button class="emerg" id="eq5">🚨 EMERG</button>
<button class="tr" id="btnTranslate">🌐 EN</button><button class="cfg" id="btnRefreshEater" style="background:rgba(30,27,75,0.7);border-color:#8b5cf6;">🔄 FRASES</button>
</div>`;
  document.body.appendChild(b);
}

// ============ MODALES ============
function createSaludosModal() {
  if (document.getElementById('saludosModal')) return;
  const m = document.createElement('div');
  m.id = 'saludosModal';
  m.innerHTML = `
<style>
#saludosModal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999999;display:none;}
.sal-box{width:450px;background:#0a0a0a;border:2px solid #8b5cf6;border-radius:12px;box-shadow:0 0 40px rgba(139,92,246,0.5);color:#8b5cf6;font-family:'Orbitron',sans-serif;}
.sal-hdr{background:linear-gradient(135deg,#1e1b4b,#8b5cf6,#1e1b4b);padding:12px 16px;border-radius:10px 10px 0 0;font-weight:bold;letter-spacing:2px;display:flex;justify-content:space-between;border-bottom:2px solid #8b5cf6;color:#e0e0e0;}
.sal-body{padding:16px;max-height:400px;overflow-y:auto;}
.sal-body h4{font-size:10px;letter-spacing:1px;margin:8px 0 5px 0;}
.sal-body textarea{width:100%;height:50px;background:#000;border:1px solid #8b5cf6;border-radius:6px;color:#e0e0e0;font-family:Arial;font-size:11px;padding:8px;margin-bottom:8px;resize:vertical;box-sizing:border-box;}
.sal-body textarea:focus{outline:none;border-color:#ef4444;}
.sal-foot{padding:12px;border-top:1px solid #8b5cf6;text-align:right;}
.sal-foot button{padding:8px 16px;border:1px solid #8b5cf6;border-radius:6px;background:rgba(30,27,75,0.7);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:10px;margin-left:8px;}
.sal-foot button.save{background:#4CAF50;border-color:#4CAF50;color:#fff;}
</style>
<div class="sal-box"><div class="sal-hdr"><span>⚙ CONFIGURAR SALUDOS</span><span style="cursor:pointer;font-size:18px;" id="btnCloseSaludos">×</span></div>
<div class="sal-body"><h4>Mensaje 1:</h4><textarea id="sMsg1"></textarea><h4>Mensaje 2:</h4><textarea id="sMsg2"></textarea><h4>Mensaje 3:</h4><textarea id="sMsg3"></textarea><h4>Mensaje 4:</h4><textarea id="sMsg4"></textarea><h4>Mensaje 5:</h4><textarea id="sMsg5"></textarea></div>
<div class="sal-foot"><button id="btnCancelSaludos">CANCELAR</button><button class="save" id="btnSaveSaludos">💾 GUARDAR</button></div></div>`;
  document.body.appendChild(m);
}

function createCartasModal() {
  if (document.getElementById('cartasModal')) return;
  const m = document.createElement('div');
  m.id = 'cartasModal';
  m.innerHTML = `
<style>
#cartasModal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999999;display:none;}
.car-box{width:520px;background:#0a0a0a;border:2px solid #8b5cf6;border-radius:12px;box-shadow:0 0 40px rgba(139,92,246,0.5);color:#8b5cf6;font-family:'Orbitron',sans-serif;}
.car-hdr{background:linear-gradient(135deg,#1e1b4b,#8b5cf6,#1e1b4b);padding:12px 16px;border-radius:10px 10px 0 0;font-weight:bold;letter-spacing:2px;display:flex;justify-content:space-between;border-bottom:2px solid #8b5cf6;color:#e0e0e0;}
.car-body{padding:16px;}
.car-body textarea{width:100%;height:180px;background:#000;border:1px solid #8b5cf6;border-radius:6px;color:#e0e0e0;font-family:Arial;font-size:12px;padding:10px;resize:vertical;box-sizing:border-box;}
.car-body textarea:focus{outline:none;border-color:#ef4444;}
.car-foot{padding:12px;border-top:1px solid #8b5cf6;text-align:right;}
.car-foot button{padding:8px 16px;border:1px solid #8b5cf6;border-radius:6px;background:rgba(30,27,75,0.7);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:10px;margin-left:8px;}
.car-foot button.save{background:#FF9800;border-color:#FF9800;color:#000;font-weight:bold;}
</style>
<div class="car-box"><div class="car-hdr"><span>📨 CONFIGURAR CARTA</span><span style="cursor:pointer;font-size:18px;" id="btnCloseCartas">×</span></div>
<div class="car-body"><textarea id="cartaText" placeholder="Escribe tu carta aquí..."></textarea></div>
<div class="car-foot"><button id="btnCancelCartas">CANCELAR</button><button class="save" id="btnSaveCartas">💾 GUARDAR</button></div></div>`;
  document.body.appendChild(m);
}

// ============ EVENTOS ============
function setupAllEvents() {
  // Login
  document.getElementById('btnLogin').addEventListener('click', doLogin);
  document.getElementById('agentId').addEventListener('keypress', e => { if(e.key==='Enter') doLogin(); });
  document.getElementById('encryptKey').addEventListener('keypress', e => { if(e.key==='Enter') doLogin(); });
  
  // Pestañas
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentTab = this.dataset.tab;
      const tabMap = { main: 'Main', star: 'Star', aa: 'AA', mailing: 'Mailing', blacklist: 'Blacklist' };
      document.getElementById('tab' + (tabMap[currentTab] || 'Main')).classList.add('active');
      if (currentTab === 'star') renderStarIds();
      if (currentTab === 'aa') updateAATabUI();
      if (currentTab === 'mailing') updateMLTabUI();
      if (currentTab === 'blacklist') renderBlacklistTab();
    });
  });
  
  // Botones de barrido
  document.getElementById('btnLikesToggle').addEventListener('click', toggleLikes);
  document.getElementById('btnFollowsToggle').addEventListener('click', toggleFollows);
  
  // Eater
  document.getElementById('btnEaterToggle').addEventListener('click', toggleEater);
  document.getElementById('eq1').addEventListener('click', () => copySugToChat(0));
  document.getElementById('eq2').addEventListener('click', () => copySugToChat(1));
  document.getElementById('eq5').addEventListener('click', () => copyToChatInput('🚨 Disculpa, no puedo continuar esta conversación. Que tengas buen día.'));
  document.getElementById('btnTranslate').addEventListener('click', translateLastMessage);
  document.getElementById('btnRefreshEater').addEventListener('click', refreshEaterSuggestions);
  
  // Panel
  document.getElementById('btnMin').addEventListener('click', () => {
    const b = document.querySelector('.tab-nav');
    const contents = document.querySelectorAll('.tab-content');
    if(b) b.style.display = b.style.display === 'none' ? 'flex' : 'none';
    contents.forEach(c => c.style.display = c.style.display === 'none' ? 'block' : 'none');
  });
  document.getElementById('btnClose').addEventListener('click', () => document.getElementById('tesseract-main-panel').style.display = 'none');
  document.getElementById('btnLogout').addEventListener('click', doLogout);
  document.getElementById('btnAdminPanel').addEventListener('click', async () => {
    try {
      const data = await chrome.storage.local.get(['tess_jwt']);
      const url = data.tess_jwt
        ? chrome.runtime.getURL('src/pages/admin/admin.html') + '?token=' + encodeURIComponent(data.tess_jwt)
        : chrome.runtime.getURL('src/pages/admin/admin.html');
      window.open(url, '_blank');
    } catch (e) {
      window.open(chrome.runtime.getURL('src/pages/admin/admin.html'), '_blank');
    }
  });
  document.getElementById('btnSetProfile').addEventListener('click', () => {
    const n = document.getElementById('manualProfileName').value.trim();
    const id = document.getElementById('manualProfileId').value.trim();
    if (n || id) {
      document.getElementById('profileName').textContent = n || '—';
      document.getElementById('profileId').textContent = 'ID: ' + (id || '—');
      document.getElementById('profileBadge').style.display = 'flex';
    }
  });
  
  // Modales
  document.getElementById('btnCloseSaludos').addEventListener('click', () => document.getElementById('saludosModal').style.display = 'none');
  document.getElementById('btnCancelSaludos').addEventListener('click', () => document.getElementById('saludosModal').style.display = 'none');
  document.getElementById('btnSaveSaludos').addEventListener('click', saveSaludosConfig);
  document.getElementById('btnCloseCartas').addEventListener('click', () => document.getElementById('cartasModal').style.display = 'none');
  document.getElementById('btnCancelCartas').addEventListener('click', () => document.getElementById('cartasModal').style.display = 'none');
  document.getElementById('btnSaveCartas').addEventListener('click', saveCartasConfig);
  
  // Star Tools filtros
  document.querySelectorAll('.st-fb').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.st-fb').forEach(b => b.classList.remove('sel'));
      this.classList.add('sel');
      currentStarFilter = this.dataset.f;
      renderStarIds();
    });
  });
  
  // Star Tools acciones
  document.getElementById('btnClear').addEventListener('click', clearIDs);
  document.getElementById('btnExport').addEventListener('click', exportIDs);
  document.getElementById('btnCopy').addEventListener('click', copyIDs);

  // Auto-Answer
  document.getElementById('btnOpenAAConfig').addEventListener('click', () => {
    if (typeof openAAPanel === 'function') openAAPanel();
  });

  // Smart Mailing
  document.getElementById('btnOpenMLConfig').addEventListener('click', () => {
    if (typeof openMLPanel === 'function') openMLPanel();
  });
  
  // Blacklist
  document.getElementById('btnBlAdd').addEventListener('click', () => {
    const input = document.getElementById('blInput');
    const id = input.value.trim();
    if (!id) return;
    if (!blacklist.includes(id)) {
      blacklist.push(id);
      saveBlacklist();
      renderBlacklistTab();
      input.value = '';
    } else {
      alert('⚠️ Este contacto ya está en blacklist');
    }
  });
  document.getElementById('blInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnBlAdd').click();
  });
  renderBlacklistTab();

  // Eater suggestions
  document.getElementById('eaterSugList').addEventListener('click', (e) => {
    const trBtn = e.target.closest('.tr-btn');
    const row = e.target.closest('.eater-row');
    if (trBtn && row) {
      const text = trBtn.dataset.sugText || row.querySelector('.sug-text')?.textContent || '';
      if (text) {
        translateText(text).then(t => copyToChatInput(t));
      }
      return;
    }
    if (row) {
      const text = row.dataset.sugText || row.querySelector('.sug-text')?.textContent || '';
      if (text) {
        copyToChatInput(text);
        row.style.background = 'rgba(76,175,80,0.4)';
        setTimeout(() => row.style.background = '', 600);
      }
    }
  });
  
  makeDraggable('tesseract-main-panel', '.tess-header');
  makeDraggable('eaterFloatBar', '#eaterDragHandle');
  
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'E') { e.preventDefault(); if(isAuthenticated) toggleEater(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); currentTab = 'star'; renderStarIds(); }
  });
  
  console.log('[TESSERACT] ✅ Eventos configurados');
}

// ============ AUTENTICACIÓN (vía servidor) ============
async function doLogin() {
  const email = document.getElementById('agentId').value.trim().toLowerCase();
  const password = document.getElementById('encryptKey').value.trim();

  if (!email.endsWith('@tesseract.com')) {
    document.getElementById('authError').textContent = '❌ El identificador debe terminar en @tesseract.com';
    document.getElementById('authError').style.display = 'block';
    return;
  }
  if (!password.endsWith('*+')) {
    document.getElementById('authError').textContent = '❌ La clave debe terminar en *+';
    document.getElementById('authError').style.display = 'block';
    return;
  }

  document.getElementById('authError').style.display = 'none';
  document.getElementById('authError').textContent = '⏳ Verificando con servidor...';
  document.getElementById('authError').style.display = 'block';

  try {
    const res = await fetch(`${TESSERACT_API}/api/tess/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      document.getElementById('authError').textContent = '❌ ' + (data.error || 'Error de autenticación');
      document.getElementById('authError').style.display = 'block';
      return;
    }

    // Guardar token y datos
    await chrome.storage.local.set({
      tess_jwt: data.token,
      tess_auth: true,
      tess_user: data.user.email,
      user_email: data.user.email,
      isAdmin: data.user.isAdmin,
      isDeveloper: data.user.isDeveloper,
      subscriptionStatus: data.user.role,
      bot_connected_user: data.user.email,
      bot_connected_at: Date.now()
    });

    document.getElementById('authError').style.display = 'none';
    isAuthenticated = true;
    currentUser = email;
    
    const loginScreen = document.getElementById('loginScreen');
    const mainScreen = document.getElementById('mainScreen');
    
    console.log('[TESSERACT] loginScreen:', loginScreen ? 'EXISTS' : 'NULL');
    console.log('[TESSERACT] mainScreen:', mainScreen ? 'EXISTS' : 'NULL');
    
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainScreen) {
      mainScreen.style.display = 'block';
      console.log('[TESSERACT] ✅ MainScreen mostrado');
    } else {
      console.error('[TESSERACT] ❌ MainScreen NO EXISTE');
      document.getElementById('authError').textContent = '❌ Error: Panel no encontrado';
      document.getElementById('authError').style.display = 'block';
      return;
    }
    
    // Cargar blacklist del servidor
    loadBlacklist();
    
    document.getElementById('currentUserDisplay').textContent = email;
    renderStarIds();
    saveAllStates();
    detectCurrentProfile();
    startPeriodicSync();
    console.log('[TESSERACT] ✅ Acceso concedido:', email);

  } catch (error) {
    document.getElementById('authError').textContent = '❌ Error de conexión: ' + error.message;
    document.getElementById('authError').style.display = 'block';
    console.error('[TESSERACT] Login error:', error);
  }
}

function doLogout() {
  isAuthenticated = false; currentUser = null;
  likesActive = followsActive = saludosActive = cartasActive = eaterActive = false;
  document.getElementById('loginScreen').style.display = 'block';
  document.getElementById('mainScreen').style.display = 'none';
  document.getElementById('eaterFloatBar').style.display = 'none';
  document.getElementById('eaterSuggestions').style.display = 'none';
  saveAllStates();
}

// ============ MÓDULOS ============
function toggleLikes() { likesActive = !likesActive; updateModUI('likes', likesActive); if(likesActive) executeLikes(); saveAllStates(); }
function toggleFollows() { followsActive = !followsActive; updateModUI('follows', followsActive); if(followsActive) executeFollows(); saveAllStates(); }
// Funciones de toggle deshabilitadas (mantener código para futuro)
function toggleSaludos() { console.log('[TESSERACT] Saludos Masivos deshabilitado'); }
function toggleCartas() { console.log('[TESSERACT] Cartas deshabilitado'); }

function updateModUI(mod, active) {
  const st = document.getElementById(mod + 'Status');
  const btn = document.getElementById('btn' + mod.charAt(0).toUpperCase() + mod.slice(1) + 'Toggle');
  if(st) { st.textContent = active ? 'ACTIVO' : 'INACTIVO'; st.style.color = active ? '#4CAF50' : '#ffffff'; }
  if(btn) { btn.textContent = active ? '⏸ DETENER' : '▶ INICIAR'; btn.className = active ? 'on' : ''; }
}

// ============ EXTRACT ID (12 DÍGITOS) ============
function extractId(el) {
  if (!el) return null;
  
  const selectors = [
    '[data-id]', '[data-user-id]', '[data-contact-id]', '[data-member-id]',
    '[data-profile-id]', '[id*="user"]', '[id*="member"]', '[id*="contact"]'
  ];
  
  for (const sel of selectors) {
    const found = el.querySelector(sel) || (el.matches && el.matches(sel) ? el : null);
    if (found) {
      const id = found.getAttribute('data-id') || found.getAttribute('data-user-id') || 
                 found.getAttribute('data-contact-id') || found.getAttribute('data-member-id') ||
                 found.getAttribute('data-profile-id') || found.id;
      if (id && /^\d{6,15}$/.test(id)) {
        return id;
      }
    }
  }
  
  const text = el.textContent || '';
  const match = text.match(/\b\d{6,15}\b/);
  if (match) return match[0];
  
  const links = el.querySelectorAll('a[href]');
  for (const link of links) {
    const hrefMatch = link.href.match(/\/(\d{6,15})(?:[/?#]|$)/);
    if (hrefMatch) return hrefMatch[1];
  }
  
  return null;
}

function scanPageForIds() {
  const ids = new Set();
  
  const bodyText = document.body.innerText || '';
  const matches = bodyText.match(/\b\d{6,15}\b/g) || [];
  matches.forEach(id => ids.add(id));
  
  document.querySelectorAll('[data-id], [data-user-id], [data-contact-id], [data-member-id], [data-profile-id]').forEach(el => {
    const id = el.getAttribute('data-id') || el.getAttribute('data-user-id') || 
               el.getAttribute('data-contact-id') || el.getAttribute('data-member-id') ||
               el.getAttribute('data-profile-id');
    if (id && /^\d{6,15}$/.test(id)) ids.add(id);
  });
  
  document.querySelectorAll('a[href]').forEach(a => {
    const m = a.href.match(/\/(\d{6,15})(?:[/?#]|$)/);
    if (m) ids.add(m[1]);
  });
  
  return Array.from(ids);
}

// ============ EJECUTAR LIKES (CAPTURA IDs) ============
async function executeLikes() {
  console.log('[LIKES] 🚀 Iniciando barrido...');
  updateModUI('likes', true);
  
  const searchBtn = findButton(['Buscar', 'Search', 'buscar', 'search', 'Browse']);
  if (searchBtn) { searchBtn.click(); await sleep(2000); }
  
  let page = 0, given = 0;
  
  while (likesActive && page < 50) {
    page++;
    
    // Capturar IDs de la página actual
    scanPageForIds().forEach(id => registerIdInStarTools(id, 'Like'));
    
    const likeBtns = document.querySelectorAll('[class*="like"], [class*="heart"], [class*="favorite"], [title*="Like"], [title*="like"], [aria-label*="Like"]');
    for (const btn of likeBtns) {
      if (!likesActive) break;
      
      // Verificar blacklist
      const profile = btn.closest('[class*="profile"], [class*="card"], [class*="user"], [class*="member"], [class*="item"], [class*="result"]');
      if (profile) {
        const contactId = extractId(profile);
        if (contactId && isBlacklisted(contactId)) {
          console.log('[LIKES] ⛔ Skipped (blacklist):', contactId);
          continue;
        }
      }
      
      if (!btn.disabled && btn.offsetParent) {
        btn.click();
        given++;
        botStats.likesGiven++;
        console.log('[LIKES] Like dado! Total:', botStats.likesGiven);
        updateStats();
        await sleep(200);
        
        const profile = btn.closest('[class*="profile"], [class*="card"], [class*="user"], [class*="member"], [class*="item"], [class*="result"]');
        if (profile && !isPinnedOrSaved(profile)) {
          const id = extractId(profile);
          if (id) registerIdInStarTools(id, 'Like');
        }
      }
    }
    
    console.log('[LIKES] Página', page, '- Likes:', given, '- IDs totales:', collectedIds.Like.length);
    
    const nextBtn = findButton(['Siguiente', 'Next', 'next', '»', '›', '>', 'Next page']);
    if (!nextBtn || nextBtn.disabled) break;
    nextBtn.click();
    await sleep(2500);
  }
  
  await syncMetricsToStorage('LIKES', given);
  likesActive = false;
  updateModUI('likes', false);
  saveAllStates();
  console.log('[LIKES] ✅ Completado. Total IDs Likes:', collectedIds.Like.length);
}

// ============ EJECUTAR FOLLOWS (CAPTURA IDs) ============
async function executeFollows() {
  console.log('[FOLLOWS] 🚀 Iniciando barrido...');
  updateModUI('follows', true);
  
  const searchBtn = findButton(['Buscar', 'Search', 'buscar', 'Browse']);
  if (searchBtn) { searchBtn.click(); await sleep(2000); }
  
  let page = 0, given = 0;
  
  while (followsActive && page < 50) {
    page++;
    
    scanPageForIds().forEach(id => registerIdInStarTools(id, 'Follow'));
    
    const followBtns = document.querySelectorAll('[class*="follow"], [class*="subscribe"], [title*="Follow"], [aria-label*="Follow"]');
    const allBtns = document.querySelectorAll('button, a, [role="button"]');
    const followButtons = new Set();
    
    for (const btn of followBtns) {
      if (!btn.disabled && btn.offsetParent) followButtons.add(btn);
    }
    
    for (const btn of allBtns) {
      const text = (btn.textContent || '').toLowerCase().trim();
      const title = (btn.title || '').toLowerCase().trim();
      if ((text === 'follow' || text === 'seguir' || text === '+ follow' || text === '+ seguir' ||
           title === 'follow' || title === 'seguir') && !btn.disabled && btn.offsetParent) {
        followButtons.add(btn);
      }
    }
    
    for (const btn of followButtons) {
      if (!followsActive) break;
      
      // Verificar blacklist
      const profile = btn.closest('[class*="profile"], [class*="card"], [class*="user"], [class*="member"], [class*="item"], [class*="result"], [class*="contact"]');
      const contactId = extractId(profile);
      if (contactId && isBlacklisted(contactId)) {
        console.log('[FOLLOWS] ⛔ Skipped (blacklist):', contactId);
        continue;
      }
      
      btn.click();
      given++;
      botStats.followsGiven++;
      console.log('[FOLLOWS] Follow dado! Total:', botStats.followsGiven);
      updateStats();
      await sleep(300);
      
      if (profile && !isPinnedOrSaved(profile)) {
        const id = extractId(profile);
        if (id) registerIdInStarTools(id, 'Follow');
      }
    }
    
    console.log('[FOLLOWS] Página', page, '- Follows:', given, '- IDs totales:', collectedIds.Follow.length);
    
    const nextBtn = findButton(['Siguiente', 'Next', 'next', '»', '›', '>']);
    if (!nextBtn || nextBtn.disabled) break;
    nextBtn.click();
    await sleep(2500);
  }
  
  await syncMetricsToStorage('FOLLOWS', given);
  followsActive = false;
  updateModUI('follows', false);
  saveAllStates();
  console.log('[FOLLOWS] ✅ Completado. Total IDs Follows:', collectedIds.Follow.length);
}

// ============ AYUDA: DETECTAR CONTACTOS CON INTERÉS RECIENTE ============
function isRecentlyEngaged(contactEl) {
  // Un contacto califica si ha explorado el perfil recientemente o ha enviado mensajes/cartas
  // Se excluyen automáticamente los contactos Pinneados o Guardados (blacklist)
  
  if (contactEl.querySelector('[class*="pin"], [class*="saved"], [class*="bookmark"], [class*="starred"]')) {
    return false; // Excluir pinned/saved
  }
  
  const text = (contactEl.textContent || '').toLowerCase();
  
  // Señales de que el contacto ha explorado el perfil recientemente
  const exploredSignals = [
    'visitó', 'visited', 'visto', 'viewed', 'vió tu perfil', 'saw your profile',
    'vió tu foto', 'saw your photo', 'ha visto', 'has viewed', 'recently visited',
    'vió tu', 'watching', 'watching you', 'visitó tu'
  ];
  
  // Señales de que el contacto ha enviado mensajes recientemente
  const messageSignals = [
    'envió', 'sent', 'mensaje', 'message', 'te escribió', 'wrote to you',
    'respondió', 'replied', 'dijo', 'said', 'te dijo', 'te envió', 'sent you',
    'nuevo mensaje', 'new message', 'te ha escrito', 'has written'
  ];
  
  // Señales de carta enviada
  const cartaSignals = [
    'carta', 'letter', 'envió una carta', 'sent a letter', 'te envió una carta',
    'carta recibida', 'letter received', 'nueva carta', 'new letter'
  ];
  
  // Señales de actividad reciente (timestamps)
  const recentTimeSignals = [
    'ahora', 'now', 'justo', 'just now', 'minuto', 'minute', 'min',
    'hace', 'ago', 'hore', 'hour', 'hoy', 'today'
  ];
  
  const hasExplored = exploredSignals.some(s => text.includes(s));
  const hasMessages = messageSignals.some(s => text.includes(s));
  const hasCartas = cartaSignals.some(s => text.includes(s));
  const hasRecentActivity = recentTimeSignals.some(s => text.includes(s));
  
  // También verificar timestamps recientes en elementos de tiempo
  let hasRecentTimestamp = false;
  const timeEl = contactEl.querySelector('[class*="time"], [class*="duration"], [class*="date"], [class*="timestamp"]');
  if (timeEl) {
    const timeText = (timeEl.textContent || '').toLowerCase();
    // Si el timestamp contiene minutos (m), horas (h) o "hoy", es reciente
    if (timeText.match(/\d+\s*(m|min|minute|h|hr|hour)/) || timeText.includes('now') || timeText.includes('ahora') || timeText.includes('hoy') || timeText.includes('today')) {
      hasRecentTimestamp = true;
    }
  }
  
  // Califica si tiene cualquiera de las señales de interés reciente
  return (hasExplored || hasMessages || hasCartas || hasRecentActivity || hasRecentTimestamp);
}

// ============ EJECUTAR SALUDOS (CAPTURA IDs) ============
async function executeSaludos() {
  console.log('[SALUDOS] 🚀 Iniciando barrido...');
  
  const list = document.querySelector('[class*="contact-list"], [class*="chat-list"], [class*="conversation"], [class*="dialog"], [class*="messages"]');
  if (!list) {
    console.log('[SALUDOS] ❌ Lista no encontrada con selectores. Buscando lista genérica...');
    // Fallback: buscar cualquier lista grande
    const altList = document.querySelector('ul, [class*="list"], [role="list"]');
    if (!altList) {
      console.log('[SALUDOS] ❌ No se encontró ninguna lista en la página');
      saludosActive = false;
      updateModUI('saludos', false);
      return;
    }
    console.log('[SALUDOS] Usando lista alternativa:', altList.className || altList.tagName);
    await doSaludosSweep(altList);
    return;
  }
  
  await doSaludosSweep(list);
}

async function doSaludosSweep(list) {
  const processedIds = new Set();
  scanPageForIds().forEach(id => registerIdInStarTools(id, 'Saludo'));
  
  let sent = 0;
  let skipped = 0;
  let maxIterations = 200;
  let iter = 0;
  
  while (saludosActive && iter < maxIterations) {
    iter++;
    const contacts = Array.from(list.querySelectorAll('[class*="contact"], [class*="user"], [class*="item"], [class*="member"], [class*="dialog-item"], li'));
    const activeContact = contacts.find(c => {
      if (c.offsetParent === null || isPinnedOrSaved(c)) return false;
      const cid = extractId(c);
      return !cid || !processedIds.has(cid);
    });
    if (!activeContact) break;
    
    activeContact.click();
    await sleep(2000);
    
    const input = await waitForChatInput(5000);
    if (!input) {
      const cid = extractId(activeContact);
      if (cid) processedIds.add(cid);
      skipped++;
      continue;
    }
    
    const msg = saludoMessages[Math.floor(Math.random() * saludoMessages.length)];
    copyToChatInput(msg);
    await sleep(800);
    sendChatMessage();
    await sleep(1500);
    
    const id = extractId(activeContact);
    if (id) {
      processedIds.add(id);
      registerIdInStarTools(id, 'Saludo');
    }
    
    scanPageForIds().forEach(newId => registerIdInStarTools(newId, 'Saludo'));
    
    sent++;
    botStats.messagesSent++;
    botStats.contactsProcessed++;
    updateStats();
    await sleep(2000);
  }
  
  scanPageForIds().forEach(id => registerIdInStarTools(id, 'Saludo'));
  
  await syncMetricsToStorage('SALUDOS', sent);
  saludosActive = false;
  updateModUI('saludos', false);
  saveAllStates();
  console.log('[SALUDOS] ✅ Completado. Enviados:', sent, '| Saltados:', skipped, '| Total IDs Saludos:', collectedIds.Saludo.length);
}

// ============ EJECUTAR CARTAS (CAPTURA IDs) ============
async function executeCartas() {
  console.log('[CARTAS] 🚀 Iniciando barrido...');
  
  // Buscar lista de contactos/threads con múltiples selectores
  let list = document.querySelector('[class*="contact-list"], [class*="chat-list"], [class*="conversation"], [class*="thread-list"], [class*="dialog-list"], [class*="inbox"], [class*="message-list"]');
  
  if (!list) {
    console.log('[CARTAS] ❌ Lista no encontrada con selectores específicos. Buscando lista genérica...');
    // Probar selectores genéricos
    const altList = document.querySelector('ul, [class*="list"], [role="list"], [class*="items"], [class*="container"] > div, main');
    if (!altList) {
      console.log('[CARTAS] ❌ No se encontró ninguna lista en la página');
      console.log('[CARTAS] DEBUG - Cuerpo:', document.body.innerHTML.substring(0, 500));
      cartasActive = false;
      updateModUI('cartas', false);
      return;
    }
    console.log('[CARTAS] Usando lista alternativa:', altList.className || altList.tagName, '| hijos:', altList.children.length);
    await doCartasSweep(altList);
    return;
  }
  
  console.log('[CARTAS] Lista encontrada:', list.className || list.tagName, '| hijos:', list.children.length);
  await doCartasSweep(list);
}

async function doCartasSweep(list) {
  const processedIds = new Set();
  scanPageForIds().forEach(id => registerIdInStarTools(id, 'Cartas'));
  
  let sent = 0;
  let skipped = 0;
  let maxIterations = 200;
  let iter = 0;
  
  while (cartasActive && iter < maxIterations) {
    iter++;
    const contacts = Array.from(list.querySelectorAll('[class*="contact"], [class*="user"], [class*="item"], [class*="dialog-item"], [class*="thread"], [class*="conversation"], li, [class*="row"], [class*="member"]'));
    const activeContact = contacts.find(c => {
      if (c.offsetParent === null || isPinnedOrSaved(c)) return false;
      const cid = extractId(c);
      return !cid || !processedIds.has(cid);
    });
    if (!activeContact) break;
    
    activeContact.click();
    await sleep(2000);
    
    const input = await waitForChatInput(5000);
    if (!input) {
      const cid = extractId(activeContact);
      if (cid) processedIds.add(cid);
      skipped++;
      continue;
    }
    
    const carta = cartaMessages[Math.floor(Math.random() * cartaMessages.length)];
    const shortCarta = carta.replace(/\n{2,}/g, ' ').substring(0, 200);
    copyToChatInput(shortCarta);
    await sleep(800);
    sendChatMessage();
    await sleep(1500);
    
    const id = extractId(activeContact);
    if (id) {
      processedIds.add(id);
      registerIdInStarTools(id, 'Cartas');
    }
    
    scanPageForIds().forEach(newId => registerIdInStarTools(newId, 'Cartas'));
    
    sent++;
    botStats.cartasSent++;
    updateStats();
    await sleep(2000);
  }
  
  scanPageForIds().forEach(id => registerIdInStarTools(id, 'Cartas'));
  
  await syncMetricsToStorage('CARTAS', sent);
  cartasActive = false;
  updateModUI('cartas', false);
  saveAllStates();
  console.log('[CARTAS] ✅ Completado. Enviados:', sent, '| Saltados:', skipped, '| Total IDs Cartas:', collectedIds.Cartas.length);
}

// ============ RENDER STAR IDS ============
function renderStarIds() {
  const out = document.getElementById('stOutput');
  const count = document.getElementById('stCount');
  const totalLive = document.getElementById('starTotalLive');
  if (!out || !count) return;
  
  const likesCount = (collectedIds.Like || []).length;
  const followsCount = (collectedIds.Follow || []).length;
  const saludosCount = (collectedIds.Saludo || []).length;
  const cartasCount = (collectedIds.Cartas || []).length;
  const totalAll = likesCount + followsCount + saludosCount + cartasCount;
  
  const cntAll = document.getElementById('cntAll');
  const cntLike = document.getElementById('cntLike');
  const cntFollow = document.getElementById('cntFollow');
  const cntSaludo = document.getElementById('cntSaludo');
  const cntCartas = document.getElementById('cntCartas');
  
  if (cntAll) cntAll.textContent = totalAll;
  if (cntLike) cntLike.textContent = likesCount;
  if (cntFollow) cntFollow.textContent = followsCount;
  if (cntSaludo) cntSaludo.textContent = saludosCount;
  if (cntCartas) cntCartas.textContent = cartasCount;
  // Indicador LIVE con pulso cuando hay barrido activo
  const anyActive = likesActive || followsActive || saludosActive || cartasActive;
  if (totalLive) totalLive.innerHTML = anyActive
    ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#4CAF50;margin-right:5px;animation:blink 1s infinite;"></span>${totalAll} IDs capturados`
    : `${totalAll} IDs capturados`;
  
  let ids = [];
  if (currentStarFilter === 'all') {
    ['Like', 'Follow', 'Saludo', 'Cartas'].forEach(t => {
      (collectedIds[t] || []).forEach(id => ids.push({ id: id, type: t }));
    });
  } else {
    (collectedIds[currentStarFilter] || []).forEach(id => ids.push({ id: id, type: currentStarFilter }));
  }
  
  count.textContent = 'TOTAL: ' + ids.length + ' IDs';
  
  if (ids.length === 0) {
    out.innerHTML = '<div class="idhdr"><span>#</span><span>ID CLIENTE</span><span>BARRIDO</span></div><div class="empty">⭐ SIN IDs DE "' + currentStarFilter.toUpperCase() + '"<br><small>Ejecuta un barrido para recolectar IDs</small></div>';
    return;
  }
  
  // Scroll al último si se agregó un nuevo ID (cuando estamos en la parte baja)
  const wasAtBottom = out.scrollTop + out.clientHeight >= out.scrollHeight - 10;

  out.innerHTML = '<div class="idhdr"><span>#</span><span>ID CLIENTE</span><span>BARRIDO</span></div>' +
    ids.map((item, i) => `
    <div class="idrow">
      <span class="idnum">${String(i + 1).padStart(3, '0')}</span>
      <span class="idval">${item.id}</span>
      <span class="idtag ${item.type}">${item.type}</span>
    </div>`).join('');

  // Auto-scroll al último ID si el usuario ya estaba al fondo
  if (wasAtBottom) out.scrollTop = out.scrollHeight;
}

// ============ EATER ============
function toggleEater() {
  eaterActive = !eaterActive;
  const btn = document.getElementById('btnEaterToggle');
  btn.textContent = '🧠 EATER: ' + (eaterActive ? 'ON' : 'OFF');
  btn.className = 'eater-btn' + (eaterActive ? ' on' : '');
  document.getElementById('eaterFloatBar').style.display = eaterActive ? 'block' : 'none';
  document.getElementById('eaterSuggestions').style.display = eaterActive ? 'block' : 'none';
  saveAllStates();
}

function copySugToChat(index) {
  const sug = eaterSuggestions[index];
  if (!sug) return;
  copyToChatInput(sug);
  const eq = document.getElementById('eq' + (index + 1));
  if (eq) { eq.style.background = 'rgba(76,175,80,0.4)'; setTimeout(() => eq.style.background = '', 600); }
}

function copyToChatInput(text) {
  const input = findChatInput();
  if (!input) return;
  
  if (input.isContentEditable || input.tagName === 'DIV') {
    input.innerHTML = text.replace(/\n/g, '<br>');
  } else {
    input.value = text;
  }
  input.focus();
  try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch(e) {}
  try { input.dispatchEvent(new Event('keyup', { bubbles: true })); } catch(e) {}
}

function sendChatMessage() {
  const input = findChatInput();
  if (!input) return false;
  input.focus();
  
  const hasNewlines = (input.value || input.textContent || '').includes('\n');
  
  // Buscar botón de envío primero (más confiable para multilínea)
  const chatArea = input.closest('[class*="chat"], [class*="message"], form') || document.body;
  const sendBtn = chatArea.querySelector('button[type="submit"], button[class*="send"], button[aria-label*="enviar"], button[aria-label*="send"], [class*="send-btn"], [class*="btn-send"], button[class*="chat-send"]');
  
  if (sendBtn && !sendBtn.disabled) {
    try { sendBtn.click(); } catch(e) {}
    return true;
  }
  
  // Fallback: Enter key (solo si no tiene saltos de línea)
  if (!hasNewlines) {
    try {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, code: 'Enter', which: 13, bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, code: 'Enter', which: 13, bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, code: 'Enter', which: 13, bubbles: true, cancelable: true }));
      if (input.tagName === 'TEXTAREA') {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch(e) {}
  }
  
  return true;
}

function isPinnedOrSaved(contactEl) {
  const text = contactEl.textContent.toLowerCase();
  if (text.includes('pin') || text.includes('saved') || text.includes('fijado') || text.includes('guardado')) return true;
  if (contactEl.querySelector('[class*="pin"], [class*="saved"], [class*="star"], [class*="fixed"], [src*="pin"], [src*="star"]')) return true;
  return false;
}

// ============ CHAT WATCHER ============
function startChatWatcher() {
  const observer = new MutationObserver((mutations) => {
    if (!eaterActive || !isAuthenticated) return;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) checkForIncomingMessages(node);
        }
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function checkForIncomingMessages(node) {
  const selectors = [
    '[class*="message-in"]', '[class*="message-received"]', '[class*="incoming"]',
    '[class*="other-message"]', '[class*="contact-message"]', '[class*="msg-other"]',
    '[class*="bubble-other"]', '[class*="dialog-item"]:not([class*="own"])',
    '[class*="chat-message"]:not([class*="sent"])', 'div[class*="message"]:not([class*="my"])'
  ];
  
  for (const sel of selectors) {
    if (node.matches && node.matches(sel)) { analyzeMessage(node); return; }
  }
  
  for (const sel of selectors) {
    const messages = node.querySelectorAll(sel);
    if (messages.length > 0) { messages.forEach(msg => analyzeMessage(msg)); return; }
  }
}

function analyzeMessage(msgEl) {
  const nameSelectors = ['[class*="name"]', '[class*="sender"]', '[class*="author"]', '[class*="username"]', '[class*="contact-name"]'];
  let clientName = 'Cliente';
  for (const sel of nameSelectors) {
    const nameEl = msgEl.querySelector(sel);
    if (nameEl && nameEl.textContent.trim()) { clientName = nameEl.textContent.trim(); break; }
  }
  
  if (clientName !== currentClientName) {
    currentClientName = clientName;
    analyzeClientProfile(clientName);
  } else {
    analyzeClientProfile(clientName);
  }
}

let eaterProfileTimer = null;
let lastAnalyzedName = '';

function analyzeClientProfile(clientName) {
  if (!clientName || !isAuthenticated || !eaterActive) return;
  if (clientName === lastAnalyzedName) return;
  lastAnalyzedName = clientName;
  
  if (eaterProfileTimer) clearTimeout(eaterProfileTimer);
  eaterProfileTimer = setTimeout(() => {
    const profileEl = document.querySelector('[class*="profile-detail"], [class*="user-profile"], [class*="member-info"], [class*="contact-info"]') || document.body;
    
    const profile = {
      name: clientName,
      interests: extractInterests(profileEl),
      location: extractLocation(profileEl),
      bio: extractBio(profileEl),
      age: extractAge(profileEl),
      hasPhoto: checkPhoto(profileEl),
      hobbies: extractHobbies(profileEl)
    };
    
    generateSuggestions(clientName, profile);
  }, 800);
}

function checkPhoto(el) {
  const imgs = el.querySelectorAll('img[class*="photo"], img[class*="avatar"], img[src]');
  for (const img of imgs) {
    if (img.src && !img.src.includes('default') && !img.src.includes('placeholder') && !img.src.includes('no-photo') && img.naturalWidth > 10) return true;
  }
  return false;
}

function extractInterests(el) {
  const t = (el.textContent || '').toLowerCase();
  const interests = [];
  const kw = {
    'viajes': ['viaje', 'viajar', 'travel', 'playa'],
    'música': ['música', 'music', 'bailar', 'cantar'],
    'deportes': ['deporte', 'gym', 'gimnasio', 'fútbol'],
    'lectura': ['libro', 'leer', 'lectura'],
    'cine': ['película', 'cine', 'movie', 'series'],
    'cocina': ['cocina', 'cocinar', 'food', 'comida']
  };
  for (const [k, v] of Object.entries(kw)) {
    if (v.some(w => t.includes(w))) interests.push(k);
  }
  return interests;
}

function extractLocation(el) {
  const text = el.textContent || '';
  const m = text.match(/(?:de|from|vive en|lives in)[:\s]*([A-ZÁÉÍÓÚ][a-záéíóú]+)/i);
  return m ? m[1].trim() : null;
}

function extractBio(el) {
  const bioEl = el.querySelector('[class*="bio"], [class*="description"], [class*="about"]');
  return (bioEl && bioEl.textContent.trim().length > 10) ? bioEl.textContent.trim() : '';
}

function extractAge(el) {
  const text = el.textContent || '';
  const m = text.match(/(\d{2})\s*(?:años|years|age|edad)/i);
  return m ? parseInt(m[1]) : null;
}

function extractHobbies(el) {
  const t = (el.textContent || '').toLowerCase();
  const h = [];
  if (t.includes('bailar') || t.includes('dance')) h.push('bailar');
  if (t.includes('cocinar') || t.includes('cooking')) h.push('cocinar');
  if (t.includes('viajar') || t.includes('travel')) h.push('viajar');
  return h.length > 0 ? h : null;
}

let generateTimer = null;

function generateSuggestions(name, profile) {
  const btn = document.getElementById('btnRefreshEater');
  if (generateTimer) clearTimeout(generateTimer);
  
  generateTimer = setTimeout(() => {
    btn.textContent = '🤖 IA...';
    
    generateWithAI(name, profile).then(aiSuggestions => {
      if (aiSuggestions && aiSuggestions.length > 0) {
        isUsingAI = true;
        btn.textContent = '🤖 IA';
        eaterSuggestions = aiSuggestions;
      } else {
        isUsingAI = false;
        btn.textContent = '🔄 FRASES';
        generateLocalSuggestions(name, profile);
      }
      displaySuggestions(name, profile);
    }).catch(() => {
      isUsingAI = false;
      btn.textContent = '🔄 FRASES';
      generateLocalSuggestions(name, profile);
      displaySuggestions(name, profile);
    });
  }, 500);
}

async function generateWithAI(name, profile) {
  try {
    const stored = await chrome.storage.local.get(['tess_jwt']);
    const token = stored.tess_jwt;
    
    const randomSeed = Math.floor(Math.random() * 10000);
    const prompt = `Genera 3 frases push-pull ÚNICAS y VARIADAS para iniciar conversación en app de citas.
Cada frase: 4-8 palabras. Estilo: directo, misterioso, provocativo.
NUNCA repitas: "me gustas", "curioso", "conversar", "hola", "hola".
Ejemplos distintos: "Tu sonrisa me intrigue", "Algo me dice que vales la pena", "¿Y si esta vez sí?", "Tengo corazonada contigo", "No puedo dejar de pensar...", "¿responderás?".

Semilla aleatoria #${randomSeed} - genera combinaciones TOTALMENTE DIFERENTES.
Responde SOLO las 3 frases, una por línea, nada más.`;

    console.log('[EATER AI] Llamando a IA con seed:', randomSeed);
    
    const response = await fetch(`${TESSERACT_API}/api/chatgpt/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Eres un experto en dating coaching. Generas frases push-pull únicas, cortas (4-8 palabras), directas, sin repetir patrones. Siempre distintas.' },
          { role: 'user', content: prompt }
        ],
        model: 'gpt-3.5-turbo',
        max_tokens: 80
      })
    });
    
    console.log('[EATER AI] Response status:', response.status);
    if (!response.ok) return null;
    
    const data = await response.json();
    console.log('[EATER AI] Response data:', data);
    
    if (data.choices && data.choices[0]?.message?.content) {
      const text = data.choices[0].message.content;
      const lines = text.split('\n').filter(l => l.trim().length > 3 && l.trim().length < 50);
      console.log('[EATER AI] Frases generadas:', lines);
      return lines.slice(0, 3);
    }
    return null;
  } catch (e) {
    console.warn('[EATER AI] Error:', e.message);
    return null;
  }
}

function generateLocalSuggestions(name, profile) {
  const { interests, location, hobbies } = profile;
  const hasRealInterests = interests && interests.length > 0;
  const hasRealHobbies = hobbies && hobbies.length > 0;
  const hasRealLocation = location && location.length > 0;
  
  const candidates = [
    'Me gustas, pero no sé si me vas a responder...',
    'Tu perfil me tiene curioso... ¿serás interesante?',
    'Tengo una corazonada sobre ti...',
    'Algo me dice que deberíamos conversar...',
    'No puedo dejar de pensar en tu sonrisa...',
    '¿Y si esta vez sí funciona? 🤔',
    'Me atraes... pero quiero saber si eres tú quien dice algo.',
    'Veo tu perfil y pienso "ella/él podría ser"...',
    'Mi instinto me dice que vales la pena...',
    '¿Qué tal sinos llevamos mejor de lo esperado?',
    location && hasRealLocation ? `Vivo cerca de ${location}, ¿y tú?` : null,
    interests && hasRealInterests ? `Veo que te gusta ${interests[0]}... interesante!` : null,
    hobbies && hasRealHobbies ? `También pratico ${hobbies[0]}!` : null,
  ].filter(s => s);
  
  // Mezclar y tomar 3 aleatorias
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  eaterSuggestions = shuffled.slice(0, 3);
}

function displaySuggestions(name) {
  const cnEl = document.getElementById('eaterClientName');
  if (cnEl) cnEl.textContent = name;
  
  const sugListEl = document.getElementById('eaterSugList');
  if (!sugListEl) return;
  
  const maxShow = 2;
  const displaySug = eaterSuggestions.slice(0, maxShow);
  
  sugListEl.innerHTML = displaySug.map((s, i) => `
    <div class="eater-row" data-sug-text="${s.replace(/"/g, '&quot;')}">
      <div style="flex:1;word-break:break-word;">
        <span class="sn">${i+1}.</span>
        <span class="sug-text" style="font-size:11px;line-height:1.3;">${s.length > 60 ? s.substring(0,60)+'...' : s}</span>
      </div>
      <button class="tr-btn" data-action="translate" data-sug-text="${s.replace(/"/g, '&quot;')}">🌐</button>
    </div>
  `).join('');
  
  // Actualizar botones eq1, eq2 de la barra flotante
  const eq1 = document.getElementById('eq1');
  const eq2 = document.getElementById('eq2');
  if (eq1) eq1.textContent = '\uD83D\uDCAC ' + (eaterSuggestions[0]?.substring(0, 18) || 'SUG 1') + '...';
  if (eq2) eq2.textContent = '\uD83D\uDCAC ' + (eaterSuggestions[1]?.substring(0, 18) || 'SUG 2') + '...';
}

function selectEaterSuggestion(text) {
  const chatInput = document.getElementById('messageInput') || document.getElementById('chatInput');
  if (chatInput) {
    chatInput.value = text;
    chatInput.focus();
  }
}

async function translateEaterText(text) {
  try {
    const stored = await chrome.storage.local.get(['tess_jwt']);
    const token = stored.tess_jwt;
    
    const res = await fetch(`${TESSERACT_API}/api/deepl/translate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ text, target: 'es' })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.translatedText) {
        alert('Traducción:\n\n' + data.translatedText);
      }
    } else {
      alert('Error al traducir');
    }
  } catch(e) {
    alert('Error: ' + e.message);
  }
}

// ============ REFRESH EATER ============
function refreshEaterSuggestions() {
  eaterRefreshCount++;
  const clientName = currentClientName || 'Cliente';
  const profileEl = document.querySelector('[class*="profile-detail"], [class*="user-profile"], [class*="member-info"], [class*="contact-info"]') || document.body;
  const profile = {
    name: clientName,
    interests: extractInterests(profileEl),
    location: extractLocation(profileEl),
    bio: extractBio(profileEl),
    age: extractAge(profileEl),
    hasPhoto: checkPhoto(profileEl),
    hobbies: extractHobbies(profileEl)
  };
  
  const btn = document.getElementById('btnRefreshEater');
  if (btn) {
    btn.textContent = '🤖 IA...';
    btn.style.background = 'rgba(139,92,246,0.5)';
  }
  
  generateWithAI(clientName, profile).then(aiSuggestions => {
    if (aiSuggestions && aiSuggestions.length > 0) {
      isUsingAI = true;
      eaterSuggestions = aiSuggestions;
      if (btn) {
        btn.textContent = '🤖 IA #' + eaterRefreshCount;
        btn.style.background = 'rgba(139,92,246,0.3)';
      }
    } else {
      isUsingAI = false;
      generateLocalSuggestions(clientName, profile);
      if (btn) {
        btn.textContent = '🔄 FRASES #' + eaterRefreshCount;
        btn.style.background = 'rgba(30,27,75,0.7)';
      }
    }
    displaySuggestions(clientName);
  }).catch(() => {
    isUsingAI = false;
    generateLocalSuggestions(clientName, profile);
    if (btn) {
      btn.textContent = '🔄 FRASES #' + eaterRefreshCount;
      btn.style.background = 'rgba(30,27,75,0.7)';
    }
    displaySuggestions(clientName);
  });
}

// ============ TRADUCCIÓN ============
function translateLastMessage() {
  if (!lastGeneratedMessage) return;
  translateText(lastGeneratedMessage).then(t => {
    copyToChatInput(t);
    lastGeneratedMessage = t;
    isEnglishMode = !isEnglishMode;
    document.getElementById('btnTranslate').textContent = isEnglishMode ? '🌐 ES' : '🌐 EN';
  });
}

async function translateText(text) {
  try {
    const token = await new Promise(r => chrome.storage.local.get('tess_jwt', d => r(d.tess_jwt)));
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const resp = await fetch(`${TESSERACT_API}/api/openai/translate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: text,
        translateWith: 'deepseek',
        forceSpanish: isEnglishMode
      })
    });
    const data = await resp.json();
    if (data.success && data.data?.translations?.[0]?.text) {
      return data.data.translations[0].text;
    }
  } catch (e) {
    console.warn('[TESSERACT] Translate error, usando texto original:', e.message);
  }
  return text;
}

// ============ PERFIL ACTIVO ============
function detectCurrentProfile() {
  const badge = document.getElementById('profileBadge');
  const nameEl = document.getElementById('profileName');
  const idEl = document.getElementById('profileId');
  if (!badge || !nameEl || !idEl) return;

  let profileName = '';
  let profileId = '';

  // 1. URL path con patrones de perfil
  const urlMatch = location.pathname.match(/\/(?:profile|user|member|u|id)\/([^/?#]+)/i);
  if (urlMatch) {
    const val = urlMatch[1];
    if (/^\d{6,15}$/.test(val)) profileId = val;
    else if (!profileName && val.length < 40) profileName = val;
  }

  // 2. Título de página
  const title = document.title;
  const titleClean = title.replace(/[|-].*$/, '').trim();
  if (titleClean && titleClean.toLowerCase() !== 'talkytimes' && titleClean.length < 40) {
    profileName = profileName || titleClean;
  }

  // 3. Selectores masivos de nombre de perfil
  const nameSelectors = [
    '[class*="username"]', '[class*="display-name"]', '[class*="profile-name"]',
    '[class*="user-name"]', '[class*="member-name"]', '[class*="nickname"]',
    '[class*="logged-name"]', '[class*="header-user"]', '[class*="my-name"]',
    '[class*="current-user"]', '[class*="user-info"]', '[class*="nav-user"]',
    '[class*="top-user"]', '[class*="logged-in"]', '[class*="welcome"]',
    '[class*="greeting"]', '[class*="user-menu"]', '[class*="account-name"]',
    '[class*="header-name"]', '[class*="user-label"]', '[class*="member-label"]',
    '[id*="username"]', '[id*="displayname"]', '[id*="profile-name"]',
    '[id*="user-name"]', '[aria-label*="profile"]', '[aria-label*="user"]'
  ];
  for (const sel of nameSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const t = el.textContent.trim();
      if (t && t.length < 50 && !t.includes('@') && !t.includes('http')) {
        profileName = t;
        break;
      }
    }
  }

  // 4. data-attributes en body o html
  if (!profileId) {
    const attrs = ['data-user-id', 'data-profile-id', 'data-member-id', 'data-id', 'data-uid', 'data-user', 'data-profile'];
    for (const a of attrs) {
      const v = document.body.getAttribute(a) || document.documentElement.getAttribute(a);
      if (v && /^\d{6,15}$/.test(v)) { profileId = v; break; }
    }
  }

  // 5. Avatar alt text
  if (!profileName) {
    const imgs = document.querySelectorAll('img[class*="avatar"], img[class*="profile"], img[class*="photo"], img[alt]:not([alt=""])');
    for (const img of imgs) {
      const alt = (img.alt || '').trim();
      if (alt && alt.length < 40 && !/photo|avatar|profile|imagen|user/i.test(alt)) {
        profileName = alt; break;
      }
    }
  }

  // 6. Extraer ID de la URL completa
  if (!profileId) {
    const m = location.href.match(/\/(\d{6,15})(?:[/?#]|$)/);
    if (m) profileId = m[1];
  }

  // 7. Enlaces "mi perfil" / "my profile"
  if (!profileName) {
    const links = document.querySelectorAll('a[href*="profile"], a[href*="perfil"], a[href*="my-"], a[href*="account"]');
    for (const link of links) {
      const t = (link.textContent || '').trim();
      if (t && t.length < 40 && !/profile|perfil|account|my\s/i.test(t) && !t.includes('@')) {
        profileName = t; break;
      }
    }
  }

  // 8. localStorage: talkytimes podría guardar el usuario actual
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      try {
        const val = JSON.parse(localStorage.getItem(key));
        if (val && typeof val === 'object') {
          if (val.userId || val.id || val.user_id) {
            const id = String(val.userId || val.id || val.user_id);
            if (/^\d{6,15}$/.test(id) && !profileId) profileId = id;
          }
          if ((val.name || val.username || val.displayName) && !profileName) {
            profileName = val.name || val.username || val.displayName;
          }
        }
      } catch (e) {}
      if (profileName && profileId) break;
    }
  } catch (e) {}

  // 9. Buscar datos de window.__INITIAL_STATE__ (SPAs)
  if (!profileName || !profileId) {
    try {
      const globalKeys = ['__INITIAL_STATE__', '__DATA__', '__USER__', '__PROFILE__', '__NEXT_DATA__'];
      for (const gk of globalKeys) {
        const data = window[gk];
        if (data && typeof data === 'object') {
          const str = JSON.stringify(data);
          const idM = str.match(/"id"\s*:\s*"(\d{6,15})"/) || str.match(/"userId"\s*:\s*"(\d{6,15})"/);
          if (idM && !profileId) profileId = idM[1];
          const nM = str.match(/"name"\s*:\s*"([^"]{2,40})"/) || str.match(/"username"\s*:\s*"([^"]{2,40})"/);
          if (nM && !profileName) profileName = nM[1];
        }
      }
    } catch (e) {}
  }

  console.log('[TESSERACT] Profile detection:', { profileName, profileId, url: location.href, title: document.title });

  // Actualizar UI
  if (profileName || profileId) {
    nameEl.textContent = profileName || '—';
    idEl.textContent = 'ID: ' + (profileId || '—');
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function startProfileWatcher() {
  detectCurrentProfile();
  // Re-detectar cuando cambie la URL (navegación SPA)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(detectCurrentProfile, 500);
    }
  }, 2000);
  // También detectar después de login
  const loginObserver = new MutationObserver(() => {
    if (isAuthenticated) detectCurrentProfile();
  });
  loginObserver.observe(document.getElementById('mainScreen') || document.body, { attributes: true, childList: true, subtree: true });
}

// ============ CONFIGURACIONES ============
function openSaludosConfig() {
  document.getElementById('sMsg1').value = saludoMessages[0] || '';
  document.getElementById('sMsg2').value = saludoMessages[1] || '';
  document.getElementById('sMsg3').value = saludoMessages[2] || '';
  document.getElementById('sMsg4').value = saludoMessages[3] || '';
  document.getElementById('sMsg5').value = saludoMessages[4] || '';
  document.getElementById('saludosModal').style.display = 'block';
}

function saveSaludosConfig() {
  saludoMessages = [
    document.getElementById('sMsg1').value.trim(),
    document.getElementById('sMsg2').value.trim(),
    document.getElementById('sMsg3').value.trim(),
    document.getElementById('sMsg4').value.trim(),
    document.getElementById('sMsg5').value.trim()
  ].filter(m => m.length > 0);
  if (!saludoMessages.length) saludoMessages = ['Hola, ¿cómo estás?'];
  document.getElementById('saludosModal').style.display = 'none';
  saveAllStates();
}

function openCartasConfig() {
  document.getElementById('cartaText').value = cartaMessages.join('\n---\n');
  document.getElementById('cartasModal').style.display = 'block';
}

function saveCartasConfig() {
  const raw = document.getElementById('cartaText').value.trim();
  if (raw) {
    cartaMessages = raw.split('---').map(m => m.trim()).filter(m => m.length > 0);
  }
  if (!cartaMessages.length) cartaMessages = ['Querido/a amigo/a, me encantaría conocerte mejor.'];
  document.getElementById('cartasModal').style.display = 'none';
  saveAllStates();
}

// ============ UTILIDADES ============
function findButton(labels) {
  const btns = document.querySelectorAll('button, a, [role="button"], span[class*="btn"]');
  for (const b of btns) {
    const text = (b.textContent || '').toLowerCase();
    const title = (b.title || '').toLowerCase();
    if (labels.some(l => text.includes(l.toLowerCase()) || title.includes(l.toLowerCase()))) {
      if (b.offsetParent) return b;
    }
  }
  return null;
}

async function waitForChatInput(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const input = findChatInput();
    if (input) return input;
    await sleep(200);
  }
  return null;
}

function findChatInput() {
  const selectors = [
    'textarea[placeholder*="mensaje"]', 'textarea[placeholder*="message"]',
    'textarea[placeholder*="escrib"]', 'textarea[class*="chat"]',
    '[contenteditable="true"][class*="chat"]', '.chat-input textarea'
  ];
  
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el && el.offsetParent) return el;
  }
  
  const allTextareas = document.querySelectorAll('textarea');
  for (const ta of allTextareas) {
    if (ta.offsetParent && !ta.placeholder?.toLowerCase().includes('search')) return ta;
  }
  
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function updateStats() {
  console.log('[STATS] Updating - Likes:', botStats.likesGiven, 'Follows:', botStats.followsGiven);
  const vLikes = document.getElementById('vLikes');
  const vFollows = document.getElementById('vFollows');
  const vMsgs = document.getElementById('vMsgs');
  console.log('[STATS] Elements - vLikes:', !!vLikes, 'vFollows:', !!vFollows, 'vMsgs:', !!vMsgs);
  if (vLikes) vLikes.textContent = botStats.likesGiven;
  if (vFollows) vFollows.textContent = botStats.followsGiven;
  if (vMsgs) vMsgs.textContent = botStats.messagesSent;
}

function makeDraggable(panelId, headerSel) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const header = panel.querySelector(headerSel);
  if (!header) return;
  let d = false, ix, iy;
  header.addEventListener('mousedown', e => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    if (e.target.closest('.tess-resize')) return;
    d = true; ix = e.clientX - panel.offsetLeft; iy = e.clientY - panel.offsetTop;
  });
  document.addEventListener('mousemove', e => {
    if (!d) return;
    panel.style.left = (e.clientX - ix) + 'px'; panel.style.top = (e.clientY - iy) + 'px';
    panel.style.bottom = 'auto'; panel.style.right = 'auto';
    panel.style.transform = 'none'; // Evitar conflicto con translateX(-50%) del eater
  });
  document.addEventListener('mouseup', () => { d = false; });
  // Inicializar resize en las esquinas
  panel.querySelectorAll('.tess-resize').forEach(handle => {
    handle.addEventListener('mousedown', function(ev) {
      ev.stopPropagation();
      ev.preventDefault();
      const corner = this.className.includes('se') ? 'se' : this.className.includes('sw') ? 'sw' : this.className.includes('ne') ? 'ne' : 'nw';
      const startX = ev.clientX, startY = ev.clientY;
      const startW = panel.offsetWidth, startH = panel.offsetHeight;
      const startL = panel.offsetLeft, startT = panel.offsetTop;
      function doResize(me) {
        const dx = me.clientX - startX, dy = me.clientY - startY;
        if (corner === 'se') {
          panel.style.width = Math.max(280, startW + dx) + 'px';
          panel.style.height = Math.max(200, startH + dy) + 'px';
        } else if (corner === 'sw') {
          panel.style.width = Math.max(280, startW - dx) + 'px';
          panel.style.left = (startL + dx) + 'px';
          panel.style.height = Math.max(200, startH + dy) + 'px';
        } else if (corner === 'ne') {
          panel.style.width = Math.max(280, startW + dx) + 'px';
          panel.style.top = (startT + dy) + 'px';
          panel.style.height = Math.max(200, startH - dy) + 'px';
        } else if (corner === 'nw') {
          panel.style.width = Math.max(280, startW - dx) + 'px';
          panel.style.left = (startL + dx) + 'px';
          panel.style.top = (startT + dy) + 'px';
          panel.style.height = Math.max(200, startH - dy) + 'px';
        }
      }
      function stopResize() {
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
      }
      document.addEventListener('mousemove', doResize);
      document.addEventListener('mouseup', stopResize);
    });
  });
}

function clearIDs() {
  if (!Object.values(collectedIds).some(arr => arr.length > 0)) return;
  collectedIds = { Saludo: [], Like: [], Follow: [], Cartas: [] };
  renderStarIds();
  saveAllStates();
  console.log('[STAR-TOOLS] 🧹 IDs limpiados');
}

function exportIDs() {
  let ids = [];
  if (currentStarFilter === 'all') {
    ['Like', 'Follow', 'Saludo', 'Cartas'].forEach(t => (collectedIds[t] || []).forEach(id => ids.push({ id, type: t })));
  } else {
    (collectedIds[currentStarFilter] || []).forEach(id => ids.push({ id, type: currentStarFilter }));
  }
  if (!ids.length) { alert('⭐ No hay IDs para exportar.'); return; }

  const now = new Date();
  const ts = now.toISOString().slice(0,19).replace('T','_').replace(/:/g,'-');
  const fecha = now.toLocaleDateString('es-CO');
  const hora = now.toLocaleTimeString('es-CO');

  // BOM UTF-8 para compatibilidad con Excel y Google Sheets
  const BOM = '\uFEFF';
  const header = 'N°,ID_CLIENTE,TIPO,FECHA,HORA\r\n';
  const rows = ids.map((item, i) =>
    `${i+1},${item.id},${item.type},${fecha},${hora}`
  ).join('\r\n');

  const csv = BOM + header + rows;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tesseract_star_ids_${ts}.csv`;
  a.click();
  console.log('[STAR-TOOLS] 📊 Exportados', ids.length, 'IDs');
}

function copyIDs() {
  let ids = [];
  if (currentStarFilter === 'all') {
    ['Like', 'Follow', 'Saludo', 'Cartas'].forEach(t => ids.push(...(collectedIds[t] || [])));
  } else {
    ids = collectedIds[currentStarFilter] || [];
  }
  if (!ids.length) return;
  navigator.clipboard.writeText(ids.join('\n'));
}

// ============ SINCRONIZACIÓN PERIÓDICA CON SERVIDOR ============
let periodicSyncInterval = null;

function startPeriodicSync() {
  if (periodicSyncInterval) clearInterval(periodicSyncInterval);
  periodicSyncInterval = setInterval(async () => {
    if (!isAuthenticated || !currentUser) return;
    const totalSweeps = (collectedIds.Like?.length || 0) +
                        (collectedIds.Follow?.length || 0) +
                        (collectedIds.Saludo?.length || 0) +
                        (collectedIds.Cartas?.length || 0);

    try {
      const token = await new Promise(r => chrome.storage.local.get('tess_jwt', d => r(d.tess_jwt)));
      if (token) {
        const res = await fetch(`${TESSERACT_API}/api/tess/metrics/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            stats: botStats,
            collectedIds: collectedIds,
            action: 'PERIODIC_SYNC',
            count: totalSweeps
          })
        });
        if (res.status === 401) {
          console.warn('[TESS] Token expirado en periodic sync');
          chrome.storage.local.remove('tess_jwt');
        } else if (!res.ok) {
          console.warn('[TESS] Periodic sync error:', res.status);
        }
      }
    } catch (e) {
      console.warn('[TESS] Periodic sync error (offline?):', e.message);
    }

    // También guardar local como respaldo
    chrome.storage.local.set({
      tess_heartbeat: Date.now(),
      bot_connected_user: currentUser,
      tess_stats: botStats,
      tess_ids: collectedIds,
      bot_likesGiven: botStats.likesGiven,
      bot_followsGiven: botStats.followsGiven,
      bot_cartasSent: botStats.cartasSent,
      bot_messagesSent: botStats.messagesSent,
      bot_sweepCount: totalSweeps,
      bot_repliesReceived: botStats.repliesReceived,
      bot_repliesResponded: botStats.repliesResponded,
      bot_idsLikes: collectedIds.Like?.length || 0,
      bot_idsFollows: collectedIds.Follow?.length || 0,
      bot_idsSaludos: collectedIds.Saludo?.length || 0,
      bot_idsCartas: collectedIds.Cartas?.length || 0,
      user_email: currentUser
    });
    updateStats();
  }, 10000);
}

// ============ AUTO-ANSWER TAB UI ============
function updateAATabUI() {
  const cfg = typeof getAAConfig === 'function' ? getAAConfig() : null;
  if (!cfg) return;

  document.getElementById('aaStatusInline').textContent = cfg.enabled ? 'ACTIVO' : 'INACTIVO';
  document.getElementById('aaStatusInline').style.color = cfg.enabled ? '#4CAF50' : '#666';

  const evts = ['like', 'wink', 'comment', 'gift'];
  evts.forEach(ev => {
    const el = document.getElementById('aa' + ev.charAt(0).toUpperCase() + ev.slice(1) + 'Status');
    if (el) {
      const enabled = cfg.events?.[ev]?.enabled;
      el.textContent = enabled ? 'ACTIVO' : 'DESACTIVADO';
      el.style.color = enabled ? '#4CAF50' : '#666';
    }
  });

  document.getElementById('aaTodayResp').textContent = cfg.respondedToday || 0;
  document.getElementById('aaDailyLimit').textContent = cfg.maxDaily || 50;
}

// ============ SMART MAILING TAB UI ============
function updateMLTabUI() {
  const cfg = typeof getMailingConfig === 'function' ? getMailingConfig() : null;
  if (!cfg) return;

  document.getElementById('mlStatusInline').textContent = cfg.enabled ? 'ACTIVO' : 'INACTIVO';
  document.getElementById('mlStatusInline').style.color = cfg.enabled ? '#4CAF50' : '#666';

  document.getElementById('mlSentTodayInline').textContent = cfg.sentToday || 0;
  document.getElementById('mlDailyLimitInline').textContent = cfg.maxDaily || 30;
  document.getElementById('mlIntervalDisplay').textContent = (cfg.intervalMinutes || 60) + ' min';

  const preview = (cfg.messageTemplate || '').slice(0, 40);
  document.getElementById('mlMsgPreview').textContent = preview + (preview.length >= 40 ? '...' : '');

  // Queue count
  if (typeof loadMailingConfig === 'function') {
    chrome.storage.local.get(['tess_ids'], (data) => {
      const ids = data.tess_ids || {};
      let total = 0;
      (cfg.sources?.targetCategories || []).forEach(cat => {
        total += (ids[cat] || []).length;
      });
      if (cfg.sources?.useManualList && cfg.sources?.manualIds) {
        total += cfg.sources.manualIds.length;
      }
      document.getElementById('mlQueueCountInline').textContent = total;
    });
  }
}

// ============ STORAGE ============
async function saveAllStates() {
  await chrome.storage.local.set({
    tess_auth: isAuthenticated, tess_user: currentUser,
    tess_eater: eaterActive, tess_likes: likesActive, tess_follows: followsActive,
    tess_saludos: saludosActive, tess_cartas: cartasActive,
    tess_stats: botStats, tess_ids: collectedIds,
    bot_likesGiven: botStats.likesGiven,
    bot_followsGiven: botStats.followsGiven,
    bot_messagesSent: botStats.messagesSent,
    bot_sweepCount: (collectedIds.Like?.length || 0) + (collectedIds.Follow?.length || 0),
    bot_idsLikes: collectedIds.Like?.length || 0,
    bot_idsFollows: collectedIds.Follow?.length || 0
  });
}

async function loadAllStates() {
  try {
const r = await chrome.storage.local.get([
      'tess_auth', 'tess_user', 'tess_eater', 'tess_likes', 'tess_follows',
      'tess_saludos', 'tess_cartas', 'tess_stats', 'tess_ids'
    ]);
    if (r.tess_auth && r.tess_user) {
      isAuthenticated = true; currentUser = r.tess_user;
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('mainScreen').style.display = 'block';
      document.getElementById('currentUserDisplay').textContent = currentUser;
    }
    if (r.tess_eater) {
      eaterActive = true;
      const btn = document.getElementById('btnEaterToggle');
      if (btn) { btn.textContent = '🧠 EATER: ON'; btn.className = 'eater-btn on'; }
      document.getElementById('eaterFloatBar').style.display = 'block';
      document.getElementById('eaterSuggestions').style.display = 'block';
    }
    if (r.tess_ids) collectedIds = r.tess_ids;
    if (r.tess_stats) botStats = r.tess_stats;
    if (r.tess_saludo_msgs) saludoMessages = r.tess_saludo_msgs;
    if (r.tess_carta_msg) {
      if (typeof r.tess_carta_msg === 'string') {
        cartaMessages = [r.tess_carta_msg];
      } else if (Array.isArray(r.tess_carta_msg)) {
        cartaMessages = r.tess_carta_msg;
      }
    }
    updateStats();
    renderStarIds();
  } catch (e) { console.error('[TESSERACT] Error cargando:', e); }
}

// ============ SINC MÉTRICAS CON SERVIDOR ============
async function syncMetricsToStorage(action, count) {
  try {
    console.log('[TESSERACT] syncMetricsToStorage:', action, count);

    // Obtener la oficina del usuario
    const userData = await new Promise(r => chrome.storage.local.get(['user_office', 'tess_user'], d => r(d)));
    const userOffice = userData.user_office || null;

    // Enviar al servidor
    try {
      const token = await new Promise(r => chrome.storage.local.get('tess_jwt', d => r(d.tess_jwt)));
      if (token) {
        const res = await fetch(`${TESSERACT_API}/api/tess/metrics/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            stats: botStats,
            collectedIds: collectedIds,
            action: action,
            count: count || 1,
            office: userOffice
          })
        });
        if (res.status === 401) {
          console.warn('[TESS] Token expirado en syncMetricsToStorage');
          chrome.storage.local.remove('tess_jwt');
        } else if (!res.ok) {
          console.warn('[TESS] syncMetricsToStorage server error:', res.status);
        }
      } else {
        console.warn('[TESS] No hay token para sync');
      }
    } catch (e) {
      console.warn('[TESSERACT] Server sync failed (offline?):', e.message);
    }

    // También guardar local como respaldo
    const totalSweeps = (collectedIds.Like?.length || 0) +
                        (collectedIds.Follow?.length || 0) +
                        (collectedIds.Saludo?.length || 0) +
                        (collectedIds.Cartas?.length || 0);

    const botLog = {
      action: action + (count ? ': ' + count + ' procesados' : ' completado'),
      timestamp: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      email: currentUser || 'unknown'
    };

    const botData = await chrome.storage.local.get(['bot_activity_log']);
    const botLogArr = botData.bot_activity_log || [];
    botLogArr.push(botLog);
    if (botLogArr.length > 5000) botLogArr.splice(0, botLogArr.length - 5000);

    await chrome.storage.local.set({
      bot_activity_log: botLogArr,
      tess_stats: botStats,
      tess_ids: collectedIds,
      bot_likesGiven: botStats.likesGiven,
      bot_followsGiven: botStats.followsGiven,
      bot_cartasSent: botStats.cartasSent,
      bot_messagesSent: botStats.messagesSent,
      bot_sweepCount: totalSweeps,
      tess_last_action: { action, count, timestamp: Date.now(), email: currentUser }
    });

    console.log('[TESSERACT] sync OK:', action, count);
  } catch (e) {
    console.error('[TESSERACT] sync error:', e);
  }
}

// ============ INICIAR ============
console.log('[TESSERACT] 🚀 Script cargado, iniciando en 1s...');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[TESSERACT] 📄 DOM Loaded, ejecutando...');
    setTimeout(initTesseract, 1000);
  });
} else {
  setTimeout(() => {
    console.log('[TESSERACT] 📄 Ya cargado, ejecutando...');
    initTesseract();
  }, 1000);
}

chrome.runtime.onMessage.addListener((req, sender, res) => {
  if (req.action === 'toggle_eater') { toggleEater(); res({ success: true }); }
  // ── NUEVA: recibir IDs rastreados desde el bot real (nox bot) ──
  if (req.action === 'TESSERACT_TRACK_ACTION') {
    const typeMap = { likes: 'Like', follows: 'Follow', saludos: 'Saludo', cartas: 'Cartas' };
    const cat = typeMap[req.type];
    if (cat && req.clientId) {
      const registered = registerIdInStarTools(String(req.clientId), cat);
      if (registered) {
        console.log('[STAR-TOOLS] 🔗 ID del bot real registrado:', req.clientId, '→', cat);
      }
    }
    res && res({ success: true });
  }
  // ── SMART MAILING: ejecutar ronda ──
  if (req.action === 'MAILING_EXECUTE_ROUND') {
    if (typeof executeMailingRound === 'function') {
      executeMailingRound();
    }
    res && res({ success: true });
  }
  return true;
});

// ── NUEVA: escuchar eventos del bot nox directamente en la misma página ──
(function setupBotEventListeners() {
  const typeMap = { 'nox:likeSent': 'Like', 'nox:followSent': 'Follow', 'nox:saludoSent': 'Saludo', 'nox:cartaSent': 'Cartas' };
  Object.entries(typeMap).forEach(([eventName, category]) => {
    window.addEventListener(eventName, (e) => {
      const clientId = (e.detail && (e.detail.clientId || e.detail.id)) || '';
      if (clientId) {
        const registered = registerIdInStarTools(String(clientId), category);
        if (registered) {
          console.log('[STAR-TOOLS] ⚡ Evento real capturado:', eventName, '→ ID:', clientId);
          // Si estamos en Star Tools, actualizar en tiempo real
          if (currentTab === 'star') renderStarIds();
        }
      }
    });
  });
  console.log('[STAR-TOOLS] ✅ Listeners de eventos del bot conectados');
})();