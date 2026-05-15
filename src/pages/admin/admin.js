// admin.js - TESSERACT v24.0
const TESSERACT_API = 'https://tesseract-jblo.onrender.com';

let currentToken = '';
let currentAdminEmail = '';
let userOffice = '';
let isOfficeAdmin = false;
let metricsErrorCount = 0;
let refreshIntervalId = null;

function apiFetch(endpoint, options = {}) {
  const method = options.method || 'GET';
  const headers = {
    'Authorization': `Bearer ${currentToken}`,
    'Content-Type': 'application/json'
  };
  const fetchOptions = { method, headers };
  if (options.body) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }
  
  return fetch(`${TESSERACT_API}${endpoint}`, fetchOptions).then(async res => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Error ${res.status}`);
    }
    return res.json();
  }).catch(e => {
    console.error('[ADMIN] API Error:', e.message);
    throw e;
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const encodedToken = urlParams.get('token');
  currentToken = encodedToken ? decodeURIComponent(encodedToken) : '';
  
  if (!currentToken) {
    window.location.href = chrome.runtime.getURL('src/pages/login/login.html');
    return;
  }
  
  try {
    await initAdminPanel();
  } catch(e) {
    console.error('[ADMIN] Init error:', e);
    document.body.innerHTML = `<div style="padding:40px;color:#ef4444;font-family:monospace;background:#0a0a0f;min-height:100vh;">Error: ${e.message}</div>`;
  }
});

async function initAdminPanel() {
  try {
    const data = await apiFetch('/api/tess/auth/verify');
    if (!data || (!data.isAdmin && !data.isDeveloper && !data.isOfficeAdmin)) {
      document.body.innerHTML = `
        <div style="padding:40px;text-align:center;color:#ef4444;font-family:monospace;background:#0a0a0f;min-height:100vh;">
          <h1>⛔ SIN ACCESO</h1>
          <p style="color:#888;margin:20px 0;">No tienes permisos de administrador.</p>
        </div>
      `;
      return;
    }

    currentAdminEmail = data.email;
    userOffice = data.office;
    isOfficeAdmin = data.isOfficeAdmin;
    // Master admin es Developer en el servidor
    const isMasterAdmin = data.isDeveloper === true || data.isAdmin === true;
    
    document.getElementById('admin-email').textContent = data.email;

    // Crear oficinas solo admin maestro
    if (!isMasterAdmin) {
      document.getElementById('create-office-section').style.display = 'none';
      document.getElementById('create-user-section').style.display = 'none';
    }

    // Storage Debug solo para admin maestro
    if (isMasterAdmin) {
      document.getElementById('storage-debug-section').style.display = 'block';
    }

    // Mostrar usuarios para todos (no solo admin maestro)
    document.getElementById('user-management-section').style.display = 'block';
    document.getElementById('dev-section').style.display = isMasterAdmin ? 'block' : 'none';

    // Si es office admin, automáticamente filtra por su oficina
    if (isOfficeAdmin && userOffice) {
      document.getElementById('office-filter').value = userOffice;
      document.getElementById('office-filter').disabled = true;
    }

    await loadOffices();
    await loadOfficesList();
    await populateCalendarOfficeFilter();

    document.getElementById('office-filter').addEventListener('change', async () => {
      const office = document.getElementById('office-filter').value;
      await loadMetrics(office);
      await loadUserList(office);
      await loadActivityLog(office);
    });

    document.getElementById('btn-refresh').addEventListener('click', () => { 
      const office = document.getElementById('office-filter').value;
      loadMetrics(office); loadUserList(office); loadActivityLog(office); 
    });
    document.getElementById('btn-logout').addEventListener('click', async () => {
      await chrome.storage.local.clear();
      window.location.href = chrome.runtime.getURL('src/pages/login/login.html');
    });
    document.getElementById('btn-activate-premium').addEventListener('click', activatePremium);
    document.getElementById('btn-ban-user').addEventListener('click', banUser);
    document.getElementById('btn-unban-user').addEventListener('click', unbanUser);
    document.getElementById('btn-change-password').addEventListener('click', changePassword);
    document.getElementById('btn-add-dev').addEventListener('click', addDeveloper);
    document.getElementById('btn-dump-storage').addEventListener('click', dumpStorage);
    document.getElementById('btn-test-write').addEventListener('click', testWriteToStorage);
    document.getElementById('btn-clear-debug').addEventListener('click', () => {
      document.getElementById('storage-debug-container').textContent = 'Haz clic en DUMP STORAGE';
    });
    document.getElementById('btn-create-user').addEventListener('click', createUser);
    document.getElementById('btn-create-office').addEventListener('click', createOffice);
    document.getElementById('btn-load-calendar').addEventListener('click', loadCalendar);

    await loadMetrics();
    await loadUserList();
    await loadActivityLog();
    if (refreshIntervalId) clearInterval(refreshIntervalId);
    refreshIntervalId = setInterval(() => { 
      const office = document.getElementById('office-filter').value;
      loadMetrics(office); loadActivityLog(office); 
    }, 5000);

  } catch (e) {
    console.error('[ADMIN] initAdminPanel Error:', e);
    document.body.innerHTML = `
      <div id="error-container" style="padding:40px;color:#ef4444;font-family:monospace;background:#0a0a0f;min-height:100vh;">
        <h2 style="color:#ef4444;">ERROR EN ADMIN PANEL</h2>
        <p style="color:#fca5a5;margin:16px 0;">${e.message}</p>
        <p style="color:#888;font-size:12px;margin-top:20px;">Revisa la consola (F12) para más detalles.</p>
        <button id="btn-error-login" style="margin-top:20px;padding:10px 20px;background:#8b5cf6;border:none;border-radius:4px;color:#fff;cursor:pointer;">IR AL LOGIN</button>
      </div>`;
    document.getElementById('btn-error-login').addEventListener('click', () => {
      window.location.href = chrome.runtime.getURL('src/pages/login/login.html');
    });
  }
}

async function loadOffices() {
  try {
    const data = await apiFetch('/api/tess/admin/offices');
    const select = document.getElementById('office-filter');
    select.innerHTML = '<option value="all">Todas las oficinas</option>';
    if (data.offices && data.offices.length > 0) {
      data.offices.forEach(office => {
        const name = office.name || office;
        select.innerHTML += `<option value="${name}">${name}</option>`;
      });
      console.log('[ADMIN] Oficinas cargadas:', data.offices.length);
    } else {
      console.warn('[ADMIN] No hay oficinas registradas en el servidor');
    }
  } catch (e) { 
    console.error('[ADMIN] Error al cargar oficinas:', e.message);
    alert('Error al cargar oficinas: ' + e.message);
  }
}

async function loadOfficesList() {
  try {
    const data = await apiFetch('/api/tess/admin/offices');
    const container = document.getElementById('offices-list');
    if (!container) return;
    if (!data.offices || !data.offices.length) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Sin oficinas registradas</div>';
      return;
    }
    container.innerHTML = data.offices.map(o => {
      const name = o.name || o;
      return `<button class="office-btn" data-office="${name}" style="background:rgba(245,158,11,0.15);border:1px solid #f59e0b;border-radius:6px;padding:12px 16px;text-align:center;cursor:pointer;font-family:inherit;color:#f59e0b;font-size:14px;font-weight:700;transition:all 0.2s;" onmouseover="this.style.background='rgba(245,158,11,0.3)'" onmouseout="this.style.background='rgba(245,158,11,0.15)'">${name}</button>`;
    }).join('');

    container.querySelectorAll('.office-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const office = btn.dataset.office;
        document.getElementById('office-filter').value = office;
        const userSection = document.getElementById('user-management-section');
        if (userSection) userSection.style.display = 'block';
        document.getElementById('btn-refresh').click();
        setTimeout(() => {
          document.querySelector('.user-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 500);
      });
    });
  } catch (e) { console.warn('[ADMIN] loadOfficesList:', e); }
}

async function loadMetrics(office = 'all') {
  try {
    const query = office && office !== 'all' ? `?office=${encodeURIComponent(office)}` : '';
    const data = await apiFetch(`/api/tess/admin/metrics${query}`);
    if (!data) return;
    metricsErrorCount = 0;
    document.getElementById('metric-active-users').textContent = data.users?.active || 0;
    document.getElementById('metric-demo-users').textContent = data.users?.demo || 0;
    document.getElementById('metric-premium-users').textContent = data.users?.premium || 0;
    document.getElementById('metric-developer-users').textContent = data.users?.developers || 0;
    document.getElementById('metric-today-sessions').textContent = data.users?.active || 0;
    document.getElementById('metric-likes').textContent = data.today?.likes || 0;
    document.getElementById('metric-follows').textContent = data.today?.follows || 0;
    document.getElementById('metric-auto-response').textContent = data.today?.auto_response || 0;
    document.getElementById('metric-mailing').textContent = data.today?.mailing || 0;
    document.getElementById('metric-sweeps').textContent = data.today?.sweeps || 0;
    document.getElementById('metric-total-ids').textContent = data.today?.ids_captured || 0;
    const month = new Date().toISOString().slice(0, 7);
    document.getElementById('month-label').textContent = month;
    document.getElementById('metric-month-likes').textContent = data.month?.likes || 0;
    document.getElementById('metric-month-follows').textContent = data.month?.follows || 0;
    document.getElementById('metric-month-auto-response').textContent = data.month?.auto_response || 0;
    document.getElementById('metric-month-mailing').textContent = data.month?.mailing || 0;
    document.getElementById('metric-month-sweeps').textContent = data.month?.sweeps || 0;
    document.getElementById('metric-month-sweeps').textContent = data.month?.sweeps || 0;
  } catch (e) {
    metricsErrorCount++;
    if (metricsErrorCount <= 3) console.error('[ADMIN] loadMetrics:', e);
  }
}

async function loadUserList(office = 'all') {
  try {
    const query = office && office !== 'all' ? `?office=${encodeURIComponent(office)}` : '';
    const data = await apiFetch(`/api/tess/admin/users${query}`);
    if (!data?.users) {
      console.warn('[ADMIN] No se recibieron usuarios del servidor');
      return;
    }
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = '';

    if (!data.users.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-msg">Sin usuarios</td></tr>';
      console.log('[ADMIN] Usuarios cargados: 0');
      return;
    }

    console.log('[ADMIN] Usuarios cargados:', data.users.length);
    data.users.forEach(u => {
      const isMaster = u.is_developer === 1 || u.is_developer === true;
      let statusText = u.role, statusClass = 'status-demo';
      if (isMaster || u.is_developer) { statusText = 'DESARROLLADOR'; statusClass = 'status-premium'; }
      else if (u.role === 'premium') { statusText = 'PREMIUM'; statusClass = 'status-premium'; }
      else if (u.is_banned) { statusText = 'BANEADO'; statusClass = 'status-banned'; }
      else if (u.role === 'expired') { statusText = 'EXPIRADO'; statusClass = 'status-expired'; }

      const officeLabel = u.office || '—';
      const activeLabel = (u.is_banned || u.role === 'expired') ? 'INACTIVO' : 'ACTIVO';
      const activeColor = (u.is_banned || u.role === 'expired') ? '#ef4444' : '#22c55e';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td><span style="color:#f59e0b;">${officeLabel}</span><br><small style="color:${activeColor};">${activeLabel}</small></td>
        <td>${u.email}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>••••••••</td>
        <td>${u.login_count || 0}</td>
        <td>${u.last_login ? new Date(u.last_login).toLocaleString() : 'Nunca'}</td>
        <td>${!isMaster ? `<button class="action-btn premium btn-premium" data-email="${u.email}">PREMIUM</button>` : ''}</td>
        <td><input type="text" class="input-field plan-input" data-email="${u.email}" placeholder="plan..." style="width:80px;padding:4px 6px;font-size:10px;">
            <button class="action-btn premium btn-set-plan" data-email="${u.email}" style="padding:4px 8px;">SET</button></td>`;
      tbody.appendChild(row);
    });

    tbody.addEventListener('click', async (e) => {
      const target = e.target.closest('button');
      if (!target) return;
      const email = target.dataset.email;
      if (!email) return;
      if (target.classList.contains('btn-premium')) {
        await apiFetch('/api/tess/admin/premium', { method: 'POST', body: { email } });
        await loadMetrics(); await loadUserList();
      }
      if (target.classList.contains('btn-set-plan')) {
        const plan = target.closest('tr').querySelector('.plan-input').value.trim().toLowerCase();
        if (!plan) return;
        await apiFetch('/api/tess/admin/set-plan', { method: 'POST', body: { email, plan } });
        await loadUserList();
      }
    });
  } catch (e) { console.error('[ADMIN] loadUserList:', e); }
}

