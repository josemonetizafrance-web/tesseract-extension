// TESSERACT - Módulo EATER (IA + Chat Watcher + Timer + Perfil Activo)

// ============ TOGGLE EATER ============
function toggleEater() {
  eaterActive = !eaterActive;
  var btn = document.getElementById('btnEaterToggle');
  if (!btn) return;
  btn.textContent = '🧠 EATER: ' + (eaterActive ? 'ON' : 'OFF');
  btn.className = 'eater-btn' + (eaterActive ? ' on' : '');
  document.getElementById('eaterSuggestions').style.display = eaterActive ? 'block' : 'none';
  if (eaterActive) { _processedTexts.clear(); setTimeout(scanAllIncomingMessages, 500); }
}

function toggleClonacion() {
  clonacionActiva = !clonacionActiva;
  var btn = document.getElementById('btnStopClone');
  if (!btn) return;
  if (clonacionActiva) {
    btn.innerHTML = '⏹ CLONACIÓN: ACTIVA';
    btn.style.borderColor = '#ef4444';
    btn.style.background = 'rgba(239,68,68,0.15)';
    btn.style.color = '#ef4444';
    showTessToast('🎭 Captura de estilo ACTIVADA', 'success');
  } else {
    btn.innerHTML = '▶ CLONACIÓN: DETENIDA';
    btn.style.borderColor = '#22c55e';
    btn.style.background = 'rgba(34,197,94,0.15)';
    btn.style.color = '#22c55e';
    showTessToast('⏸ Captura de estilo DETENIDA', 'warning');
  }
}

function copyEaterResponseToChat() {
  const area = document.getElementById('eaterResponseArea');
  if (!area || !area.value || area.value === 'Esperando mensaje...') return;
  copyToChatInput(area.value);
  area.style.borderColor = '#4CAF50';
  setTimeout(() => area.style.borderColor = '#8b5cf6', 600);
}

// ============ RESPONSE TIMER (alerta tasa de respuesta) ============
function createTimerElement() {
  const el = document.createElement('span');
  el.className = 'tess-resp-timer';
  Object.assign(el.style, {
    fontSize: '10px',
    color: '#f59e0b',
    fontFamily: "'Orbitron',sans-serif",
    letterSpacing: '1px',
    marginLeft: '6px',
    display: 'inline-block'
  });
  return el;
}

function insertTimerInItem(convEl, timerDisplay) {
  const nameArea = convEl.querySelector(TALK_Y.DIALOG_NAME_WRAPPER);
  if (nameArea) {
    nameArea.appendChild(timerDisplay);
  } else {
    convEl.appendChild(timerDisplay);
  }
}

function startResponseTimer(convEl, clientName, afterEl) {
  if (!convEl || !clientName) return;

  stopResponseTimer(clientName);

  const startTime = Date.now();
  let _alertTriggered = false;

  const tick = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const remaining = Math.max(0, TIMER_DISPLAY_SECONDS - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    const text = '⏱ ' + mins + ':' + (secs < 10 ? '0' : '') + secs;
    const color = remaining < 30 ? '#ef4444' : '#f59e0b';

    const item = findConversationItem(clientName);
    if (item) {
      let td = item.querySelector(TALK_Y.TIMER_ELEMENT);
      if (!td) {
        td = createTimerElement();
        insertTimerInItem(item, td);
      }
      td.textContent = text;
      td.style.color = color;
    }

    if (elapsed >= RESPONSE_ALERT_SECONDS && !_alertTriggered) {
      _alertTriggered = true;
      showResponseAlert(clientName);
    }

    if (remaining <= 0) {
      clearInterval(timerId);
    }
  };

  const timerId = setInterval(tick, 1000);
  tick();

  _responseTimers.set(clientName, { timerId, startTime });
}

function stopResponseTimer(clientName) {
  if (clientName) {
    const entry = _responseTimers.get(clientName);
    if (entry) {
      clearInterval(entry.timerId);
      const items = document.querySelectorAll(TALK_Y.DIALOG_ITEMS);
      for (const item of items) {
        const td = item.querySelector(TALK_Y.TIMER_ELEMENT);
        if (td) td.remove();
      }
      _responseTimers.delete(clientName);
    }
    return;
  }
  for (const [name, entry] of _responseTimers) {
    clearInterval(entry.timerId);
  }
  document.querySelectorAll(TALK_Y.TIMER_ELEMENT).forEach(el => el.remove());
  _responseTimers.clear();
}

