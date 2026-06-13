// TESSERACT v24.0 - Panel UI + Eventos + Auth + Init (extraído de talky-bot-panel.js)

// Fallback: asegurar que _clearMessageSelection exista (definida en talky-eater.js)
if (typeof _clearMessageSelection === 'undefined') {
  function _clearMessageSelection() {
    document.querySelectorAll('.tess-eater-trigger.sel').forEach(function(el) {
      el.classList.remove('sel');
      el.style.border = '';
      el.style.borderRadius = '';
      el.style.padding = '';
      el.style.opacity = '0.5';
    });
    if (typeof _selectedEaterMessages !== 'undefined') _selectedEaterMessages = [];
    if (typeof _updateEaterSelectionUI === 'function') _updateEaterSelectionUI();
  }
}

// ============ FUNCIÓN CENTRAL: Registrar ID en Star Tools ============
function registerIdInStarTools(id, category) {
  if (!id || !/^\d{6,15}$/.test(String(id).trim())) return false;
  id = String(id).trim();
  if (!collectedIds[category]) collectedIds[category] = [];
  if (collectedIds[category].includes(id)) return false;
  
  collectedIds[category].push(id);
  console.log('[STAR-TOOLS] ✅ ID registrado en ' + category + ':', id, '| Total ' + category + ':', collectedIds[category].length);
  
  if (currentTab === 'star') {
    renderStarIds();
  }
  updateStats();
  saveAllStates();
  return true;
}

// ============ INICIALIZACIÓN ============
async function initTesseract() {
  try {
    console.log('[TESSERACT] 🚀 Inicializando sistema...');
  } catch (e) {
    console.error('[TESSERACT] Error en log inicial:', e);
  }

  // Crear panel PRIMERO
  try { createMainPanel(); } catch (e) { console.error('[TESSERACT] createMainPanel:', e); }
  try { initIcebreakers(); } catch (e) { console.error('[TESSERACT] initIcebreakers:', e); }
  try { createSaludosModal(); } catch (e) { console.error('[TESSERACT] createSaludosModal:', e); }
  try { createCartasModal(); } catch (e) { console.error('[TESSERACT] createCartasModal:', e); }
  try { setupAllEvents(); } catch (e) { console.error('[TESSERACT] setupAllEvents:', e); }
  try { await loadAllStates(); } catch (e) { console.error('[TESSERACT] loadAllStates:', e); }
  try { startChatWatcher(); } catch (e) { console.error('[TESSERACT] startChatWatcher:', e); }
  try { startBackgroundIdCapture(); } catch (e) { console.error('[TESSERACT] startBackgroundIdCapture:', e); }
  try { startProfileWatcher(); } catch (e) { console.error('[TESSERACT] startProfileWatcher:', e); }
  try { createCribsOverlay(); } catch (e) { console.error('[TESSERACT] createCribsOverlay:', e); }
  try { startPeriodicSync(); } catch (e) { console.error('[TESSERACT] startPeriodicSync:', e); }
  try {
    var userDisplay = document.getElementById('currentUserDisplay');
    if (userDisplay) userDisplay.textContent = currentUser;
  } catch (e) {}

  // Inicializar módulos v24 (pueden fallar sin afectar el panel)
  try {
    if (typeof initAutoAnswer === 'function') await initAutoAnswer();
  } catch (e) {
    console.error('[TESSERACT] ⚠️ initAutoAnswer falló:', e.message);
  }
  if (typeof updateAATabUI === 'function') updateAATabUI();
  try {
    if (typeof initSmartMailing === 'function') await initSmartMailing();
  } catch (e) {
    console.error('[TESSERACT] ⚠️ initSmartMailing fallo:', e.message);
  }

  // Recargar blacklists despues de init
  if (typeof reloadMLBlacklist === 'function') reloadMLBlacklist();
  if (typeof loadAABlacklist === 'function') loadAABlacklist();
  if (typeof reloadLFPBlacklist === 'function') reloadLFPBlacklist();

  // Inicializar Mail CRIBS
  try {
    if (typeof window._initMailCribs === 'function') await window._initMailCribs();
  } catch (e) {
    console.error('[TESSERACT] ⚠️ initMailCribs falló:', e.message);
  }
  if (typeof updateMailCribsUI === 'function') updateMailCribsUI();

  // Verificar que storage funciona
  try {
    chrome.storage.local.set({ tess_heartbeat: Date.now() }, () => {
      if (chrome.runtime.lastError) {
        console.error('[TESSERACT] ❌ Error de storage:', chrome.runtime.lastError);
      } else {
        console.log('[TESSERACT] ✅ Storage OK');
      }
    });
    console.log('[TESSERACT] ✅ Sistema listo - JARVIS activo');
  } catch (e) {
    console.error('[TESSERACT] ❌ Error en storage check:', e);
  }
}

// ============ CAPTURA DE IDs EN SEGUNDO PLANO ============
function startBackgroundIdCapture() {
  console.log('[STAR-TOOLS] 👁️ Captura de IDs en segundo plano iniciada');
  
  // Escanear cada 3 segundos mientras haya barridos activos
  setInterval(() => {
    if (!isAuthenticated) return;
    if (!likesActive && !followsActive) return;
    
    const ids = scanPageForIds();
    
    ids.forEach(id => {
      if (likesActive) registerIdInStarTools(id, 'Like');
      if (followsActive) registerIdInStarTools(id, 'Follow');
    });
  }, 3000);
  
  // Solo capturar IDs si hay barridos activos y cambió la URL
  let lastUrl = location.href;
  setInterval(() => {
    if (!isAuthenticated) return;
    if (!likesActive && !followsActive) return;
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => {
        if (!isAuthenticated) return;
        if (!likesActive && !followsActive) return;
        const ids = scanPageForIds();
        ids.forEach(id => {
          if (likesActive) registerIdInStarTools(id, 'Like');
          if (followsActive) registerIdInStarTools(id, 'Follow');
        });
      }, 1500);
    }
  }, 2000);
}