async function loadActivityLog(office = 'all') {
  try {
    const container = document.getElementById('log-container');
    if (!container) return;
    
    const query = office && office !== 'all' ? `&office=${encodeURIComponent(office)}` : '';
    const data = await apiFetch(`/api/tess/admin/activity-log?limit=50${query}`);
    
    container.innerHTML = '';
    if (!data?.logs?.length) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#555;">Sin actividad</div>';
      return;
    }
    
    let html = '<div style="display:grid;grid-template-columns:100px 1fr 100px 120px;gap:4px;font-size:10px;color:#8b5cf6;padding:6px 8px;border-bottom:1px solid #333;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;"><span>OFICINA</span><span>OPERADOR / ACCIÓN</span><span>FECHA</span><span>HORA</span></div>';
    
    data.logs.forEach(entry => {
      const ts = entry.created_at ? new Date(entry.created_at) : new Date();
      const dateStr = ts.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
      const timeStr = ts.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const officeName = entry.office || '—';
      const operator = entry.email || '—';
      const action = entry.action || '';
      const actionType = entry.action_type ? ` (${entry.action_type})` : '';
      
      html += `<div style="display:grid;grid-template-columns:100px 1fr 100px 120px;gap:4px;padding:8px;border-bottom:1px solid #222;font-size:11px;color:#aaa;align-items:start;">
        <span style="color:#f59e0b;font-weight:500;">${officeName}</span>
        <div><span style="color:#fff;">${operator}</span><br><span style="color:#ccc;font-size:10px;">${action}${actionType}</span></div>
        <span style="color:#888;">${dateStr}</span>
        <span style="color:#8b5cf6;">${timeStr}</span>
      </div>`;
    });
    container.innerHTML = html;
  } catch (e) { 
    const container = document.getElementById('log-container');
    if (container) container.innerHTML = '<div style="padding:20px;color:#ef4444;">Error: ' + e.message + '</div>';
  }
}

