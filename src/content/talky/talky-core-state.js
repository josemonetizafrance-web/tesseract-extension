// TESSERACT v24.0 - Estado global + Blacklist + Icebreakers (extraído de talky-bot-panel.js)
var TESSERACT_API = 'https://tesseract-jblo.onrender.com';
const ALLOWED_DOMAIN = 'talkytimes.com';

let isAuthenticated = true;
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

const ICEBREAKER_SYSTEM_PROMPT = 'Eres un experto en crear mensajes rompehielos originales, impredecibles y con personalidad para una plataforma de citas. Cada mensaje debe sonar como una persona real, auténtica y con chispa.\n\nCRÍTICO: Cada generación debe ser COMPLETAMENTE DIFERENTE a cualquier cosa generada antes. NO repitas temas, estructuras, ni formatos. Sé impredecible.\n\nCUATRO CATEGORÍAS\nRH Amistad: Rompehielos relajados, originales, con un toque de humor o curiosidad. Nada genérico. Deben invitar a responder con interés genuino.\nRH Amor Real: Rompehielos con profundidad emocional, que muestren inteligencia emocional y madurez. Evita lo cursi o predecible. Deben hacer pensar.\nRH Charla Caliente: Rompehielos con actitud, carisma y un toque pícaro sutil. Nada sexual, pero con esa chispa de confianza atractiva. Originales, no los típicos.\nRH Mail: Mensajes de 4-8 líneas que parezcan escritos por una persona real contando una anécdota o reflexión auténtica. Con gancho, que den ganas de responder largo.\n\nREGLAS ESTRICTAS\n- 100 % español maduro y natural.\n- NADA de frases cliché como "qué te gusta hacer", "cuéntame de ti", "cómo fue tu día".\n- Evita preguntas predecibles. Usa observaciones, comentarios ingeniosos, supuestos divertidos o reflexiones auténticas.\n- Cada mensaje debe ser ÚNICO. Si ya usaste la idea de cocina, la próxima usa algo completamente distinto (música, filosofía callejera, esa aplicación rara, etc.).\n- Prohibido: contenido sexual, lenguaje abusivo, datos de contacto.\n- Emojis solo si suman. Nada de texto plano aburrido.\n- Temas variados: teorías conspirativas ligeras, apps que nadie conoce, esa habilidad inútil pero cool, dilemas modernos, cosas que aprendiste a los 30+.';

async function generateIcebreakers(inputText) {
  var token = await new Promise(function (r) { chrome.storage.local.get('tess_jwt', function (d) { r(d.tess_jwt); }); });
  if (!token) { if (typeof showTessToast === 'function') showTessToast('⚠ No hay sesión activa', 'warning'); return null; }

  var isSpecific = inputText.trim().toLowerCase().startsWith('rh ') && inputText.trim().length > 3;
  var seed = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  var userContent = isSpecific
    ? 'Genera SOLO 1 mensaje de "' + inputText.trim() + '". Que sea completamente original, nada predecible. Seed: ' + seed
    : 'Genera EXACTAMENTE 5 mensajes en este orden: 1 Amistad → 1 Amor Real → 1 Charla Caliente → 2 Mail. Sepáralos con "---". NO incluyas el nombre de la categoría, solo el texto. Cada uno debe ser único y de un tema diferente. Seed: ' + seed;

  try {
    var res = await fetch(TESSERACT_API + '/api/chatgpt/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: ICEBREAKER_SYSTEM_PROMPT },
          { role: 'user', content: userContent }
        ],
        max_tokens: isSpecific ? 300 : 1000,
        temperature: 0.8
      })
    });
    if (!res.ok) return null;
    var data = await res.json();
    return data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;
  } catch (e) { console.log('[ICEBREAKER] Error:', e.message); return null; }
}

function cleanIBText(text) {
  // Strip "RH Categoría:" or "RH Categoría" headers from the start
  return text.replace(/^(RH\s+(Amistad|Amor\s+Real|Charla\s+Caliente|Mail)\s*[:\-–—]?\s*)/i, '').trim();
}

function renderIcebreakerItems(parts, labels) {
  var html = '';
  for (var i = 0; i < 5; i++) {
    var label = labels[i] || 'RH ' + (i + 1);
    var text = parts[i] || '—';
    if (text !== '—') text = cleanIBText(text);
    html += '<div class="ib-item" data-idx="' + i + '">' +
      '<div class="ib-label">' + label + '</div>' +
      '<div class="ib-text">' + escapeHtml(text) + '</div>' +
      '</div>';
  }
  return html;
}