// ============ PANEL PRINCIPAL HTML (CON PESTAÑAS) ============
function createMainPanel() {
  if (document.getElementById('tesseract-main-panel')) return;
  
  const p = document.createElement('div');
  p.id = 'tesseract-main-panel';
  var logoUrl = chrome.runtime.getURL('dist/assets/tesseract-logo.svg');
  p.innerHTML = `
<style>
@font-face { font-family: 'Orbitron'; font-style: normal; font-weight: 400; font-display: swap; src: url('https://fonts.gstatic.com/s/orbitron/v32/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1sz.woff2') format('woff2'); }
@font-face { font-family: 'Orbitron'; font-style: normal; font-weight: 700; font-display: swap; src: url('https://fonts.gstatic.com/s/orbitron/v32/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1s77g.woff2') format('woff2'); }
@font-face { font-family: 'Orbitron'; font-style: normal; font-weight: 900; font-display: swap; src: url('https://fonts.gstatic.com/s/orbitron/v32/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1s7_g.woff2') format('woff2'); }
@font-face { font-family: 'Share Tech Mono'; font-style: normal; font-weight: 400; font-display: swap; src: url('https://fonts.gstatic.com/s/sharetechmono/v13/J7aHnp1uDWRyFFd98ABVA9PkkfN9J9aM.woff2') format('woff2'); }
#tesseract-main-panel{position:fixed;bottom:20px;right:20px;z-index:2147483647 !important;font-family:'Orbitron','Segoe UI',sans-serif;display:block !important;visibility:visible !important;font-size:13px;}
#tess-mini-icon{display:none;width:56px;height:56px;background:linear-gradient(135deg,#1e1b4b,#8b5cf6);border-radius:50%;align-items:center;justify-content:center;font-size:28px;color:#fff;position:fixed;bottom:20px;right:20px;cursor:pointer;z-index:2147483647 !important;box-shadow:0 0 20px rgba(139,92,246,0.4);}
#tess-mini-icon:hover{box-shadow:0 0 30px rgba(139,92,246,0.7);}
.tess-box{width:420px;min-width:280px;background:linear-gradient(145deg,#0a0a0a,#1a1a2e);border-radius:16px;border:2px solid #8b5cf6;box-shadow:0 0 40px rgba(139,92,246,0.3),0 10px 40px rgba(0,0,0,0.9);color:#e0e0e0;max-height:720px;overflow-y:auto;position:relative;}
.tess-resize{position:absolute;width:16px;height:16px;z-index:20;}.tess-resize.se{bottom:0;right:0;cursor:se-resize;border-right:3px solid #8b5cf6;border-bottom:3px solid #8b5cf6;border-radius:0 0 6px 0;}.tess-resize.sw{bottom:0;left:0;cursor:sw-resize;border-left:3px solid #8b5cf6;border-bottom:3px solid #8b5cf6;border-radius:0 0 0 6px;}.tess-resize.ne{top:0;right:0;cursor:ne-resize;border-right:3px solid #8b5cf6;border-top:3px solid #8b5cf6;border-radius:0 6px 0 0;}.tess-resize.nw{top:0;left:0;cursor:nw-resize;border-left:3px solid #8b5cf6;border-top:3px solid #8b5cf6;border-radius:6px 0 0 0;}
.tess-header{background:linear-gradient(135deg,#1e1b4b,#8b5cf6,#7c3aed,#8b5cf6,#1e1b4b);padding:14px 18px;display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:18px;letter-spacing:2px;border-bottom:2px solid #8b5cf6;cursor:move;text-shadow:0 0 10px #8b5cf6;text-transform:uppercase;position:sticky;top:0;z-index:10;}
.tess-header button{background:rgba(0,0,0,0.6);border:1px solid #8b5cf6;color:#8b5cf6;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;margin-left:5px;transition:all 0.3s;}
.tess-header button:hover{background:#7c3aed;color:#fff;box-shadow:0 0 15px #8b5cf6;}
.tess-header button.active-tab{background:#8b5cf6;color:#000;}
#tesseract-main-panel .profile-badge{display:none;padding:4px 14px;background:rgba(15,15,30,0.9);border-bottom:1px solid rgba(139,92,246,0.15);font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:1px;color:#8888a0;align-items:center;gap:10px;position:sticky;top:56px;z-index:9;}
.profile-badge .pb-name{color:#e0e0e0;font-weight:bold;letter-spacing:0.5px;}
.profile-badge .pb-id{color:#8b5cf6;font-size:10px;}

/* PESTAÑAS */
#tesseract-main-panel .tab-nav{display:flex;background:#0a0a0a;border-bottom:2px solid #8b5cf6;}
#tesseract-main-panel .tab-btn{flex:1;padding:10px 6px;background:rgba(30,27,75,0.5);border:none;border-right:1px solid #8b5cf6;color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;transition:all 0.3s;}
#tesseract-main-panel .tab-btn:last-child{border-right:none;}
#tesseract-main-panel .tab-btn:hover{background:rgba(139,92,246,0.2);}
#tesseract-main-panel .tab-btn.active{background:#8b5cf6;color:#fff;font-weight:bold;}
#tesseract-main-panel .tab-content{display:none;padding:14px;background:linear-gradient(180deg,#0a0a0a,#0a0a0f);}
#tesseract-main-panel .tab-content.active{display:block;}

.tess-box::-webkit-scrollbar{width:6px;}
.tess-box::-webkit-scrollbar-track{background:#0a0a0a;}
.tess-box::-webkit-scrollbar-thumb{background:#8b5cf6;border-radius:3px;}

.user-bar{margin-bottom:10px;padding:8px 12px;background:rgba(0,0,0,0.3);border:1px solid #8b5cf6;border-radius:6px;font-size:11px;text-align:center;color:#e0e0e0;}

/* TOGGLE SWITCH */
.aa-toggle{position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0;cursor:pointer;}
.aa-toggle input{opacity:0;width:0;height:0;}
.aa-toggle-slider{position:absolute;inset:0;background:#333;border-radius:20px;transition:0.3s;cursor:pointer;}
.aa-toggle-slider::before{content:"";position:absolute;left:3px;bottom:3px;width:14px;height:14px;background:#888;border-radius:50%;transition:0.3s;}
.aa-toggle input:checked + .aa-toggle-slider{background:#8b5cf6;}
.aa-toggle input:checked + .aa-toggle-slider::before{transform:translateX(16px);background:#fff;}

/* MAIL CRIBS TOGGLE */
.mc-toggle{position:relative;display:inline-flex;align-items:center;gap:6px;cursor:pointer;}
.mc-toggle input{opacity:0;width:0;height:0;}
.mc-toggle-slider{position:relative;display:inline-block;width:28px;height:16px;background:#333;border-radius:16px;transition:0.3s;flex-shrink:0;}
.mc-toggle-slider::before{content:"";position:absolute;left:2px;top:2px;width:12px;height:12px;background:#888;border-radius:50%;transition:0.3s;}
.mc-toggle input:checked + .mc-toggle-slider{background:#22c55e;}
.mc-toggle input:checked + .mc-toggle-slider::before{transform:translateX(12px);background:#fff;}

.bot-subnav{display:flex;gap:0;background:#0a0a0a;border:1px solid #8b5cf6;border-radius:8px;overflow:hidden;margin-bottom:10px;}
.bot-subbtn{flex:1;padding:8px 4px;background:rgba(30,27,75,0.5);border:none;border-right:1px solid rgba(139,92,246,0.3);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:8px;letter-spacing:0.5px;text-transform:uppercase;transition:all 0.3s;}
.bot-subbtn:last-child{border-right:none;}
.bot-subbtn:hover{background:rgba(139,92,246,0.3);}
.bot-subbtn.active{background:#8b5cf6;color:#fff;font-weight:bold;}
.bot-subpanel{position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(180deg,#0a0a0a,#0a0a0f);border-radius:12px;z-index:1;display:none;flex-direction:column;overflow-y:auto;padding:14px;}
.bot-subpanel.visible{display:flex;}
.bot-subpanel .win-close{position:absolute;top:8px;right:10px;background:rgba(239,68,68,0.2);border:1px solid #ef4444;color:#ef4444;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all 0.3s;}
.bot-subpanel .win-close:hover{background:#ef4444;color:#fff;}

.mod-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;}
.mod-card{padding:10px;background:rgba(30,27,75,0.5);border:1px solid #8b5cf6;border-radius:10px;text-align:center;}
.mod-card h4{font-size:12px;letter-spacing:1px;margin:0 0 6px 0;text-transform:uppercase;color:#e0e0e0;}
.mod-card .st{font-size:11px;margin-bottom:6px;}
.mod-card button{width:100%;padding:8px;border:1px solid #8b5cf6;border-radius:6px;background:rgba(0,0,0,0.5);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;transition:all 0.3s;margin:2px 0;}
.mod-card button:hover{background:#7c3aed;color:#fff;box-shadow:0 0 10px #8b5cf6;}
.mod-card button.on{background:#4CAF50;color:#fff;}
.mod-card button.cfg{background:rgba(139,92,246,0.2);}
.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0;}
.stat-mini{text-align:center;padding:8px 4px;background:rgba(0,0,0,0.5);border:1px solid #8b5cf6;border-radius:6px;font-size:11px;text-transform:uppercase;color:#e0e0e0;}
.stat-mini .val{display:block;font-size:18px;font-weight:900;color:#ffffff;text-shadow:0 0 10px #8b5cf6;}

.eater-box{margin-top:8px;padding:10px;background:#000;border:1px solid #8b5cf6;border-radius:8px;}
.eater-box h4{font-size:11px;letter-spacing:1px;margin:0 0 8px 0;text-align:center;color:#e0e0e0;}
.eater-btn{width:100%;padding:12px;border:1px solid #8b5cf6;border-radius:6px;background:linear-gradient(180deg,rgba(139,92,246,0.3),rgba(30,27,75,0.7));color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;transition:all 0.3s;}
.eater-btn.on{background:#8b5cf6;color:#000;box-shadow:0 0 30px #8b5cf6;animation:eater-glow 2s infinite;}
@keyframes eater-glow{0%,100%{box-shadow:0 0 10px #8b5cf6;}50%{box-shadow:0 0 30px #8b5cf6,0 0 60px #8b5cf6;}}
.eater-textarea{width:100%;height:80px;background:#000;border:1px solid #8b5cf6;border-radius:6px;color:#e0e0e0;font-family:'Segoe UI',sans-serif;font-size:12px;padding:10px;resize:vertical;box-sizing:border-box;line-height:1.4;outline:none;}
.eater-textarea:focus{border-color:#a78bfa;box-shadow:0 0 10px rgba(139,92,246,0.3);}
.logout-link{margin-top:10px;font-size:10px;letter-spacing:2px;color:#8b5cf6;cursor:pointer;text-align:center;text-decoration:underline;}
.logout-link:hover{color:#ffffff;}

/* STAR TOOLS DENTRO DEL PANEL */
.st-tbar{display:flex;gap:2px;padding:4px;background:#0a0a0a;border-bottom:1px solid rgba(139,92,246,0.3);flex-wrap:wrap;}
.st-fb{padding:4px 8px;border:1px solid #8b5cf6;border-radius:4px;background:rgba(30,27,75,0.5);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:7px;letter-spacing:1px;text-transform:uppercase;}
.st-fb:hover{background:#7c3aed;color:#fff;}
.st-fb.sel{background:#7c3aed;color:#fff;font-weight:bold;box-shadow:0 0 10px #8b5cf6;}
.st-fb .cnt{color:#666;font-size:7px;margin-left:3px;}
.st-out{max-height:350px;overflow-y:auto;font-size:10px;background:#000;padding:4px;border-radius:4px;}
.st-out .idhdr{display:flex;justify-content:space-between;padding:4px 6px;background:rgba(30,27,75,0.7);border-bottom:2px solid #8b5cf6;font-weight:bold;font-size:9px;position:sticky;top:0;z-index:5;text-transform:uppercase;color:#e0e0e0;}
.st-out .idrow{padding:3px 6px;border-bottom:1px solid rgba(139,92,246,0.08);display:flex;align-items:center;gap:6px;}
.st-out .idrow:hover{background:rgba(139,92,246,0.1);}
.st-out .idnum{color:#666;font-size:8px;width:25px;}
.st-out .idval{color:#ffffff;font-size:13px;font-weight:bold;letter-spacing:2px;flex:1;font-family:'Share Tech Mono',monospace;}
.st-out .idtag{font-size:7px;padding:2px 6px;border-radius:8px;text-transform:uppercase;font-weight:bold;}
.st-out .idtag.Like{background:#ec4899;color:#fff;}
.st-out .idtag.Follow{background:#3b82f6;color:#fff;}
.st-out .idtag.LFP{background:#8b5cf6;color:#fff;}
.st-out .idtag.Saludo{background:#22c55e;color:#000;}
.st-out .idtag.Cartas{background:#f59e0b;color:#000;}
.st-out .empty{text-align:center;padding:20px;color:#666;font-size:10px;letter-spacing:1px;}
.st-out::-webkit-scrollbar{width:3px;}
.st-out::-webkit-scrollbar-track{background:#000;}
.st-out::-webkit-scrollbar-thumb{background:#8b5cf6;border-radius:2px;}
.st-bar{padding:6px 8px;background:#0a0a0a;border-top:1px solid #8b5cf6;font-size:8px;display:flex;justify-content:space-between;align-items:center;}
.st-bar button{background:rgba(30,27,75,0.7);border:1px solid #8b5cf6;color:#e0e0e0;padding:4px 8px;border-radius:4px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:7px;}
.st-bar button:hover{background:#7c3aed;color:#fff;}
</style>
<style>
/* TESSERACT LIGHT THEME OVERRIDE */
#tesseract-main-panel{font-family:'Segoe UI',system-ui,sans-serif !important;}
.tess-box{background:#fff !important;border-color:#d0d0d8 !important;box-shadow:0 4px 24px rgba(0,0,0,0.1) !important;color:#1a1a2e !important;}
.tess-header{background:linear-gradient(135deg,#7c3aed,#6d28d9) !important;text-shadow:none !important;}
.tab-nav{background:#f4f4f8 !important;border-bottom:2px solid #e0e0e8 !important;}
.tab-btn{background:transparent !important;border-color:#e0e0e8 !important;color:#888 !important;font-family:'Segoe UI',sans-serif !important;}
.tab-btn:hover{background:rgba(124,58,237,0.06) !important;color:#7c3aed !important;}
.tab-btn.active{background:#7c3aed !important;color:#fff !important;}
.tab-content{background:#fafafc !important;}
.inp-lbl{color:#555 !important;}
.t-input{background:#f8f8fc !important;border-color:#e0e0e8 !important;color:#1a1a2e !important;font-family:'Segoe UI',sans-serif !important;}
.t-input:focus{border-color:#7c3aed !important;box-shadow:0 0 0 3px rgba(124,58,237,0.1) !important;}
.t-input::placeholder{color:#aaa !important;}
.btn-auth{background:#7c3aed !important;color:#fff !important;border:none !important;font-family:'Segoe UI',sans-serif !important;}
.btn-auth:hover{background:#6d28d9 !important;box-shadow:0 4px 12px rgba(124,58,237,0.3) !important;}
.user-bar{background:#f4f4f8 !important;border-color:#e0e0e8 !important;color:#555 !important;}
.aa-toggle-slider{background:#ddd !important;}
.aa-toggle input:checked + .aa-toggle-slider{background:#7c3aed !important;}
.aa-toggle-slider::before{background:#fff !important;}
.mc-toggle-slider{background:#ddd !important;}
.mc-toggle input:checked + .mc-toggle-slider{background:#22c55e !important;}
.mc-toggle-slider::before{background:#fff !important;}
.bot-subnav{background:#f4f4f8 !important;border-color:#e0e0e8 !important;}
.bot-subbtn{background:transparent !important;border-color:#e0e0e8 !important;color:#888 !important;font-family:'Segoe UI',sans-serif !important;}
.bot-subbtn:hover{background:rgba(124,58,237,0.06) !important;color:#7c3aed !important;}
.bot-subbtn.active{background:#7c3aed !important;color:#fff !important;}
.bot-subpanel{background:#fff !important;}
.mod-card{background:#f4f4f8 !important;border-color:#e0e0e8 !important;}
.mod-card h4{color:#555 !important;}
.profile-badge{background:#f4f4f8 !important;border-color:#e0e0e8 !important;color:#555 !important;}
.profile-badge .pb-name{color:#1a1a2e !important;}
.profile-badge .pb-id{color:#7c3aed !important;}
#manualProfileName,#manualProfileId{background:#f8f8fc !important;border-color:#e0e0e8 !important;color:#1a1a2e !important;}
#btnSetProfile{background:#7c3aed !important;}
.st-bar{background:#f4f4f8 !important;border-color:#e0e0e8 !important;}
.st-bar button{background:#fff !important;border-color:#d0d0d8 !important;color:#555 !important;font-family:'Segoe UI',sans-serif !important;}
.st-bar button:hover{background:#7c3aed !important;color:#fff !important;}
.tess-header button{background:rgba(255,255,255,0.15) !important;border-color:rgba(255,255,255,0.3) !important;color:#fff !important;}
.tess-header button:hover{background:rgba(255,255,255,0.3) !important;}
.tess-header button.active-tab{background:#fff !important;color:#7c3aed !important;}
.tess-box::-webkit-scrollbar-track{background:#f4f4f8 !important;}
.tess-box::-webkit-scrollbar-thumb{background:#d0d0d8 !important;}
/* Per-window accent colors */
.bot-subpanel.visible[id="botsubLikefollow"]{border-top:3px solid #ec4899 !important;}
.bot-subpanel.visible[id="botsubEater"]{border-top:3px solid #f59e0b !important;}
.bot-subpanel.visible[id="botsubIcebreakers"]{border-top:3px solid #10b981 !important;}
/* Light theme modals & icebreakers */
.sal-box{background:#fff !important;border-color:#d0d0d8 !important;box-shadow:0 4px 24px rgba(0,0,0,0.1) !important;color:#1a1a2e !important;}
.sal-hdr{background:linear-gradient(135deg,#7c3aed,#6d28d9) !important;color:#fff !important;border-color:#d0d0d8 !important;}
.sal-body textarea{background:#f8f8fc !important;border-color:#d0d0d8 !important;color:#1a1a2e !important;}
.sal-foot button{background:#f4f4f8 !important;border-color:#d0d0d8 !important;color:#555 !important;}
.car-box{background:#fff !important;border-color:#d0d0d8 !important;box-shadow:0 4px 24px rgba(0,0,0,0.1) !important;color:#1a1a2e !important;}
.car-hdr{background:linear-gradient(135deg,#7c3aed,#6d28d9) !important;color:#fff !important;border-color:#d0d0d8 !important;}
.car-body textarea{background:#f8f8fc !important;border-color:#d0d0d8 !important;color:#1a1a2e !important;}
.car-foot button{background:#f4f4f8 !important;border-color:#d0d0d8 !important;color:#555 !important;}
.ib-item{background:#f8f8fc !important;border-color:#d0d0d8 !important;}
.ib-item:hover{background:rgba(124,58,237,0.06) !important;border-color:#7c3aed !important;}
.ib-label{color:#7c3aed !important;}
.ib-text{color:#1a1a2e !important;}
.bot-subpanel.visible[id="botsubPhotos"]{border-top:3px solid #f59e0b !important;}
.bot-subpanel.visible[id="botsubSaludos"]{border-top:3px solid #10b981 !important;}
.bot-subpanel.visible[id="botsubCartas"]{border-top:3px solid #3b82f6 !important;}
.bot-subpanel.visible[id="botsubScraping"]{border-top:3px solid #ef4444 !important;}
.bot-subpanel.visible[id="botsubMailing"]{border-top:3px solid #8b5cf6 !important;}
.ml-btn{display:block;width:100%;padding:10px 16px;border:none;border-radius:8px;cursor:pointer;font-family:'Segoe UI',sans-serif;font-size:12px;font-weight:600;letter-spacing:0.5px;transition:all 0.3s;text-align:center;margin-top:6px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;box-shadow:0 2px 8px rgba(124,58,237,0.3);}
.ml-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(124,58,237,0.4);}
.ml-btn:active{transform:translateY(0);}
.ml-btn-secondary{background:linear-gradient(135deg,#6366f1,#4f46e5);box-shadow:0 2px 8px rgba(99,102,241,0.3);}
.ml-btn-secondary:hover{box-shadow:0 4px 16px rgba(99,102,241,0.4);}
.ml-btn-success{background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 2px 8px rgba(16,185,129,0.3);}
.ml-btn-success:hover{box-shadow:0 4px 16px rgba(16,185,129,0.4);}
/* Dark theme ml-btn override */
.tess-box .ml-btn{background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;}
.tess-box .ml-btn-secondary{background:linear-gradient(135deg,#6366f1,#4f46e5);}
.tess-box .ml-btn-success{background:linear-gradient(135deg,#10b981,#059669);}
.bot-subpanel.visible[id="botsubAutoAnswer"]{border-top:3px solid #06b6d4 !important;}
.bot-subpanel.visible[id="botsubStar"]{border-top:3px solid #7c3aed !important;}
/* Tab-content accent colors */
#tabMain.tab-content{border-left:3px solid #7c3aed !important;}
#tabStar.tab-content{border-left:3px solid #f59e0b !important;}
#tabAA.tab-content{border-left:3px solid #06b6d4 !important;}
#tabMailing.tab-content{border-left:3px solid #8b5cf6 !important;}
#tabBlacklist.tab-content{border-left:3px solid #ef4444 !important;}
</style>
<div id="tess-mini-icon">🤖</div>
<div class="tess-box">
<div class="tess-resize se"></div><div class="tess-resize sw"></div><div class="tess-resize ne"></div><div class="tess-resize nw"></div>
<div class="tess-header"><img src="${logoUrl}" alt="TESSERACT" style="height:22px;width:auto;display:inline-block;vertical-align:middle;"><div><button id="btnZoomOut" title="Reducir">-</button><span id="zoomLevel" style="color:#fff;font-size:11px;min-width:28px;text-align:center;display:inline-block;">1.0</span><button id="btnZoomIn" title="Ampliar">+</button><button id="btnMin" title="Minimizar">_</button><button id="btnClose" title="Cerrar">x</button></div></div>

<!-- PERFIL ACTIVO -->
<div class="profile-badge" id="profileBadge"><span>🎯 <span class="pb-name" id="profileName">—</span></span><span class="pb-id" id="profileId">ID: —</span> <input id="manualProfileName" placeholder="Name" style="width:60px;background:#0a0a0f;border:1px solid #333350;color:#e0e0e0;font-size:8px;padding:2px 4px;border-radius:2px;"> <input id="manualProfileId" placeholder="ID" style="width:60px;background:#0a0a0f;border:1px solid #333350;color:#e0e0e0;font-size:8px;padding:2px 4px;border-radius:2px;"> <button id="btnSetProfile" style="background:#8b5cf6;border:none;color:#fff;font-size:8px;padding:2px 6px;border-radius:2px;cursor:pointer;">SET</button></div>

<!-- PESTAÑAS -->
<div class="tab-nav">
  <button class="tab-btn active" data-tab="main">🎮 BOT</button>
  <button class="tab-btn" data-tab="star">⭐ STAR TOOLS</button>
  <button class="tab-btn" data-tab="aa">🤖 AUTO-ANSWER</button>
  <button class="tab-btn" data-tab="mailing">📬 MAILING</button>
  <button class="tab-btn" data-tab="blacklist">🚫 BLACKLIST</button>
</div>

<!-- PESTAÑA BOT -->
<div id="tabMain" class="tab-content active">
<div id="mainScreen">
<div class="user-bar">👤 <strong id="currentUserDisplay"></strong></div>

<!-- SUB-PESTAÑAS DEL BOT -->
<div class="bot-subnav">
  <button class="bot-subbtn" data-botsub="likefollow">❤️➕ LIKES & FOLLOWS</button>
  <button class="bot-subbtn" data-botsub="eater">🧠 EATER</button>
  <button class="bot-subbtn" data-botsub="icebreakers">🎯 ICEBREAKERS</button>
</div>

<!-- CONTENEDOR DE VENTANAS -->
<div class="bot-win-container" style="position:relative;min-height:200px;">

<!-- SUB: LIKE & FOLLOW + PHOTOS (Unificado) -->
<div class="bot-subpanel" id="botsubLikefollow" data-z="1">
<button class="win-close" data-close="botsubLikefollow">×</button>
<div class="mod-card" style="margin-bottom:8px;">
<h4>❤️➕📷 L+F+P UNIFICADO</h4>
<div class="st" id="lfpStatus" style="color:#ffffff;font-size:13px;font-weight:bold;margin-bottom:8px;">INACTIVO</div>
<div style="display:flex;gap:6px;justify-content:center;">
<button id="btnLFPToggle" style="flex:1;padding:12px 8px;border:2px solid #8b5cf6;border-radius:8px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;transition:all 0.3s;text-shadow:0 0 10px rgba(139,92,246,0.5);">▶ L+F+P</button>
<button id="btnLFPPause" style="width:44px;padding:12px 4px;border:1px solid #f59e0b;border-radius:8px;background:rgba(245,158,11,0.15);color:#f59e0b;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:16px;transition:all 0.3s;" title="Pausar/Reanudar">⏸</button>
</div>
</div>
<div class="stats-row">
<div class="stat-mini" style="grid-column:1/-1;"><span class="val" id="vTotal" style="font-size:28px;">0</span>RESULTS</div>
</div>
</div>

<!-- SUB: EATER -->
<div class="bot-subpanel" id="botsubEater" data-z="1">
<button class="win-close" data-close="botsubEater">×</button>
<div class="eater-box">
<h4>🧠 EATER — <span id="eaterClientName" style="font-size:9px;"></span></h4>
<button class="eater-btn" id="btnEaterToggle">🧠 EATER: OFF</button>
<div class="eater-sugs" id="eaterSuggestions" style="margin-top:8px;">
<div style="margin-bottom:6px;font-size:10px;color:#888;letter-spacing:1px;">📝 RESPUESTA GENERADA</div>
<textarea id="eaterResponseArea" class="eater-textarea">Esperando mensaje...</textarea>
<div id="eaterSelectionInfo" style="display:none;align-items:center;gap:6px;margin-top:4px;padding:4px 8px;background:rgba(139,92,246,0.15);border:1px solid #8b5cf6;border-radius:6px;font-size:9px;color:#c4b5fd;">
  <span>📋</span>
  <span class="sel-count" style="font-weight:bold;color:#fff;">0</span>
  <span style="color:#c4b5fd;">seleccionados</span>
  <span style="margin-left:auto;cursor:pointer;color:#f87171;font-size:12px;" id="btnClearSelection">✕</span>
</div>
<button id="btnStopClone" style="width:100%;padding:6px;margin-top:4px;border:1px solid #ef4444;border-radius:6px;background:rgba(239,68,68,0.15);color:#ef4444;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:8px;letter-spacing:1px;">⏹ CLONACIÓN: ACTIVA</button>
<button id="btnCopyEaterResponse" style="width:100%;padding:8px;margin-top:6px;border:1px solid #8b5cf6;border-radius:6px;background:rgba(30,27,75,0.5);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px;">📋 COPIAR AL CHAT</button>
<div style="display:flex;gap:6px;margin-top:6px;">
<button id="btnRefreshEater2" style="flex:1;padding:8px;border:1px solid #8b5cf6;border-radius:6px;background:rgba(139,92,246,0.2);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:8px;letter-spacing:1px;">🔄 REGENERAR</button>
<select id="btnTranslate2" style="flex:1;padding:8px;border:1px solid #2196F3;border-radius:6px;background:rgba(33,150,243,0.2);color:#e0e0e0;cursor:pointer;font-family:'Segoe UI Emoji','Apple Color Emoji','Orbitron',sans-serif;font-size:8px;letter-spacing:1px;outline:none;appearance:auto;">
<option value="en">🇬🇧 EN</option>
<option value="fr">🇫🇷 FR</option>
<option value="pt">🇵🇹 PT</option>
<option value="de">🇩🇪 DE</option>
<option value="it">🇮🇹 IT</option>
<option value="nl">🇳🇱 NL</option>
<option value="es">🇪🇸 ES</option>
</select>
</div>
</div>
</div>
</div>

<!-- SUB: ICEBREAKERS -->
<div class="bot-subpanel" id="botsubIcebreakers" data-z="1">
<button class="win-close" data-close="botsubIcebreakers">×</button>
<div class="eater-box">
<h4 style="font-size:16px;letter-spacing:3px;margin:8px 0;text-align:center;background:linear-gradient(135deg,#7c3aed,#ec4899,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:900;text-transform:uppercase;font-family:'Orbitron',sans-serif;">IB</h4>
<div style="display:flex;gap:4px;margin-bottom:6px;">
  <input id="ibInput" value="RH" placeholder="RH, RH Amistad, RH Amor Real, RH Charla Caliente, RH Mail" style="flex:1;background:#0a0a0f;border:1px solid #333350;color:#e0e0e0;padding:6px 8px;border-radius:4px;font-size:10px;font-family:'Share Tech Mono',monospace;">
  <button id="ibGenerateBtn" style="background:#8b5cf6;border:none;color:#fff;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:10px;font-family:'Orbitron',sans-serif;white-space:nowrap;">🔄 GENERAR</button>
</div>
<div style="display:flex;gap:4px;margin-bottom:4px;">
  <button id="ibSendAllBtn" style="flex:1;background:linear-gradient(135deg,#059669,#10b981);border:none;color:#fff;padding:8px;border-radius:6px;cursor:pointer;font-size:10px;font-family:'Orbitron',sans-serif;letter-spacing:1px;">🌐 ENVIAR IB (Traducir → Enviar)</button>
</div>
<div id="icebreakersList" style="display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto;padding:2px 4px;">
  <div class="ib-item" data-idx="0"><div class="ib-label">RH Amistad</div><div class="ib-text">—</div></div>
  <div class="ib-item" data-idx="1"><div class="ib-label">RH Amor Real</div><div class="ib-text">—</div></div>
  <div class="ib-item" data-idx="2"><div class="ib-label">RH Charla Caliente</div><div class="ib-text">—</div></div>
  <div class="ib-item" data-idx="3"><div class="ib-label">RH Mail 1</div><div class="ib-text">—</div></div>
  <div class="ib-item" data-idx="4"><div class="ib-label">RH Mail 2</div><div class="ib-text">—</div></div>
</div>
<style>
.ib-item{cursor:pointer;border:1px solid #333350;border-radius:6px;padding:6px 8px;background:rgba(139,92,246,0.08);transition:all 0.2s;}
.ib-item:hover{background:rgba(139,92,246,0.2);border-color:#8b5cf6;}
.ib-label{font-size:9px;color:#8b5cf6;letter-spacing:1px;margin-bottom:3px;font-family:'Orbitron',sans-serif;}
.ib-text{font-size:11px;color:#e0e0e0;line-height:1.4;}
</style>
</div>
</div>

</div>

<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding:6px 8px;background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.2);border-radius:6px;">
  <label class="mc-toggle" style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:1;">
    <input type="checkbox" id="btnToggleMailCribs">
    <span class="mc-toggle-slider"></span>
    <span style="font-size:10px;letter-spacing:1px;color:#ccc;">📬 MAIL CRIBS</span>
  </label>
  <span id="mcStatusInline" style="font-size:9px;color:#666;">INACTIVO</span>
</div>

<div style="display:flex;gap:8px;justify-content:center;margin-top:8px;">
<div class="logout-link" id="btnLogout" style="flex:1;">CERRAR SESIÓN</div>
<button class="logout-link" id="btnAdminPanel" style="flex:1;background:#8b5cf6;border:1px solid #8b5cf6;color:#fff;text-align:center;padding:8px 12px;border-radius:6px;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:1px;">⚙ ADMIN PANEL</button>
</div>
</div>
</div>

<!-- PESTAÑA STAR TOOLS -->
<div id="tabStar" class="tab-content">
<div class="user-bar">⭐ STAR TOOLS — <span id="starTotalLive">0 IDs capturados</span></div>
<div class="st-tbar">
<button class="st-fb sel" data-f="all">TODOS <span class="cnt" id="cntAll">0</span></button>
<button class="st-fb" data-f="L+F">❤️➕ L+F <span class="cnt" id="cntLF">0</span></button>
<button class="st-fb" data-f="Saludo">👋 <span class="cnt" id="cntSaludo">0</span></button>
<button class="st-fb" data-f="Cartas">📨 <span class="cnt" id="cntCartas">0</span></button>
</div>
<div class="st-out" id="stOutput"><div class="empty">⭐ SIN IDs RECOLECTADOS<br><small>Ejecuta un barrido para ver IDs</small></div></div>
<div class="st-bar"><span id="stCount">TOTAL: 0 IDs</span><div><button id="btnClear">🧹 LIMPIAR</button><button id="btnExport">📋 EXPORTAR</button><button id="btnCopy">📝 COPIAR</button></div></div>
</div>

<!-- PESTAÑA AUTO-ANSWER -->
<div id="tabAA" class="tab-content">
<div class="user-bar" style="display:flex;align-items:center;justify-content:center;gap:8px;">
  🤖 AUTO-ANSWER —
  <label class="aa-toggle">
    <input type="checkbox" id="btnToggleAA">
    <span class="aa-toggle-slider round"></span>
  </label>
  <span id="aaStatusInline" style="color:#666;">INACTIVO</span>
</div>
<div style="padding:10px;">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
    <div class="mod-card"><h4>❤️ LIKE</h4><div class="st" id="aaLikeStatus" style="color:#666;">DESACTIVADO</div></div>
    <div class="mod-card"><h4>😉 WINK</h4><div class="st" id="aaWinkStatus" style="color:#666;">DESACTIVADO</div></div>
    <div class="mod-card"><h4>💬 COMMENT</h4><div class="st" id="aaCommentStatus" style="color:#666;">DESACTIVADO</div></div>
    <div class="mod-card"><h4>🎁 GIFT</h4><div class="st" id="aaGiftStatus" style="color:#666;">DESACTIVADO</div></div>
  </div>
  <div class="stats-row">
    <div class="stat-mini"><span class="val" id="aaTodayResp">0</span>HOY</div>
    <div class="stat-mini"><span class="val" id="aaDailyLimit">50</span>LÍMITE</div>
  </div>
  <button class="btn-auth" id="btnOpenAAConfig" style="margin-top:8px;">⚙ CONFIGURAR AUTO-ANSWER</button>
</div>
</div>

<!-- PESTAÑA SMART MAILING -->
<div id="tabMailing" class="tab-content">
<div class="user-bar">📬 SMART MAILING — <span id="mlStatusInline">INACTIVO</span></div>
<div style="padding:10px;">
  <div class="stats-row">
    <div class="stat-mini"><span class="val" id="mlSentTodayInline">0</span>ENVIADOS HOY</div>
    <div class="stat-mini"><span class="val" id="mlDailyLimitInline">30</span>LÍMITE</div>
    <div class="stat-mini"><span class="val" id="mlQueueCountInline">0</span>EN COLA</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
    <div class="mod-card"><h4>⏱ Intervalo</h4><div class="st" id="mlIntervalDisplay">60 min</div></div>
    <div class="mod-card"><h4>💬 Mensaje</h4><div class="st" id="mlMsgPreview" style="font-size:8px;">—</div></div>
  </div>
  <button class="ml-btn" id="btnOpenMLConfig">⚙ CONFIGURAR</button>
  <button class="ml-btn ml-btn-secondary" id="btnScrapeML">🔍 RASTREAR</button>
  <button class="ml-btn ml-btn-success" id="btnStartCarta">📨 INICIAR ENVÍO</button>
  <div id="mlCartaProgress" style="margin-top:6px;font-size:9px;color:#888;display:none;text-align:center;"></div>
  <div id="mlContactList" style="margin-top:8px;max-height:200px;overflow-y:auto;border:1px solid #e0e0e8;border-radius:6px;background:#fafafc;display:none;"></div>
</div>
</div>

<!-- PESTAÑA BLACKLIST -->
<div id="tabBlacklist" class="tab-content">
<div class="user-bar">🚫 BLACKLIST — <span id="blCount">0 contactos</span></div>
<div style="padding:10px;">
  <div class="inp-grp"><label class="inp-lbl">AGREGAR ID A BLACKLIST</label><input type="text" id="blInput" class="t-input" placeholder="ID del contacto" /></div>
  <button class="btn-auth" id="btnBlAdd" style="margin-top:4px;">🚫 BLOQUEAR</button>
  <div style="margin-top:10px;max-height:250px;overflow-y:auto;background:#0a0a0a;padding:8px;border:1px solid #333;border-radius:4px;">
    <div id="blList" style="font-size:10px;color:#ccc;">
      <p style="color:#666;text-align:center;">Cargando...</p>
    </div>
  </div>
</div>
</div>

</div></div>`;
  document.body.appendChild(p);
  console.log('[TESSERACT] ✅ Panel principal creado');
}