async function activatePremium() {
  const email = document.getElementById('input-email').value.trim().toLowerCase();
  if (!email) return;
  try {
    await apiFetch('/api/tess/admin/premium', { method: 'POST', body: { email } });
    document.getElementById('input-email').value = '';
    await loadMetrics(); await loadUserList();
  } catch (e) { alert('Error: ' + e.message); }
}

async function banUser() {
  const email = document.getElementById('input-email').value.trim().toLowerCase();
  if (!email) return;
  try {
    await apiFetch('/api/tess/admin/ban', { method: 'POST', body: { email } });
    document.getElementById('input-email').value = '';
    await loadUserList();
  } catch (e) { alert(e.message); }
}

async function unbanUser() {
  const email = document.getElementById('input-email').value.trim().toLowerCase();
  if (!email) return;
  try {
    await apiFetch('/api/tess/admin/unban', { method: 'POST', body: { email } });
    document.getElementById('input-email').value = '';
    await loadUserList();
  } catch (e) { alert(e.message); }
}

async function changePassword() {
  const email = document.getElementById('input-email').value.trim().toLowerCase();
  const password = document.getElementById('new-password-input').value.trim();
  if (!email) return alert('Ingresa el email');
  if (!password) return alert('Ingresa la nueva contraseña');
  if (!password.endsWith('*+')) return alert('La contraseña debe terminar en *+');
  try {
    await apiFetch('/api/tess/admin/set-password', { method: 'POST', body: { email, password } });
    document.getElementById('input-email').value = '';
    document.getElementById('new-password-input').value = '';
    alert('Contraseña actualizada correctamente');
  } catch (e) { alert(e.message); }
}