function sleepIB(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function ibCategoryToMood(label) {
  var l = label.toLowerCase();
  if (l.indexOf('amistad') !== -1) return 'friendship';
  if (l.indexOf('amor real') !== -1) return 'real_love';
  if (l.indexOf('charla caliente') !== -1) return 'hot_talks';
  return null; // null = Mail
}

async function enviarIcebreaker(text, label) {
  var mood = ibCategoryToMood(label);
  var isMail = mood === null;

  try {
    // 1. Click Icebreakers nav
    var ibNav = document.querySelector('a[data-test-id*="Icebreakers"], a[data-test-id*="icebreaker"], [data-test-id*="Icebreakers"]');
    if (!ibNav) { showTessToast('⚠ No se encontró navegación a Icebreakers', 'warning'); return false; }
    ibNav.click();
    console.log('[IB] Click Icebreakers nav');
    await sleepIB(1200);

    // 2. Click "create new"
    var createChip = document.querySelector('[data-test-id*="tab-mode-create-icebreaker"], [data-test-id*="create-icebreaker"]');
    if (!createChip) {
      // Fallback: buscar label con texto "create new"
      var allLabels = document.querySelectorAll('label');
      for (var ci = 0; ci < allLabels.length; ci++) {
        if ((allLabels[ci].textContent || '').trim().toLowerCase().indexOf('create new') !== -1) {
          createChip = allLabels[ci];
          break;
        }
      }
    }
    if (!createChip) {
      // Fallback: buscar cualquier chip/button con texto "create new"
      var allEls = document.querySelectorAll('[class*="chip"], [class*="tab"], .label');
      for (var ei = 0; ei < allEls.length; ei++) {
        if ((allEls[ei].textContent || '').trim().toLowerCase().indexOf('create new') !== -1) {
          createChip = allEls[ei];
          break;
        }
      }
    }
    if (createChip) {
      createChip.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      console.log('[IB] Click create new');
      await sleepIB(1200);
      // Check for daily limit warning
      var limitWarn = document.querySelector('.warning-text, [class*="warning"]');
      if (limitWarn && (limitWarn.textContent || '').toLowerCase().indexOf('daily limit') !== -1) {
        console.log('[IB] Daily limit reached, stopping');
        showTessToast('⚠ Límite diario de icebreakers alcanzado', 'warning');
        return 'LIMIT_REACHED';
      }
    } else { console.log('[IB] create new no encontrado, continuando...'); }

    if (isMail) {
      // 3a. Mail: click radio mail
      var mailRadio = document.querySelector('input[data-test-id*="mail"][type="radio"], input[name="mail"]');
      if (!mailRadio) {
        // Buscar label que contenga "Mail" y tenga un input radio dentro
        var allRadios = document.querySelectorAll('input[type="radio"]');
        for (var ri = 0; ri < allRadios.length; ri++) {
          var parentText = (allRadios[ri].parentElement ? allRadios[ri].parentElement.textContent : '').toLowerCase();
          if (parentText.indexOf('mail') !== -1) { mailRadio = allRadios[ri]; break; }
        }
        if (!mailRadio) {
          // Fallback: buscar cualquier elemento con texto "Mail" cerca de un radio
          var mailLabels = document.querySelectorAll('.ui-radio_text, [class*="radio"]');
          for (var rli = 0; rli < mailLabels.length; rli++) {
            if ((mailLabels[rli].textContent || '').trim().toLowerCase() === 'mail') {
              var parentLabel = mailLabels[rli].closest('label');
              if (parentLabel) { mailRadio = parentLabel.querySelector('input[type="radio"]') || parentLabel; break; }
            }
          }
        }
        if (mailRadio) { mailRadio.click(); console.log('[IB] Click Mail radio'); await sleepIB(400); }
      } else {
        mailRadio.click();
        console.log('[IB] Click Mail radio');
        await sleepIB(400);
      }
    } else {
      // 3b. Mood: click mood chip con evento Vue
      await sleepIB(300);
      var moodEl = document.querySelector('[data-test-id*="emit-select-mood"][data-mood="' + mood + '"], .mood-chip[data-mood="' + mood + '"]');
      if (!moodEl) {
        var allMoods = document.querySelectorAll('[data-test-id*="mood-chip"]');
        for (var mi = 0; mi < allMoods.length; mi++) {
          var moodText = (allMoods[mi].textContent || '').toLowerCase().trim();
          var moodMap = { friendship: 'friendship', real_love: 'real love', hot_talks: 'hot talks' };
          if (moodText.indexOf(moodMap[mood]) !== -1) { moodEl = allMoods[mi]; break; }
        }
      }
      if (moodEl) {
        moodEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        console.log('[IB] Click mood:', mood);
        await sleepIB(600);
      } else {
        console.log('[IB] Mood not found:', mood);
      }
    }

    // 4. Type message in textarea
    var textarea = document.querySelector('textarea[placeholder="Type your message here"], textarea.textarea');
    if (!textarea) {
      // Buscar cualquier textarea visible
      var allTextareas = document.querySelectorAll('textarea');
      for (var ti = 0; ti < allTextareas.length; ti++) {
        if (allTextareas[ti].offsetParent !== null) { textarea = allTextareas[ti]; break; }
      }
    }
    if (!textarea) { showTessToast('⚠ No se encontró textarea', 'warning'); return false; }
    textarea.value = text.substring(0, 300);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ', keyCode: 32 }));
    console.log('[IB] Texto insertado en textarea');
    await sleepIB(300);

    // 5. Click "Send for Moderation"
    var sendBtn = document.querySelector('button[data-test-id*="send-to-moderation"], [data-test-id*="send-to-moderation"]');
    if (!sendBtn) {
      var allBtns = document.querySelectorAll('button');
      for (var bi = 0; bi < allBtns.length; bi++) {
        var bt = (allBtns[bi].textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (bt.indexOf('send for moderation') !== -1 || bt.indexOf('enviar') !== -1) { sendBtn = allBtns[bi]; break; }
      }
    }
    if (sendBtn && !sendBtn.disabled) { sendBtn.click(); console.log('[IB] Click Send for Moderation'); await sleepIB(1000); }
    else if (sendBtn && sendBtn.disabled) { showTessToast('⚠ Send está deshabilitado', 'warning'); return false; }
    else { showTessToast('⚠ No se encontró botón Send', 'warning'); return false; }

    // Check for daily limit warning after sending
    var limitWarn2 = document.querySelector('.warning-text, [class*="warning"]');
    if (limitWarn2 && (limitWarn2.textContent || '').toLowerCase().indexOf('daily limit') !== -1) {
      console.log('[IB] Daily limit reached after send');
      showTessToast('⚠ Límite diario de icebreakers alcanzado', 'warning');
      return 'LIMIT_REACHED';
    }

    console.log('[IB] Icebreaker enviado:', label, text.substring(0, 40));
    return true;
  } catch (e) { console.log('[IB] Error:', e.message); showTessToast('⚠ Error al enviar IB: ' + e.message, 'error'); return false; }
}

async function translateToEnglish(text) {
  var token = await new Promise(function (r) { chrome.storage.local.get('tess_jwt', function (d) { r(d.tess_jwt); }); });
  if (!token) return null;
  try {
    var res = await fetch(TESSERACT_API + '/api/chatgpt/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Translate the following Spanish text to natural, fluent English. Keep the same tone, mood and style. Reply ONLY with the translated text, no explanations.' },
          { role: 'user', content: text }
        ],
        max_tokens: 400,
        temperature: 0.3
      })
    });
    if (!res.ok) return null;
    var data = await res.json();
    var translated = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content.trim() : null;
    return translated || null;
  } catch (e) { console.log('[IB-TRANSLATE] Error:', e.message); return null; }
}

