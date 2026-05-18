(function () {
  var CHAT_TIMER_MS = 120000;
  var CARTA_TIMER_MS = 180000;
  var timers = {};
  var lastIncoming = {};
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
    if (msgEl) msgEl.textContent = (clientName || 'Un contacto') + ' espera tu respuesta';
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

  function detectOutgoingMessage() {
    var chatInputs = document.querySelectorAll(
      'textarea[class*="chat"], textarea[class*="message"], textarea[placeholder*="mensaje"], textarea[placeholder*="message"],' +
      'input[class*="chat"], input[class*="message"], #chatInput, #messageInput, #msgInput, textarea.chat-input,' +
      'div[contenteditable="true"]'
    );
    var sendButtons = document.querySelectorAll(
      'button[class*="send"], button[class*="enviar"], button[class*="submit"],' +
      '[type="submit"], [class*="btn-send"], [class*="btn-enviar"],' +
      'a[class*="send"], img[class*="send"]'
    );
    var hasContent = false;
    chatInputs.forEach(function (el) {
      if (el.value && el.value.trim()) hasContent = true;
      if (el.textContent && el.textContent.trim()) hasContent = true;
    });
    if (hasContent || sendButtons.length > 0) {
      for (var key in timers) {
        if (timers.hasOwnProperty(key)) clearReminderTimer(key);
      }
    }
  }

  function handleIncomingNode(node) {
    var chatSelectors = [
      '[class*="message-in"]', '[class*="message-received"]', '[class*="incoming"]',
      '[class*="other-message"]', '[class*="contact-message"]', '[class*="msg-other"]',
      '[class*="bubble-other"]', '[class*="dialog-item"]:not([class*="own"])',
      '[class*="chat-message"]:not([class*="sent"])', 'div[class*="message"]:not([class*="my"])'
    ];
    var cartaSelectors = [
      '[class*="letter-in"]', '[class*="mail-in"]', '[class*="inbox-item"]',
      '[class*="mail-received"]', '[class*="email-received"]'
    ];
    for (var sel in chatSelectors) {
      var match = null;
      if (node.matches && node.matches(chatSelectors[sel])) { match = node; }
      else { match = node.querySelector(chatSelectors[sel]); }
      if (match) {
        var clientName = extractName(match) || 'Cliente';
        var contactId = extractContactId(match) || 'chat_' + Date.now();
        startReminderTimer(contactId, 'chat', clientName);
        return;
      }
    }
    for (var sel2 in cartaSelectors) {
      var match2 = null;
      if (node.matches && node.matches(cartaSelectors[sel2])) { match2 = node; }
      else { match2 = node.querySelector(cartaSelectors[sel2]); }
      if (match2) {
        var clientName2 = extractName(match2) || 'Cliente';
        var contactId2 = extractContactId(match2) || 'carta_' + Date.now();
        startReminderTimer(contactId2, 'carta', clientName2);
        return;
      }
    }
  }

  function extractName(el) {
    var selectors = ['[class*="name"]', '[class*="sender"]', '[class*="author"]', '[class*="username"]', '[class*="contact-name"]', '[class*="title"]'];
    for (var i = 0; i < selectors.length; i++) {
      var found = el.querySelector(selectors[i]);
      if (found && found.textContent.trim()) return found.textContent.trim();
    }
    if (el.textContent.trim()) return el.textContent.trim().substring(0, 30);
    return null;
  }

  function extractContactId(el) {
    var id = el.getAttribute('data-user-id') || el.getAttribute('data-contact-id') || el.getAttribute('data-id');
    if (id) return String(id);
    var link = el.querySelector('a[href*="/member/"], a[href*="/user/"], a[href*="/profile/"]');
    if (link) {
      var parts = link.href.match(/\/(\d{6,15})/);
      if (parts) return parts[1];
    }
    return null;
  }

  function initReminder() {
    createNotification();
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        if (mutation.addedNodes.length > 0) {
          for (var j = 0; j < mutation.addedNodes.length; j++) {
            var node = mutation.addedNodes[j];
            if (node.nodeType === 1) handleIncomingNode(node);
          }
        }
      }
    });
    var chatContainer = document.querySelector('[class*="chat"], [class*="message"], [class*="conversation"], [class*="inbox"], [class*="mail"], [class*="letter"]') || document.body;
    observer.observe(chatContainer, { childList: true, subtree: true });
    document.addEventListener('click', function (e) {
      var target = e.target;
      if (target.matches && (
        target.matches('button[class*="send"], button[class*="enviar"], [type="submit"], [class*="btn-send"]') ||
        target.closest('button[class*="send"], button[class*="enviar"], [type="submit"], [class*="btn-send"]')
      )) {
        setTimeout(detectOutgoingMessage, 500);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        var active = document.activeElement;
        if (active && (active.matches('textarea, input[type="text"], [contenteditable="true"]'))) {
          setTimeout(detectOutgoingMessage, 500);
        }
      }
    });
    console.log('[TESSERACT REMINDER] Activo - Chat: 2min, Cartas: 3min');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReminder);
  } else {
    initReminder();
  }
})();
