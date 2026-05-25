// TESSERACT v24 - L+F+P (Like + Follow + Photos) Module
// Simplified approach: history.back() always, no queue forward, robust photo likes

// Exports to both local scope (shared content script world) and window (page)
var executeLFP, lfpTogglePause, lfpActive = false;
var lfpPaused = false;
var lfpStats = { likes: 0, follows: 0, photoLikes: 0, processed: 0 };
var lfpVisited = [];
var lfpBlacklist = [];
var lfpBlacklistLoaded = false;
var lfpBlacklistLoadPromise = null;

async function lfpLoadBlacklist() {
  if (lfpBlacklistLoadPromise) return lfpBlacklistLoadPromise;
  lfpBlacklistLoadPromise = (async () => {
    for (var attempt = 0; attempt <= 2; attempt++) {
      try {
        var stored = await chrome.storage.local.get(['tess_jwt']);
        if (!stored.tess_jwt) { lfpBlacklistLoadPromise = null; return; }
        var res = await fetch(`${TESSERACT_API}/api/tess/blacklist`, {
          headers: { 'Authorization': 'Bearer ' + stored.tess_jwt }
        });
        if (!res.ok && attempt < 2) { await lfpSleep(1000); continue; }
        if (res.ok) {
          var data = await res.json();
          lfpBlacklist = (data.blacklist || []).map(String);
          lfpBlacklistLoaded = true;
        }
        break;
      } catch (e) {
        if (attempt >= 2) break;
        await lfpSleep(1000);
      }
    }
    lfpBlacklistLoadPromise = null;
  })();
  return lfpBlacklistLoadPromise;
}

function lfpIsBlacklisted(id) {
  return id && lfpBlacklist.indexOf(String(id)) !== -1;
}

async function reloadLFPBlacklist() {
  lfpBlacklist = []; lfpBlacklistLoaded = false; lfpBlacklistLoadPromise = null;
  await lfpLoadBlacklist();
}

function lfpSleep(ms) {
  if (!lfpActive) return Promise.resolve();
  return new Promise(function (r) {
    var step = 100;
    var t = setInterval(function () {
      ms -= step;
      if (!lfpActive || ms <= 0) { clearInterval(t); r(); }
    }, step);
  });
}

function lfpToast(msg, type) {
  if (typeof showInPageToast === 'function') { showInPageToast(msg, type); return; }
  var el = document.getElementById('tess-toast');
  if (!el) { el = document.createElement('div'); el.id = 'tess-toast';
    el.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:99999;padding:10px 18px;border-radius:8px;font-family:Orbitron,sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;color:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);transition:opacity 0.3s;';
    document.body.appendChild(el);
  }
  el.style.background = type === 'error' ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : type === 'success' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#3b82f6,#2563eb)';
  el.textContent = msg; el.style.opacity = '1';
  if (window.__tt) clearTimeout(window.__tt);
  window.__tt = setTimeout(function () { el.style.opacity = '0'; }, 2500);
}

function lfpIsBlocked() {
  var p = [/blocked you/i, /has blocked you/i, /can't view their profile/i, /te ha bloqueado/i, /no puedes ver su perfil/i, /has blocked/i, /user has blocked/i];
  function tm(el) { return el && el.textContent && p.some(function (x) { return x.test(el.textContent); }); }
  if (tm(document.body)) return true;
  try { var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false); var n; while ((n = w.nextNode())) { if (n.textContent && p.some(function (x) { return x.test(n.textContent); })) return true; } } catch (e) {}
  return false;
}

function lfpPhotoViewerOpen() {
  return !!(document.querySelector('.photo-viewer') || document.querySelector('[data-test-id*="photo-view"]') || document.querySelector('[role="dialog"]') || document.querySelector('button[aria-label="Close"]') || document.querySelector('[class*="gallery"]') || document.querySelector('.modal-overlay'));
}

