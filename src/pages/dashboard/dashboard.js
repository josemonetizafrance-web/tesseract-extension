(function () {
  const TESSERACT_API = 'https://tesseract-jblo.onrender.com';

  function formatTime(ms) {
    if (ms <= 0 || ms === Infinity) return ms === Infinity ? 'Ilimitado' : 'Expirado';
    var d = Math.floor(ms / 86400000);
    var h = Math.floor((ms % 86400000) / 3600000);
    return d > 0 ? d + ' d\u00edas ' + h + ' horas' : h + ' horas';
  }

  chrome.storage.local.get(['tess_jwt', 'user_email'], async function (data) {
    if (!data.tess_jwt || !data.user_email) {
      window.location.href = chrome.runtime.getURL('src/pages/login/login.html');
      return;
    }

    try {
      const res = await fetch(`${TESSERACT_API}/api/tess/auth/verify`, {
        headers: { 'Authorization': 'Bearer ' + data.tess_jwt }
      });
      if (!res.ok) {
        await chrome.storage.local.remove('tess_jwt');
        window.location.href = chrome.runtime.getURL('src/pages/login/login.html');
        return;
      }
      const authData = await res.json();
      document.getElementById('user-info').textContent = authData.email;

      var status = authData.subscription?.status || 'expired';
      var remaining = authData.subscription?.timeRemaining || 0;

      var badge = document.getElementById('status-badge');
      badge.textContent = status.toUpperCase();
      badge.className = 'status-badge status-' + status;

      var timeEl = document.getElementById('time-remaining');
      if (remaining > 0 && remaining !== Infinity && remaining < 999999999999990) {
        timeEl.textContent = 'Tiempo restante: ' + formatTime(remaining);
      } else if (remaining === Infinity || remaining >= 999999999999990) {
        timeEl.textContent = 'Acceso ilimitado';
      } else {
        timeEl.textContent = 'Tu acceso ha expirado';
        timeEl.style.color = '#ef4444';
      }

      if (authData.isAdmin || authData.isDeveloper) {
        document.getElementById('btn-admin').style.display = 'inline-block';
      }
    } catch (e) {
      document.getElementById('user-info').textContent = data.user_email + ' (sin conexión)';
    }

    document.getElementById('btn-open-bot').addEventListener('click', function () {
      chrome.tabs.create({ url: 'https://talkytimes.com/', active: true });
    });
    document.getElementById('btn-admin').addEventListener('click', function () {
      const token = data.tess_jwt;
      if (token) {
        window.open(chrome.runtime.getURL('src/pages/admin/admin.html') + '?token=' + encodeURIComponent(token), '_blank');
      } else {
        window.open(chrome.runtime.getURL('src/pages/admin/admin.html'), '_blank');
      }
    });
    document.getElementById('btn-logout').addEventListener('click', function () {
      chrome.storage.local.clear();
      window.location.href = chrome.runtime.getURL('src/pages/login/login.html');
    });

    // Support button handlers
    const supportModal = document.getElementById('support-modal');
    document.getElementById('btn-support').addEventListener('click', function () {
      supportModal.style.display = 'flex';
      document.getElementById('support-status').textContent = '';
    });
    document.getElementById('btn-close-support').addEventListener('click', function () {
      supportModal.style.display = 'none';
    });
    document.getElementById('btn-send-support').addEventListener('click', async function () {
      const subject = document.getElementById('support-subject').value.trim();
      const message = document.getElementById('support-message').value.trim();
      const statusEl = document.getElementById('support-status');
      
      if (!message) {
        statusEl.textContent = '⚠️ Escribe un mensaje';
        return;
      }
      
      this.textContent = 'Enviando...';
      this.disabled = true;
      
      try {
        const res = await fetch(`${TESSERACT_API}/api/tess/support/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: data.user_email, 
            subject: subject || 'Consulta de usuario',
            message: message 
          })
        });
        const result = await res.json();
        if (res.ok) {
          statusEl.textContent = '✅ Mensaje enviado! El administrador te contactará.';
          document.getElementById('support-message').value = '';
          document.getElementById('support-subject').value = '';
          setTimeout(() => supportModal.style.display = 'none', 2000);
        } else {
          statusEl.textContent = '❌ ' + (result.error || 'Error al enviar');
        }
      } catch (err) {
        statusEl.textContent = '❌ Error de conexión';
      }
      
      this.textContent = 'Enviar';
      this.disabled = false;
    });
  });
})();