async function addDeveloper() {
  const email = document.getElementById('input-dev-email').value.trim().toLowerCase();
  if (!email) return;
  try {
    await apiFetch('/api/tess/admin/developer', { method: 'POST', body: { email, action: 'add' } });
    document.getElementById('input-dev-email').value = '';
    await loadUserList();
  } catch (e) { alert(e.message); }
}

async function testWriteToStorage() {
  const container = document.getElementById('storage-debug-container');
  try {
    const res = await fetch(`${TESSERACT_API}/api/health`);
    const data = await res.json();
    container.textContent = '✅ Servidor OK: ' + new Date().toLocaleTimeString() + '\n' + JSON.stringify(data, null, 2);
  } catch (e) { container.textContent = '❌ Error: ' + e.message; }
}

async function dumpStorage() {
  const container = document.getElementById('storage-debug-container');
  container.textContent = 'Cargando...';
  try {
    const allData = await chrome.storage.local.get(null);
    let output = '=== chrome.storage.local (' + Object.keys(allData).length + ' claves) ===\n\n';
    Object.keys(allData).sort().forEach(key => {
      let val = allData[key];
      let str = '';
      try {
        if (typeof val === 'object') str = JSON.stringify(val, null, 2);
        else if (typeof val === 'string' && val.length > 500) str = val.slice(0, 500) + '...';
        else str = String(val);
      } catch (e) { str = '[Error]'; }
      output += key + ':\n' + str + '\n\n';
    });
    container.textContent = output;
  } catch (e) { container.textContent = '❌ ' + e.message; }
}

