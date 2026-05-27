(function () {
  var RISK_TIMER_MS = 90000;
  var riskTimers = {};
  var riskNotificationEl = null;
  var audioCtx = null;

  function playAlarm() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      for (var i = 0; i < 4; i++) {
        setTimeout(function () {
          try {
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.3);
          } catch (e) {}
        }, i * 350);
      }
    } catch (e) {}
  }

  function createRiskNotification() {
    if (riskNotificationEl) return;
    riskNotificationEl = document.createElement('div');
    riskNotificationEl.id = 'tess-risk';
    riskNotificationEl.style.cssText = 'position:fixed;bottom:95px;right:30px;z-index:2147483647;background:linear-gradient(135deg,#1a1a2e,#0a0a0f);border:2px solid #f59e0b;border-radius:12px;padding:16px 24px;box-shadow:0 0 40px rgba(245,158,11,0.3),0 10px 40px rgba(0,0,0,0.5);font-family:monospace;color:#e0e0e0;font-size:12px;max-width:360px;transform:translateY(120px);opacity:0;transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);pointer-events:none;cursor:pointer;';
    riskNotificationEl.setAttribute('data-client-id', '');
    riskNotificationEl.setAttribute('data-client-name', '');
    riskNotificationEl.addEventListener('click', function () {
      var id = this.getAttribute('data-client-id');
      if (id) {
        var links = document.querySelectorAll(TALK_Y.LINKS_WITH_PROFILE);
        for (var k = 0; k < links.length; k++) {
          var parts = links[k].href.match(/\/(\d{6,15})/);
          if (parts && parts[1] === id) {
            links[k].closest('[class*="dialog-item"],[class*="contact-item"],[class*="conversation"]')?.click();
            break;
          }
        }
      }
      hideRiskNotification();
    });
    riskNotificationEl.innerHTML = '<div style="display:flex;align-items:center;gap:12px;"><div style="width:10px;height:10px;border-radius:50%;background:#f59e0b;animation:tess-pulse 1s infinite;"></div><div><div style="font-weight:600;color:#f59e0b;letter-spacing:1px;font-size:11px;">TASA DE RESPUESTA EN RIESGO</div><div style="margin-top:4px;color:#ccc;font-size:11px;" id="tess-risk-msg"></div></div></div>';
    var style = document.createElement('style');
    style.textContent = '@keyframes tess-pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }';
    document.head.appendChild(style);
    document.body.appendChild(riskNotificationEl);
  }

  function hideRiskNotification() {
    if (!riskNotificationEl) return;
    riskNotificationEl.style.transform = 'translateY(120px)';
    riskNotificationEl.style.opacity = '0';
    riskNotificationEl.style.pointerEvents = 'none';
  }

  function showRiskNotification(contactId, clientName) {
    createRiskNotification();
    riskNotificationEl.setAttribute('data-client-id', contactId || '');
    riskNotificationEl.setAttribute('data-client-name', clientName || '');
    var msgEl = document.getElementById('tess-risk-msg');
    if (msgEl) msgEl.textContent = (clientName || 'Un contacto') + ' espera respuesta';
    riskNotificationEl.style.transform = 'translateY(0)';
    riskNotificationEl.style.opacity = '1';
    riskNotificationEl.style.pointerEvents = 'auto';
    playAlarm();
    setTimeout(hideRiskNotification, 8000);
  }

  function clearRiskTimer(contactId) {
    if (!contactId) return;
    if (riskTimers[contactId]) {
      clearTimeout(riskTimers[contactId]);
      delete riskTimers[contactId];
    }
  }

  function startRiskTimer(contactId, clientName) {
    if (!contactId || contactId === 'undefined') return;
    clearRiskTimer(contactId);
    riskTimers[contactId] = setTimeout(function () {
      if (riskTimers[contactId]) {
        showRiskNotification(contactId, clientName);
        delete riskTimers[contactId];
      }
    }, RISK_TIMER_MS);
  }

  function getCurrentContactId() {
    var sel = 'a[href*="/member/"].active, a[href*="/profile/"].active, [class*="active"] a[href*="/member/"], [class*="active"] a[href*="/user/"],' +
      '[class*="chat-header"] a[href*="/member/"], [class*="chat-header"] a[href*="/user/"],' +
      '[class*="dialog-header"] a[href*="/member/"]';
    var links = document.querySelectorAll(sel);
    for (var i = 0; i < links.length; i++) {
      var parts = links[i].href.match(/\/(\d{6,15})/);
      if (parts) return parts[1];
    }
    return null;
  }

  function onOperatorResponded() {
    var id = getCurrentContactId();
    clearRiskTimer(id);
  }

  function detectContactInteraction(node) {
    if (node.nodeType !== 1) return null;
    var incomingSels = [
      '[class*="message-in"]', '[class*="message-received"]', '[class*="incoming"]',
      '[class*="other-message"]', '[class*="contact-message"]', '[class*="msg-other"]',
      '[class*="bubble-other"]', '[class*="dialog-item"]:not([class*="own"])',
      '[class*="chat-message"]:not([class*="sent"])', 'div[class*="message"]:not([class*="my"])',
      '[class*="msg"]:not([class*="my"])', '[class*="message"]:not([class*="self"])'
    ];
    for (var i = 0; i < incomingSels.length; i++) {
      var el = node.matches && node.matches(incomingSels[i]) ? node : node.querySelector(incomingSels[i]);
      if (!el) continue;
      var link = el.querySelector(TALK_Y.LINKS_WITH_PROFILE);
      var contactId = null;
      if (link) {
        var parts = link.href.match(/\/(\d{6,15})/);
        if (parts) contactId = parts[1];
      }
      if (!contactId) contactId = el.getAttribute('data-user-id') || el.getAttribute('data-contact-id') || el.getAttribute('data-id');
      if (!contactId) contactId = el.closest('[data-user-id]')?.getAttribute('data-user-id');
      if (!contactId) continue;
      var nameSelectors = ['[class*="name"]', '[class*="sender"]', '[class*="author"]', '[class*="username"]', '[class*="contact-name"]'];
      var clientName = 'Un contacto';
      for (var j = 0; j < nameSelectors.length; j++) {
        var found = el.querySelector(nameSelectors[j]) || el.closest(nameSelectors[j]);
        if (found && found.textContent.trim()) { clientName = found.textContent.trim(); break; }
      }
      return { contactId: String(contactId), clientName: clientName };
    }
    return null;
  }

  // Periodic poll: detecta mensajes entrantes que el MutationObserver pueda perder
  function startPolling() {
    var lastSnapshot = new Map();
    setInterval(function () {
      var all = document.querySelectorAll(incomingSels.join(','));
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        var key = el.textContent.trim().substring(0, 80);
        if (lastSnapshot.has(key)) continue;
        lastSnapshot.set(key, true);
        if (lastSnapshot.size > 100) lastSnapshot.clear();
        var result = detectContactInteraction(el);
        if (result) startRiskTimer(result.contactId, result.clientName);
      }
    }, 4000);
  }

  var incomingSels = [
    '[class*="message-in"]', '[class*="message-received"]', '[class*="incoming"]',
    '[class*="other-message"]', '[class*="contact-message"]', '[class*="msg-other"]',
    '[class*="bubble-other"]', '[class*="dialog-item"]:not([class*="own"])',
    '[class*="chat-message"]:not([class*="sent"])', 'div[class*="message"]:not([class*="my"])',
    '[class*="msg"]:not([class*="my"])', '[class*="message"]:not([class*="self"])'
  ];

  function initReminder() {
    document.addEventListener('click', function onClickInit() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      document.removeEventListener('click', onClickInit);
    }, { once: true });

    // MutationObserver: detecta interacciones entrantes
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.addedNodes.length === 0) continue;
        for (var j = 0; j < m.addedNodes.length; j++) {
          var result = detectContactInteraction(m.addedNodes[j]);
          if (result) startRiskTimer(result.contactId, result.clientName);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Click en botón de enviar → operador respondió
    document.addEventListener('click', function (e) {
      var sendBtn = e.target.closest('button[class*="send"], button[class*="enviar"], [type="submit"], [class*="btn-send"], [class*="btn-enviar"], a[class*="send"]');
      if (sendBtn) setTimeout(onOperatorResponded, 300);
    });

    // Enter en input de chat → operador respondió
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        var active = document.activeElement;
        if (active && (active.matches('textarea, input[type="text"], [contenteditable="true"]'))) {
          setTimeout(onOperatorResponded, 300);
        }
      }
    });

    startPolling();
  }

  window.onOperatorResponded = onOperatorResponded;
  window.startRiskTimer = startRiskTimer;
  window.clearRiskTimer = clearRiskTimer;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReminder);
  } else {
    initReminder();
  }
})();