async function enviarTodosIcebreakers() {
  var container = document.getElementById('icebreakersList');
  if (!container) return;
  var items = container.querySelectorAll('.ib-item');
  if (items.length === 0) { showTessToast('⚠ No hay icebreakers para enviar', 'warning'); return; }

  var batch = [];
  for (var ii = 0; ii < items.length; ii++) {
    var labelEl = items[ii].querySelector('.ib-label');
    var textEl = items[ii].querySelector('.ib-text');
    if (!textEl || textEl.textContent === '—') continue;
    batch.push({ label: labelEl ? labelEl.textContent : '', text: textEl.textContent });
  }
  if (batch.length === 0) { showTessToast('⚠ No hay icebreakers generados', 'warning'); return; }

  showTessToast('🌐 Traduciendo ' + batch.length + ' icebreakers al inglés...', 'info');
  var translated = [];
  for (var bi = 0; bi < batch.length; bi++) {
    var enText = await translateToEnglish(batch[bi].text);
    if (!enText) { showTessToast('⚠ Error al traducir: ' + batch[bi].label, 'error'); return; }
    translated.push({ label: batch[bi].label, text: enText });
    console.log('[IB] Traducido', batch[bi].label, '→', enText.substring(0, 40));
  }

  for (var si = 0; si < translated.length; si++) {
    var entry = translated[si];
    showTessToast('🚀 Enviando ' + entry.label + ' (' + (si + 1) + '/' + translated.length + ')...', 'info');
    var success = await enviarIcebreaker(entry.text, entry.label);
    if (success === 'LIMIT_REACHED') {
      console.log('[IB] Batch stopped due to daily limit');
      break;
    } else if (success) {
      botStats.icebreakersSent = (botStats.icebreakersSent || 0) + 1;
      console.log('[IB] ✅ Enviado:', entry.label);
      if (si < translated.length - 1) await sleepIB(1500);
    } else {
      showTessToast('⚠ Falló ' + entry.label + ', continuando con siguiente...', 'warning');
      await sleepIB(1000);
    }
  }
  showTessToast('✅ Proceso completado (' + botStats.icebreakersSent + ' icebreakers enviados)', 'success');
}