// ============ MODALES ============
function createSaludosModal() {
  if (document.getElementById('saludosModal')) return;
  const m = document.createElement('div');
  m.id = 'saludosModal';
  m.innerHTML = `
<style>
#saludosModal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999999;display:none;}
.sal-box{width:450px;background:#0a0a0a;border:2px solid #8b5cf6;border-radius:12px;box-shadow:0 0 40px rgba(139,92,246,0.5);color:#8b5cf6;font-family:'Orbitron',sans-serif;}
.sal-hdr{background:linear-gradient(135deg,#1e1b4b,#8b5cf6,#1e1b4b);padding:12px 16px;border-radius:10px 10px 0 0;font-weight:bold;letter-spacing:2px;display:flex;justify-content:space-between;border-bottom:2px solid #8b5cf6;color:#e0e0e0;}
.sal-body{padding:16px;max-height:400px;overflow-y:auto;}
.sal-body h4{font-size:10px;letter-spacing:1px;margin:8px 0 5px 0;}
.sal-body textarea{width:100%;height:50px;background:#000;border:1px solid #8b5cf6;border-radius:6px;color:#e0e0e0;font-family:Arial;font-size:11px;padding:8px;margin-bottom:8px;resize:vertical;box-sizing:border-box;}
.sal-body textarea:focus{outline:none;border-color:#ef4444;}
.sal-foot{padding:12px;border-top:1px solid #8b5cf6;text-align:right;}
.sal-foot button{padding:8px 16px;border:1px solid #8b5cf6;border-radius:6px;background:rgba(30,27,75,0.7);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:10px;margin-left:8px;}
.sal-foot button.save{background:#4CAF50;border-color:#4CAF50;color:#fff;}
</style>
<div class="sal-box"><div class="sal-hdr"><span>⚙ CONFIGURAR SALUDOS</span><span style="cursor:pointer;font-size:18px;" id="btnCloseSaludos">×</span></div>
<div class="sal-body"><h4>Mensaje 1:</h4><textarea id="sMsg1"></textarea><h4>Mensaje 2:</h4><textarea id="sMsg2"></textarea><h4>Mensaje 3:</h4><textarea id="sMsg3"></textarea><h4>Mensaje 4:</h4><textarea id="sMsg4"></textarea><h4>Mensaje 5:</h4><textarea id="sMsg5"></textarea></div>
<div class="sal-foot"><button id="btnCancelSaludos">CANCELAR</button><button class="save" id="btnSaveSaludos">💾 GUARDAR</button></div></div>`;
  document.body.appendChild(m);
}