function lfpFindNextPage() {
  var cp = parseInt(localStorage.getItem('tessSearchPage') || '1');
  var np = cp + 1;
  if (np > 25) return null;
  var btn = document.querySelector('[data-test-id="cmp:ui-button click:change-page-n ' + np + '"]');
  if (btn) return btn;
  btn = document.querySelector('button:has(svg[data-icon="chevron-right"])');
  if (btn) return btn;
  btn = Array.from(document.querySelectorAll('a, button')).find(function (el) { var t = el.textContent && el.textContent.trim(); return t === 'Next' || t === 'Siguiente'; });
  if (btn) return btn;
  // Fallback: buscar cualquier botón de paginación numérica
  var allBtns = document.querySelectorAll('[data-test-id*="change-page-n"]');
  for (var i = 0; i < allBtns.length; i++) {
    var match = allBtns[i].getAttribute('data-test-id').match(/change-page-n\s+(\d+)/);
    if (match && parseInt(match[1]) === np) return allBtns[i];
  }
  return null;
}

// Navigate back to search preserving history state
// IMPORTANT: call history.back() only ONCE — retrying navigates further back past search!
async function lfpGoBack() {
  // Already on search page? nothing to do
  if (window.location.href.includes('/search/all') || window.location.href.includes('/search?')) return;
  try { window.history.back(); } catch (e) {}
  for (var w = 0; w < 100 && lfpActive; w++) {
    if (document.querySelectorAll('img.person-card__photo, img.photo-card, .person-card, [data-test-id*="person-card"]').length > 0) return;
    await lfpSleep(100);
  }
  // Fallback: save sweep state before hard navigation so it can resume
  try {
    localStorage.setItem('lfpSweepActive', '1');
    localStorage.setItem('lfpVisited', JSON.stringify(lfpVisited));
    localStorage.setItem('lfpStats', JSON.stringify(lfpStats));
    localStorage.setItem('lfpPage', localStorage.getItem('tessSearchPage') || '1');
  } catch (e) {}
  try { window.location.href = '/search/all'; } catch (e) {}
  for (var w2 = 0; w2 < 100 && lfpActive; w2++) {
    if (document.querySelectorAll('img.person-card__photo, img.photo-card, .person-card, [data-test-id*="person-card"]').length > 0) return;
    await lfpSleep(200);
  }
}

// ============ PHOTO LIKES ============
async function lfpDoPhotos() {
  if (!lfpActive) return;
  await lfpSleep(200);
  var fp = document.querySelector('[data-test-id="file:media click:photo-view"]') || document.querySelector('[data-test-id*="photo-view"]') || document.querySelector('.profile-photo-wrap img') || document.querySelector('[class*="profile"] img[src*="photo"]');
  if (!fp) return;
  try { (fp.tagName === 'A' ? fp : (fp.closest('a') || fp)).click(); } catch (e) { try { fp.click(); } catch (e2) {} }
  await lfpSleep(1200);
  if (!lfpPhotoViewerOpen()) return;

  var limit = Date.now() + 8000;
  var idx = 0;
  while (idx < 5 && lfpActive && Date.now() < limit) {
    var btn = document.querySelector('button[data-test-id*="set-like"]') || document.querySelector('button.gallery-footer__like_narrow') || document.querySelector('button[data-test-id*="on-like"]') || document.querySelector('button[aria-label*="Like"]') || (function () { var pl = document.querySelector('p.label'); return pl && pl.closest('button'); })();
    if (btn && !btn.getAttribute('aria-pressed') && !btn.matches('[data-type="filled"],[data-type="solid"]')) {
      try { btn.click(); lfpStats.photoLikes++; } catch (e) {}
      await lfpSleep(200);
    }
    await lfpSleep(400);
    if (!lfpPhotoViewerOpen()) break;
    var nx = document.querySelector('button[aria-label*="Next"]') || document.querySelector('button[aria-label*="next"]') || document.querySelector('button[aria-label*="Siguiente"]') || document.querySelector('button[data-test-id*="next"]');
    if (nx && !nx.disabled) { try { nx.click(); await lfpSleep(600); idx++; } catch (e) { break; } } else break;
  }
  var cl = document.querySelector('button[aria-label="Close"]') || document.querySelector('[aria-label*="close"]');
  if (cl) { try { cl.click(); } catch (e) { try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); } catch (e2) {} } }
  else { try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); } catch (e) {} }
  await lfpSleep(500);
}