function showResponseAlert(clientName) {
  const oldAlert = document.getElementById('tessRespAlert');
  if (oldAlert) oldAlert.remove();
  
  const alert = document.createElement('div');
  alert.id = 'tessRespAlert';
  alert.style.cursor = 'pointer';
  alert.addEventListener('click', () => {
    const items = document.querySelectorAll(TALK_Y.DIALOG_ITEM_CONTENT);
    for (const item of items) {
      const nameEl = item.querySelector(TALK_Y.DIALOG_ITEM_NAME);
      if (nameEl && nameEl.textContent.trim() === clientName) {
        item.click();
        break;
      }
    }
    alert.remove();
  });
  alert.innerHTML = `
<style>
#tessRespAlert{position:fixed;top:80px;right:20px;z-index:999999;}
.tess-alert-box{background:#0a0a0a;border:2px solid #ef4444;border-radius:12px;padding:16px 20px;box-shadow:0 0 30px rgba(239,68,68,0.5);min-width:260px;animation:tessAlertIn 0.3s ease-out;}
@keyframes tessAlertIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
.tess-alert-hdr{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.tess-alert-hdr span{font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:2px;color:#ef4444;}
.tess-alert-body{font-size:12px;color:#e0e0e0;font-family:'Segoe UI',sans-serif;line-height:1.4;}
.tess-alert-close{position:absolute;top:6px;right:10px;cursor:pointer;color:#666;font-size:16px;font-family:sans-serif;background:none;border:none;z-index:2;}
.tess-alert-close:hover{color:#ef4444;}
</style>
<div class="tess-alert-box">
<button class="tess-alert-close" onclick="event.stopPropagation();this.closest('#tessRespAlert').remove()">×</button>
<div class="tess-alert-hdr">
<span>⚠ RESPUESTA PENDIENTE</span>
</div>
<div class="tess-alert-body">
<b style="color:#f59e0b;">${clientName}</b> te escribió hace más de ${RESPONSE_ALERT_SECONDS / 60} min y aún no respondes.<br>
<small style="color:#666;">Click para ir a la conversación</small>
</div>
</div>`;
  document.body.appendChild(alert);
  
  setTimeout(() => {
    const a = document.getElementById('tessRespAlert');
    if (a) a.remove();
  }, 8000);
}

function checkForSentMessages() {
  const sentSelectors = [
    '[class*="message-sent"]', '[class*="my-message"]', '[class*="own"]',
    '[class*="bubble-right"]', '[class*="msg--sent"]', '[class*="message--own"]',
    '[class*="right-bubble"]', '.text-message.own', '[class*="msg my"]',
    '[data-test-id*="msg--sent"]'
  ];
  for (const sel of sentSelectors) {
    const sent = document.querySelectorAll(sel + ':not(.tess-checked-sent)');
    if (sent.length > 0) {
      for (const el of sent) {
        el.classList.add('tess-checked-sent');
      }
      stopResponseTimer();
      return;
    }
  }
}

// ============ CHAT WATCHER ============
let chatWatcherObserver = null;
let msgPollInterval = null;
let titleObserver = null;
let loginObserver = null;
let urlPollInterval = null;

function startChatWatcher() {
  if (chatWatcherObserver) chatWatcherObserver.disconnect();
  if (msgPollInterval) clearInterval(msgPollInterval);
  
  chatWatcherObserver = new MutationObserver((mutations) => {
    if (!eaterActive || !isAuthenticated) return;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) checkForIncomingMessages(node);
        }
      }
    }
  });
  
  const chatContainer = document.querySelector(TALK_Y.PAGE_MESSAGES) || document.body;
  chatWatcherObserver.observe(chatContainer, { childList: true, subtree: true, characterData: true });
  
  msgPollInterval = setInterval(() => {
    if (!eaterActive || !isAuthenticated) return;
    scanAllIncomingMessages();
    scanAllOutgoingMessages();
  }, 2000);
  
  setInterval(() => {
    if (_responseTimers.size === 0) return;
    checkForSentMessages();
  }, 2000);
  
  document.addEventListener('click', (e) => {
    if (!eaterActive || !isAuthenticated) return;
    const convItem = e.target.closest('[class*="conversation"], [class*="contact-item"], [class*="user-item"], [class*="dialog-item"], [class*="chat-item"], [class*="thread"]');
    if (convItem) {
      _processedTexts.clear();
      setTimeout(scanAllIncomingMessages, 800);
    }
  }, true);
}

// ============ SCANNERS ============
function scanAllIncomingMessages() {
  const selectors = [
    '.text-message',
    '[data-test-id*="text-msg"]',
    '[data-test-id*="message"]:not([class*="my"])',
    '[class*="message-in"]', '[class*="message-received"]', '[class*="incoming"]',
    '[class*="other-message"]', '[class*="contact-message"]', '[class*="msg-other"]',
    '[class*="bubble-other"]', '[class*="dialog-item"]:not([class*="own"])',
    '[class*="chat-message"]:not([class*="sent"])', 'div[class*="message"]:not([class*="my"])',
    '[class*="msg"]:not([class*="my"])', '[class*="message"]:not([class*="self"])',
    '[class*="conv-msg"]:not([class*="own"])', '[class*="bubble"]:not([class*="right"])',
    '[class*="left-bubble"]', '[class*="replies"] [class*="msg"]',
    '[class*="conversacion"] [class*="texto"]', '[class*="chat-content"] [class*="other"]',
    '[data-test-uid] [class*="text"]:not([class*="my"])',
    '[class*="message"]:not([class*="my"])'
  ];
  
  for (const sel of selectors) {
    const messages = document.querySelectorAll(sel);
    if (messages.length === 0) continue;
    console.log('[TESSERACT] scanner selector', sel, 'matched', messages.length, 'messages');
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.classList.contains('tess-checked-outgoing')) continue;
      if (msg.matches && msg.matches('[class*="my-text-message"], [class*="my-message"], [class*="own"], [class*="sent"]')) continue;
      if (msg.closest && msg.closest('[class*="my-text-message"], [class*="my-message"], [class*="own"]')) continue;
      const text = (msg.textContent || '').trim();
      if (!text || text.length < 3) continue;
      const hash = text.substring(0, 80);
      if (_processedTexts.has(hash)) continue;
      if (eaterResponse && (text === eaterResponse || text.startsWith(eaterResponse.substring(0, 40)))) continue;
      _processedTexts.add(hash);
      if (_processedTexts.size > 30) {
        const first = _processedTexts.values().next().value;
        _processedTexts.delete(first);
      }
      injectEaterTrigger(msg, text);
      return;
    }
  }
}