function createCartasModal() {
  if (document.getElementById('cartasModal')) return;
  const m = document.createElement('div');
  m.id = 'cartasModal';
  m.innerHTML = `
<style>
#cartasModal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999999;display:none;}
.car-box{width:520px;background:#0a0a0a;border:2px solid #8b5cf6;border-radius:12px;box-shadow:0 0 40px rgba(139,92,246,0.5);color:#8b5cf6;font-family:'Orbitron',sans-serif;}
.car-hdr{background:linear-gradient(135deg,#1e1b4b,#8b5cf6,#1e1b4b);padding:12px 16px;border-radius:10px 10px 0 0;font-weight:bold;letter-spacing:2px;display:flex;justify-content:space-between;border-bottom:2px solid #8b5cf6;color:#e0e0e0;}
.car-body{padding:16px;}
.car-body textarea{width:100%;height:180px;background:#000;border:1px solid #8b5cf6;border-radius:6px;color:#e0e0e0;font-family:Arial;font-size:12px;padding:10px;resize:vertical;box-sizing:border-box;}
.car-body textarea:focus{outline:none;border-color:#ef4444;}
.car-foot{padding:12px;border-top:1px solid #8b5cf6;text-align:right;}
.car-foot button{padding:8px 16px;border:1px solid #8b5cf6;border-radius:6px;background:rgba(30,27,75,0.7);color:#e0e0e0;cursor:pointer;font-family:'Orbitron',sans-serif;font-size:10px;margin-left:8px;}
.car-foot button.save{background:#FF9800;border-color:#FF9800;color:#000;font-weight:bold;}
</style>
<div class="car-box"><div class="car-hdr"><span>📨 CONFIGURAR CARTA</span><span style="cursor:pointer;font-size:18px;" id="btnCloseCartas">×</span></div>
<div class="car-body"><textarea id="cartaText" placeholder="Escribe tu carta aquí..."></textarea></div>
<div class="car-foot"><button id="btnCancelCartas">CANCELAR</button><button class="save" id="btnSaveCartas">💾 GUARDAR</button></div></div>`;
  document.body.appendChild(m);
}

