// TESSERACT v24 - Smart Mailing Panel UI
// Fixado: guardado robusto con feedback visual y acceso global a funciones

function showMLSavedFeedback() {
  const btn = document.getElementById('mlSaveBtn');
  if (btn) {
    const original = btn.textContent;
    btn.textContent = '✅ ¡GUARDADO!';
    btn.className = 'primary';
    btn.style.background = '#4CAF50';
    btn.style.borderColor = '#4CAF50';
    btn.style.color = '#fff';
    setTimeout(() => {
      btn.textContent = original;
      btn.className = '';
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 2000);
  }
}

function showAAFeedback() {
  const btn = document.getElementById('aaSaveBtn');
  if (btn) {
    const original = btn.textContent;
    btn.textContent = '✅ ¡GUARDADO!';
    btn.className = '';
    btn.style.background = '#4CAF50';
    btn.style.borderColor = '#4CAF50';
    btn.style.color = '#fff';
    setTimeout(() => {
      btn.textContent = original;
      btn.className = 'primary';
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 2000);
  }
}

// ============ SMART MAILING PANEL ============
function createMailingPanel() {
  if (document.getElementById('mailingModal')) return;

  const m = document.createElement('div');
  m.id = 'mailingModal';
  m.innerHTML = `
<style>
#mailingModal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999999;display:none;width:580px;max-height:88vh;background:#0a0a0a;border:2px solid #8b5cf6;border-radius:12px;box-shadow:0 0 40px rgba(139,92,246,0.5);color:#e0e0e0;font-family:'Orbitron','Segoe UI',sans-serif;overflow:hidden;display:flex;flex-direction:column;}
.ml-hdr{background:linear-gradient(135deg,#1e1b4b,#8b5cf6,#1e1b4b);padding:12px 16px;font-weight:bold;letter-spacing:2px;display:flex;justify-content:space-between;border-bottom:2px solid #8b5cf6;color:#e0e0e0;font-size:13px;cursor:default;}
.ml-hdr span{cursor:pointer;font-size:18px;}
.ml-body{padding:16px;overflow-y:auto;flex:1;}
.ml-body::-webkit-scrollbar{width:4px;}
.ml-body::-webkit-scrollbar-track{background:#0a0a0a;}
.ml-body::-webkit-scrollbar-thumb{background:#8b5cf6;border-radius:2px;}
.ml-section{margin-bottom:14px;padding:10px;background:rgba(30,27,75,0.3);border:1px solid rgba(139,92,246,0.2);border-radius:8px;}
.ml-section h4{font-size:10px;letter-spacing:1px;margin:0 0 8px 0;color:#e0e0e0;text-transform:uppercase;display:flex;align-items:center;gap:6px;}
.ml-section label{display:flex;align-items:center;gap:8px;font-size:10px;letter-spacing:0.5px;color:#ccc;margin:4px 0;cursor:pointer;}
.ml-section input[type="checkbox"]{accent-color:#8b5cf6;width:14px;height:14px;cursor:pointer;}
.ml-section input[type="number"]{width:60px;padding:4px 6px;background:#000;border:1px solid #8b5cf6;border-radius:4px;color:#e0e0e0;font-family:'Share Tech Mono',monospace;font-size:10px;}
.ml-section input[type="text"], .ml-section textarea{width:100%;padding:6px;background:#000;border:1px solid #8b5cf6;border-radius:4px;color:#e0e0e0;font-family:Arial;font-size:11px;box-sizing:border-box;}
.ml-section textarea{height:60px;resize:vertical;}
.ml-section textarea:focus, .ml-section input:focus{outline:none;border-color:#7c3aed;}
.ml-section select{background:#000;border:1px solid #8b5cf6;border-radius:4px;color:#e0e0e0;padding:4px 6px;font-size:10px;width:100%;margin-top:4px;}
.ml-hour-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;}
.ml-hour-row label{font-size:9px;}
.ml-hour-row input{width:40px;}
.ml-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0;}
.ml-stat-card{text-align:center;padding:8px;background:rgba(0,0,0,0.4);border:1px solid rgba(139,92,246,0.2);border-radius:6px;}
.ml-stat-card .val{display:block;font-size:18px;font-weight:900;color:#ffffff;text-shadow:0 0 10px #8b5cf6;}
.ml-stat-card .lbl{font-size:7px;letter-spacing:1px;color:#888;text-transform:uppercase;}
.ml-error{color:#dc2626;font-size:9px;margin:4px 0;padding:6px 10px;background:rgba(220,38,38,0.1);border:1px solid #dc2626;border-radius:4px;display:none;}
.ml-foot{padding:12px;border-top:1px solid #8b5cf6;text-align:right;display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.3);}
.ml-foot .ml-status{font-size:9px;letter-spacing:1px;}
.ml-foot .ml-status .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;}
.ml-foot .ml-status .dot.on{background:#4CAF50;box-shadow:0 0 8px #4CAF50;}
.ml-foot .ml-status .dot.off{background:#666;}
.ml-foot button{padding:8px 16px;border:1px solid #8b5cf6;border-radius:6px;background:rgba(30,27,75,0.7);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px;margin-left:6px;transition:all 0.3s;}
.ml-foot button:hover{background:#7c3aed;color:#fff;}
.ml-foot button.primary{background:#8b5cf6;color:#000;}
.ml-foot button.primary:hover{background:#7c3aed;color:#fff;}
</style>
<div class="ml-box">
<div class="ml-hdr"><span>📬 SMART MAILING v2</span><span id="mlCloseBtn">&times;</span></div>
<div class="ml-body">

  <div class="ml-section">
    <h4>⚙ General</h4>
    <label><input type="checkbox" id="mlEnabledToggle"> Smart Mailing Activado</label>
    <label><input type="checkbox" id="mlUseAIToggle"> Usar AI (Groq API) para mensajes</label>
    <div class="ml-hour-row" style="margin-top:6px;">
      <label><input type="number" id="mlInterval" value="60" min="1" style="width:50px;"> min intervalo</label>
      <label><input type="number" id="mlMaxDaily" value="30" min="0" style="width:50px;"> máx/día</label>
    </div>
    <label style="margin-top:6px;"><input type="checkbox" id="mlRespectHours" checked> Respetar horario laboral</label>
    <div class="ml-hour-row">
      <label>Desde <input type="number" id="mlHourStart" value="8" min="0" max="23">:00</label>
      <label>Hasta <input type="number" id="mlHourEnd" value="22" min="0" max="23">:00</label>
    </div>
  </div>

  <div class="ml-section">
    <h4>📋 Origen de Perfiles</h4>
    <label><input type="checkbox" id="mlUseCollected" checked> IDs recolectados (barrido)</label>
    <div style="padding-left:18px;margin-top:4px;">
      <label><input type="checkbox" class="ml-cat-cb" value="Like" checked> ❤️ Like</label>
      <label><input type="checkbox" class="ml-cat-cb" value="Follow" checked> ➕ Follow</label>
      <label><input type="checkbox" class="ml-cat-cb" value="Saludo" checked> 👋 Saludo</label>
      <label><input type="checkbox" class="ml-cat-cb" value="Cartas"> 📨 Cartas</label>
    </div>
    <label style="margin-top:8px;"><input type="checkbox" id="mlUseManual"> Lista manual de IDs</label>
    <textarea id="mlManualIds" placeholder="Un ID por línea..." style="height:40px;margin-top:4px;display:none;"></textarea>
  </div>

  <div class="ml-section">
    <h4>🌐 Fuentes DOM Talkytimes</h4>
    <p style="font-size:8px;color:#888;">Localiza contactos directamente en la página.</p>
    <label><input type="checkbox" id="mlDomActiveLimits" checked> Active Limits (MAIL)</label>
    <label><input type="checkbox" id="mlDomMessagesActive" checked> Messages - Active</label>
    <label><input type="checkbox" id="mlDomContactList"> Contact List (todos)</label>
  </div>

  <div class="ml-section">
    <h4>💬 Plantilla de Mensaje</h4>
    <textarea id="mlMessageTemplate" placeholder="Escribe la plantilla del mensaje...">Hola! Me encantaría conocerte mejor. ¿Te gustaría conversar un rato?</textarea>
    <p style="font-size:7px;color:#666;">Si AI activo, se generarán variaciones vía Groq API.</p>
  </div>

  <div class="ml-section">
    <h4>📊 Estadísticas</h4>
    <div class="ml-stats">
      <div class="ml-stat-card"><span class="val" id="mlSentTodayVal">0</span><span class="lbl">Hoy</span></div>
      <div class="ml-stat-card"><span class="val" id="mlDailyLimitVal">30</span><span class="lbl">Límite</span></div>
      <div class="ml-stat-card"><span class="val" id="mlQueueVal">0</span><span class="lbl">Cola</span></div>
    </div>
    <div id="mlErrorMsg" class="ml-error"></div>
  </div>

</div>
<div class="ml-foot">
  <div class="ml-status"><span class="dot off" id="mlStatusDot"></span><span id="mlStatusText">INACTIVO</span></div>
  <div>
    <button id="mlSaveBtn" class="primary">💾 GUARDAR</button>
    <button id="mlCloseBtn2">CERRAR</button>
  </div>
</div>
</div>`;
  document.body.appendChild(m);

  // Bind events
  document.getElementById('mlCloseBtn').addEventListener('click', () => mlModal(false));
  document.getElementById('mlCloseBtn2').addEventListener('click', () => mlModal(false));
  document.getElementById('mlUseManual').addEventListener('change', function() {
    document.getElementById('mlManualIds').style.display = this.checked ? 'block' : 'none';
  });

  document.getElementById('mlSaveBtn').addEventListener('click', saveMLPanelConfigWrapper);
}

function mlModal(show) {
  const el = document.getElementById('mailingModal');
  if (el) el.style.display = show ? 'block' : 'none';
}

let mlCfgCache = null;

async function openMLPanel() {
  createMailingPanel();
  mlModal(true);
  mlCfgCache = await _loadMLCfg();
  populateMLPanel();
  setTimeout(updateMLQueueCount, 500);
}

async function _loadMLCfg() {
  try {
    if (typeof window._getMailingConfigDirect === 'function') {
      const cfg = window._getMailingConfigDirect();
      if (cfg) return cfg;
    }
    if (typeof window._loadMailingConfigDirect === 'function') {
      await window._loadMailingConfigDirect();
      return window._getMailingConfigDirect ? window._getMailingConfigDirect() : null;
    }
    // Fallback: raw storage
    const r = await chrome.storage.local.get(['tess_mailing_config']);
    return r.tess_mailing_config || null;
  } catch (e) {
    console.error('[ML-PANEL] Load error:', e);
    return null;
  }
}

function populateMLPanel() {
  const cfg = mlCfgCache || getDefaultMailingConfig();

  document.getElementById('mlEnabledToggle').checked = !!cfg.enabled;
  document.getElementById('mlUseAIToggle').checked = !!cfg.useAI;
  document.getElementById('mlInterval').value = cfg.intervalMinutes || 60;
  document.getElementById('mlMaxDaily').value = cfg.maxDaily || 30;
  document.getElementById('mlRespectHours').checked = cfg.respectQuietHours !== false;
  document.getElementById('mlHourStart').value = cfg.workingHours?.start ?? 8;
  document.getElementById('mlHourEnd').value = cfg.workingHours?.end ?? 22;
  document.getElementById('mlUseCollected').checked = cfg.sources?.useCollectedIds !== false;
  document.getElementById('mlUseManual').checked = cfg.sources?.useManualList || false;
  document.getElementById('mlManualIds').value = (cfg.sources?.manualIds || []).join('\n');
  document.getElementById('mlManualIds').style.display = cfg.sources?.useManualList ? 'block' : 'none';
  document.getElementById('mlDomActiveLimits').checked = cfg.sources?.domSources?.includes('active-limits');
  document.getElementById('mlDomMessagesActive').checked = cfg.sources?.domSources?.includes('messages-active');
  document.getElementById('mlDomContactList').checked = cfg.sources?.domSources?.includes('contact-list');

  const cats = cfg.sources?.targetCategories || ['Like', 'Follow', 'Saludo'];
  document.querySelectorAll('.ml-cat-cb').forEach(cb => cb.checked = cats.includes(cb.value));
  document.getElementById('mlMessageTemplate').value = cfg.messageTemplate || '';
  document.getElementById('mlSentTodayVal').textContent = cfg.sentToday || 0;
  document.getElementById('mlDailyLimitVal').textContent = cfg.maxDaily || 30;
  updateMLStatusBar(cfg.enabled);
  updateMLQueueCount();
}

async function saveMLPanelConfigWrapper() {
  const errEl = document.getElementById('mlErrorMsg');
  errEl.style.display = 'none';
  try {
    const cfg = mlCfgCache || {};
    cfg.enabled = !!document.getElementById('mlEnabledToggle').checked;
    cfg.useAI = !!document.getElementById('mlUseAIToggle').checked;
    cfg.intervalMinutes = parseInt(document.getElementById('mlInterval').value) || 60;
    cfg.maxDaily = parseInt(document.getElementById('mlMaxDaily').value) || 30;
    cfg.respectQuietHours = !!document.getElementById('mlRespectHours').checked;
    cfg.workingHours = { start: parseInt(document.getElementById('mlHourStart').value) || 8, end: parseInt(document.getElementById('mlHourEnd').value) || 22 };
    cfg.sources = cfg.sources || {};
    cfg.sources.useCollectedIds = !!document.getElementById('mlUseCollected').checked;
    cfg.sources.useManualList = !!document.getElementById('mlUseManual').checked;
    cfg.sources.manualIds = document.getElementById('mlManualIds').value.split('\n').map(s => s.trim()).filter(Boolean);
    cfg.sources.targetCategories = Array.from(document.querySelectorAll('.ml-cat-cb:checked')).map(c => c.value);
    cfg.sources.domSources = [];
    if (document.getElementById('mlDomActiveLimits').checked) cfg.sources.domSources.push('active-limits');
    if (document.getElementById('mlDomMessagesActive').checked) cfg.sources.domSources.push('messages-active');
    if (document.getElementById('mlDomContactList').checked) cfg.sources.domSources.push('contact-list');
    cfg.messageTemplate = document.getElementById('mlMessageTemplate').value;

    // Guardar vía accesor global
    if (typeof window._saveMailingConfigDirect === 'function') {
      mlCfgCache = cfg;
      // Actualizar el objeto global mailingConfig con los valores del formulario
      if (typeof window._getMailingConfigDirect === 'function') {
        const globalMailing = window._getMailingConfigDirect();
        Object.assign(globalMailing, cfg);
      }
      await window._saveMailingConfigDirect();
    } else {
      await chrome.storage.local.set({ tess_mailing_config: cfg });
    }

    showMLSavedFeedback();
    updateMLStatusBar(cfg.enabled);
    updateMLQueueCount();
    console.log('[ML-PANEL] ✅ Config saved');
  } catch (e) {
    console.error('[ML-PANEL] Save error:', e);
    errEl.textContent = '❌ Error: ' + (e.message || 'desconocido');
    errEl.style.display = 'block';
  }
}

function getDefaultMailingConfig() {
  return { enabled: false, intervalMinutes: 60, maxDaily: 30, sentToday: 0, messageTemplate: '', useAI: false, respectQuietHours: true, workingHours: { start: 8, end: 22 }, sources: { useCollectedIds: true, useManualList: false, manualIds: [], domSources: ['active-limits'], targetCategories: ['Like','Follow','Saludo'] } };
}

function updateMLStatusBar(enabled) {
  const dot = document.getElementById('mlStatusDot');
  const text = document.getElementById('mlStatusText');
  if (dot) dot.className = 'dot ' + (enabled ? 'on' : 'off');
  if (text) text.textContent = enabled ? 'ACTIVO' : 'INACTIVO';
  // Sync with main panel tab
  const inline = document.getElementById('mlStatusInline');
  if (inline) { inline.textContent = enabled ? 'ACTIVO' : 'INACTIVO'; inline.style.color = enabled ? '#4CAF50' : '#666'; }
}

async function updateMLQueueCount() {
  try {
    const data = await chrome.storage.local.get(['tess_ids']);
    const ids = data.tess_ids || {};
    let total = 0;
    const cats = mlCfgCache?.sources?.targetCategories || ['Like','Follow','Saludo'];
    cats.forEach(c => { total += (ids[c] || []).length; });
    if (mlCfgCache?.sources?.useManualList) total += (mlCfgCache.sources.manualIds || []).length;
    const el = document.getElementById('mlQueueVal');
    if (el) el.textContent = Math.min(total, 999);
    // Sync inline
    const inline = document.getElementById('mlQueueCountInline');
    if (inline) inline.textContent = Math.min(total, 999);
  } catch (e) {}
}