function scanAllOutgoingMessages() {
  if (!clonacionActiva) return;
  const sentSelectors = [
    '[class*="my-text-message"]', '.text-message.own', '[class*="message-sent"]',
    '[class*="bubble-right"]', '[data-test-id*="msg--sent"]'
  ];
  const chatContainer = document.querySelector(TALK_Y.PAGE_CHAT_BODY);
  if (!chatContainer) return;
  for (const sel of sentSelectors) {
    const messages = document.querySelectorAll(sel + ':not(.tess-checked-outgoing)');
    if (messages.length === 0) continue;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!chatContainer.contains(msg)) continue;
      msg.classList.add('tess-checked-outgoing');
      const text = (msg.textContent || '').trim();
      if (!text || text.length < 3) continue;
      directInjectCaptureButton(msg, text);
    }
  }
}

function directInjectCaptureButton(msgEl, messageText) {
  if (msgEl.querySelector('.tess-capture-trigger')) return;
  var clientName = 'Cliente';
  var nameEl = msgEl.querySelector('[class*="name"], [class*="sender"], [class*="author"]');
  if (nameEl && nameEl.textContent.trim()) clientName = nameEl.textContent.trim();
  var trigger = document.createElement('span');
  trigger.className = 'tess-capture-trigger';
  trigger.textContent = '🎭';
  trigger.title = 'Capturar estilo del operador para este perfil';
  Object.assign(trigger.style, {
    cursor: 'pointer',
    fontSize: '14px',
    marginLeft: '4px',
    display: 'inline-block',
    opacity: '0.5',
    transition: 'opacity 0.2s',
    verticalAlign: 'middle'
  });
  trigger.onmouseenter = function () { this.style.opacity = '1'; };
  trigger.onmouseleave = function () { this.style.opacity = '0.5'; };
  var msgText = messageText || msgEl.textContent || '';
  trigger.onclick = function (e) {
    e.stopPropagation();
    captureOperatorStyle(msgText.trim());
  };
  var contentEl = msgEl.querySelector('.content, [class*="content"], p') || msgEl;
  contentEl.appendChild(trigger);
}

function checkForIncomingMessages(node) {
  const selectors = [
    '.text-message',
    '[data-test-id*="text-msg"]',
    '[data-test-id*="message"]:not([class*="my"])',
    '[class*="message-in"]', '[class*="message-received"]', '[class*="incoming"]',
    '[class*="other-message"]', '[class*="contact-message"]', '[class*="msg-other"]',
    '[class*="bubble-other"]', '[class*="dialog-item"]:not([class*="own"])',
    '[class*="chat-message"]:not([class*="sent"])', 'div[class*="message"]:not([class*="my"])',
    '[class*="msg"]:not([class*="my"])', '[class*="message"]:not([class*="self"])',
    '[class*="conv-msg"]:not([class*="own"])', '[class*="bubble"]:not([class*="right"])',
    '[class*="left-bubble"]', '[class*="replies"] [class*="msg"]',
    '[class*="conversacion"] [class*="texto"]', '[class*="chat-content"] [class*="other"]',
    '[class*="message"]:not([class*="my"])'
  ];
  
  const nodes = node.nodeType === 1 ? [node, ...node.querySelectorAll('*')] : [];
  for (const el of nodes) {
    if (el.nodeType !== 1) continue;
    if (el.classList.contains('tess-checked-outgoing')) continue;
    if (el.matches && el.matches('[class*="my-text-message"], [class*="my-message"], [class*="own"]')) continue;
    if (el.closest && el.closest('[class*="my-text-message"], [class*="my-message"], [class*="own"]')) continue;
    for (const sel of selectors) {
      if (!el.matches || !el.matches(sel)) continue;
      const text = (el.textContent || '').trim();
      if (!text || text.length < 3) continue;
      const hash = text.substring(0, 80);
      if (_processedTexts.has(hash)) continue;
      if (eaterResponse && (text === eaterResponse || text.startsWith(eaterResponse.substring(0, 40)))) continue;
      _processedTexts.add(hash);
      if (_processedTexts.size > 30) {
        const first = _processedTexts.values().next().value;
        _processedTexts.delete(first);
      }
      injectEaterTrigger(el, text);
      return;
    }
  }
}

function isOutgoingMessage(el) {
  const outgoingClasses = ['own', 'sent', 'outgoing', 'self', 'my-text-message', 'my-message', 'right', 'msg--outgoing', 'message--sent', 'msg--right', 'bubble--right'];
  let current = el;
  while (current && current !== document.body) {
    const cls = typeof current.className === 'string' ? current.className : '';
    for (const oc of outgoingClasses) {
      if (cls.includes(oc)) return true;
    }
    if (current.getAttribute && current.getAttribute('data-test-id')?.includes('msg--sent')) return true;
    current = current.parentElement;
  }
  return false;
}