async function createUser() {
  const email = document.getElementById('new-user-email')?.value?.trim().toLowerCase();
  const password = document.getElementById('new-user-password')?.value?.trim();
  const office = document.getElementById('new-user-office')?.value?.trim();
  const userType = document.getElementById('new-user-type')?.value || 'operador';
  
  if (!email) return alert('Ingresa el email');
  if (!password) return alert('Ingresa la contraseña');
  if (!email.endsWith('@tesseract.com')) return alert('Solo correos @tesseract.com');
  if (!password.endsWith('*+')) return alert('La contraseña debe terminar en *+');
  
  try {
    console.log('[ADMIN] Creando usuario:', email, 'oficina:', office, 'tipo:', userType);
    const result = await apiFetch('/api/tess/admin/create-user', {
      method: 'POST',
      body: { email, password, office, userType }
    });
    
    console.log('[ADMIN] Respuesta create-user:', result);
    alert(`Usuario ${userType === 'admin' ? 'ADMIN' : 'OPERADOR'} creado correctamente`);
    document.getElementById('new-user-email').value = '';
    document.getElementById('new-user-password').value = '';
    document.getElementById('new-user-office').value = '';
    document.getElementById('new-user-type').value = 'operador';
    await loadUserList();
    await loadOffices();
  } catch (e) { 
    console.error('[ADMIN] Error al crear usuario:', e);
    alert('Error al crear usuario: ' + e.message); 
  }
}