// ============ EVENTOS ============
function setupAllEvents() {
  // Pestañas
  var mainPanel = document.getElementById('tesseract-main-panel');
  mainPanel.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const clickedTab = this.dataset.tab;
      if (clickedTab === currentTab && currentTab !== 'main') {
        mainPanel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        mainPanel.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        currentTab = 'main';
        mainPanel.querySelector('[data-tab="main"]').classList.add('active');
        document.getElementById('tabMain').classList.add('active');
        return;
      }
      mainPanel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentTab = clickedTab;
      const tabMap = { main: 'Main', star: 'Star', aa: 'AA', mailing: 'Mailing', blacklist: 'Blacklist' };
      mainPanel.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById('tab' + (tabMap[currentTab] || 'Main')).classList.add('active');
      if (currentTab === 'star') renderStarIds();
      if (currentTab === 'aa') updateAATabUI();
      if (currentTab === 'mailing') { updateMLTabUI(); startMLStatsPolling(); } else { stopMLStatsPolling(); }
      if (currentTab === 'blacklist') renderBlacklistTab();
    });
  });

  // Sub-pestañas del BOT: estilo ventanas Windows
  let topZ = 10;
  document.querySelectorAll('.bot-subbtn').forEach(btn => {
    btn.addEventListener('click', function() {
      const panelId = 'botsub' + this.dataset.botsub.charAt(0).toUpperCase() + this.dataset.botsub.slice(1);
      const panel = document.getElementById(panelId);
      topZ++;
      panel.style.zIndex = topZ;
      panel.classList.add('visible');
      this.classList.add('active');
    });
  });

  // Botones de cerrar ventanas
  document.querySelectorAll('.win-close').forEach(btn => {
    btn.addEventListener('click', function() {
      const panelId = this.dataset.close;
      document.getElementById(panelId).classList.remove('visible');
      const subKey = panelId.replace('botsub', '').toLowerCase();
      document.querySelector('.bot-subbtn[data-botsub="' + subKey + '"]').classList.remove('active');
    });
  });
  
  // Botones de barrido
  document.getElementById('btnLFPToggle').addEventListener('click', executeLFP);
  document.getElementById('btnLFPPause').addEventListener('click', lfpTogglePause);
  
  // Eater
  document.getElementById('btnEaterToggle').addEventListener('click', toggleEater);
  document.getElementById('btnStopClone').addEventListener('click', toggleClonacion);
  document.getElementById('btnCopyEaterResponse').addEventListener('click', copyEaterResponseToChat);
  document.getElementById('btnRefreshEater2').addEventListener('click', refreshEaterSuggestions);
  var clearSelBtn = document.getElementById('btnClearSelection');
  if (clearSelBtn && typeof _clearMessageSelection !== 'undefined') clearSelBtn.addEventListener('click', _clearMessageSelection);
  document.getElementById('btnTranslate2').addEventListener('change', function () {
    selectedLangCode = this.value;
    translateEaterResponse();
  });
  
  // Panel
  function toggleMin(e) {
    var panel = document.getElementById('tesseract-main-panel');
    var box = panel.querySelector('.tess-box');
    var mini = document.getElementById('tess-mini-icon');
    var isMin = box.style.display === 'none';
    if (isMin) {
      box.style.display = '';
      if (mini) mini.style.display = 'none';
    } else {
      box.style.display = 'none';
      if (mini) mini.style.display = 'flex';
    }
  }
  document.getElementById('btnMin').addEventListener('click', toggleMin);
  document.getElementById('tess-mini-icon').addEventListener('click', function (e) {
    toggleMin(e);
  });
  document.getElementById('btnClose').addEventListener('click', toggleMin);

  // Zoom (envuelto en try/catch para no bloquear la inicialización)
  try {
    var currentZoom = 1.0;
    window._tessApplyZoom = function (z) {
      currentZoom = Math.max(0.5, Math.min(2.0, z));
      var box = document.querySelector('#tesseract-main-panel .tess-box');
      if (box) box.style.zoom = currentZoom;
      var zl = document.getElementById('zoomLevel');
      if (zl) zl.textContent = currentZoom.toFixed(1);
      chrome.storage.local.set({ tess_zoom: currentZoom });
    };
    document.getElementById('btnZoomIn').addEventListener('click', function () { window._tessApplyZoom(currentZoom + 0.1); });
    document.getElementById('btnZoomOut').addEventListener('click', function () { window._tessApplyZoom(currentZoom - 0.1); });
    chrome.storage.local.get('tess_zoom', function (d) { if (d.tess_zoom) window._tessApplyZoom(d.tess_zoom); });
  } catch (e) { console.warn('[ZOOM] Error:', e.message); }

  document.getElementById('btnLogout').addEventListener('click', typeof doLogout === 'function' ? doLogout : function () { chrome.storage.local.remove('tess_jwt', function () { location.reload(); }); });
  document.getElementById('btnAdminPanel').addEventListener('click', async () => {
    try {
      const data = await chrome.storage.local.get(['tess_jwt']);
      const url = data.tess_jwt
        ? chrome.runtime.getURL('dist/pages/admin/admin.html') + '?token=' + encodeURIComponent(data.tess_jwt)
        : chrome.runtime.getURL('dist/pages/admin/admin.html');
      window.open(url, '_blank');
    } catch (e) {
      window.open(chrome.runtime.getURL('dist/pages/admin/admin.html'), '_blank');
    }
  });
  document.getElementById('btnSetProfile').addEventListener('click', () => {
    const n = document.getElementById('manualProfileName').value.trim();
    const id = document.getElementById('manualProfileId').value.trim();
    if (n || id) {
      document.getElementById('profileName').textContent = n || '—';
      document.getElementById('profileId').textContent = 'ID: ' + (id || '—');
      document.getElementById('profileBadge').style.display = 'flex';
    }
  });
  
  // Modales
  document.getElementById('btnCloseSaludos').addEventListener('click', () => document.getElementById('saludosModal').style.display = 'none');
  document.getElementById('btnCancelSaludos').addEventListener('click', () => document.getElementById('saludosModal').style.display = 'none');
  document.getElementById('btnSaveSaludos').addEventListener('click', saveSaludosConfig);
  document.getElementById('btnCloseCartas').addEventListener('click', () => document.getElementById('cartasModal').style.display = 'none');
  document.getElementById('btnCancelCartas').addEventListener('click', () => document.getElementById('cartasModal').style.display = 'none');
  document.getElementById('btnSaveCartas').addEventListener('click', saveCartasConfig);
  
  // Star Tools filtros
  document.querySelectorAll('.st-fb').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.st-fb').forEach(b => b.classList.remove('sel'));
      this.classList.add('sel');
      currentStarFilter = this.dataset.f;
      renderStarIds();
    });
  });
  
  // Star Tools acciones
  document.getElementById('btnClear').addEventListener('click', clearIDs);
  document.getElementById('btnExport').addEventListener('click', exportIDs);
  document.getElementById('btnCopy').addEventListener('click', copyIDs);

  // Auto-Answer
  document.getElementById('btnOpenAAConfig').addEventListener('click', () => {
    if (typeof openAAPanel === 'function') openAAPanel();
  });

  document.getElementById('btnToggleAA').addEventListener('change', function() {
    if (typeof window._setAAState === 'function') {
      window._setAAState(this.checked);
    }
    if (typeof updateAATabUI === 'function') setTimeout(updateAATabUI, 300);
  });

  // Mail CRIBS
  document.getElementById('btnToggleMailCribs').addEventListener('change', function() {
    if (typeof window._setMailCribsEnabled === 'function') {
      window._setMailCribsEnabled(this.checked);
    }
    setTimeout(updateMailCribsUI, 300);
  });

  // Smart Mailing
  document.getElementById('btnOpenMLConfig').addEventListener('click', () => {
    if (typeof openMLPanel === 'function') openMLPanel();
  });
  document.getElementById('btnScrapeML').addEventListener('click', () => {
    updateMLContactList();
  });
  document.getElementById('btnStartCarta').addEventListener('click', function() {
    if (this._mailingActive) {
      if (typeof window._abortMailingRound === 'function') window._abortMailingRound();
      this.textContent = '⏹ DETENIENDO...';
      this.style.background = '#dc2626';
      this._mailingActive = false;
    } else {
      startCartaMailing();
    }
  });
  
  // Blacklist
  document.getElementById('btnBlAdd').addEventListener('click', () => {
    const input = document.getElementById('blInput');
    const id = input.value.trim();
    if (!id) return;
    if (!blacklist.includes(id)) {
      blacklist.push(id);
      saveBlacklist();
      renderBlacklistTab();
      input.value = '';
      if (typeof showToast === 'function') showToast('Contacto ' + id + ' bloqueado', 'success', 2000);
    } else {
      alert('⚠️ Este contacto ya está en blacklist');
    }
  });
  document.getElementById('blInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnBlAdd').click();
  });
  renderBlacklistTab();

  // Eater suggestions
  // ===== EATER textarea: seleccionar texto lo copia al chat =====
  document.getElementById('eaterResponseArea').addEventListener('mouseup', function() {
    const sel = this.selectionStart !== this.selectionEnd;
    if (sel) {
      const text = this.value.substring(this.selectionStart, this.selectionEnd);
      if (text && text !== 'Esperando mensaje...') {
        copyToChatInput(text);
        this.style.borderColor = '#4CAF50';
        setTimeout(() => this.style.borderColor = '#8b5cf6', 600);
        this.selectionStart = this.selectionEnd;
      }
    }
  });
  
  makeDraggable('tesseract-main-panel', '.tess-header');

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'E') { e.preventDefault(); if(isAuthenticated) toggleEater(); }
    if (e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); currentTab = 'star'; renderStarIds(); }
  });
  
  console.log('[TESSERACT] ✅ Eventos configurados');
}