// ============ PROCESS PROFILE ============
async function lfpProcessOne() {
  if (!lfpActive) return;
  await lfpSleep(400);

  for (var a = 0; a < 30 && lfpActive; a++) {
    if (lfpIsBlocked()) {
      lfpToast('\u23ED\uFE0F Bloqueado', 'info');
      return;
    }
    if (document.querySelectorAll('button[data-test-id*="on-like"], button[data-test-id*="on-follow"]').length > 0) break;
    var bt = Array.from(document.querySelectorAll('button, a[role="button"]')).find(function (el) { var t = (el.textContent || '') + (el.getAttribute('aria-label') || ''); return /like|follow|wink/i.test(t); });
    if (bt) break;
    await lfpSleep(150);
  }
  if (!lfpActive) return;

  // Like
  var lb = document.querySelector('button[data-test-id*="on-like"]');
  if (lb) {
    var svg = lb.querySelector('svg');
    if ((svg && svg.id === 'HeartOutline') || lb.getAttribute('data-selected') === 'false') {
      try { lb.scrollIntoView({ block: 'center' }); await lfpSleep(80); lb.click(); lfpStats.likes++; lfpStats.processed++; if (typeof botStats !== 'undefined') { botStats.likesGiven++; botStats.contactsProcessed++; } } catch (e) {}
      await lfpSleep(120);
    }
  }
  if (!lfpActive) return;

  // Follow
  var fb = document.querySelector('button[data-test-id*="on-follow"]');
  if (fb) {
    var ft = (fb.textContent || '').toLowerCase() + (fb.getAttribute('aria-label') || '').toLowerCase();
    if (!/\b(following|siguiendo|unfollow)\b/.test(ft) && !fb.querySelector('svg[id*="Check"]')) {
      try { fb.scrollIntoView({ block: 'center' }); await lfpSleep(80); fb.click(); lfpStats.follows++; if (typeof botStats !== 'undefined') botStats.followsGiven++; } catch (e) {}
      await lfpSleep(120);
    }
  }
  if (!lfpActive) return;

  // Photos (with timeout)
  var hasPhoto = document.querySelector('[data-test-id*="photo-view"]') || document.querySelector('.profile-photo-wrap img');
  if (hasPhoto && lfpActive) {
    try { await Promise.race([lfpDoPhotos(), new Promise(function (r) { setTimeout(r, 12000); })]); } catch (e) {}
  } else { await lfpSleep(100); }
  if (!lfpActive) return;

  if (typeof updateStats === 'function') updateStats();
}

