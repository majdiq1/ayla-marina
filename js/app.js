/* Ayla Marina — public map */

// ---------- 1. Load data ----------
const DATA = { levels: [], categories: [], pois: [], catById: {}, lvlById: {} };
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

async function loadData(){
  const v = '?v=' + Date.now();
  const [levels, categories, pois, settings] = await Promise.all([
    fetch('data/levels.json' + v, { cache: 'no-store' }).then(r => r.json()),
    fetch('data/categories.json' + v, { cache: 'no-store' }).then(r => r.json()),
    fetch('data/pois.json' + v, { cache: 'no-store' }).then(r => r.json()),
    fetch('data/settings.json' + v, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
  ]);
  DATA.settings = settings || {};
  DATA.levels = levels.sort((a,b) => a.sort_order - b.sort_order);
  // Apply admin edits on top before filtering
  const ov = readAdminPoiOverrides();
  DATA.categories = mergeAdminCats(categories, ov).sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const mergedPois = mergeAdminPois(pois, ov);
  DATA.pois = mergedPois.filter(p => p.is_active !== false);
  DATA.catById  = Object.fromEntries(DATA.categories.map(c => [c.id, c]));
  DATA.lvlById  = Object.fromEntries(DATA.levels.map(l => [l.id, l]));
}

// Admin override merging — same logic as admin.js so public map reflects admin edits
function readAdminPoiOverrides(){
  try { return JSON.parse(localStorage.getItem('ayla_admin_overrides_v1') || '{}'); } catch(_) { return {}; }
}
function mergeAdminPois(pois, o){
  let result = [...pois];
  const byId = Object.fromEntries(result.map((p, i) => [p.id, i]));
  for (const [id, edit] of Object.entries(o.updates || {})){
    if (id in byId) Object.assign(result[byId[id]], edit);
  }
  for (const newPoi of o.adds || []) result.push(newPoi);
  if (o.deletes?.length){
    const del = new Set(o.deletes);
    result = result.filter(p => !del.has(p.id));
  }
  return result;
}
function mergeAdminCats(cats, o){
  let result = [...cats];
  const byId = Object.fromEntries(result.map((c, i) => [c.id, i]));
  for (const [id, edit] of Object.entries(o.catUpdates || {})){
    if (id in byId) Object.assign(result[byId[id]], edit);
  }
  for (const newCat of o.catAdds || []) result.push(newCat);
  if (o.catDeletes?.length){
    const del = new Set(o.catDeletes);
    result = result.filter(c => !del.has(c.id));
  }
  return result;
}

// Read admin settings overrides from localStorage and apply them to the live UI
function readAdminSettings(){
  try { return JSON.parse(localStorage.getItem('ayla_settings_overrides_v1') || '{}'); } catch(_) { return {}; }
}
function applyAdminSettings(){
  // Start with what's in DATA.settings (the published settings.json), then
  // overlay any localStorage overrides on top (unpublished admin preview).
  const j = DATA.settings || {};
  const local = readAdminSettings();
  const s = {
    brand_name:       local.brand_name       ?? j.brand?.name           ?? null,
    brand_name_ar:    local.brand_name_ar    ?? j.brand?.name_ar        ?? null,
    splash_tag:       local.splash_tag       ?? j.brand?.splash_tagline ?? null,
    logo_data:        local.logo_data        ?? j.brand?.logo           ?? null,
    primary:          local.primary          ?? j.theme?.primary        ?? null,
    brand_size:       local.brand_size       ?? j.brand?.size           ?? null,
    brand_color:      local.brand_color      ?? j.brand?.color          ?? null,
    brand_accent_color: local.brand_accent_color ?? j.brand?.accent_color ?? null,
    font_heading_data: local.font_heading_data ?? j.theme?.font_heading_data ?? null,
    font_heading_name: local.font_heading_name ?? j.theme?.font_heading_name ?? null,
    font_body_data:    local.font_body_data    ?? j.theme?.font_body_data    ?? null,
    font_body_name:    local.font_body_name    ?? j.theme?.font_body_name    ?? null,
    show_illustrated: local.show_illustrated ?? j.map?.show_illustrated ?? true,
    show_satellite:   local.show_satellite   ?? j.map?.show_satellite   ?? true,
    show_new:         local.show_new         ?? j.map?.show_new         ?? true,
    default_concept:  local.default_concept  ?? j.map?.default_concept  ?? 'illustrated',
    map_ill_ground_desktop: local.map_ill_ground_desktop ?? j.map?.ill_ground_desktop ?? null,
    map_ill_ground_phone:   local.map_ill_ground_phone   ?? j.map?.ill_ground_phone   ?? null,
    map_ill_marina_desktop: local.map_ill_marina_desktop ?? j.map?.ill_marina_desktop ?? null,
    map_ill_marina_phone:   local.map_ill_marina_phone   ?? j.map?.ill_marina_phone   ?? null,
    map_new_ground_desktop: local.map_new_ground_desktop ?? j.map?.new_ground_desktop ?? null,
    map_new_ground_phone:   local.map_new_ground_phone   ?? j.map?.new_ground_phone   ?? null,
    map_new_marina_desktop: local.map_new_marina_desktop ?? j.map?.new_marina_desktop ?? null,
    map_new_marina_phone:   local.map_new_marina_phone   ?? j.map?.new_marina_phone   ?? null,
  };

  // Brand name
  if (s.brand_name){
    document.querySelectorAll('.brand-name').forEach(el => {
      const parts = s.brand_name.split(' ');
      const accent = parts.pop();
      el.innerHTML = `${parts.join(' ')} <span class="brand-accent">${escapeHtml(accent)}</span>`;
    });
    const t = document.querySelector('.splash-title') || document.querySelector('.splash-marina');
    if (t && document.querySelector('.splash-marina')){
      document.querySelector('.splash-marina').textContent = s.brand_name + (s.brand_name_ar ? '' : '');
    }
    document.title = s.brand_name;
  }
  if (s.splash_tag){
    const tag = document.querySelector('.splash-tag');
    if (tag) tag.textContent = s.splash_tag;
  }
  // Brand logo — drive both the splash and the persistent topbar mark
  if (s.logo_data){
    const splashLogo = document.querySelector('.splash-logo');
    if (splashLogo){ splashLogo.src = s.logo_data; splashLogo.style.filter = 'none'; }
    const brandLogo = document.getElementById('brand-logo');
    if (brandLogo){ brandLogo.src = s.logo_data; brandLogo.hidden = false; }
  }
  // Primary colour
  if (s.primary){
    document.documentElement.style.setProperty('--ayla-aqua', s.primary);
    document.documentElement.style.setProperty('--ayla-teal', s.primary);
    // Derive a deeper shade by darkening
    document.documentElement.style.setProperty('--ayla-aqua-deep', s.primary);
  }
  // Brand title font size + colours
  document.querySelectorAll('.brand-name').forEach(el => {
    if (s.brand_size) el.style.fontSize = s.brand_size + 'px';
    if (s.brand_color) el.style.color = s.brand_color;
  });
  if (s.brand_accent_color){
    document.querySelectorAll('.brand-accent').forEach(el => {
      el.style.color = s.brand_accent_color;
    });
  }
  // Custom fonts (uploaded data URLs)
  if (s.font_heading_data){
    injectAylaFont('AylaCustomHeading', s.font_heading_data);
    document.documentElement.style.setProperty('--serif', `"AylaCustomHeading", "${s.font_heading_name || 'Playfair Display'}", Georgia, serif`);
  }
  if (s.font_body_data){
    injectAylaFont('AylaCustomBody', s.font_body_data);
    document.documentElement.style.setProperty('--sans', `"AylaCustomBody", "${s.font_body_name || 'Inter'}", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`);
  }

  // Map concept visibility
  const concepts = { illustrated: s.show_illustrated, satellite: s.show_satellite, new: s.show_new };
  for (const [k, v] of Object.entries(concepts)){
    if (v === false){
      const btn = document.querySelector(`.concept-btn[data-concept="${k}"]`);
      if (btn) btn.style.display = 'none';
    }
  }
  // Default concept
  if (s.default_concept && document.querySelector(`.concept-btn[data-concept="${s.default_concept}"]`)){
    state.mapConcept = s.default_concept;
  }
  // Custom map images — per concept × level × device, with sane fallbacks
  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  const pick = (desktop, phone) => isMobile ? (phone || desktop) : (desktop || phone);
  const illGround = pick(s.map_ill_ground_desktop, s.map_ill_ground_phone);
  const illMarina = pick(s.map_ill_marina_desktop, s.map_ill_marina_phone);
  const newGround = pick(s.map_new_ground_desktop, s.map_new_ground_phone);
  const newMarina = pick(s.map_new_marina_desktop, s.map_new_marina_phone);
  if (illGround) MAP_CONCEPTS.illustrated.img.ground = illGround;
  if (illMarina) MAP_CONCEPTS.illustrated.img.marina = illMarina;
  if (newGround) MAP_CONCEPTS.new.img.ground = newGround;
  if (newMarina) MAP_CONCEPTS.new.img.marina = newMarina;
}

function injectAylaFont(family, dataUrl){
  let style = document.getElementById('font-' + family);
  if (!style){
    style = document.createElement('style');
    style.id = 'font-' + family;
    document.head.appendChild(style);
  }
  style.textContent = `@font-face{font-family:"${family}";src:url(${dataUrl});font-display:swap}`;
}

// ---------- 2. State ----------
const state = {
  levelId: null,
  activeCats: new Set(),         // empty = all
  selectedPoiId: null,
  scale: 1, minScale: 1, maxScale: 4,
  tx: 0, ty: 0,
};

// ---------- 3. Map / zoom / pan ----------
const stage = $('#stage');
const canvas = $('#canvas');
const mapImg = $('#map-img');
const pinsLayer = $('#pins');

// ---------- Map concepts (Illustrated / Satellite / New) ----------
const MAP_CONCEPTS = {
  illustrated: {
    kind: 'image',
    img: { ground: 'images/map-ground.png', marina: 'images/map-marina.png' },
  },
  satellite: { kind: 'leaflet' },
  new: {
    kind: 'image',
    img: { ground: 'images/map-new.jpg', marina: 'images/map-new.jpg' },
  },
};
state.mapConcept = 'illustrated';

function conceptImageFor(lvl){
  const c = MAP_CONCEPTS[state.mapConcept];
  if (c && c.kind === 'image'){
    return c.img[lvl?.slug] || c.img.ground;
  }
  return lvl?.map_image || 'images/map-ground.png';
}

let _imgLoadToken = 0;
function loadLevelImage(lvl){
  return new Promise((resolve) => {
    const src = conceptImageFor(lvl);
    const myToken = ++_imgLoadToken;
    const tmp = new Image();
    tmp.onload = () => {
      // A newer load (concept/level switch) superseded this one — discard
      if (myToken !== _imgLoadToken){ resolve(); return; }
      mapImg.src = tmp.src;
      mapImg.naturalW = tmp.naturalWidth;
      mapImg.naturalH = tmp.naturalHeight;
      fitMapToStage();
      resolve();
    };
    tmp.onerror = () => resolve();
    tmp.src = src;
  });
}

function fitMapToStage(){
  const sw = stage.clientWidth;
  const sh = stage.clientHeight;
  const iw = mapImg.naturalW || mapImg.naturalWidth || 1;
  const ih = mapImg.naturalH || mapImg.naturalHeight || 1;
  const sxContain = Math.min(sw / iw, sh / ih);
  const sxCover   = Math.max(sw / iw, sh / ih);
  // Wide screens: bias toward cover so the marina dominates instead of letterboxing.
  // The PNG has water at top/bottom — cropping a slice of that water is fine.
  const isWide = window.matchMedia('(min-width: 960px)').matches;
  const bias = isWide ? 0.55 : 0;
  const scale = sxContain + (sxCover - sxContain) * bias;
  canvas.style.width  = iw + 'px';
  canvas.style.height = ih + 'px';
  state.minScale = sxContain;     // allow zooming out to see the whole map
  state.scale = scale;
  state.tx = (sw - iw * scale) / 2;
  state.ty = (sh - ih * scale) / 2;
  applyTransform();
  updateResetBtn();
}

function applyTransform(){
  canvas.style.transform = `translate3d(${state.tx}px, ${state.ty}px, 0) scale(${state.scale})`;
  if (typeof updateLabelVisibility === 'function') updateLabelVisibility();
  if (typeof updateScaleBar === 'function') updateScaleBar();
}

function updateResetBtn(){
  const zoomed = state.scale > state.minScale * 1.05;
  $('#reset-btn').hidden = !zoomed;
}

function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }

