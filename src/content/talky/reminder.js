(function () {
  var CHAT_TIMER_MS = 120000;
  var CARTA_TIMER_MS = 180000;
  var timers = {};
  var notificationEl = null;
  var audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playAlarm() {
    try {
      var ctx = getAudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      for (var i = 0; i < 4; i++) {
        setTimeout(function () {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.3);
        }, i * 350);
      }
    } catch (e) {}
  }

  function createNotification() {
    if (notificationEl) return;
    notificationEl = document.createElement('div');
    notificationEl.id = 'tess-reminder';
    notificationEl.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:2147483647;background:linear-gradient(135deg,#1a1a2e,#0a0a0f);border:2px solid #ef4444;border-radius:12px;padding:16px 24px;box-shadow:0 0 40px rgba(239,68,68,0.3),0 10px 40px rgba(0,0,0,0.5);font-family:"JetBrains Mono",monospace;color:#e0e0e0;font-size:12px;max-width:360px;transform:translateY(120px);opacity:0;transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);pointer-events:none;';
    notificationEl.innerHTML = '<div style="display:flex;align-items:center;gap:12px;"><div style="width:10px;height:10px;border-radius:50%;background:#ef4444;animation:tess-pulse 1s infinite;"></div><div><div style="font-weight:600;color:#ef4444;letter-spacing:1px;font-size:11px;" id="tess-reminder-type">RECORDATORIO</div><div style="margin-top:4px;color:#ccc;font-size:11px;" id="tess-reminder-msg">Tienes un mensaje sin responder</div></div></div>';
    var style = document.createElement('style');
    style.textContent = '@keyframes tess-pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }';
    document.head.appendChild(style);
    document.body.appendChild(notificationEl);
  }

  function showReminder(type, clientName) {
    createNotification();
    var typeEl = document.getElementById('tess-reminder-type');
    var msgEl = document.getElementById('tess-reminder-msg');
    if (typeEl) typeEl.textContent = type === 'carta' ? 'CARTA SIN RESPONDER' : 'CHAT SIN RESPONDER';
    if (msgEl) msgEl.textContent = (clientName || 'Un contacto') + ' no responde';
    if (notificationEl) {
      notificationEl.style.transform = 'translateY(0)';
      notificationEl.style.opacity = '1';
      notificationEl.style.pointerEvents = 'auto';
    }
    playAlarm();
    setTimeout(function () {
      if (notificationEl) {
        notificationEl.style.transform = 'translateY(120px)';
        notificationEl.style.opacity = '0';
        notificationEl.style.pointerEvents = 'none';
      }
    }, 8000);
  }

  function clearReminderTimer(contactId) {
    if (timers[contactId]) {
      clearTimeout(timers[contactId]);
      delete timers[contactId];
    }
  }

  function startReminderTimer(contactId, type, clientName) {
    clearReminderTimer(contactId);
    var delay = type === 'carta' ? CARTA_TIMER_MS : CHAT_TIMER_MS;
    timers[contactId] = setTimeout(function () {
      showReminder(type, clientName);
      delete timers[contactId];
    }, delay);
  }

  function getCurrentContactName() {
    var selectors = [
      '[class*="chat-header"] [class*="name"]', '[class*="dialog-header"] [class*="name"]',
      '[class*="conversation-header"] [class*="name"]', '[class*="profile-name"]',
      '[class*="contact-name"]', '[class*="user-name"]', '[class*="active"] [class*="name"]',
      '[class*="chat"] [class*="title"]', '[class*="conversation"] [class*="title"]'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return null;
  }

  function getCurrentContactId() {
    var sel = '[class*="chat-header"] a[href*="/member/"], [class*="chat-header"] a[href*="/user/"], [class*="chat-header"] a[href*="/profile/"],' +
      '[class*="dialog-header"] a[href*="/member/"], [class*="dialog-header"] a[href*="/user/"],' +
      'a[href*="/member/"].active, a[href*="/profile/"].active, [class*="active"] a[href*="/member/"],' +
      '[class*="active"] a[href*="/user/"]';
    var links = document.querySelectorAll(sel);
    for (var i = 0; i < links.length; i++) {
      var parts = links[i].href.match(/\/(\d{6,15})/);
      if (parts) return parts[1];
    }
    return Date.now().toString();
  }

  function onMessageSent() {
    var name = getCurrentContactName() || 'Contacto';
    var id = getCurrentContactId();
    startReminderTimer(id, 'chat', name);
  }

  function onCartaSent() {
    var name = getCurrentContactName() || 'Contacto';
    var id = getCurrentContactId();
    startReminderTimer(id, 'carta', name);
  }

  function isFromContact(node) {
    var incomingSels = [
      '[class*="message-in"]', '[class*="message-received"]', '[class*="incoming"]',
      '[class*="other-message"]', '[class*="contact-message"]', '[class*="msg-other"]',
      '[class*="bubble-other"]', '[class*="dialog-item"]:not([class*="own"])',
      '[class*="chat-message"]:not([class*="sent"])', 'div[class*="message"]:not([class*="my"])'
    ];
    for (var i = 0; i < incomingSels.length; i++) {
      var match = null;
      if (node.matches && node.matches(incomingSels[i])) match = node;
      else match = node.querySelector(incomingSels[i]);
      if (match) return true;
    }
    var cartaSels = [
      '[class*="letter-in"]', '[class*="mail-in"]', '[class*="inbox-item"]',
      '[class*="mail-received"]', '[class*="email-received"]'
    ];
    for (var j = 0; j < cartaSels.length; j++) {
      var match2 = null;
      if (node.matches && node.matches(cartaSels[j])) match2 = node;
      else match2 = node.querySelector(cartaSels[j]);
      if (match2) return true;
    }
    return false;
  }

  function extractContactIdFromNode(node) {
    var id = node.getAttribute('data-user-id') || node.getAttribute('data-contact-id') || node.getAttribute('data-id');
    if (id) return String(id);
    var link = node.querySelector('a[href*="/member/"], a[href*="/user/"], a[href*="/profile/"]');
    if (link) {
      var parts = link.href.match(/\/(\d{6,15})/);
      if (parts) return parts[1];
    }
    return null;
  }

  function initReminder() {
    createNotification();

    // MutationObserver: detecta mensajes entrantes del contacto → limpia timer
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.addedNodes.length > 0) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var node = m.addedNodes[j];
            if (node.nodeType !== 1) continue;
            if (!isFromContact(node)) continue;
            // Mensaje entrante del contacto → limpiar timer
            for (var k in timers) {
              if (timers.hasOwnProperty(k)) {
                clearReminderTimer(k);
              }
            }
          }
        }
      }
    });
    var chatContainer = document.querySelector('[class*="chat"], [class*="message"], [class*="conversation"], [class*="inbox"], [class*="mail"], [class*="letter"]') || document.body;
    observer.observe(chatContainer, { childList: true, subtree: true });

    // Click en botón de enviar → detectar mensaje saliente
    document.addEventListener('click', function (e) {
      var target = e.target;
      var sendBtn = target.closest('button[class*="send"], button[class*="enviar"], [type="submit"], [class*="btn-send"], [class*="btn-enviar"], a[class*="send"]');
      if (sendBtn) {
        setTimeout(onMessageSent, 300);
      }
    });

    // Enter en input de chat → detectar mensaje saliente
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        var active = document.activeElement;
        if (active && (active.matches('textarea, input[type="text"], [contenteditable="true"]'))) {
          setTimeout(onMessageSent, 300);
        }
      }
    });

    console.log('[TESSERACT REMINDER] Activo - Chat: 2min | Carta: 3min');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReminder);
  } else {
    initReminder();
  }
})();