// ============ AUTENTICACIÓN (vía servidor) ============
// ============ MÓDULOS ============
// Bridge: updateStats is called by like-follow-photos.js to refresh results counter
function updateStats() {
  var el = document.getElementById('vTotal');
  if (el) el.textContent = (window.lfpStats && window.lfpStats.processed) || 0;
}

function toggleSaludos() { console.log('[TESSERACT] Saludos Masivos deshabilitado'); }
function toggleCartas() { console.log('[TESSERACT] Cartas deshabilitado'); }

// ============ RENDER STAR IDS ============
function renderStarIds() {
  const out = document.getElementById('stOutput');
  const count = document.getElementById('stCount');
  const totalLive = document.getElementById('starTotalLive');
  if (!out || !count) return;
  
  const likesCount = (collectedIds.Like || []).length;
  const followsCount = (collectedIds.Follow || []).length;
  const lfpCount = (collectedIds.LFP || []).length;
  const lfCount = likesCount + followsCount + lfpCount;
  const saludosCount = (collectedIds.Saludo || []).length;
  const cartasCount = (collectedIds.Cartas || []).length;
  const totalAll = lfCount + saludosCount + cartasCount;
  
  const cntAll = document.getElementById('cntAll');
  const cntLF = document.getElementById('cntLF');
  const cntSaludo = document.getElementById('cntSaludo');
  const cntCartas = document.getElementById('cntCartas');
  
  if (cntAll) cntAll.textContent = totalAll;
  if (cntLF) cntLF.textContent = lfCount;
  if (cntSaludo) cntSaludo.textContent = saludosCount;
  if (cntCartas) cntCartas.textContent = cartasCount;
  // Indicador LIVE con pulso cuando hay barrido activo
  const anyActive = likesActive || followsActive || saludosActive || cartasActive;
  if (totalLive) totalLive.innerHTML = anyActive
    ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#4CAF50;margin-right:5px;animation:blink 1s infinite;"></span>${totalAll} IDs capturados`
    : `${totalAll} IDs capturados`;
  
  let ids = [];
  if (currentStarFilter === 'all') {
    ['Like', 'Follow', 'LFP', 'Saludo', 'Cartas'].forEach(t => {
      (collectedIds[t] || []).forEach(id => ids.push({ id: id, type: t }));
    });
  } else if (currentStarFilter === 'L+F') {
    ['Like', 'Follow', 'LFP'].forEach(t => {
      (collectedIds[t] || []).forEach(id => ids.push({ id: id, type: t }));
    });
  } else {
    (collectedIds[currentStarFilter] || []).forEach(id => ids.push({ id: id, type: currentStarFilter }));
  }
  
  count.textContent = 'TOTAL: ' + ids.length + ' IDs';
  
  if (ids.length === 0) {
    out.innerHTML = '<div class="idhdr"><span>#</span><span>ID CLIENTE</span><span>BARRIDO</span></div><div class="empty">⭐ SIN IDs DE "' + currentStarFilter.toUpperCase() + '"<br><small>Ejecuta un barrido para recolectar IDs</small></div>';
    return;
  }
  
  // Scroll al último si se agregó un nuevo ID (cuando estamos en la parte baja)
  const wasAtBottom = out.scrollTop + out.clientHeight >= out.scrollHeight - 10;

  out.innerHTML = '<div class="idhdr"><span>#</span><span>ID CLIENTE</span><span>BARRIDO</span></div>' +
    ids.map((item, i) => `
    <div class="idrow">
      <span class="idnum">${String(i + 1).padStart(3, '0')}</span>
      <span class="idval">${item.id}</span>
      <span class="idtag ${item.type}">${item.type}</span>
    </div>`).join('');

  // Auto-scroll al último ID si el usuario ya estaba al fondo
  if (wasAtBottom) out.scrollTop = out.scrollHeight;
}

// ============ CONFIGURACIONES ============
function openSaludosConfig() {
  document.getElementById('sMsg1').value = saludoMessages[0] || '';
  document.getElementById('sMsg2').value = saludoMessages[1] || '';
  document.getElementById('sMsg3').value = saludoMessages[2] || '';
  document.getElementById('sMsg4').value = saludoMessages[3] || '';
  document.getElementById('sMsg5').value = saludoMessages[4] || '';
  document.getElementById('saludosModal').style.display = 'block';
}