function injectEaterTrigger(msgEl, messageText) {
  if (msgEl.querySelector('.tess-eater-trigger, .tess-capture-trigger')) return;
  if (msgEl.classList.contains('tess-checked-outgoing')) return;
  if (msgEl.matches && msgEl.matches('[class*="my-text-message"]')) return;
  
  const nameSelectors = ['[class*="name"]', '[class*="sender"]', '[class*="author"]', '[class*="username"]', '[class*="contact-name"]'];
  let clientName = 'Cliente';
  for (const sel of nameSelectors) {
    const nameEl = msgEl.querySelector(sel);
    if (nameEl && nameEl.textContent.trim()) { clientName = nameEl.textContent.trim(); break; }
  }
  if (clientName && clientName !== currentClientName) currentClientName = clientName;
  
  const trigger = document.createElement('span');
  trigger.className = 'tess-eater-trigger';
  trigger.textContent = '🤖';
  trigger.title = 'Generar respuesta con IA - ' + clientName;
  Object.assign(trigger.style, {
    cursor: 'pointer',
    fontSize: '14px',
    marginLeft: '4px',
    display: 'inline-block',
    opacity: '0.5',
    transition: 'opacity 0.2s',
    verticalAlign: 'middle'
  });
  trigger.onmouseenter = () => trigger.style.opacity = '1';
  trigger.onmouseleave = () => trigger.style.opacity = '0.5';
  
  const msgText = messageText || msgEl.textContent || '';
  trigger.onclick = (e) => {
    e.stopPropagation();
    generateFromMessage(msgText.trim());
  };
  
  const contentEl = msgEl.querySelector('.content, [class*="content"], p') || msgEl;
  contentEl.appendChild(trigger);

  let convEl = msgEl.closest('[class*="dialog-item-content"], [class*="dialog-item"], [class*="conversation-item"]');
  if (!convEl && clientName) {
    const items = document.querySelectorAll(TALK_Y.DIALOG_ITEMS);
    for (const item of items) {
      const nameEl = item.querySelector(TALK_Y.DIALOG_ITEM_NAME);
      if (nameEl && nameEl.textContent.trim() === clientName) {
        convEl = item;
        break;
      }
    }
  }
  if (convEl) startResponseTimer(convEl, clientName, trigger);
}

// ============ CAPTURA DE ESTILO ============
async function captureOperatorStyle(text) {
  if (!clonacionActiva) { showTessToast('⏸ Clonación está detenida', 'warning'); return; }
  var rawId = '';
  if (window._lastCribsPid) {
    var isOperator = window._cribsChatIds && window._cribsChatIds[0] && String(window._cribsChatIds[0]).replace(/^0+/, '') === String(window._lastCribsPid).replace(/^0+/, '');
    if (!isOperator) rawId = window._lastCribsPid;
  }
  if (!rawId && window._cribsChatIds && window._cribsChatIds.length > 1) {
    rawId = String(window._cribsChatIds[1]).replace(/^0+/, '');
  }
  if (!rawId) {
    var chatM = location.href.match(/\/chat\/(\d{6,15})_(\d{6,15})/);
    if (chatM) rawId = chatM[2].replace(/^0+/, '');
  }
  if (!rawId) {
    showTessToast('⚠ No hay perfil detectado para capturar estilo', 'warning');
    return;
  }
  await cribLoadOrRefresh(false);
  var entry = cribFindEntry(rawId);
  if (!entry || !entry._id) {
    showTessToast('⚠ Perfil no encontrado en CRIBS. Agrégalo desde el dashboard.', 'warning');
    return;
  }
  var existing = entry.voice_style || '';
  var lines = existing ? existing.split('\n').filter(function (l) { return l.trim(); }) : [];
  lines.push(text.trim());
  if (lines.length > 50) lines = lines.slice(-50);
  var newStyle = lines.join('\n');
  var headers = { 'Content-Type': 'application/json' };
  if (_tessJwtCache) headers['Authorization'] = 'Bearer ' + _tessJwtCache;
  try {
    var res = await fetch(TESSERACT_API + '/api/tess/cribs/' + entry._id + '/bulk', {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify({ voice_style: newStyle })
    });
    if (res.ok) {
      entry.voice_style = newStyle;
      if (cribsOverlayData && cribsOverlayData._id === entry._id) {
        cribsOverlayData.voice_style = newStyle;
      }
      if (cribsOverlayData && cribsOverlayData._id !== entry._id) {
        cribsOverlayData = entry;
      }
      if (cribsOverlayData) renderCribsOverlay(cribsOverlayData);
      showTessToast('🎭 Estilo capturado (' + lines.length + '/50)', 'success');
    } else {
      var errText = await res.text().catch(function () { return 'Unknown error'; });
      console.log('[CAPTURE] Bulk PUT error:', res.status, errText);
      showTessToast('⚠ Error al guardar estilo (' + res.status + ')', 'error');
    }
  } catch (e) {
    console.log('[CAPTURE] Error de red:', e.message);
    showTessToast('⚠ Error de conexión al guardar estilo', 'error');
  }
}

