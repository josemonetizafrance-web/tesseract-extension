(function () {
  var TESSERACT_API = 'https://tesseract-jblo.onrender.com';

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
      const contactEmail = document.getElementById('support-email').value.trim();
      const statusEl = document.getElementById('support-status');
      
      if (!message) {
        statusEl.textContent = '⚠️ Escribe un mensaje';
        return;
      }
      
      if (!contactEmail) {
        statusEl.textContent = '⚠️ Ingresa tu email de contacto';
        return;
      }
      
      this.textContent = 'Enviando...';
      this.disabled = true;
      
      console.log('[SUPPORT] Enviando a:', TESSERACT_API);
      console.log('[SUPPORT] Email:', contactEmail);
      console.log('[SUPPORT] JWT:', data.tess_jwt ? 'OK' : 'MISSING');
      
      try {
        const res = await fetch(`${TESSERACT_API}/api/tess/support/message`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + data.tess_jwt
          },
          body: JSON.stringify({ 
            email: contactEmail, 
            subject: subject || 'Consulta de usuario',
            message: message 
          })
        });
        console.log('[SUPPORT] Response status:', res.status);
        if (!res.ok) {
          const errText = await res.text();
          console.log('[SUPPORT] Error response:', errText);
          statusEl.textContent = '❌ Error: ' + res.status;
          this.textContent = 'Enviar';
          this.disabled = false;
          return;
        }
        const result = await res.json();
        console.log('[SUPPORT] Response:', result);
          if (result.success || res.ok) {
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

    // Blacklist handlers
    const blacklistModal = document.getElementById('blacklist-modal');
    document.getElementById('btn-blacklist').addEventListener('click', async function () {
      blacklistModal.style.display = 'flex';
      loadBlacklist();
    });
    document.getElementById('btn-close-blacklist').addEventListener('click', function () {
      blacklistModal.style.display = 'none';
    });

    async function loadBlacklist() {
      const listEl = document.getElementById('blacklist-list');
      listEl.innerHTML = '<p style="color:#666;font-size:11px;">Cargando...</p>';
      try {
        const res = await fetch(`${TESSERACT_API}/api/tess/blacklist`, {
          headers: { 'Authorization': 'Bearer ' + data.tess_jwt }
        });
        const data = await res.json();
        if (res.ok && data.blacklist && data.blacklist.length > 0) {
          listEl.innerHTML = data.blacklist.map(id => 
            `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #333;">
              <span style="font-size:11px;color:#ccc;">${id}</span>
              <button class="btn-remove-bl" data-id="${id}" style="background:#ef4444;color:#fff;border:none;padding:4px 8px;border-radius:2px;font-size:10px;cursor:pointer;">✕</button>
            </div>`
          ).join('');
          document.querySelectorAll('.btn-remove-bl').forEach(btn => {
            btn.addEventListener('click', async function () {
              await removeFromBlacklist(this.dataset.id);
              loadBlacklist();
            });
          });
        } else {
          listEl.innerHTML = '<p style="color:#666;font-size:11px;text-align:center;">No hay contactos en blacklist</p>';
        }
      } catch (e) {
        listEl.innerHTML = '<p style="color:#ef4444;font-size:11px;">Error al cargar</p>';
      }
    }

    async function addToBlacklist(contactId) {
      const statusEl = document.getElementById('blacklist-status');
      if (!contactId) {
        statusEl.textContent = '⚠️ Ingresa un ID';
        return;
      }
      try {
        const res = await fetch(`${TESSERACT_API}/api/tess/blacklist/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + data.tess_jwt },
          body: JSON.stringify({ contactId })
        });
        if (res.ok) {
          statusEl.textContent = '✅ Agregado a blacklist';
          document.getElementById('blacklist-input').value = '';
          loadBlacklist();
        } else {
          statusEl.textContent = '❌ Error al agregar';
        }
      } catch (e) {
        statusEl.textContent = '❌ Error de conexión';
      }
    }

    async function removeFromBlacklist(contactId) {
      try {
        await fetch(`${TESSERACT_API}/api/tess/blacklist/remove`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + data.tess_jwt },
          body: JSON.stringify({ contactId })
        });
      } catch (e) {}
    }

    document.getElementById('btn-add-blacklist').addEventListener('click', function () {
      const input = document.getElementById('blacklist-input').value.trim();
      addToBlacklist(input);
    });
  });
})();