// ============ MAIN SWEEP ============
executeLFP = window.executeLFP = async function () {
  if (lfpActive) {
    lfpActive = false; lfpPaused = false;
    // Clear saved sweep state on toggle-off
    try { localStorage.removeItem('lfpSweepActive'); localStorage.removeItem('lfpVisited'); localStorage.removeItem('lfpStats'); localStorage.removeItem('lfpPage'); } catch (e) {}
    if (typeof updateStats === 'function') updateStats();
    lfpUpdateUI();
    if (typeof saveAllStates === 'function') saveAllStates();
    return;
  }

  if (typeof likesActive !== 'undefined') { likesActive = false; followsActive = false; likeFollowActive = false; }

  lfpActive = true; lfpPaused = false;
  lfpStats.likes = 0; lfpStats.follows = 0; lfpStats.photoLikes = 0; lfpStats.processed = 0;
  lfpVisited = []; window.lfpStats = lfpStats;
  lfpUpdateUI();
  if (typeof saveAllStates === 'function') saveAllStates();

  await lfpLoadBlacklist();

  try { var m = window.location.href.match(/[?&]page=(\d+)/); localStorage.setItem('tessSearchPage', m ? m[1] : '1'); } catch (e) {}
  if (window.location.href.includes('/mails/')) { lfpToast('\u26A0\uFE0F Est\u00E1s en Mail. Usa Search.', 'error'); lfpActive = false; lfpUpdateUI(); return; }

  // Restore sweep state after hard reload
  var resumed = false;
  try {
    if (localStorage.getItem('lfpSweepActive') === '1') {
      var savedVisited = JSON.parse(localStorage.getItem('lfpVisited') || '[]');
      var savedStats = JSON.parse(localStorage.getItem('lfpStats') || '{}');
      if (Array.isArray(savedVisited) && savedVisited.length > 0) {
        lfpVisited = savedVisited;
        if (savedStats.likes != null) { lfpStats.likes = savedStats.likes; lfpStats.follows = savedStats.follows; lfpStats.photoLikes = savedStats.photoLikes; lfpStats.processed = savedStats.processed; }
        var savedPage = localStorage.getItem('lfpPage');
        if (savedPage) localStorage.setItem('tessSearchPage', savedPage);
        resumed = true;
        lfpToast('\uD83D\uDD04 Reanudando L+F+P (' + lfpStats.processed + ' procesados)...', 'success');
      }
      localStorage.removeItem('lfpSweepActive');
    }
  } catch (e) {}

  if (!resumed) {
    // Recovery: if on a profile page, process it first
    if (!window.location.href.includes('/search/all') && !window.location.href.includes('/search?')) {
      var isP = document.querySelectorAll('button[data-test-id*="on-like"], button[data-test-id*="on-follow"]').length > 0;
      if (isP) {
        lfpToast('\uD83D\uDD04 Recuperando perfil...', 'success');
        var recId = (window.location.href.match(/\/(\d{6,15})(?:[/?#]|$)/) || [])[1];
        await lfpProcessOne();
        if (recId && typeof registerIdInStarTools === 'function') registerIdInStarTools(recId, 'LFP');
        await lfpGoBack();
        await lfpSleep(1000);
      }
    }
  }

  if (!resumed) lfpToast('\u26A1 L+F+P Iniciado', 'success');
  var maxPages = 25;

  while (lfpActive) {
    var hasC = document.querySelectorAll('img.person-card__photo, img.photo-card, .person-card, [data-test-id*="person-card"]').length > 0;
    if (!hasC) {
      var pg = lfpFindNextPage();
      if (pg) { try { pg.click(); } catch (e) {} var nextCp = parseInt(localStorage.getItem('tessSearchPage') || '1') + 1; localStorage.setItem('tessSearchPage', String(nextCp)); await lfpSleep(1600); continue; }
      lfpToast('No hay perfiles. Fin.', 'info');
      break;
    }
    var imgs = Array.from(document.querySelectorAll('img.person-card__photo, img.photo-card'));
    if (imgs.length === 0) {
      var cards = Array.from(document.querySelectorAll('.person-card, [data-test-id*="person-card"]'));
      cards.forEach(function (c) { var i = c.querySelector('img'); if (i) imgs.push(i); });
    }
    var toProcess = null;
    for (var ii = 0; ii < imgs.length; ii++) {
      var pid = imgs[ii].dataset.userId || imgs[ii].src || (imgs[ii].closest('[data-test-id*="person-card"]') ? imgs[ii].closest('[data-test-id*="person-card"]').dataset.userId : null);
      if (!pid || lfpVisited.indexOf(pid) !== -1) continue;
      var card = imgs[ii].closest('.person-card, [data-test-id*="person-card"], [data-test-id*="profile-card"]');
      var heart = card ? card.querySelector('button[data-test-id*="like-profile"]') : null;
      var svg = heart ? heart.querySelector('svg') : null;
      if (!svg || svg.id === 'HeartOutline') { toProcess = imgs[ii]; break; }
    }
    if (!toProcess) {
      var pg = lfpFindNextPage();
      if (pg) { try { pg.click(); } catch (e) {} var nextCp2 = parseInt(localStorage.getItem('tessSearchPage') || '1') + 1; localStorage.setItem('tessSearchPage', String(nextCp2)); await lfpSleep(2000); continue; }
      lfpToast('No m\u00E1s p\u00E1ginas. Fin.', 'info');
      break;
    }
    var profileId = (function () { var lk = toProcess.closest('a[href*="/profile"], a[href*="/user"]'); var lm = lk && lk.href && lk.href.match(/\/(\d{6,15})(?:[/?#]|$)/); return lm ? lm[1] : (toProcess.dataset.userId || null); })();
    if (!lfpActive) break;
    if (profileId && lfpIsBlacklisted(profileId)) { lfpVisited.push(profileId); lfpToast('\u26D4 Blacklist: ' + profileId, 'error'); await lfpSleep(300); continue; }
    toProcess.scrollIntoView({ behavior: 'auto', block: 'center' });
    await lfpSleep(100);
    try {
      var lnk = toProcess.closest('a[href*="/profile"], a[href*="/user"]') || (toProcess.parentElement && toProcess.parentElement.tagName === 'A' ? toProcess.parentElement : null);
      if (lnk) lnk.click(); else toProcess.click();
    } catch (e) { var cd = toProcess.closest('.person-card'); if (cd) { try { cd.click(); } catch (e2) {} } }
    await lfpSleep(300);
    if (!lfpActive) break;
    // Extract numeric ID from profile URL after navigation (more reliable than card data)
    var urlId = (window.location.href.match(/\/(\d{6,15})(?:[/?#]|$)/) || [])[1];
    if (urlId) profileId = urlId;
    try { await Promise.race([lfpProcessOne(), new Promise(function (_, rj) { setTimeout(function () { rj(new Error('T')); }, 35000); })]); } catch (e) { lfpToast('\u23ED\uFE0F Timeout', 'info'); }
    if (!lfpActive) break;
    lfpVisited.push(profileId);
    if (typeof registerIdInStarTools === 'function') registerIdInStarTools(profileId, 'LFP');
    if (typeof renderStarIds === 'function') renderStarIds();
    if (typeof saveAllStates === 'function') saveAllStates();
    await lfpGoBack();
    await lfpSleep(600);
  }
  lfpActive = false; lfpPaused = false;
  try { localStorage.removeItem('lfpSweepActive'); localStorage.removeItem('lfpVisited'); localStorage.removeItem('lfpStats'); localStorage.removeItem('lfpPage'); } catch (e) {}
  lfpUpdateUI();
  if (typeof saveAllStates === 'function') saveAllStates();
  if (typeof syncMetricsToStorage === 'function') syncMetricsToStorage('LFP', lfpStats.processed);
  lfpToast('\u2705 L+F+P completado: ' + lfpStats.processed + ' contactos', 'success');
};

function lfpUpdateUI() {
  var btn = document.getElementById('btnLFPToggle');
  var st = document.getElementById('lfpStatus');
  if (btn) { btn.textContent = lfpActive ? (lfpPaused ? '\u25B6 L+F+P' : '\u23F8 L+F+P') : '\u25B6 L+F+P'; btn.className = lfpActive ? 'on' : ''; }
  if (st) { st.textContent = lfpActive ? (lfpPaused ? 'PAUSADO' : 'ACTIVO') : 'INACTIVO'; st.style.color = lfpActive ? (lfpPaused ? '#f59e0b' : '#4CAF50') : '#ffffff'; }
  if (typeof updateStats === 'function') updateStats();
}

lfpTogglePause = window.lfpTogglePause = function () { if (!lfpActive) return; lfpPaused = !lfpPaused; lfpUpdateUI(); if (typeof saveAllStates === 'function') saveAllStates(); };
window.lfpActive = false;
window.lfpStats = lfpStats;