function clampTransform(){
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const cw = (mapImg.naturalW || 1) * state.scale;
  const ch = (mapImg.naturalH || 1) * state.scale;
  // Tight clamp so the map doesn't visibly drift back to the user.
  // When the map is smaller than the viewport, keep it centered.
  if (cw <= sw){
    state.tx = (sw - cw) / 2;
  } else {
    const padX = sw * 0.12;
    state.tx = clamp(state.tx, sw - cw - padX, padX);
  }
  if (ch <= sh){
    state.ty = (sh - ch) / 2;
  } else {
    const padY = sh * 0.12;
    state.ty = clamp(state.ty, sh - ch - padY, padY);
  }
}

function zoomAt(targetScale, cx, cy){
  const newScale = clamp(targetScale, state.minScale, state.maxScale);
  // Keep point under (cx,cy) stable
  const ratio = newScale / state.scale;
  state.tx = cx - (cx - state.tx) * ratio;
  state.ty = cy - (cy - state.ty) * ratio;
  state.scale = newScale;
  clampTransform();
  applyTransform();
  updateResetBtn();
}

function resetView(){
  fitMapToStage();
}
$('#reset-btn').addEventListener('click', resetView);

// Compass = reset view
$('#compass-btn')?.addEventListener('click', resetView);

// Zoom +/- buttons
$('#zoom-in-btn')?.addEventListener('click', () => {
  const sw = stage.clientWidth, sh = stage.clientHeight;
  zoomAt(state.scale * 1.5, sw / 2, sh / 2);
});
$('#zoom-out-btn')?.addEventListener('click', () => {
  const sw = stage.clientWidth, sh = stage.clientHeight;
  zoomAt(state.scale / 1.5, sw / 2, sh / 2);
});

