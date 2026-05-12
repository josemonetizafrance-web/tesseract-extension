// admin.js - TESSERACT v23.0 (Backend Integrado)
const TESSERACT_API = 'https://tesseract-jblo.onrender.com';

document.addEventListener('DOMContentLoaded', () => initAdminPanel());

let currentAdminEmail = '';
let userOffice = null;
let isOfficeAdmin = false;

async function apiFetch(path, options = {}) {
  const data = await chrome.storage.local.get(['tess_jwt']);
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (data.tess_jwt) headers['Authorization'] = `Bearer ${data.tess_jwt}`;

  const res = await fetch(`${TESSERACT_API}${path}`, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    window.location.href = '/src/pages/login/login.html';
    return null;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.json();
}

async function initAdminPanel() {
  try {
    const data = await apiFetch('/api/tess/auth/verify');
    console.log('[ADMIN] Verify response:', data);
    
    // Permitir acceso si es admin, developer, office admin, o el admin maestro
    const isMasterAdmin = data?.email === 'adminchevy@tesseract.com';
    
    if (!data || (!data.isAdmin && !data.isDeveloper && !data.isOfficeAdmin && !isMasterAdmin)) {
      window.location.href = '/src/pages/login/login.html';
      return;
    }
    
    // Forzar isAdmin true para el admin maestro
    if (isMasterAdmin && !data.isAdmin) {
      data.isAdmin = true;
    }

    currentAdminEmail = data.email;
    userOffice = data.office;
    isOfficeAdmin = data.isOfficeAdmin;
    
    document.getElementById('admin-email').textContent = data.email;

    // Si es office admin, automáticamente filtra por su oficina
    if (isOfficeAdmin && userOffice) {
      document.getElementById('office-filter').value = userOffice;
      document.getElementById('office-filter').disabled = true;
      document.getElementById('btn-create-office').style.display = 'none';
      document.getElementById('create-office-section').style.display = 'none';
    }

    // Solo admin maestro puede agregar desarrolladores
    if (data.email !== 'adminchevy@tesseract.com') {
      document.getElementById('dev-section').style.display = 'none';
    }

    await loadOffices();
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
      window.location.href = '/src/pages/login/login.html';
    });
    document.getElementById('btn-activate-premium').addEventListener('click', activatePremium);
    document.getElementById('btn-ban-user').addEventListener('click', banUser);
    document.getElementById('btn-unban-user').addEventListener('click', unbanUser);
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
    setInterval(() => { 
      const office = document.getElementById('office-filter').value;
      loadMetrics(office); loadActivityLog(office); 
    }, 10000);

  } catch (e) {
    console.error('[ADMIN]', e);
    window.location.href = '/src/pages/login/login.html';
  }
}

async function loadOffices() {
  try {
    const data = await apiFetch('/api/tess/admin/offices');
    const select = document.getElementById('office-filter');
    select.innerHTML = '<option value="all">Todas las oficinas</option>';
    if (data.offices) {
      data.offices.forEach(office => {
        select.innerHTML += `<option value="${office}">${office}</option>`;
      });
    }
  } catch (e) { console.warn('[ADMIN] loadOffices:', e); }
}

async function loadMetrics(office = 'all') {
  try {
    const query = office && office !== 'all' ? `?office=${encodeURIComponent(office)}` : '';
    const data = await apiFetch(`/api/tess/admin/metrics${query}`);
    if (!data) return;
    document.getElementById('metric-active-users').textContent = data.users?.active || 0;
    document.getElementById('metric-demo-users').textContent = data.users?.demo || 0;
    document.getElementById('metric-premium-users').textContent = data.users?.premium || 0;
    document.getElementById('metric-developer-users').textContent = data.users?.developers || 0;
    document.getElementById('metric-today-sessions').textContent = data.users?.active || 0;
    document.getElementById('metric-icebreakers').textContent = data.today?.icebreakers || 0;
    document.getElementById('metric-likes').textContent = data.today?.likes || 0;
    document.getElementById('metric-follows').textContent = data.today?.follows || 0;
    document.getElementById('metric-cartas').textContent = data.today?.cartas || 0;
    document.getElementById('metric-sweeps').textContent = data.today?.sweeps || 0;
    document.getElementById('metric-total-ids').textContent = data.today?.ids_captured || 0;
    const month = new Date().toISOString().slice(0, 7);
    document.getElementById('month-label').textContent = month;
    document.getElementById('metric-month-icebreakers').textContent = data.month?.icebreakers || 0;
    document.getElementById('metric-month-likes').textContent = data.month?.likes || 0;
    document.getElementById('metric-month-follows').textContent = data.month?.follows || 0;
    document.getElementById('metric-month-cartas').textContent = data.month?.cartas || 0;
    document.getElementById('metric-month-sweeps').textContent = data.month?.sweeps || 0;
  } catch (e) { console.error('[ADMIN] loadMetrics:', e); }
}