function initIcebreakers() {
  var container = document.getElementById('icebreakersList');
  var input = document.getElementById('ibInput');
  var btn = document.getElementById('ibGenerateBtn');
  var sendAllBtn = document.getElementById('ibSendAllBtn');
  if (!container || !input || !btn) return;

  var labels = ['RH Amistad', 'RH Amor Real', 'RH Charla Caliente', 'RH Mail 1', 'RH Mail 2'];

  // Click en item → enviar icebreaker por el flujo completo
  container.addEventListener('click', async function (e) {
    var item = e.target.closest('.ib-item');
    if (!item) return;
    var labelEl = item.querySelector('.ib-label');
    var textEl = item.querySelector('.ib-text');
    if (!textEl || textEl.textContent === '—') return;
    var label = labelEl ? labelEl.textContent : '';
    var text = textEl.textContent;

    if (typeof showTessToast === 'function') showTessToast('🚀 Enviando ' + label + '...', 'info');
    var success = await enviarIcebreaker(text, label);
    if (success === true) {
      if (typeof showTessToast === 'function') showTessToast('✅ ' + label + ' enviado a moderación', 'success');
      botStats.icebreakersSent = (botStats.icebreakersSent || 0) + 1;
    } else if (success === 'LIMIT_REACHED') {
      if (typeof showTessToast === 'function') showTessToast('⚠ Límite diario alcanzado', 'warning');
    }
  });

  // Botón generar
  btn.addEventListener('click', async function () {
    var val = input.value.trim() || 'RH';
    btn.textContent = '⏳...';
    btn.disabled = true;
    var result = await generateIcebreakers(val);
    btn.textContent = '🔄 GENERAR';
    btn.disabled = false;
    if (!result) { if (typeof showTessToast === 'function') showTessToast('⚠ Error al generar', 'error'); return; }

    var parts = result.split('---').map(function (p) { return cleanIBText(p.trim()); }).filter(Boolean);
    if (parts.length === 0) parts = [cleanIBText(result)];

    var isSpecific = val.toLowerCase().startsWith('rh ') && val.trim().length > 3;
    if (isSpecific) {
      container.innerHTML = renderIcebreakerItems([cleanIBText(result)], [val.trim()]);
    } else {
      container.innerHTML = renderIcebreakerItems(parts, labels);
    }
    if (typeof showTessToast === 'function') showTessToast('🎯 ' + parts.length + ' icebreakers generados', 'success');
  });

  // Botón enviar todos (traducir + navegar + enviar a moderación)
  if (sendAllBtn) {
    sendAllBtn.addEventListener('click', async function () {
      sendAllBtn.textContent = '⏳...';
      sendAllBtn.disabled = true;
      await enviarTodosIcebreakers();
      sendAllBtn.textContent = '🌐 ENVIAR IB';
      sendAllBtn.disabled = false;
    });
  }
}

// Variables de estado global
let collectedIds = { Saludo: [], Like: [], Follow: [], LFP: [], Cartas: [] };
let botStats = { likesGiven: 0, followsGiven: 0, cartasSent: 0, contactsProcessed: 0, repliesReceived: 0, repliesResponded: 0, icebreakersSent: 0 };
let currentTab = 'main';
let currentStarFilter = 'all';
let currentUser = 'agente@tesseract.com';
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