// Scale bar — update displayed metres based on current zoom
function updateScaleBar(){
  const el = document.querySelector('#scale-bar .scale-text');
  if (!el) return;
  // Marina village is roughly 200m across the visible PNG width
  const iw = mapImg.naturalW || mapImg.naturalWidth || 1;
  if (!iw) return;
  const metresPerPx = 200 / iw;
  const barPx = 60; // matches CSS .scale-line width
  const metresAtZoom = (barPx / state.scale) * metresPerPx;
  // Round to a friendly number
  const friendly = [5, 10, 20, 50, 100, 200, 500].find(n => n >= metresAtZoom) || 500;
  el.textContent = `${friendly} m`;
}

// ---------- 3a. Gestures (pointer events: mouse + touch + stylus) ----------
const pointers = new Map();
let lastTap = 0;
let panStart = null;
let pinchStart = null;
let moved = false;
let downPin = null;

stage.addEventListener('pointerdown', e => {
  // Don't capture if user is tapping UI overlays inside the stage
  if (e.target.closest('.map-tool, .map-tool-group, .reset-btn, .scale-bar, .concept-switch, .satmap')){
    return;
  }
  stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = false;
  // Detect if pointerdown is on a pin
  const pinEl = e.target.closest('.pin');
  downPin = pinEl || null;

  if (pointers.size === 1){
    panStart = { x: e.clientX, y: e.clientY, tx: state.tx, ty: state.ty };
  } else if (pointers.size === 2){
    const [a, b] = Array.from(pointers.values());
    pinchStart = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      scale: state.scale,
      tx: state.tx,
      ty: state.ty,
    };
    panStart = null;
  }
});

stage.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2 && pinchStart){
    const [a, b] = Array.from(pointers.values());
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const ratio = dist / pinchStart.dist;
    const newScale = clamp(pinchStart.scale * ratio, state.minScale, state.maxScale);
    const ratioApplied = newScale / pinchStart.scale;
    state.tx = pinchStart.cx - (pinchStart.cx - pinchStart.tx) * ratioApplied + (cx - pinchStart.cx);
    state.ty = pinchStart.cy - (pinchStart.cy - pinchStart.ty) * ratioApplied + (cy - pinchStart.cy);
    state.scale = newScale;
    clampTransform();
    applyTransform();
    moved = true;
  } else if (pointers.size === 1 && panStart){
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    state.tx = panStart.tx + dx;
    state.ty = panStart.ty + dy;
    clampTransform();
    applyTransform();
  }
});

function endPointer(e){
  if (!pointers.has(e.pointerId)) return;
  const isLast = pointers.size === 1;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (pointers.size === 0) panStart = null;

  if (isLast && !moved){
    if (downPin){
      const id = downPin.dataset.id;
      openPoi(id);
    } else if (!e.target.closest('.sheet, .topbar, .chips, .reset-btn, .search-overlay')){
      // Tap on empty map → close sheet, double-tap to zoom
      const now = Date.now();
      if (now - lastTap < 280){
        // Double-tap → zoom in or reset
        if (state.scale > state.minScale * 1.05){
          resetView();
        } else {
          zoomAt(state.scale * 2.2, e.clientX, e.clientY);
        }
        lastTap = 0;
      } else {
        lastTap = now;
        closeSheet();
      }
    }
  }
  updateResetBtn();
  downPin = null;
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);

// Mouse wheel zoom (desktop)
stage.addEventListener('wheel', e => {
  if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0){
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const delta = -e.deltaY * 0.0015;
    zoomAt(state.scale * (1 + delta), cx, cy);
  }
}, { passive: false });