function saveSaludosConfig() {
  saludoMessages = [
    document.getElementById('sMsg1').value.trim(),
    document.getElementById('sMsg2').value.trim(),
    document.getElementById('sMsg3').value.trim(),
    document.getElementById('sMsg4').value.trim(),
    document.getElementById('sMsg5').value.trim()
  ].filter(m => m.length > 0);
  if (!saludoMessages.length) saludoMessages = ['Hola, ¿cómo estás?'];
  document.getElementById('saludosModal').style.display = 'none';
  saveAllStates();
}

function openCartasConfig() {
  document.getElementById('cartaText').value = cartaMessages.join('\n---\n');
  document.getElementById('cartasModal').style.display = 'block';
}

function saveCartasConfig() {
  const raw = document.getElementById('cartaText').value.trim();
  if (raw) {
    cartaMessages = raw.split('---').map(m => m.trim()).filter(m => m.length > 0);
  }
  if (!cartaMessages.length) cartaMessages = ['Querido/a amigo/a, me encantaría conocerte mejor.'];
  document.getElementById('cartasModal').style.display = 'none';
  saveAllStates();
}

// ============ MAIL CRIBS UI ============
function updateMailCribsUI() {
  const cfg = window._getMailCribsConfig ? window._getMailCribsConfig() : null;
  if (!cfg) return;
  const toggle = document.getElementById('btnToggleMailCribs');
  const status = document.getElementById('mcStatusInline');
  if (toggle) toggle.checked = cfg.enabled || false;
  if (status) {
    status.textContent = cfg.enabled ? 'ACTIVO' : 'INACTIVO';
    status.style.color = cfg.enabled ? '#4CAF50' : '#666';
  }
}

// ============ UTILIDADES ============
function clearIDs() {
  if (!Object.values(collectedIds).some(arr => arr.length > 0)) return;
  collectedIds = { Saludo: [], Like: [], Follow: [], LFP: [], Cartas: [] };
  renderStarIds();
  saveAllStates();
  console.log('[STAR-TOOLS] 🧹 IDs limpiados');
}

function collectFilteredIds() {
  var ids = [];
  if (currentStarFilter === 'all') {
    ['Like', 'Follow', 'LFP', 'Saludo', 'Cartas'].forEach(function (t) { (collectedIds[t] || []).forEach(function (id) { ids.push({id:id,t:t}); }); });
  } else if (currentStarFilter === 'L+F') {
    ['Like', 'Follow', 'LFP'].forEach(function (t) { (collectedIds[t] || []).forEach(function (id) { ids.push({id:id,t:t}); }); });
  } else {
    (collectedIds[currentStarFilter] || []).forEach(function (id) { ids.push({id:id,t:currentStarFilter}); });
  }
  return ids;
}

function exportIDs() {
  var items = collectFilteredIds();
  if (!items.length) { alert('No hay IDs para exportar.'); return; }
  var lines = items.map(function (item) { return String(item.id).replace(/^0+/, ''); });
  var now = new Date();
  var ts = now.toISOString().slice(0,19).replace('T','_').replace(/:/g,'-');
  var BOM = '\uFEFF';
  var csv = BOM + lines.join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tesseract_ids_' + ts + '.csv';
  a.click();
  console.log('[STAR-TOOLS] Exportados', items.length, 'IDs');
}

function copyIDs() {
  var items = collectFilteredIds();
  if (!items.length) return;
  var lines = items.map(function (item) { return String(item.id).replace(/^0+/, ''); });
  navigator.clipboard.writeText(lines.join('\n'));
}

// ============ SINCRONIZACIÓN PERIÓDICA CON SERVIDOR ============
let periodicSyncInterval = null;