// ============ GENERACIÓN DE RESPUESTAS ============
function generateFromMessage(msgText) {
  if (!msgText || msgText.length < 3) return;
  
  const clientName = currentClientName || 'Cliente';
  
  if (!window._lastClientProfile) {
    const profileEl = document.querySelector(TALK_Y.PROFILE_DETAIL) || document.body;
    window._lastClientProfile = {
      name: clientName,
      interests: extractInterests(profileEl),
      location: extractLocation(profileEl),
      bio: extractBio(profileEl),
      age: extractAge(profileEl),
      hasPhoto: checkPhoto(profileEl),
      hobbies: extractHobbies(profileEl)
    };
  }
  
  const area = document.getElementById('eaterResponseArea');
  if (area) { area.value = '🤖 Generando...'; area.style.color = '#888'; }

  const btn2 = document.getElementById('btnRefreshEater2');
  if (btn2) btn2.textContent = '🤖 IA...';
  
  const profile = window._lastClientProfile || { name: clientName, interests: [], location: null, bio: '', age: null, hasPhoto: false, hobbies: null };
  
  generateWithAI(clientName, profile, msgText).then(response => {
    eaterResponse = response || generateLocalResponse(clientName, profile);
    if (eaterResponse) _processedTexts.add(eaterResponse.substring(0, 80));
    isUsingAI = !!response;
    if (btn2) btn2.textContent = isUsingAI ? '🤖 IA' : '🔄 FRASES';
    displaySuggestions(clientName);
  }).catch(() => {
    eaterResponse = generateLocalResponse(clientName, profile);
    if (eaterResponse) _processedTexts.add(eaterResponse.substring(0, 80));
    isUsingAI = false;
    if (btn2) btn2.textContent = '🔄 FRASES';
    displaySuggestions(clientName);
  });
}

// ============ EXTRACCIÓN DE PERFIL ============
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
  const bioEl = el.querySelector(TALK_Y.PROFILE_BIO);
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