async function createOffice() {
  const name = document.getElementById('new-office-name')?.value?.trim();
  if (!name) return alert('Ingresa el nombre de la oficina');
  
  try {
    console.log('[ADMIN] Creando oficina:', name);
    const result = await apiFetch('/api/tess/admin/create-office', {
      method: 'POST',
      body: { name }
    });
    console.log('[ADMIN] Respuesta create-office:', result);
    alert('Oficina creada correctamente');
    document.getElementById('new-office-name').value = '';
    await loadOffices();
    await loadOfficesList();
  } catch (e) { 
    console.error('[ADMIN] Error al crear oficina:', e);
    alert('Error al crear oficina: ' + e.message); 
  }
}

async function loadCalendar() {
  const office = document.getElementById('calendar-office-filter').value;
  const days = document.getElementById('calendar-days').value;
  const grid = document.getElementById('calendar-grid');
  
  grid.innerHTML = '<div class="calendar-row" style="justify-content:center;padding:30px;color:#555;">Cargando...</div>';
  
  try {
    const query = office && office !== 'all' ? `?office=${encodeURIComponent(office)}&days=${days}` : `?days=${days}`;
    const data = await apiFetch(`/api/tess/admin/metrics-daily${query}`);
    
    if (!data?.dailyMetrics?.length) {
      grid.innerHTML = `
        <div class="calendar-row header-row">
          <div class="calendar-cell date-cell">FECHA</div>
          <div class="calendar-cell metric-cell">LIKES</div>
          <div class="calendar-cell metric-cell">FOLLOWS</div>
          <div class="calendar-cell metric-cell">AUTO-RESP</div>
          <div class="calendar-cell metric-cell">MAILING</div>
          <div class="calendar-cell total-cell">TOTAL</div>
        </div>
        <div class="calendar-row empty-row">No hay datos para el período seleccionado</div>`;
      return;
    }
    
    grid.innerHTML = `
      <div class="calendar-row header-row">
        <div class="calendar-cell date-cell">FECHA</div>
        <div class="calendar-cell metric-cell">LIKES</div>
        <div class="calendar-cell metric-cell">FOLLOWS</div>
        <div class="calendar-cell metric-cell">AUTO-RESP</div>
        <div class="calendar-cell metric-cell">MAILING</div>
        <div class="calendar-cell total-cell">TOTAL</div>
      </div>
      ${data.dailyMetrics.map(m => {
        const total = (m.likes || 0) + (m.follows || 0) + (m.auto_response || 0) + (m.mailing || 0);
        return `
          <div class="calendar-row">
            <div class="calendar-cell date-cell">${m.date}</div>
            <div class="calendar-cell metric-cell likes">${m.likes || 0}</div>
            <div class="calendar-cell metric-cell follows">${m.follows || 0}</div>
            <div class="calendar-cell metric-cell auto_response">${m.auto_response || 0}</div>
            <div class="calendar-cell metric-cell mailing">${m.mailing || 0}</div>
            <div class="calendar-cell total-cell">${total}</div>
          </div>
        `;
      }).join('')}`;
    
  } catch (e) {
    grid.innerHTML = `<div class="calendar-row empty-row">Error: ${e.message}</div>`;
  }
}

async function populateCalendarOfficeFilter() {
  try {
    const data = await apiFetch('/api/tess/admin/offices');
    const select = document.getElementById('calendar-office-filter');
    select.innerHTML = '<option value="all">Todas las oficinas</option>';
    if (data.offices) {
      data.offices.forEach(office => {
        const name = office.name || office;
        select.innerHTML += `<option value="${name}">${name}</option>`;
      });
    }
  } catch (e) { console.warn('[ADMIN] populateCalendarOfficeFilter:', e); }
}