function startPeriodicSync() {
  if (periodicSyncInterval) clearInterval(periodicSyncInterval);
  periodicSyncInterval = setInterval(async () => {
    const totalSweeps = (collectedIds.Like?.length || 0) +
                        (collectedIds.Follow?.length || 0) +
                        (collectedIds.LFP?.length || 0) +
                        (collectedIds.Saludo?.length || 0) +
                        (collectedIds.Cartas?.length || 0);

    try {
      const [token, userOffice] = await Promise.all([
        new Promise(r => chrome.storage.local.get('tess_jwt', d => r(d.tess_jwt))),
        new Promise(r => chrome.storage.local.get('user_office', d => r(d.user_office)))
      ]);
      if (token) {
        const res = await fetch(`${TESSERACT_API}/api/tess/metrics/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            stats: botStats,
            collectedIds: collectedIds,
            action: 'PERIODIC_SYNC',
            count: totalSweeps,
            office: userOffice || null
          })
        });
        if (!res.ok) console.warn('[TESS] Periodic sync error:', res.status);
      }
    } catch (e) {
      console.warn('[TESS] Periodic sync error (offline?):', e.message);
    }

    // Heartbeat al servidor para tracking online/offline
    chrome.storage.local.get('tess_jwt', function (data) {
      if (data.tess_jwt) {
        fetch(`${TESSERACT_API}/api/tess/admin/heartbeat`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + data.tess_jwt }
        }).catch(function () {});
      }
    });

    // También guardar local como respaldo
    chrome.storage.local.set({
      tess_heartbeat: Date.now(),
      bot_connected_user: currentUser,
      tess_stats: botStats,
      tess_ids: collectedIds,
      bot_likesGiven: botStats.likesGiven,
      bot_followsGiven: botStats.followsGiven,
      bot_cartasSent: botStats.cartasSent,
      bot_sweepCount: totalSweeps,
      bot_repliesReceived: botStats.repliesReceived,
      bot_repliesResponded: botStats.repliesResponded,
      bot_idsLikes: collectedIds.Like?.length || 0,
      bot_idsFollows: collectedIds.Follow?.length || 0,
      bot_idsSaludos: collectedIds.Saludo?.length || 0,
      bot_idsCartas: collectedIds.Cartas?.length || 0,
      user_email: currentUser
    });
    updateStats();
  }, 10000);
}

// ============ AUTO-ANSWER TAB UI ============
function updateAATabUI() {
  const cfg = typeof getAAConfig === 'function' ? getAAConfig() : null;
  if (!cfg) return;

  document.getElementById('aaStatusInline').textContent = cfg.enabled ? 'ACTIVO' : 'INACTIVO';
  document.getElementById('aaStatusInline').style.color = cfg.enabled ? '#4CAF50' : '#666';

  const evts = ['like', 'wink', 'comment', 'gift'];
  evts.forEach(ev => {
    const el = document.getElementById('aa' + ev.charAt(0).toUpperCase() + ev.slice(1) + 'Status');
    if (el) {
      const enabled = cfg.events?.[ev]?.enabled;
      el.textContent = enabled ? 'ACTIVO' : 'DESACTIVADO';
      el.style.color = enabled ? '#4CAF50' : '#666';
    }
  });

  document.getElementById('aaTodayResp').textContent = cfg.respondedToday || 0;
  document.getElementById('aaDailyLimit').textContent = cfg.maxDaily || 50;
}

// ============ SMART MAILING TAB UI ============
async function startCartaMailing() {
  var btn = document.getElementById('btnStartCarta');
  var progressEl = document.getElementById('mlCartaProgress');
  if (!progressEl) return;
  progressEl.style.display = 'block';
  progressEl.textContent = 'Preparando envio de cartas...';
  progressEl.style.color = '#8b5cf6';

  if (btn) {
    btn.textContent = '⏹ DETENER';
    btn.className = 'ml-btn ml-btn-danger';
    btn._mailingActive = true;
  }

  window._mlProgressCallback = function(text) {
    if (progressEl) progressEl.textContent = text;
  };

  var originalMaxDaily = null;
  try {
    if (typeof window._loadMailingConfigDirect === 'function') await window._loadMailingConfigDirect();
    var cfg = typeof window._getMailingConfigDirect === 'function' ? window._getMailingConfigDirect() : null;
    if (!cfg) { progressEl.textContent = 'Error: config no disponible'; progressEl.style.color = '#dc2626'; window._mlProgressCallback = null; if (btn) { btn.textContent = '📨 INICIAR ENVÍO'; btn.className = 'ml-btn ml-btn-success'; btn._mailingActive = false; } return; }
    // Guardar y desactivar el limite diario para procesar todas las paginas
    originalMaxDaily = cfg.maxDaily;
    cfg.maxDaily = 99999;
    cfg.enabled = true;
    cfg.useEmailSection = true;
    if (typeof window._saveMailingConfigDirect === 'function') await window._saveMailingConfigDirect();
    if (typeof window._setMailingState === 'function') await window._setMailingState(true);

    var result;
    if (typeof window._executeEmailMailingRound === 'function') {
      result = await window._executeEmailMailingRound();
    } else if (typeof window._executeMailingRound === 'function') {
      result = await window._executeMailingRound();
    } else {
      progressEl.textContent = 'Error: modulo mailing no disponible';
      progressEl.style.color = '#dc2626';
      window._mlProgressCallback = null;
      if (btn) { btn.textContent = '📨 INICIAR ENVIO DE CARTAS'; btn.style.background = '#059669'; btn.style.borderColor = '#059669'; btn._mailingActive = false; }
      return;
    }
    if (result) {
      var aborted = window._getMailingAbortState ? window._getMailingAbortState() : false;
      var msg = aborted ? '🛑 Detenido por usuario. ' : 'Completado: ';
      msg += result.sent + ' cartas enviadas';
      if (result.total > 0) msg += ' (' + result.total + ' contactos escaneados';
      if (result.blacklisted > 0) msg += ', ' + result.blacklisted + ' blacklist';
      if (result.activeSkipped > 0) msg += ', ' + result.activeSkipped + ' dialogo activo';
      if (result.skipped > 0) msg += ', ' + result.skipped + ' saltados';
      if (result.total > 0) msg += ')';
      progressEl.textContent = msg;
      progressEl.style.color = result.sent > 0 ? '#4CAF50' : '#f59e0b';
    } else {
      progressEl.textContent = 'Error al ejecutar envio';
      progressEl.style.color = '#dc2626';
    }
    if (typeof updateMLTabUI === 'function') updateMLTabUI();
  } catch (e) {
    progressEl.textContent = 'Error: ' + (e.message || 'desconocido');
    progressEl.style.color = '#dc2626';
  }
  // Restaurar el limite diario original
  if (originalMaxDaily !== null && typeof window._getMailingConfigDirect === 'function') {
    var restored = window._getMailingConfigDirect();
    if (restored) {
      restored.maxDaily = originalMaxDaily;
      if (typeof window._saveMailingConfigDirect === 'function') window._saveMailingConfigDirect();
    }
  }
  window._mlProgressCallback = null;
  if (btn) {
    btn.textContent = '📨 INICIAR ENVIO DE CARTAS';
    btn.style.background = '#059669';
    btn.style.borderColor = '#059669';
    btn._mailingActive = false;
  }
  setTimeout(function() {
    if (progressEl) { progressEl.style.display = 'none'; }
  }, 15000);
}

function updateMLTabUI() {
  var cfg = typeof getMailingConfig === 'function' ? getMailingConfig() : null;
  if (!cfg && typeof window._getMailingConfigDirect === 'function') {
    cfg = window._getMailingConfigDirect();
  }
  if (!cfg) return;

  document.getElementById('mlStatusInline').textContent = cfg.enabled ? 'ACTIVO' : 'INACTIVO';
  document.getElementById('mlStatusInline').style.color = cfg.enabled ? '#4CAF50' : '#666';

  document.getElementById('mlSentTodayInline').textContent = cfg.sentToday || 0;
  document.getElementById('mlDailyLimitInline').textContent = cfg.maxDaily || 30;
  document.getElementById('mlIntervalDisplay').textContent = (cfg.delay?.min ? Math.floor(cfg.delay.min / 1000) + '-' + Math.floor(cfg.delay.max / 1000) + 's' : '3-7s');

  const preview = (cfg.messageTemplate || '').slice(0, 40);
  document.getElementById('mlMsgPreview').textContent = preview + (preview.length >= 40 ? '...' : '');

  const stats = typeof window._getMailingStats === 'function' ? window._getMailingStats() : null;
  document.getElementById('mlQueueCountInline').textContent = stats?.lastScrapedCount ?? '--';
}
window._updateMLTabUI = updateMLTabUI;

let _mlPollTimer = null;

function startMLStatsPolling() {
  stopMLStatsPolling();
  _mlPollTimer = setInterval(function() {
    try {
      var cfg = typeof window._getMailingConfigDirect === 'function' ? window._getMailingConfigDirect() : null;
      if (!cfg) return;
      var elSent = document.getElementById('mlSentTodayInline');
      var elLimit = document.getElementById('mlDailyLimitInline');
      var elQueue = document.getElementById('mlQueueCountInline');
      if (elSent) elSent.textContent = cfg.sentToday || 0;
      if (elLimit) elLimit.textContent = cfg.maxDaily || 30;
      if (elQueue) {
        var stats = typeof window._getMailingStats === 'function' ? window._getMailingStats() : null;
        elQueue.textContent = stats?.lastScrapedCount ?? '--';
      }
    } catch (e) {}
  }, 3000);
}

function stopMLStatsPolling() {
  if (_mlPollTimer) { clearInterval(_mlPollTimer); _mlPollTimer = null; }
}

function updateMLContactList() {
  const container = document.getElementById('mlContactList');
  if (!container) return;
  const scrapeFn = typeof window._scrapeActiveLimitsIds === 'function' ? window._scrapeActiveLimitsIds : null;
  if (!scrapeFn) { container.innerHTML = '<div style="padding:12px;text-align:center;color:#888;font-size:10px;">Smart Mailing no disponible</div>'; container.style.display = 'block'; return; }
  const contacts = scrapeFn();
  if (!contacts || contacts.length === 0) {
    container.innerHTML = '<div style="padding:12px;text-align:center;color:#888;font-size:10px;">Sin contactos disponibles. Asegúrate de estar en Active Limits.</div>';
    container.style.display = 'block';
    document.getElementById('mlQueueCountInline').textContent = '0';
    return;
  }
  const typeLabels = { active: '💬 ACTIVO', recurring: '🔄 RECURRENTE', new: '🆕 NUEVO' };
  const typeColors = { active: '#f59e0b', recurring: '#3b82f6', new: '#22c55e' };
  var isBlocked = typeof window._isInMLBlacklist === 'function' ? function(id) { return window._isInMLBlacklist(id); } : function(id) { return blacklist.includes(String(id)); };
  let html = '<div style="font-size:9px;color:#888;padding:6px 8px;border-bottom:1px solid #e0e0e8;font-weight:600;">CONTACTOS (' + contacts.length + ')</div>';
  contacts.forEach(function (c) {
    var blocked = isBlocked(c.id);
    var label = blocked ? '🚫 BLOQUEADO' : (typeLabels[c.contactType] || '🆕 NUEVO');
    var color = blocked ? '#dc2626' : (typeColors[c.contactType] || '#22c55e');
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-bottom:1px solid #f0f0f5;font-size:10px;' + (blocked ? 'opacity:0.5;text-decoration:line-through;' : '') + '">';
    html += '<span style="color:#1a1a2e;font-weight:500;">#' + c.id + '</span>';
    html += '<span style="font-size:8px;padding:2px 6px;border-radius:4px;background:' + color + '20;color:' + color + ';font-weight:600;">' + label + '</span>';
    html += '</div>';
  });
  container.innerHTML = html;
  container.style.display = 'block';
  document.getElementById('mlQueueCountInline').textContent = contacts.length;
}

// ============ STORAGE ============
async function saveAllStates() {
  await chrome.storage.local.set({
    tess_eater: eaterActive, tess_likes: likesActive, tess_follows: followsActive,
    tess_saludos: saludosActive, tess_cartas: cartasActive,
    tess_stats: botStats, tess_ids: collectedIds,
    bot_likesGiven: botStats.likesGiven,
    bot_followsGiven: botStats.followsGiven,
    bot_sweepCount: (collectedIds.Like?.length || 0) + (collectedIds.Follow?.length || 0) + (collectedIds.LFP?.length || 0),
    bot_idsLikes: collectedIds.Like?.length || 0,
    bot_idsFollows: collectedIds.Follow?.length || 0
  });
}

async function loadAllStates() {
  try {
const r = await chrome.storage.local.get([
      'tess_eater', 'tess_likes', 'tess_follows',
      'tess_saludos', 'tess_cartas', 'tess_stats', 'tess_ids'
    ]);
    if (r.tess_eater) {
      eaterActive = true;
      const btn = document.getElementById('btnEaterToggle');
      if (btn) { btn.textContent = '🧠 EATER: ON'; btn.className = 'eater-btn on'; }
      document.getElementById('eaterSuggestions').style.display = 'block';
    }
    if (r.tess_ids) collectedIds = r.tess_ids;
    if (r.tess_stats) botStats = r.tess_stats;
    if (r.tess_saludo_msgs) saludoMessages = r.tess_saludo_msgs;
    if (r.tess_carta_msg) {
      if (typeof r.tess_carta_msg === 'string') {
        cartaMessages = [r.tess_carta_msg];
      } else if (Array.isArray(r.tess_carta_msg)) {
        cartaMessages = r.tess_carta_msg;
      }
    }
    updateStats();
    renderStarIds();
  } catch (e) { console.error('[TESSERACT] Error cargando:', e); }
}

// ============ SINC MÉTRICAS CON SERVIDOR ============
async function syncMetricsToStorage(action, count) {
  try {
    console.log('[TESSERACT] syncMetricsToStorage:', action, count);

    // Obtener la oficina del usuario
    const userData = await new Promise(r => chrome.storage.local.get(['user_office', 'tess_user'], d => r(d)));
    const userOffice = userData.user_office || null;

    // Enviar al servidor
    try {
      const token = await new Promise(r => chrome.storage.local.get('tess_jwt', d => r(d.tess_jwt)));
      if (token) {
        const res = await fetch(`${TESSERACT_API}/api/tess/metrics/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            stats: botStats,
            collectedIds: collectedIds,
            action: action,
            count: count || 1,
            office: userOffice
          })
        });
        if (res.status === 401) {
          console.warn('[TESS] Token expirado en syncMetricsToStorage');
          chrome.storage.local.remove(['tess_jwt', 'tess_refresh']);
        } else if (!res.ok) {
          console.warn('[TESS] syncMetricsToStorage server error:', res.status);
        }
      } else {
        console.warn('[TESS] No hay token para sync');
      }
    } catch (e) {
      console.warn('[TESSERACT] Server sync failed (offline?):', e.message);
    }

    // También guardar local como respaldo
    const totalSweeps = (collectedIds.Like?.length || 0) +
                        (collectedIds.Follow?.length || 0) +
                        (collectedIds.LFP?.length || 0) +
                        (collectedIds.Saludo?.length || 0) +
                        (collectedIds.Cartas?.length || 0);

    const botLog = {
      action: action + (count ? ': ' + count + ' procesados' : ' completado'),
      timestamp: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      email: currentUser || 'unknown'
    };

    const botData = await chrome.storage.local.get(['bot_activity_log']);
    const botLogArr = botData.bot_activity_log || [];
    botLogArr.push(botLog);
    if (botLogArr.length > 5000) botLogArr.splice(0, botLogArr.length - 5000);

    await chrome.storage.local.set({
      bot_activity_log: botLogArr,
      tess_stats: botStats,
      tess_ids: collectedIds,
      bot_likesGiven: botStats.likesGiven,
      bot_followsGiven: botStats.followsGiven,
      bot_cartasSent: botStats.cartasSent,
      bot_sweepCount: totalSweeps,
      tess_last_action: { action, count, timestamp: Date.now(), email: currentUser }
    });

    console.log('[TESSERACT] sync OK:', action, count);
  } catch (e) {
    console.error('[TESSERACT] sync error:', e);
  }
}

// ============ INICIAR ============
console.log('[TESSERACT] 🚀 Script cargado, iniciando en 1s...');

function safeInit() {
  if (document.body) {
    console.log('[TESSERACT] 📄 Body disponible, ejecutando...');
    setTimeout(initTesseract, 1000);
  } else {
    console.log('[TESSERACT] ⏳ Esperando body...');
    setTimeout(safeInit, 500);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    safeInit();
  });
} else {
  safeInit();
}