// ---------- 4. Pins ----------
function renderPins(){
  pinsLayer.innerHTML = '';
  const visible = DATA.pois.filter(p =>
    p.level_id === state.levelId &&
    (state.activeCats.size === 0 || state.activeCats.has(p.category_id))
  );
  // Dimmed (other-category) pins on this level
  const dimmed = state.activeCats.size > 0
    ? DATA.pois.filter(p => p.level_id === state.levelId && !state.activeCats.has(p.category_id))
    : [];

  let i = 0;
  for (const p of [...dimmed, ...visible]){
    const cat = DATA.catById[p.category_id];
    const el = document.createElement('button');
    el.className = 'pin';
    if (dimmed.includes(p)) el.classList.add('dim');
    if (state.selectedPoiId === p.id) el.classList.add('active');
    el.dataset.id = p.id;
    // Per-concept pin position: Premium map has its own coords; fall back to illustrated
    const px = (state.mapConcept === 'new' && p.pin_x_new != null) ? p.pin_x_new : p.pin_x;
    const py = (state.mapConcept === 'new' && p.pin_y_new != null) ? p.pin_y_new : p.pin_y;
    el.style.left = px + '%';
    el.style.top  = py + '%';
    el.style.setProperty('--c', cat?.color || '#666');
    el.style.setProperty('--pin-i', i++);
    // Inner content of the teardrop: prefer the place's logo, else category icon, else initials
    const initials = (p.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const innerHTML = p.logo
      ? `<img src="${p.logo}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'initials',textContent:'${initials}'}))">`
      : iconSvg(cat?.icon);
    el.innerHTML = `
      <div class="pin-teardrop"><div class="pin-inner">${innerHTML}</div></div>
      <div class="pin-dot"></div>
      <span class="pin-label">${escapeHtml(p.name)}</span>
    `;
    el.setAttribute('aria-label', p.name);
    pinsLayer.appendChild(el);
  }
  updateLabelVisibility();
  renderRailList();
  if (state.mapConcept === 'satellite' && typeof renderSatMarkers === 'function') renderSatMarkers();
}

// Show labels by default; collision dedup keeps it readable when crowded
function updateLabelVisibility(){
  pinsLayer.classList.add('show-labels');
  scheduleDedupeLabels();
}

// --- Label collision avoidance ---
let dedupeTimer = null;
function scheduleDedupeLabels(){
  if (dedupeTimer) cancelAnimationFrame(dedupeTimer);
  dedupeTimer = requestAnimationFrame(dedupeLabels);
}

function dedupeLabels(){
  const labelsShown = pinsLayer.classList.contains('show-labels') ||
                      window.matchMedia('(min-width: 960px)').matches;
  if (!labelsShown) return;

  const allPins = Array.from(pinsLayer.querySelectorAll('.pin:not(.dim)'));
  // Reset
  allPins.forEach(p => p.querySelector('.pin-label')?.classList.remove('collide'));

  // Higher-importance categories win label space in crowded zones
  const CATEGORY_PRIORITY = {
    'cat-hotel':         -5000,
    'cat-heritage':      -4000,
    'cat-experience':    -3500,
    'cat-essentials':    -3000,
    'cat-dining':        -2000,
    'cat-cafe':          -1500,
    'cat-pub':           -1000,
    'cat-shopping':       -500,
    'cat-entertainment':  -100,
  };
  const items = allPins.map(p => {
    const label = p.querySelector('.pin-label');
    if (!label) return null;
    const rect = label.getBoundingClientRect();
    if (rect.width === 0) return null;
    const id = p.dataset.id;
    const poi = id ? DATA.pois.find(x => x.id === id) : null;
    const catPriority = poi ? (CATEGORY_PRIORITY[poi.category_id] || 0) : 0;
    return {
      el: p,
      label,
      rect,
      active: p.classList.contains('active'),
      // active > category importance > shorter name
      priority: p.classList.contains('active')
        ? -100000
        : catPriority + (label.textContent || '').length,
    };
  }).filter(Boolean);

  // Sort: active first, then shortest labels (more likely to fit clean)
  items.sort((a, b) => a.priority - b.priority);

  const kept = [];
  // More aggressive padding on mobile so labels never visually touch
  const isWide = window.matchMedia('(min-width: 960px)').matches;
  const pad = isWide ? 10 : 16;
  for (const it of items){
    const collides = kept.some(k => rectsOverlap(it.rect, k.rect, pad));
    if (collides){
      it.label.classList.add('collide');
    } else {
      kept.push(it);
    }
  }
}

function rectsOverlap(a, b, pad = 0){
  return !(a.right + pad < b.left ||
           b.right + pad < a.left ||
           a.bottom + pad < b.top ||
           b.bottom + pad < a.top);
}

const ICONS = {
  coffee:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  bed:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`,
  'shopping-bag': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  wine:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5V3H7v7a5 5 0 0 0 5 5z"/></svg>`,
  heart:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  landmark:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,
  utensils:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>`,
  compass:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  sparkles:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 14l.95 2.3L22 17.25l-2.05.95L19 20l-.95-1.8L16 17.25l2.05-.95z"/></svg>`,
};
function iconSvg(name){ return ICONS[name] || ICONS['compass']; }

// ---------- 4b. Atmosphere: drifting boats ----------
const BOAT_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16h18l-2 4H5l-2-4z" fill="currentColor" fill-opacity="0.7"/><path d="M12 4v12"/><path d="M12 6l6 8H12V6z" fill="currentColor" fill-opacity="0.5"/></svg>`;
// One boat config per level — positions are in % of image
const BOAT_PLAN = {
  ground: [
    { top: 8,  fromX: -6,  toX: 6,  dur: 38, ang: 90 },
    { top: 88, fromX: 4,   toX: -4, dur: 44, ang: -90 },
    { top: 52, fromX: -4,  toX: 4,  dur: 50, ang: 90 }
  ],
  marina: [
    { top: 90, fromX: -5,  toX: 5,  dur: 36, ang: 90 },
    { top: 8,  fromX: 6,   toX: -6, dur: 42, ang: -90 },
    { top: 50, fromX: 0,   toX: 0,  dur: 60, ang: 0 }
  ]
};
function renderBoats(){
  const layer = document.getElementById('boats');
  if (!layer) return;
  layer.innerHTML = '';
  const lvl = DATA.lvlById[state.levelId];
  const slug = lvl?.slug || 'ground';
  const plan = BOAT_PLAN[slug] || BOAT_PLAN.ground;
  plan.forEach((b, i) => {
    const el = document.createElement('div');
    el.className = 'boat';
    el.style.top = b.top + '%';
    el.style.left = '50%';
    el.style.setProperty('--from-x', `calc(${b.fromX}vw - 13px)`);
    el.style.setProperty('--to-x',   `calc(${b.toX}vw - 13px)`);
    el.style.setProperty('--dur', b.dur + 's');
    el.style.setProperty('--ang', b.ang + 'deg');
    el.style.animationDelay = (i * -8) + 's';
    el.innerHTML = BOAT_SVG;
    layer.appendChild(el);
  });
}

// ---------- 4c. Auto-fit to filtered pins ----------
function flyToFilteredBounds(){
  // Mobile: don't reframe the map when the user touches a chip — too disorienting.
  // The bottom sheet UI will show "X places match" feedback instead.
  if (!window.matchMedia('(min-width: 960px)').matches) return;
  const visible = DATA.pois.filter(p =>
    p.level_id === state.levelId &&
    (state.activeCats.size === 0 || state.activeCats.has(p.category_id))
  );
  if (visible.length === 0){ resetView(); return; }
  // Compute bounding box in image-percent space
  let minX = 100, minY = 100, maxX = 0, maxY = 0;
  for (const p of visible){
    if (p.pin_x < minX) minX = p.pin_x;
    if (p.pin_x > maxX) maxX = p.pin_x;
    if (p.pin_y < minY) minY = p.pin_y;
    if (p.pin_y > maxY) maxY = p.pin_y;
  }
  // If only one or two pins or all filters cleared, just reset
  if (state.activeCats.size === 0 || visible.length === DATA.pois.filter(p => p.level_id === state.levelId).length){
    resetView();
    return;
  }
  const iw = mapImg.naturalW || mapImg.naturalWidth;
  const ih = mapImg.naturalH || mapImg.naturalHeight;
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const pad = 0.18;
  const bx = (minX / 100) * iw, by = (minY / 100) * ih;
  const bw = ((maxX - minX) / 100) * iw, bh = ((maxY - minY) / 100) * ih;
  // Inflate for padding and a minimum sensible viewport
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  const desiredW = Math.max(bw * (1 + pad * 2), iw * 0.25);
  const desiredH = Math.max(bh * (1 + pad * 2), ih * 0.25);
  const targetScale = Math.min(sw / desiredW, sh / desiredH, state.maxScale);
  const finalScale = Math.max(state.minScale, targetScale);
  const tx = sw / 2 - cx * finalScale;
  const ty = sh / 2 - cy * finalScale;
  animateTransform(tx, ty, finalScale, 600);
}

// ---------- 5. Levels ----------
async function setLevel(lvlId){
  state.levelId = lvlId;
  const lvl = DATA.lvlById[lvlId];
  if (!lvl) return;
  await loadLevelImage(lvl);
  renderBoats();
  renderPins();
  renderLevelSwitch();
  closeSheet();
}

function renderLevelSwitch(){
  const wrap = $('#level-switch');
  wrap.innerHTML = '';
  for (const lvl of DATA.levels){
    const btn = document.createElement('button');
    btn.textContent = lvl.name;
    btn.role = 'tab';
    btn.setAttribute('aria-selected', lvl.id === state.levelId);
    btn.addEventListener('click', () => setLevel(lvl.id));
    wrap.appendChild(btn);
  }
}

// ---------- 6. Filter chips ----------
function renderChips(){
  const wrap = $('#chips');
  wrap.innerHTML = '';
  // "All"
  const all = document.createElement('button');
  all.className = 'chip chip-all';
  all.setAttribute('aria-pressed', state.activeCats.size === 0);
  all.textContent = 'All';
  all.addEventListener('click', () => {
    state.activeCats.clear();
    renderChips(); renderPins(); flyToFilteredBounds(); updateFilterBadge?.();
  });
  wrap.appendChild(all);
  // Category chips
  for (const cat of DATA.categories){
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.style.setProperty('--c', cat.color);
    chip.setAttribute('aria-pressed', state.activeCats.has(cat.id));
    chip.innerHTML = `<span class="swatch"></span>${cat.name}`;
    chip.addEventListener('click', () => {
      if (state.activeCats.has(cat.id)) state.activeCats.delete(cat.id);
      else state.activeCats.add(cat.id);
      renderChips(); renderPins(); flyToFilteredBounds(); updateFilterBadge?.();
    });
    wrap.appendChild(chip);
  }
}

// ---------- 6b. Rail list (desktop) ----------
function renderRailList(){
  const wrap = document.getElementById('rail-list');
  const title = document.getElementById('rail-list-title');
  const count = document.getElementById('rail-list-count');
  if (!wrap) return;
  const lvl = DATA.lvlById[state.levelId];
  const pois = DATA.pois.filter(p =>
    p.level_id === state.levelId &&
    (state.activeCats.size === 0 || state.activeCats.has(p.category_id))
  ).sort((a, b) => a.name.localeCompare(b.name));

  if (title) title.textContent = state.activeCats.size === 0 ? `All places · ${lvl?.name || ''}` : `Filtered · ${lvl?.name || ''}`;
  if (count) count.textContent = `${pois.length} place${pois.length === 1 ? '' : 's'}`;

  if (!pois.length){
    wrap.innerHTML = `<div class="search-empty"><p>No places match the current filter</p></div>`;
    return;
  }
  wrap.innerHTML = pois.map(p => {
    const cat = DATA.catById[p.category_id];
    const logo = p.logo
      ? `<img src="${p.logo}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'initials',textContent:'${initials(p.name)}'}))">`
      : `<span class="initials">${initials(p.name)}</span>`;
    const active = state.selectedPoiId === p.id ? ' is-active' : '';
    return `
      <div class="result-item rail-item${active}" data-id="${p.id}">
        <div class="result-logo">${logo}</div>
        <div class="result-body">
          <p class="result-name">${escapeHtml(p.name)}</p>
          <p class="result-meta"><span class="sw" style="background:${cat?.color||'#999'}"></span>${cat?.name||''}</p>
        </div>
        <span class="result-chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
      </div>
    `;
  }).join('');
  wrap.querySelectorAll('.rail-item').forEach(el => {
    el.addEventListener('click', () => openPoi(el.dataset.id));
  });
}

// ---------- 7. Bottom sheet ----------
const sheet = $('#sheet');

function initials(name){
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function logoMarkup(poi){
  if (poi.logo){
    return `<img src="${poi.logo}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'initials',textContent:'${initials(poi.name)}'}))">`;
  }
  return `<span class="initials">${initials(poi.name)}</span>`;
}

function openPoi(id){
  const poi = DATA.pois.find(p => p.id === id);
  if (!poi) return;
  state.selectedPoiId = id;
  const cat = DATA.catById[poi.category_id];
  const lvl = DATA.lvlById[poi.level_id];

  // Switch level if needed
  if (poi.level_id !== state.levelId){
    setLevel(poi.level_id).then(() => openPoi(id));
    return;
  }

  $('#sheet-logo').innerHTML = logoMarkup(poi);
  $('#sheet-name').textContent = poi.name;
  $('#sheet-meta').innerHTML = `<span class="swatch" style="background:${cat?.color || '#999'}"></span>${cat?.name || ''} · ${lvl?.name || ''}`;
  const desc = $('#sheet-desc');
  if (poi.description){ desc.textContent = poi.description; desc.hidden = false; }
  else desc.hidden = true;

  // Actions
  const dirEl = $('#act-directions');
  if (poi.google_maps_url){
    dirEl.href = poi.google_maps_url;
  } else if (poi.lat && poi.lng){
    dirEl.href = `https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}`;
  } else {
    dirEl.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(poi.name + ' Ayla Aqaba')}`;
  }
  const call = $('#act-call'); call.hidden = !poi.phone;
  if (poi.phone) call.href = `tel:${poi.phone}`;
  const wa = $('#act-whatsapp'); wa.hidden = !poi.whatsapp;
  if (poi.whatsapp){
    const num = poi.whatsapp.replace(/\D/g, '');
    wa.href = `https://wa.me/${num}`;
  }
  const ig = $('#act-instagram'); ig.hidden = !poi.instagram;
  if (poi.instagram){
    const handle = poi.instagram.replace(/^@/, '');
    ig.href = `https://instagram.com/${handle}`;
  }

  sheet.setAttribute('aria-hidden', 'false');
  document.body.classList.add('poi-open');
  renderPins();
  if (state.mapConcept === 'satellite' && SAT.map){
    const [lat, lng] = poiLatLng(poi);
    SAT.map.flyTo([lat, lng], Math.max(SAT.map.getZoom(), 18), { duration: 0.7 });
    renderSatMarkers();
  } else {
    flyToPin(poi);
  }
  haptic();
  pushDeepLink(poi.id);
}

function closeSheet(){
  sheet.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('poi-open');
  state.selectedPoiId = null;
  renderPins();
  clearDeepLink();
}
$('#sheet-close').addEventListener('click', closeSheet);

// Share button
$('#act-share').addEventListener('click', async () => {
  const id = state.selectedPoiId;
  if (!id) return;
  const poi = DATA.pois.find(p => p.id === id);
  const url = new URL(location.href);
  url.searchParams.set('poi', id);
  const shareData = {
    title: poi.name,
    text: `${poi.name} at Ayla Marina`,
    url: url.toString(),
  };
  try {
    if (navigator.share){
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(url.toString());
      toast('Link copied');
    }
  } catch(_) {}
});

// Drag-to-dismiss
(function sheetDrag(){
  const handle = sheet.querySelector('.sheet-handle');
  let startY = 0, currentY = 0, dragging = false;
  handle.addEventListener('pointerdown', e => {
    dragging = true; startY = e.clientY; currentY = 0;
    sheet.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    currentY = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${currentY}px)`;
  });
  handle.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
    if (currentY > 90) closeSheet();
  });
  handle.addEventListener('pointercancel', () => {
    dragging = false;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
  });
})();

// ---------- 8. Fly to pin ----------
function flyToPin(poi){
  const iw = mapImg.naturalW || mapImg.naturalWidth;
  const ih = mapImg.naturalH || mapImg.naturalHeight;
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const px = (poi.pin_x / 100) * iw;
  const py = (poi.pin_y / 100) * ih;

  const targetScale = Math.min(state.maxScale, Math.max(state.minScale * 1.8, state.minScale * 2.2));
  // Bottom sheet covers ~45% of height — offset center upward
  const offsetY = sh * 0.28;
  const tx = sw / 2 - px * targetScale;
  const ty = sh / 2 - py * targetScale - offsetY;

  animateTransform(tx, ty, targetScale, 520);
}

function animateTransform(toTx, toTy, toScale, duration){
  const fromTx = state.tx, fromTy = state.ty, fromScale = state.scale;
  const start = performance.now();
  function tick(now){
    const t = Math.min(1, (now - start) / duration);
    const e = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2; // easeInOutQuad
    state.tx = fromTx + (toTx - fromTx) * e;
    state.ty = fromTy + (toTy - fromTy) * e;
    state.scale = fromScale + (toScale - fromScale) * e;
    clampTransform();
    applyTransform();
    if (t < 1) requestAnimationFrame(tick);
    else updateResetBtn();
  }
  requestAnimationFrame(tick);
}

// ---------- 9. Search ----------
const searchOverlay = $('#search-overlay');
const searchInput = $('#search-input');
const searchResults = $('#search-results');

$('#search-trigger').addEventListener('click', openSearch);
$('#search-back').addEventListener('click', closeSearch);

function openSearch(){
  searchOverlay.setAttribute('aria-hidden', 'false');
  searchInput.value = '';
  renderSearchResults('');
  setTimeout(() => searchInput.focus(), 220);
}
function closeSearch(){ searchOverlay.setAttribute('aria-hidden', 'true'); }

searchInput.addEventListener('input', () => renderSearchResults(searchInput.value));
searchInput.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });

function renderSearchResults(q){
  const query = q.trim().toLowerCase();
  let results;
  if (!query){
    // Default — show all alphabetically
    results = [...DATA.pois].sort((a,b) => a.name.localeCompare(b.name));
  } else {
    results = DATA.pois.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.description || '').toLowerCase().includes(query) ||
      (DATA.catById[p.category_id]?.name || '').toLowerCase().includes(query)
    );
  }
  if (!results.length){
    searchResults.innerHTML = `<div class="search-empty"><p>No places match "${escapeHtml(query)}"</p></div>`;
    return;
  }
  searchResults.innerHTML = results.map(p => {
    const cat = DATA.catById[p.category_id];
    const lvl = DATA.lvlById[p.level_id];
    const logo = p.logo
      ? `<img src="${p.logo}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'initials',textContent:'${initials(p.name)}'}))">`
      : `<span class="initials">${initials(p.name)}</span>`;
    return `
      <div class="result-item" data-id="${p.id}">
        <div class="result-logo">${logo}</div>
        <div class="result-body">
          <p class="result-name">${escapeHtml(p.name)}</p>
          <p class="result-meta"><span class="sw" style="background:${cat?.color||'#999'}"></span>${cat?.name||''} · ${lvl?.name||''}</p>
        </div>
        <span class="result-chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
      </div>
    `;
  }).join('');
  searchResults.querySelectorAll('.result-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      closeSearch();
      openPoi(id);
    });
  });
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- 10. Deep-link, haptic, toast ----------
function pushDeepLink(id){
  const url = new URL(location.href);
  url.searchParams.set('poi', id);
  history.replaceState(null, '', url);
}
function clearDeepLink(){
  const url = new URL(location.href);
  url.searchParams.delete('poi');
  history.replaceState(null, '', url);
}
function haptic(){
  if (navigator.vibrate) try { navigator.vibrate(10); } catch(_){}
}
function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- 11. Resize ----------
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    fitMapToStage();
    renderPins();
  }, 120);
});

// ---------- 11b. Desktop: inline search input + list↔pin hover sync ----------
function setupDesktopEnhancements(){
  const mq = window.matchMedia('(min-width: 960px)');
  applyDesktopMode(mq.matches);
  mq.addEventListener?.('change', e => applyDesktopMode(e.matches));
}

function applyDesktopMode(isDesktop){
  const trigger = $('#search-trigger');
  if (!trigger) return;
  if (isDesktop && !trigger.querySelector('input')){
    // Replace span with input
    const span = trigger.querySelector('span');
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search shops, dining, experiences…';
    input.autocomplete = 'off';
    input.spellcheck = false;
    trigger.classList.add('is-input');
    if (span) span.replaceWith(input);
    trigger.removeEventListener('click', openSearch);
    input.addEventListener('focus', openSearch);
    input.addEventListener('input', () => {
      // Mirror to overlay input
      const oi = $('#search-input');
      if (oi){ oi.value = input.value; renderSearchResults(input.value); }
    });
  }
}

// List ↔ pin hover sync
document.addEventListener('mouseover', e => {
  const item = e.target.closest('.rail-item');
  if (item){
    highlightPin(item.dataset.id, true);
    return;
  }
  const pin = e.target.closest('.pin');
  if (pin){
    highlightListItem(pin.dataset.id, true);
  }
});
document.addEventListener('mouseout', e => {
  const item = e.target.closest('.rail-item');
  if (item){ highlightPin(item.dataset.id, false); return; }
  const pin = e.target.closest('.pin');
  if (pin){ highlightListItem(pin.dataset.id, false); }
});

function highlightPin(id, on){
  const pin = pinsLayer.querySelector(`.pin[data-id="${id}"]`);
  if (!pin) return;
  if (on){
    pin.style.transform = 'translate(-50%, -100%) scale(1.25)';
    pin.style.zIndex = '4';
    const lbl = pin.querySelector('.pin-label');
    if (lbl){ lbl.style.opacity = '1'; lbl.classList.remove('collide'); }
  } else {
    pin.style.transform = '';
    pin.style.zIndex = '';
    const lbl = pin.querySelector('.pin-label');
    if (lbl){ lbl.style.opacity = ''; }
    scheduleDedupeLabels();
  }
}

function highlightListItem(id, on){
  const item = document.querySelector(`.rail-item[data-id="${id}"]`);
  if (!item) return;
  if (on){
    item.classList.add('is-hover');
    item.style.background = 'var(--muted)';
    // Scroll into view if not visible
    const list = document.getElementById('rail-list');
    if (list){
      const lr = list.getBoundingClientRect();
      const ir = item.getBoundingClientRect();
      if (ir.top < lr.top || ir.bottom > lr.bottom){
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  } else {
    item.classList.remove('is-hover');
    item.style.background = '';
  }
}

// ---------- 11c. Mobile tab bar + sheets ----------
function setActiveTab(name){
  document.querySelectorAll('.tabbar .tab').forEach(t => {
    t.classList.toggle('tab-active', t.dataset.tab === name);
  });
}

function openMobileSheet(name){
  const sheet = document.getElementById(name + '-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  if (!sheet) return;
  // Close any other open mobile sheets first
  document.querySelectorAll('.mobile-sheet[aria-hidden="false"]').forEach(s => s.setAttribute('aria-hidden', 'true'));
  sheet.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('show');
  setActiveTab(name);
  haptic();
}

function closeMobileSheet(name){
  const sheet = name ? document.getElementById(name + '-sheet') : document.querySelector('.mobile-sheet[aria-hidden="false"]');
  if (sheet) sheet.setAttribute('aria-hidden', 'true');
  document.getElementById('sheet-backdrop').classList.remove('show');
  setActiveTab('map');
}

function renderFiltersGrid(){
  const wrap = document.getElementById('filters-grid');
  if (!wrap) return;
  const counts = {};
  for (const p of DATA.pois){
    if (p.level_id !== state.levelId) continue;
    counts[p.category_id] = (counts[p.category_id] || 0) + 1;
  }
  wrap.innerHTML = DATA.categories.map(cat => `
    <button class="filter-cell ${state.activeCats.has(cat.id) ? 'on' : ''}" data-cat="${cat.id}" style="--c:${cat.color}">
      <span class="dot"></span>
      <span class="name">${cat.name}</span>
      <span class="count">${counts[cat.id] || 0}</span>
    </button>
  `).join('');
  wrap.querySelectorAll('.filter-cell').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.cat;
      if (state.activeCats.has(id)) state.activeCats.delete(id);
      else state.activeCats.add(id);
      el.classList.toggle('on');
      renderChips();
      renderPins();
      updateFilterBadge();
    });
  });
}

function updateFilterBadge(){
  const badge = document.getElementById('filter-badge');
  if (!badge) return;
  if (state.activeCats.size === 0){
    badge.hidden = true;
  } else {
    badge.hidden = false;
    badge.textContent = state.activeCats.size;
  }
}

function renderMobileList(){
  const wrap = document.getElementById('list-sheet-content');
  const title = document.getElementById('list-sheet-title');
  if (!wrap) return;
  const lvl = DATA.lvlById[state.levelId];
  const pois = DATA.pois.filter(p =>
    p.level_id === state.levelId &&
    (state.activeCats.size === 0 || state.activeCats.has(p.category_id))
  ).sort((a, b) => a.name.localeCompare(b.name));
  if (title) title.textContent = `${pois.length} places · ${lvl?.name || ''}`;
  if (!pois.length){
    wrap.innerHTML = `<div class="search-empty"><p>No places match your filters.</p></div>`;
    return;
  }
  wrap.innerHTML = pois.map(p => {
    const cat = DATA.catById[p.category_id];
    const logo = p.logo
      ? `<img src="${p.logo}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'initials',textContent:'${initials(p.name)}'}))">`
      : `<span class="initials">${initials(p.name)}</span>`;
    return `
      <div class="result-item" data-id="${p.id}">
        <div class="result-logo">${logo}</div>
        <div class="result-body">
          <p class="result-name">${escapeHtml(p.name)}</p>
          <p class="result-meta"><span class="sw" style="background:${cat?.color||'#999'}"></span>${cat?.name||''}</p>
        </div>
        <span class="result-chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
      </div>
    `;
  }).join('');
  wrap.querySelectorAll('.result-item').forEach(el => {
    el.addEventListener('click', () => {
      closeMobileSheet();
      openPoi(el.dataset.id);
    });
  });
}

function setupTabbar(){
  document.querySelectorAll('.tabbar .tab').forEach(tab => {
    tab.addEventListener('click', e => {
      e.stopPropagation();
      const t = tab.dataset.tab;
      if (t === 'map'){
        closeMobileSheet();
        setActiveTab('map');
      } else if (t === 'search'){
        openSearch();
        setActiveTab('search');
      } else if (t === 'filters'){
        renderFiltersGrid();
        openMobileSheet('filters');
      } else if (t === 'list'){
        renderMobileList();
        openMobileSheet('list');
      }
    });
  });
  document.getElementById('sheet-backdrop')?.addEventListener('click', () => closeMobileSheet());
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); closeMobileSheet(btn.dataset.close); });
  });
  document.getElementById('filters-reset')?.addEventListener('click', () => {
    state.activeCats.clear();
    renderChips(); renderPins(); renderFiltersGrid(); updateFilterBadge();
  });
  document.getElementById('filters-apply')?.addEventListener('click', () => closeMobileSheet('filters'));

  // Drag-to-dismiss for mobile sheets
  document.querySelectorAll('.mobile-sheet').forEach(sheet => {
    const handle = sheet.querySelector('.mobile-sheet-handle');
    let startY = 0, currentY = 0, dragging = false;
    handle?.addEventListener('pointerdown', e => {
      dragging = true; startY = e.clientY; currentY = 0;
      sheet.classList.add('dragging');
      handle.setPointerCapture(e.pointerId);
    });
    handle?.addEventListener('pointermove', e => {
      if (!dragging) return;
      currentY = Math.max(0, e.clientY - startY);
      sheet.style.transform = `translateY(${currentY}px)`;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      sheet.classList.remove('dragging');
      sheet.style.transform = '';
      if (currentY > 80) closeMobileSheet();
    };
    handle?.addEventListener('pointerup', end);
    handle?.addEventListener('pointercancel', end);
  });
}


// ---------- 11e. Map concept switcher + Leaflet satellite ----------
const SAT = { map: null, markers: [], ready: false };
const AYLA_LATLNG = [29.5462, 34.9905];
const MARINA_BOUNDS = {
  ground: { nw: [29.5487, 34.9886], se: [29.5448, 34.9925] },
  marina: { nw: [29.5478, 34.9888], se: [29.5450, 34.9912] },
};
function poiLatLng(p){
  if (p.lat && p.lng) return [p.lat, p.lng];
  const lvl = DATA.lvlById[p.level_id];
  const b = MARINA_BOUNDS[lvl?.slug] || MARINA_BOUNDS.ground;
  return [
    b.nw[0] + (p.pin_y / 100) * (b.se[0] - b.nw[0]),
    b.nw[1] + (p.pin_x / 100) * (b.se[1] - b.nw[1]),
  ];
}

function initSatellite(){
  if (SAT.ready || typeof L === 'undefined') return;
  const el = document.getElementById('satmap');
  if (!el) return;
  SAT.map = L.map(el, { zoomControl: true, attributionControl: true, minZoom: 14, maxZoom: 19 })
    .setView(AYLA_LATLNG, 17);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Imagery © Esri', maxNativeZoom: 19, maxZoom: 19,
  }).addTo(SAT.map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    maxNativeZoom: 19, opacity: 0.7,
  }).addTo(SAT.map);
  SAT.ready = true;
  renderSatMarkers();
}

function renderSatMarkers(){
  if (!SAT.map) return;
  SAT.markers.forEach(m => SAT.map.removeLayer(m));
  SAT.markers = [];
  const pois = DATA.pois.filter(p =>
    p.level_id === state.levelId &&
    (state.activeCats.size === 0 || state.activeCats.has(p.category_id))
  );
  for (const p of pois){
    const cat = DATA.catById[p.category_id];
    const [lat, lng] = poiLatLng(p);
    const icon = L.divIcon({
      className: '',
      html: `<div class="sat-pin ${state.selectedPoiId === p.id ? 'active' : ''}" style="--c:${cat?.color || '#666'}">
        <div class="sat-dot"></div><span class="sat-name">${escapeHtml(p.name)}</span>
      </div>`,
      iconSize: [16, 16], iconAnchor: [8, 8],
    });
    const m = L.marker([lat, lng], { icon }).addTo(SAT.map);
    m.on('click', () => openPoi(p.id));
    SAT.markers.push(m);
  }
}

function setMapConcept(concept){
  if (!MAP_CONCEPTS[concept]) return;
  state.mapConcept = concept;
  document.body.classList.remove('concept-illustrated', 'concept-satellite', 'concept-new');
  document.body.classList.add('concept-' + concept);
  document.querySelectorAll('.concept-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.concept === concept);
  });

  if (concept === 'satellite'){
    initSatellite();
    setTimeout(() => { SAT.map?.invalidateSize(); renderSatMarkers(); }, 320);
  } else {
    // Image concept — reload the basemap image for the current level
    const lvl = DATA.lvlById[state.levelId];
    loadLevelImage(lvl).then(() => { renderPins(); renderBoats(); });
  }
  haptic();
}

function setupConceptSwitch(){
  document.querySelectorAll('.concept-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      setMapConcept(btn.dataset.concept);
    });
  });
}

// ---------- 12. Boot ----------
async function boot(){
  try {
    await loadData();
  } catch(err){
    console.error(err);
    document.body.innerHTML = '<div style="padding:40px;font-family:system-ui">Couldn\'t load map data. Check that data/*.json files exist.</div>';
    return;
  }
  // Default level
  state.levelId = DATA.levels[0]?.id;
  if (!state.levelId){ console.error('No levels defined'); return; }

  renderLevelSwitch();
  renderChips();
  setupDesktopEnhancements();
  setupTabbar();
  setupConceptSwitch();
  applyAdminSettings();
  document.body.classList.add('concept-' + state.mapConcept);
  // Reflect the default concept choice in the segmented control
  document.querySelectorAll('.concept-btn').forEach(b => b.classList.toggle('on', b.dataset.concept === state.mapConcept));
  await setLevel(state.levelId);
  updateFilterBadge();
  // If default is satellite, initialise it
  if (state.mapConcept === 'satellite'){ setTimeout(() => setMapConcept('satellite'), 200); }

  // Deep link
  const params = new URLSearchParams(location.search);
  const deepPoi = params.get('poi');
  if (deepPoi){
    setTimeout(() => openPoi(deepPoi), 400);
  }

  // Hide splash
  setTimeout(() => $('#splash').classList.add('hide'), 600);
}

boot();