// ============ IA GENERATION ============
async function generateWithAI(name, profile, accumulatedMsg) {
  try {
    const stored = await chrome.storage.local.get(['tess_jwt']);
    const token = stored.tess_jwt;
    
    if (!accumulatedMsg || accumulatedMsg.trim().length < 3) {
      return generateLocalResponse(name, profile);
    }
    
    const langHint = clientDetectedLang && clientDetectedLang !== 'es' ? ' El cliente escribe en ' + clientDetectedLang + '. Responde en ese mismo idioma.' : '';
    
    const isMultiple = accumulatedMsg.includes(' | ');
    const contextNote = isMultiple
      ? 'El cliente ha enviado VARIOS mensajes seguidos. Toma en cuenta TODOS para generar una respuesta coherente.'
      : '';
    
    var confianza = 'nueva';
    if (/\b(amor|cariño|bebé|mi vida|corazón|querido)\b/i.test(accumulatedMsg)) confianza = 'alta';
    else if (/\b(gracias|encanta|gusta|divertido|interesante|bonito|lindo)\b/i.test(accumulatedMsg)) confianza = 'media';
    var confianzaHint = confianza === 'alta' ? 'YA tienen confianza — puedes ser más natural, cálido y cercano. Responde como alguien con quien ya hay química.' :
      confianza === 'media' ? 'HAY buena vibra — sé cálido pero sin exagerar la confianza. Sigue el tono positivo.' :
      'apenas se están conociendo — sé respetuoso, sin apodos, sin posesión. Construye rapport natural.';

    var styleInjection = '';
    var cribsEntry = cribFindEntry(window._lastCribsPid);
    if (cribsEntry && cribsEntry.voice_style) {
      var examples = cribsEntry.voice_style.split('\n')
        .filter(function (l) { return l.trim().length > 5; })
        .map(function (l) { return '• "' + l.trim() + '"'; })
        .join('\n');
      console.log('[EATER AI] Estilo cargado para perfil', window._lastCribsPid, '—', cribsEntry.voice_style.split('\n').length, 'líneas');
      if (examples) {
        styleInjection = 'El operador escribe a este cliente con este estilo propio (ejemplos de mensajes reales enviados):\n' +
          examples + '\n\nDebes imitar EXACTAMENTE ese estilo: tono, nivel de formalidad, tipo de vocabulario, uso de emojis, longitud de frases y forma de expresarse. Sé coherente con su manera de escribir.\n\n';
      }
    } else {
      console.log('[EATER AI] Sin estilo capturado para perfil', window._lastCribsPid);
    }

    const prompt = 'Último mensaje del cliente:\n\n"' + accumulatedMsg.substring(0, 500) + '"\n\n' +
      contextNote +
      'Nivel de confianza: ' + confianza + '. ' + confianzaHint + '\n\n' +
      styleInjection +
      'Escribe UNA respuesta natural, variada, como en una conversación real. Reglas ESTRICTAS:\n' +
      '- NO empieces con "Me alegra que...", "Qué bien que...", "Me gusta que..." ni variantes. Es repetitivo.\n' +
      '- NO saludes ("Hola", "Hey", "Qué tal", "Buenas") a menos que el cliente haya saludado en su mensaje.\n' +
      '- NO preguntes la hora, fecha, día, ni "¿en qué piensas?", "¿qué haces?".\n' +
      '- NO uses frases hechas, halagos vacíos, ni estructura de "Me _____ que tú _____".\n' +
      '- Si el cliente usa palabras de cariño (amor, bebé, cariño, querido, etc.), responde con EL MISMO nivel de afecto, reflejando su tono.\n' +
      '- Si el cliente pide número de celular, correo electrónico o cambiar a otra página, NIÉGATE de forma coherente y sin dudar, inventando una excusa creíble (ej: "me robaron el celular y estoy esperando el reemplazo", "mi correo está teniendo problemas", "esta página es más segura para hablar"). No des esperanzas falsas pero tampoco cierres la puerta del todo.\n' +
      'Varía tu forma de iniciar: a veces responde directo, a veces con una observación. NO termines cada mensaje con pregunta, solo pregúntale algo si es genuinamente necesario entender algo. ' +
      'Sigue el tono del cliente: si es directo, sé directo; si bromea, sigue su humor; si es profundo, conéctate en ese nivel. ' +
      'Habla como si estuvieras respondiendo un mensaje de WhatsApp, no redactando una carta. ' +
      'Sé concreto, máximo 280 caracteres. Responde SOLO el texto de mi respuesta.' + langHint;

    console.log('[EATER AI] Llamando a IA con mensaje del cliente');
    
    const response = await fetch(`${TESSERACT_API}/api/chatgpt/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'Eres un hombre real de 30-45 años, conversas como una persona normal en WhatsApp. Reglas OBLIGATORIAS: 1) NUNCA empieces con "Me alegra que...", "Qué bien que...", "Me gusta que..." ni ninguna estructura parecida. Varía siempre tu forma de empezar. 2) Habla como en una conversación real, no como coach, terapeuta, poeta ni redactor publicitario. 3) NUNCA preguntes la hora, fecha, qué hacía a una hora específica, ni "¿en qué piensas?". 4) Cada respuesta debe reaccionar a algo CONCRETO que el cliente dijo. 5) Sigue el tono del cliente: si bromea, sigue el humor; si es directo, sé directo; si es cariñoso, responde con calidez natural. 6) Siempre en español. Nunca revelas que eres IA. 7) No uses apodos ("mi vida", "amor", "bebé") a menos que el cliente los haya usado primero. 8) No incluyas redes sociales ni contacto externo. 9) Si la persona está mal, escucha sin presionar. 10) Máximo 280 caracteres. Sé variado, concreto y auténtico. 11) NO saludes ("Hola", "Hey", "Qué tal", "Buenas") a menos que el cliente haya saludado en su mensaje. 12) Si el cliente usa palabras de cariño (amor, bebé, cariño, querido, etc.), responde con el mismo nivel de afecto reflejando su tono. 13) Si el cliente pide número de celular, correo o cambiar a otra página, niégate de forma coherente y sin dudar con una excusa creíble (ej: "me robaron el celular", "mi correo no está funcionando", "esta página es más segura"), sin dar esperanzas falsas pero sin cerrar la puerta del todo. 14) Si el usuario te da ejemplos del estilo del operador para este cliente, imítalos fielmente en tu respuesta. El operador habla así con esta persona, tú debes sonar igual. 15) NO termines cada respuesta con pregunta. Solo pregunta algo si es genuinamente necesario para seguir la conversación. La mayoría de las veces responde sin preguntar.'
          },
          { role: 'user', content: prompt }
        ],
        model: 'gpt-3.5-turbo',
        max_tokens: 150
      })
    });
    
    console.log('[EATER AI] Response status:', response.status);
    const data = await response.json();
    console.log('[EATER AI] Response data:', data);
    if (!response.ok) {
      console.warn('[EATER AI] Error del servidor:', JSON.stringify(data));
      return null;
    }
    
    if (data.choices && data.choices[0]?.message?.content) {
      const text = data.choices[0].message.content.trim();
      console.log('[EATER AI] Respuesta generada:', text);
      return text;
    }
    return null;
  } catch (e) {
    console.warn('[EATER AI] Error:', e.message);
    return null;
  }
}

// ============ RESPUESTA LOCAL (FALLBACK) ============
function generateLocalResponse(name, profile) {
  const { interests, location, hobbies } = profile;
  const hasRealInterests = interests && interests.length > 0;
  const hasRealHobbies = hobbies && hobbies.length > 0;
  const hasRealLocation = location && location.length > 0;
  
  const candidates = [
    'Me gustas, pero no sé si me vas a responder...',
    'Tu perfil me tiene curioso... ¿serás interesante?',
    'Tengo una corazonada sobre ti...',
    'Algo me dice que deberíamos conversar...',
    'No puedo dejar de pensar en ti...',
    '¿Y si esta vez sí funciona?',
    'Me atraes... y quiero saber más de ti.',
    'Veo tu perfil y pienso que podrías ser especial...',
    'Algo en ti me llama la atención...',
    'Oye, ¿qué tal si nos conocemos mejor?',
    location && hasRealLocation ? `Vivo cerca de ${location}, ¿y tú?` : null,
    interests && hasRealInterests ? `Veo que te gusta ${interests[0]}... a mí también!` : null,
    hobbies && hasRealHobbies ? `${hobbies[0]}! Yo también hago eso :D` : null,
  ].filter(s => s);
  
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled[0] || 'Cuéntame más de ti...';
}

// ============ DISPLAY SUGGESTIONS ============
function displaySuggestions(name) {
  const cnEl = document.getElementById('eaterClientName');
  if (cnEl) cnEl.textContent = name;
  
  const area = document.getElementById('eaterResponseArea');
  if (!area) return;
  
  if (eaterResponse) {
    area.value = eaterResponse;
    area.style.color = '#e0e0e0';
  }
  
  if (clientDetectedLang && clientDetectedLang !== 'es') {
    const sel = document.getElementById('btnTranslate2');
    if (sel && sel.querySelector('option[value="' + clientDetectedLang + '"]')) {
      sel.value = clientDetectedLang;
      selectedLangCode = clientDetectedLang;
    }
    translateEaterResponse();
  }
}

// ============ TRADUCCIÓN ============
async function translateEaterText(text) {
  var code = selectedLangCode;
  if (code === 'es') { copyToChatInput(text); return; }
  var targetLang = translateLanguages.find(function (l) { return l.code === code; }) || translateLanguages[0];
  try {
    const stored = await chrome.storage.local.get(['tess_jwt']);
    const token = stored.tess_jwt;
    
    const res = await fetch(`${TESSERACT_API}/api/openai/translate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ text, targetLang: targetLang.code, targetName: targetLang.name })
    });
    
    if (res.ok) {
      const data = await res.json();
      const translated = data.data?.translations?.[0]?.text || data.translatedText;
      if (translated) {
        copyToChatInput(translated);
        console.log('[TRANSLATE] ES → ' + targetLang.name + ':', translated.substring(0, 50));
      }
    }
  } catch(e) {
    console.warn('[TRANSLATE] Error:', e.message);
  }
}