async function loadUserList(office = 'all') {
  try {
    const query = office && office !== 'all' ? `?office=${encodeURIComponent(office)}` : '';
    const data = await apiFetch(`/api/tess/admin/users${query}`);
    if (!data?.users) return;
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = '';

    if (!data.users.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">Sin usuarios</td></tr>';
      return;
    }

    data.users.forEach(u => {
      const isMaster = u.email === 'adminchevy@tesseract.com';
      let statusText = u.role, statusClass = 'status-demo';
      if (isMaster || u.is_developer) { statusText = 'DESARROLLADOR'; statusClass = 'status-premium'; }
      else if (u.role === 'premium') { statusText = 'PREMIUM'; statusClass = 'status-premium'; }
      else if (u.is_banned) { statusText = 'BANEADO'; statusClass = 'status-banned'; }
      else if (u.role === 'expired') { statusText = 'EXPIRADO'; statusClass = 'status-expired'; }

      const row = document.createElement('tr');
      row.innerHTML = `
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
        await apiFetch('/api/tess/admin/premium', { method: 'POST', body: JSON.stringify({ email }) });
        await loadMetrics(); await loadUserList();
      }
      if (target.classList.contains('btn-set-plan')) {
        const plan = target.closest('tr').querySelector('.plan-input').value.trim().toLowerCase();
        if (!plan) return;
        await apiFetch('/api/tess/admin/set-plan', { method: 'POST', body: JSON.stringify({ email, plan }) });
        await loadUserList();
      }
    });
  } catch (e) { console.error('[ADMIN] loadUserList:', e); }
}

async function loadActivityLog(office = 'all') {
  try {
    const query = office && office !== 'all' ? `&office=${encodeURIComponent(office)}` : '';
    const data = await apiFetch(`/api/tess/admin/activity-log?limit=100${query}`);
    const grid = document.getElementById('activity-grid');
    
    if (!data?.logs?.length) {
      grid.innerHTML = '<div class="activity-row"><div class="activity-cell empty">Sin actividad registrada</div></div>';
      return;
    }
    
    const usersMap = {};
    data.logs.forEach(log => {
      if (!usersMap[log.email]) {
        usersMap[log.email] = { 
          email: log.email,
          saludos: 0, 
          likes: 0, 
          follows: 0, 
          cartas: 0, 
          lastActivity: log.created_at 
        };
      }
      const action = log.action?.toLowerCase() || '';
      const actionType = log.action_type || '';
      
      if (action.includes('saludo') || action.includes('icebreaker') || actionType === 'saludo') {
        usersMap[log.email].saludos++;
      }
      if (action.includes('like') || actionType === 'like') {
        usersMap[log.email].likes++;
      }
      if (action.includes('follow') || actionType === 'follow') {
        usersMap[log.email].follows++;
      }
      if (action.includes('carta') || actionType === 'carta') {
        usersMap[log.email].cartas++;
      }
      
      if (log.created_at > usersMap[log.email].lastActivity) {
        usersMap[log.email].lastActivity = log.created_at;
      }
    });
    
    const users = Object.values(usersMap).sort((a, b) => {
      const totalA = a.saludos + a.likes + a.follows + a.cartas;
      const totalB = b.saludos + b.likes + b.follows + b.cartas;
      return totalB - totalA;
    });
    
    if (users.length === 0) {
      grid.innerHTML = '<div class="activity-row"><div class="activity-cell empty">Sin actividad registrada</div></div>';
      return;
    }
    
    grid.innerHTML = users.map(u => `
      <div class="activity-row">
        <div class="activity-cell email-cell">${u.email}</div>
        <div class="activity-cell metric-cell saludos">${u.saludos}</div>
        <div class="activity-cell metric-cell likes">${u.likes}</div>
        <div class="activity-cell metric-cell follows">${u.follows}</div>
        <div class="activity-cell metric-cell cartas">${u.cartas}</div>
        <div class="activity-cell time-cell">--:--:--</div>
        <div class="activity-cell last-activity">${u.lastActivity ? new Date(u.lastActivity).toLocaleString() : 'Nunca'}</div>
      </div>
    `).join('');
    
  } catch (e) { 
    console.error('[ADMIN] loadActivityLog:', e); 
    const grid = document.getElementById('activity-grid');
    grid.innerHTML = '<div class="activity-row"><div class="activity-cell empty">Error al cargar: ' + e.message + '</div></div>';
  }
}

async function activatePremium() {
  const email = document.getElementById('input-email').value.trim().toLowerCase();
  if (!email) return;
  try {
    await apiFetch('/api/tess/admin/premium', { method: 'POST', body: JSON.stringify({ email }) });
    document.getElementById('input-email').value = '';
    await loadMetrics(); await loadUserList();
  } catch (e) { alert(e.message); }
}

async function banUser() {
  const email = document.getElementById('input-email').value.trim().toLowerCase();
  if (!email) return;
  try {
    await apiFetch('/api/tess/admin/ban', { method: 'POST', body: JSON.stringify({ email }) });
    document.getElementById('input-email').value = '';
    await loadUserList();
  } catch (e) { alert(e.message); }
}

async function unbanUser() {
  const email = document.getElementById('input-email').value.trim().toLowerCase();
  if (!email) return;
  try {
    await apiFetch('/api/tess/admin/unban', { method: 'POST', body: JSON.stringify({ email }) });
    document.getElementById('input-email').value = '';
    await loadUserList();
  } catch (e) { alert(e.message); }
}

async function addDeveloper() {
  const email = document.getElementById('input-dev-email').value.trim().toLowerCase();
  if (!email) return;
  try {
    await apiFetch('/api/tess/admin/developer', { method: 'POST', body: JSON.stringify({ email, action: 'add' }) });
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
    const result = await apiFetch('/api/tess/admin/create-user', {
      method: 'POST',
      body: JSON.stringify({ email, password, office, userType })
    });
    
    alert(`Usuario ${userType === 'admin' ? 'ADMIN' : 'OPERADOR'} creado correctamente`);
    document.getElementById('new-user-email').value = '';
    document.getElementById('new-user-password').value = '';
    document.getElementById('new-user-office').value = '';
    document.getElementById('new-user-type').value = 'operador';
    await loadUserList();
    await loadOffices();
  } catch (e) { alert('Error: ' + e.message); }
}

async function createOffice() {
  const name = document.getElementById('new-office-name')?.value?.trim();
  if (!name) return alert('Ingresa el nombre de la oficina');
  
  try {
    await apiFetch('/api/tess/admin/create-office', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    alert('Oficina creada correctamente');
    document.getElementById('new-office-name').value = '';
    await loadOffices();
  } catch (e) { alert('Error: ' + e.message); }
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
          <div class="calendar-cell metric-cell">SALUDOS</div>
          <div class="calendar-cell metric-cell">LIKES</div>
          <div class="calendar-cell metric-cell">FOLLOWS</div>
          <div class="calendar-cell metric-cell">CARTAS</div>
          <div class="calendar-cell total-cell">TOTAL</div>
        </div>
        <div class="calendar-row empty-row">No hay datos para el período seleccionado</div>`;
      return;
    }
    
    grid.innerHTML = `
      <div class="calendar-row header-row">
        <div class="calendar-cell date-cell">FECHA</div>
        <div class="calendar-cell metric-cell">SALUDOS</div>
        <div class="calendar-cell metric-cell">LIKES</div>
        <div class="calendar-cell metric-cell">FOLLOWS</div>
        <div class="calendar-cell metric-cell">CARTAS</div>
        <div class="calendar-cell total-cell">TOTAL</div>
      </div>
      ${data.dailyMetrics.map(m => {
        const total = (m.saludos || 0) + (m.likes || 0) + (m.follows || 0) + (m.cartas || 0);
        return `
          <div class="calendar-row">
            <div class="calendar-cell date-cell">${m.date}</div>
            <div class="calendar-cell metric-cell saludos">${m.saludos || 0}</div>
            <div class="calendar-cell metric-cell likes">${m.likes || 0}</div>
            <div class="calendar-cell metric-cell follows">${m.follows || 0}</div>
            <div class="calendar-cell metric-cell cartas">${m.cartas || 0}</div>
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
        select.innerHTML += `<option value="${office}">${office}</option>`;
      });
    }
  } catch (e) { console.warn('[ADMIN] populateCalendarOfficeFilter:', e); }
}