async function translateEaterResponse() {
  const area = document.getElementById('eaterResponseArea');
  if (!area || !area.value || area.value === 'Esperando mensaje...') return;

  var code = selectedLangCode;
  if (code === 'es') return;
  var targetLang = translateLanguages.find(function (l) { return l.code === code; }) || translateLanguages[0];

  var sourceText = window._eaterOriginalResponse || area.value;
  if (!sourceText || sourceText === 'Esperando mensaje...') return;

  try {
    const stored = await chrome.storage.local.get(['tess_jwt']);
    const token = stored.tess_jwt;
    
    const res = await fetch(`${TESSERACT_API}/api/openai/translate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ text: sourceText, targetLang: targetLang.code, targetName: targetLang.name })
    });

    console.log('[TRANSLATE] Solicitando traducción → ' + targetLang.name + ':', sourceText.substring(0, 50));
    
    if (res.ok) {
      const data = await res.json();
      const translated = data.data?.translations?.[0]?.text || data.translatedText;
      console.log('[TRANSLATE] Respuesta:', translated ? translated.substring(0, 50) : 'sin traducción');
      if (translated) {
        area.value = translated;
        eaterResponse = translated;
        window._eaterTranslated = true;
      }
    } else {
      console.warn('[TRANSLATE] Error HTTP:', res.status, await res.text().catch(function () { return ''; }));
    }
  } catch(e) {
    console.warn('[TRANSLATE] Error:', e.message);
  }
}

// ============ REFRESH EATER ============
function refreshEaterSuggestions() {
  const clientName = currentClientName || 'Cliente';
  const profileEl = document.querySelector(TALK_Y.PROFILE_DETAIL) || document.body;
  const profile = {
    name: clientName,
    interests: extractInterests(profileEl),
    location: extractLocation(profileEl),
    bio: extractBio(profileEl),
    age: extractAge(profileEl),
    hasPhoto: checkPhoto(profileEl),
    hobbies: extractHobbies(profileEl)
  };
  
  const area = document.getElementById('eaterResponseArea');
  if (area) { area.value = '🤖 Generando...'; area.style.color = '#888'; }

  const btn2 = document.getElementById('btnRefreshEater2');
  if (btn2) {
    btn2.textContent = '🤖 IA...';
    btn2.style.background = 'rgba(139,92,246,0.5)';
  }

  window._eaterTranslated = false;
  window._eaterOriginalResponse = '';
  const currentText = eaterResponse || '';
  generateWithAI(clientName, profile, currentText).then(response => {
    eaterResponse = response || generateLocalResponse(clientName, profile);
    window._eaterOriginalResponse = eaterResponse;
    if (eaterResponse) _processedTexts.add(eaterResponse.substring(0, 80));
    isUsingAI = !!response;
    if (btn2) {
      btn2.textContent = isUsingAI ? '🤖 IA' : '🔄 FRASES';
      btn2.style.background = isUsingAI ? 'rgba(139,92,246,0.3)' : 'rgba(30,27,75,0.7)';
    }
    displaySuggestions(clientName);
  }).catch(() => {
    eaterResponse = generateLocalResponse(clientName, profile);
    window._eaterOriginalResponse = eaterResponse;
    if (eaterResponse) _processedTexts.add(eaterResponse.substring(0, 80));
    isUsingAI = false;
    if (btn2) { btn2.textContent = '🔄 FRASES'; btn2.style.background = 'rgba(30,27,75,0.7)'; }
    displaySuggestions(clientName);
  });
}

// ============ TRADUCCIÓN (ES → EN / FR / PT) ============
async function translateText(text, targetCode, targetName) {
  var defaultLang = translateLanguages.find(function (l) { return l.code === selectedLangCode; }) || translateLanguages[0];
  const code = targetCode || defaultLang.code;
  const name = targetName || defaultLang.name;
  try {
    const token = await new Promise(r => chrome.storage.local.get('tess_jwt', d => r(d.tess_jwt)));
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const resp = await fetch(`${TESSERACT_API}/api/openai/translate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: text,
        targetLang: code,
        targetName: name
      })
    });
    const data = await resp.json();
    if (data.success && data.data?.translations?.[0]?.text) {
      return data.data.translations[0].text;
    }
    if (data.translatedText) {
      return data.translatedText;
    }
  } catch (e) {
    console.warn('[TESSERACT] Translate error:', e.message);
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

  const urlMatch = location.pathname.match(/\/(?:profile|user|member|u|id)\/([^/?#]+)/i);
  if (urlMatch) {
    const val = urlMatch[1];
    if (/^\d{6,15}$/.test(val)) profileId = val;
    else if (!profileName && val.length < 40) profileName = val;
  }

  const title = document.title;
  const titleClean = title.replace(/[|-].*$/, '').trim();
  if (titleClean && titleClean.toLowerCase() !== 'talkytimes' && titleClean.length < 40) {
    profileName = profileName || titleClean;
  }

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

  if (!profileId) {
    const attrs = ['data-user-id', 'data-profile-id', 'data-member-id', 'data-id', 'data-uid', 'data-user', 'data-profile'];
    for (const a of attrs) {
      const v = document.body.getAttribute(a) || document.documentElement.getAttribute(a);
      if (v && /^\d{6,15}$/.test(v)) { profileId = v; break; }
    }
  }

  if (!profileName) {
    const imgs = document.querySelectorAll('img[class*="avatar"], img[class*="profile"], img[class*="photo"], img[alt]:not([alt=""])');
    for (const img of imgs) {
      const alt = (img.alt || '').trim();
      if (alt && alt.length < 40 && !/photo|avatar|profile|imagen|user/i.test(alt)) {
        profileName = alt; break;
      }
    }
  }

  if (!profileId) {
    const m = location.href.match(/\/(\d{6,15})(?:[/?#]|$)/);
    if (m) profileId = m[1];
  }
  const chatM = location.href.match(/\/chat\/(\d{6,15})_(\d{6,15})/);
  if (chatM) {
    window._cribsChatIds = [chatM[1], chatM[2]];
    window._tessOperatorId = chatM[1];
    chrome.storage.local.set({ tess_operator_id: chatM[1] });
    profileId = chatM[2];
  } else {
    window._cribsChatIds = null;
  }

  if (!profileName) {
    const links = document.querySelectorAll('a[href*="profile"], a[href*="perfil"], a[href*="my-"], a[href*="account"]');
    for (const link of links) {
      const t = (link.textContent || '').trim();
      if (t && t.length < 40 && !/profile|perfil|account|my\s/i.test(t) && !t.includes('@')) {
        profileName = t; break;
      }
    }
  }

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

  console.log('[TESSERACT] Profile detection:', profileId, '| name:', profileName, '| url:', location.href);

  if (profileName || profileId) {
    nameEl.textContent = profileName || '—';
    idEl.textContent = 'ID: ' + (profileId || '—');
    badge.style.display = 'flex';
    var rawId = profileId ? profileId.replace(/^0+/, '') : '';
    if (rawId) {
      var isSame = window._lastCribsPid === rawId;
      var hasAlternates = window._cribsChatIds && window._cribsChatIds.length > 1 && window._cribsChatIds.some(function (id) { return String(id).replace(/^0+/, '') !== rawId; });
      if (!isSame || hasAlternates) {
        console.log('[CRIBS] Detectado:', rawId, '| anterior:', window._lastCribsPid, '| alternates:', window._cribsChatIds ? JSON.stringify(window._cribsChatIds) : 'ninguno');
        window._lastCribsPid = rawId;
        if (window._cribsDetectTimer) { clearTimeout(window._cribsDetectTimer); window._cribsDetectTimer = null; }
        window._cribsDetectTimer = setTimeout(function () { window._cribsDetectTimer = null; fetchCribsForProfile(rawId); }, 150);
      } else {
        console.log('[CRIBS] Mismo perfil sin alternates, saltando:', rawId);
      }
    }
  } else {
    badge.style.display = 'none';
    window._lastCribsPid = '';
    if (cribsOverlayState && cribsOverlayState.visible) {
      cribsOverlayState.visible = false;
      var te = document.getElementById('tess-cribs-overlay');
      if (te) te.classList.remove('visible');
    }
  }
}

function stopProfileWatcher() {
  if (titleObserver) { titleObserver.disconnect(); titleObserver = null; }
  if (loginObserver) { loginObserver.disconnect(); loginObserver = null; }
  if (urlPollInterval) { clearInterval(urlPollInterval); urlPollInterval = null; }
}

function startProfileWatcher() {
  stopProfileWatcher();
  detectCurrentProfile();
  var titleEl = document.querySelector(TALK_Y.PAGE_TITLE);
  if (titleEl) {
    var lastTitle = titleEl.textContent;
    titleObserver = new MutationObserver(function () {
      if (titleEl.textContent !== lastTitle) {
        lastTitle = titleEl.textContent;
        setTimeout(detectCurrentProfile, 400);
      }
    });
    titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
  }
  let lastUrl = location.href;
  urlPollInterval = setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(detectCurrentProfile, 600);
    }
  }, 1500);
  window.addEventListener('popstate', function () {
    setTimeout(detectCurrentProfile, 600);
  });
  loginObserver = new MutationObserver(() => {
    if (isAuthenticated) detectCurrentProfile();
  });
  loginObserver.observe(document.getElementById('mainScreen') || document.body, { attributes: true, childList: true, subtree: true });
}
