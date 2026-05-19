/* Ayla Marina — Admin console */

// ---------- 1. Data layer ----------
const DATA = { levels: [], categories: [], pois: [], settings: null, catById: {}, lvlById: {} };
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const STORE_KEY = 'ayla_admin_overrides_v1';
const AUTH_KEY = 'ayla_admin_auth_v1';
const AUTH_TTL_MS = 6 * 60 * 60 * 1000;   // 6 hours

async function loadData(){
  // Cache-bust so a recently-deployed settings.json (password hash) is picked up
  const v = '?v=' + Date.now();
  const opts = { cache: 'no-store' };
  const [levels, categories, pois, settings] = await Promise.all([
    fetch('data/levels.json' + v, opts).then(r => r.json()),
    fetch('data/categories.json' + v, opts).then(r => r.json()),
    fetch('data/pois.json' + v, opts).then(r => r.json()),
    fetch('data/settings.json' + v, opts).then(r => r.json()),
  ]);
  DATA.levels = levels.sort((a, b) => a.sort_order - b.sort_order);
  // Apply any saved overrides on top of the JSON
  const overrides = readOverrides();
  DATA.categories = mergeCategoryOverrides(categories, overrides).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  DATA.pois = mergeOverrides(pois, overrides);
  DATA.settings = settings;
  DATA.catById = Object.fromEntries(DATA.categories.map(c => [c.id, c]));
  DATA.lvlById = Object.fromEntries(DATA.levels.map(l => [l.id, l]));
}

function readOverrides(){
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch(_) { return {}; }
}
function writeOverrides(obj){
  localStorage.setItem(STORE_KEY, JSON.stringify(obj));
}

function mergeOverrides(pois, overrides){
  const result = [...pois];
  const byId = Object.fromEntries(result.map((p, i) => [p.id, i]));
  // Edits / additions
  for (const [id, edit] of Object.entries(overrides.updates || {})){
    if (id in byId) Object.assign(result[byId[id]], edit);
  }
  for (const newPoi of overrides.adds || []){
    result.push(newPoi);
  }
  // Deletions
  if (overrides.deletes?.length){
    const delSet = new Set(overrides.deletes);
    return result.filter(p => !delSet.has(p.id));
  }
  return result;
}

function mergeCategoryOverrides(cats, overrides){
  let result = [...cats];
  const byId = Object.fromEntries(result.map((c, i) => [c.id, i]));
  for (const [id, edit] of Object.entries(overrides.catUpdates || {})){
    if (id in byId) Object.assign(result[byId[id]], edit);
  }
  for (const newCat of overrides.catAdds || []){
    result.push(newCat);
  }
  if (overrides.catDeletes?.length){
    const delSet = new Set(overrides.catDeletes);
    result = result.filter(c => !delSet.has(c.id));
  }
  return result;
}

function persistEdit(poiId, partial){
  const o = readOverrides();
  o.updates = o.updates || {};
  o.updates[poiId] = { ...(o.updates[poiId] || {}), ...partial };
  writeOverrides(o);
  // Apply in memory
  const idx = DATA.pois.findIndex(p => p.id === poiId);
  if (idx >= 0) Object.assign(DATA.pois[idx], partial);
}

function persistAdd(newPoi){
  const o = readOverrides();
  o.adds = o.adds || [];
  o.adds.push(newPoi);
  writeOverrides(o);
  DATA.pois.push(newPoi);
}

function persistDelete(poiId){
  const o = readOverrides();
  o.deletes = [...new Set([...(o.deletes || []), poiId])];
  // Drop any update for this id; if it was an add, remove from adds
  if (o.updates) delete o.updates[poiId];
  if (o.adds) o.adds = o.adds.filter(p => p.id !== poiId);
  writeOverrides(o);
  DATA.pois = DATA.pois.filter(p => p.id !== poiId);
}

function persistCatEdit(id, partial){
  const o = readOverrides();
  o.catUpdates = o.catUpdates || {};
  o.catUpdates[id] = { ...(o.catUpdates[id] || {}), ...partial };
  writeOverrides(o);
  const idx = DATA.categories.findIndex(c => c.id === id);
  if (idx >= 0) Object.assign(DATA.categories[idx], partial);
  DATA.catById = Object.fromEntries(DATA.categories.map(c => [c.id, c]));
}
function persistCatAdd(cat){
  const o = readOverrides();
  o.catAdds = o.catAdds || [];
  o.catAdds.push(cat);
  writeOverrides(o);
  DATA.categories.push(cat);
  DATA.catById = Object.fromEntries(DATA.categories.map(c => [c.id, c]));
}
function persistCatDelete(id){
  const o = readOverrides();
  o.catDeletes = [...new Set([...(o.catDeletes || []), id])];
  if (o.catUpdates) delete o.catUpdates[id];
  if (o.catAdds) o.catAdds = o.catAdds.filter(c => c.id !== id);
  writeOverrides(o);
  DATA.categories = DATA.categories.filter(c => c.id !== id);
  DATA.catById = Object.fromEntries(DATA.categories.map(c => [c.id, c]));
}

// ---------- 2. Auth ----------
// SHA-256 hash compare against settings.admin.password_hash
async function sha256(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function isAuthed(){
  try {
    const v = JSON.parse(sessionStorage.getItem(AUTH_KEY) || '{}');
    return v.ok && (Date.now() - v.at) < AUTH_TTL_MS;
  } catch(_) { return false; }
}
function setAuthed(){ sessionStorage.setItem(AUTH_KEY, JSON.stringify({ ok: true, at: Date.now() })); }
function clearAuthed(){ sessionStorage.removeItem(AUTH_KEY); }

async function tryLogin(password){
  const expected = DATA.settings?.admin?.password_hash;
  if (!expected) return false;
  const got = await sha256(password);
  return got === expected;
}

function showLogin(){
  $('#login').hidden = false;
  $('#app').hidden = true;
  setTimeout(() => $('#login-password')?.focus(), 100);
}
function showApp(){
  $('#login').hidden = true;
  $('#app').hidden = false;
  navigate();
}

// ---------- 3. Routing (hash-based) ----------
function currentRoute(){
  const h = location.hash || '#list';
  if (h.startsWith('#edit/')) return { name: 'edit', id: h.slice(6) };
  if (h === '#new') return { name: 'edit', id: null };
  if (h.startsWith('#cat/')) return { name: 'cat-edit', id: h.slice(5) };
  if (h === '#cat-new') return { name: 'cat-edit', id: null };
  if (h === '#cats') return { name: 'cats' };
  if (h === '#settings') return { name: 'settings' };
  return { name: 'list' };
}

function navigate(){
  if (!isAuthed()){ showLogin(); return; }
  const r = currentRoute();
  // Hide all views, then show one
  ['#view-list','#view-edit','#view-cats','#view-cat-edit','#view-settings'].forEach(s => { const el = $(s); if (el) el.hidden = true; });
  // Section-tab active state
  document.querySelectorAll('.sec-tab').forEach(t => t.classList.remove('on'));
  if (r.name === 'list' || r.name === 'edit'){
    document.querySelector('.sec-tab[data-section="list"]')?.classList.add('on');
  } else if (r.name === 'cats' || r.name === 'cat-edit'){
    document.querySelector('.sec-tab[data-section="cats"]')?.classList.add('on');
  } else if (r.name === 'settings'){
    document.querySelector('.sec-tab[data-section="settings"]')?.classList.add('on');
  }

  if (r.name === 'list'){
    $('#view-list').hidden = false;
    renderList();
  } else if (r.name === 'edit'){
    $('#view-edit').hidden = false;
    renderEdit(r.id);
  } else if (r.name === 'cats'){
    $('#view-cats').hidden = false;
    renderCatList();
  } else if (r.name === 'cat-edit'){
    $('#view-cat-edit').hidden = false;
    renderCatEdit(r.id);
  } else if (r.name === 'settings'){
    $('#view-settings').hidden = false;
    renderSettings();
  }
  refreshSectionCounts();
}

function refreshSectionCounts(){
  const cl = document.getElementById('sec-count-list');
  const cc = document.getElementById('sec-count-cats');
  if (cl) cl.textContent = DATA.pois.length;
  if (cc) cc.textContent = DATA.categories.length;
}
window.addEventListener('hashchange', navigate);

// ---------- 4. List view ----------
function renderList(){
  populateFilterDropdowns();
  refreshTable();
}

function populateFilterDropdowns(){
  const cf = $('#cat-filter');
  if (cf.options.length === 1){
    for (const c of DATA.categories){
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      cf.appendChild(o);
    }
  }
  const lf = $('#lvl-filter');
  if (lf.options.length === 1){
    for (const l of DATA.levels){
      const o = document.createElement('option');
      o.value = l.id; o.textContent = l.name;
      lf.appendChild(o);
    }
  }
}

function refreshTable(){
  const q = $('#search-input').value.trim().toLowerCase();
  const cat = $('#cat-filter').value;
  const lvl = $('#lvl-filter').value;
  const filtered = DATA.pois.filter(p => {
    if (cat && p.category_id !== cat) return false;
    if (lvl && p.level_id !== lvl) return false;
    if (q){
      const hay = (p.name + ' ' + (p.name_ar || '') + ' ' + (p.description || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));

  $('#poi-count').textContent = `${filtered.length} place${filtered.length === 1 ? '' : 's'}`;
  const tbody = $('#poi-tbody');
  tbody.innerHTML = filtered.map(p => rowHTML(p)).join('');
  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => { location.hash = `#edit/${tr.dataset.id}`; });
  });
}

function rowHTML(p){
  const cat = DATA.catById[p.category_id];
  const lvl = DATA.lvlById[p.level_id];
  const logo = p.logo
    ? `<img src="${escAttr(p.logo)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'initials',textContent:'${initials(p.name)}'}))">`
    : `<span class="initials">${initials(p.name)}</span>`;
  const con = c => `<span class="ico${c ? ' set' : ''}">`;
  return `
    <tr data-id="${escAttr(p.id)}">
      <td class="td-logo"><div class="poi-logo">${logo}</div></td>
      <td class="td-name poi-name">${escHtml(p.name)}</td>
      <td class="td-cat td-meta"><span class="cat-tag"><span class="dot" style="background:${cat?.color || '#999'}"></span>${escHtml(cat?.name || '—')}</span></td>
      <td class="td-lvl td-meta">${escHtml(lvl?.name || '—')}</td>
      <td class="td-contact poi-contact">
        ${con(p.phone)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.56 2.81.69A2 2 0 0 1 22 16.92z"/></svg></span>
        ${con(p.whatsapp)}<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07L4 22l3-1a10 10 0 0 0 12.07-16.07z"/></svg></span>
        ${con(p.instagram)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/></svg></span>
      </td>
      <td class="td-status"><span class="status-pill${p.is_active ? '' : ' off'}">${p.is_active ? 'Active' : 'Hidden'}</span></td>
      <td class="td-chev chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></td>
    </tr>
  `;
}

function initials(name){
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function escHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s){ return escHtml(s); }

// ---------- 5. Edit view ----------
let editState = {
  poi: null,        // null = new
  level: null,
  concept: 'illustrated',   // which map you're placing the pin on
  // Per-concept pin coords (% of map image). Premium map may not align with
  // illustrated, so each concept stores its own coords.
  pinX_ill: null, pinY_ill: null,
  pinX_new: null, pinY_new: null,
  logoData: null,           // final cropped data URL persisted on the POI
};
// Active pin getters/setters that route to the right concept slot
function getPin(){
  return editState.concept === 'new'
    ? { x: editState.pinX_new, y: editState.pinY_new }
    : { x: editState.pinX_ill, y: editState.pinY_ill };
}
function setPin(x, y){
  if (editState.concept === 'new'){ editState.pinX_new = x; editState.pinY_new = y; }
  else { editState.pinX_ill = x; editState.pinY_ill = y; }
}

// Logo cropper state — only live while cropping
const cropper = {
  active: false,
  src: null,          // data URL of the source image being cropped
  natW: 0, natH: 0,   // natural image dimensions
  scale: 1,           // current zoom multiplier (1 = "cover" fit)
  baseScale: 1,       // scale that makes image cover the 220px window
  offsetX: 0, offsetY: 0, // top-left position in px inside the window
  WINDOW: 220,
  dragging: false, dragStartX: 0, dragStartY: 0, dragOX: 0, dragOY: 0,
};

function renderEdit(id){
  const poi = id ? DATA.pois.find(p => p.id === id) : null;
  editState.poi = poi;
  editState.level = poi?.level_id || 'lvl-ground';
  editState.concept = 'illustrated';
  editState.pinX_ill = poi?.pin_x ?? null;
  editState.pinY_ill = poi?.pin_y ?? null;
  editState.pinX_new = poi?.pin_x_new ?? null;
  editState.pinY_new = poi?.pin_y_new ?? null;
  editState.logoData = poi?.logo || null;

  $('#edit-title').textContent = poi ? `Edit · ${poi.name}` : 'Add a new place';
  $('#delete-btn').hidden = !poi;

  // Populate form
  $('#f-name').value = poi?.name || '';
  $('#f-name-ar').value = poi?.name_ar || '';
  $('#f-category').innerHTML = '<option value="">Select…</option>' +
    DATA.categories.map(c => `<option value="${c.id}" ${poi?.category_id === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('');
  $('#f-level').innerHTML = DATA.levels.map(l => `<option value="${l.id}" ${editState.level === l.id ? 'selected' : ''}>${escHtml(l.name)}</option>`).join('');
  $('#f-phone').value = poi?.phone || '';
  $('#f-whatsapp').value = poi?.whatsapp || '';
  $('#f-instagram').value = poi?.instagram || '';
  $('#f-google-maps').value = poi?.google_maps_url || '';
  $('#f-description').value = poi?.description || '';
  $('#f-description-ar').value = poi?.description_ar || '';
  $('#f-active').checked = poi ? !!poi.is_active : true;

  // Logo preview
  refreshLogoPreview();

  // Level switch on the map header
  $$('#view-edit .lvl-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.lvl === editState.level);
  });

  loadEditMap();
}

function refreshLogoPreview(){
  const wrap = $('#f-logo-preview');
  if (editState.logoData){
    wrap.innerHTML = `<img src="${escAttr(editState.logoData)}" alt="">`;
    $('#f-logo-clear').hidden = false;
    $('#f-logo-recrop').hidden = false;
  } else {
    wrap.innerHTML = `<span>No logo</span>`;
    $('#f-logo-clear').hidden = true;
    $('#f-logo-recrop').hidden = true;
  }
}

function openCropper(src){
  cropper.active = true;
  cropper.src = src;
  $('#f-cropper').hidden = false;
  const img = new Image();
  img.onload = () => {
    cropper.imgEl = img;
    cropper.natW = img.naturalWidth;
    cropper.natH = img.naturalHeight;
    cropper.baseScale = Math.max(
      cropper.WINDOW / cropper.natW,
      cropper.WINDOW / cropper.natH,
    );
    cropper.scale = 1;
    cropper.offsetX = (cropper.WINDOW - cropper.natW * cropper.baseScale) / 2;
    cropper.offsetY = (cropper.WINDOW - cropper.natH * cropper.baseScale) / 2;
    $('#f-cropper-image').src = src;
    $('#f-cropper-zoom').value = 100;
    renderCropper();
  };
  img.src = src;
}

function closeCropper(){
  cropper.active = false;
  cropper.src = null;
  $('#f-cropper').hidden = true;
}

function renderCropper(){
  const img = $('#f-cropper-image');
  if (!img) return;
  const eff = cropper.baseScale * cropper.scale;
  img.style.width = (cropper.natW * eff) + 'px';
  img.style.height = (cropper.natH * eff) + 'px';
  // Clamp offsets so the image always covers the window
  const minX = cropper.WINDOW - cropper.natW * eff;
  const minY = cropper.WINDOW - cropper.natH * eff;
  cropper.offsetX = Math.min(0, Math.max(minX, cropper.offsetX));
  cropper.offsetY = Math.min(0, Math.max(minY, cropper.offsetY));
  img.style.transform = `translate(${cropper.offsetX}px, ${cropper.offsetY}px)`;
  // Live pin-mock preview
  renderPinMock();
}

function renderPinMock(){
  const mock = $('#f-cropper-pin-img');
  if (!mock) return;
  mock.src = cropToDataURL(96);
}

function cropToDataURL(size = 256){
  if (!cropper.imgEl) return '';
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const eff = cropper.baseScale * cropper.scale;
  const srcX = -cropper.offsetX / eff;
  const srcY = -cropper.offsetY / eff;
  const srcSize = cropper.WINDOW / eff;
  ctx.drawImage(cropper.imgEl, srcX, srcY, srcSize, srcSize, 0, 0, size, size);
  return canvas.toDataURL('image/png');
}

// Drag to pan
function bindCropperDrag(){
  const win = $('#f-cropper-window');
  if (!win) return;
  const start = (x, y) => {
    cropper.dragging = true;
    cropper.dragStartX = x; cropper.dragStartY = y;
    cropper.dragOX = cropper.offsetX; cropper.dragOY = cropper.offsetY;
  };
  const move = (x, y) => {
    if (!cropper.dragging) return;
    cropper.offsetX = cropper.dragOX + (x - cropper.dragStartX);
    cropper.offsetY = cropper.dragOY + (y - cropper.dragStartY);
    renderCropper();
  };
  const end = () => { cropper.dragging = false; };
  win.addEventListener('pointerdown', e => { win.setPointerCapture(e.pointerId); start(e.clientX, e.clientY); });
  win.addEventListener('pointermove', e => move(e.clientX, e.clientY));
  win.addEventListener('pointerup', end);
  win.addEventListener('pointercancel', end);
}

function loadEditMap(){
  const lvl = DATA.lvlById[editState.level];
  if (!lvl) return;
  const img = $('#edit-map-img');
  img.onload = () => {
    img.dataset.naturalW = img.naturalWidth;
    img.dataset.naturalH = img.naturalHeight;
    renderEditPin();
  };
  img.src = editMapSrc();
}

// Pick the right map image for the active concept × level (uploaded → default)
function editMapSrc(){
  const s = effectiveSettings();
  const lvl = DATA.lvlById[editState.level];
  const conceptKey = editState.concept === 'new' ? 'new' : 'ill';
  const levelKey = editState.level === 'lvl-marina' ? 'marina' : 'ground';
  const uploaded = s[`map_${conceptKey}_${levelKey}_desktop`] || s[`map_${conceptKey}_${levelKey}_phone`];
  if (uploaded) return uploaded;
  // Bundled defaults
  const DEFAULTS = {
    'ill-ground': 'images/map-ground.png',
    'ill-marina': 'images/map-marina.png',
    'new-ground': 'images/map-new.jpg',
    'new-marina': 'images/map-new-parchment.jpg',
  };
  return DEFAULTS[`${conceptKey}-${levelKey}`] || lvl.map_image;
}

function renderEditPin(){
  const pin = $('#edit-pin');
  const { x: px, y: py } = getPin();
  const label = editState.concept === 'new' ? 'Premium' : 'Illustrated';
  if (px == null || py == null){
    pin.hidden = true;
    $('#edit-pos-hint').textContent = `Tap on the ${label} map to place this pin`;
    $('#edit-pos-coords').textContent = '';
    return;
  }
  const stage = $('#edit-stage');
  const img = $('#edit-map-img');
  const iw = +img.dataset.naturalW || img.naturalWidth || 1;
  const ih = +img.dataset.naturalH || img.naturalHeight || 1;
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const scale = Math.min(sw / iw, sh / ih);
  const dispW = iw * scale, dispH = ih * scale;
  const offX = (sw - dispW) / 2, offY = (sh - dispH) / 2;
  pin.style.left = `${offX + (px / 100) * dispW}px`;
  pin.style.top  = `${offY + (py / 100) * dispH}px`;
  pin.hidden = false;
  $('#edit-pos-hint').textContent = `Drag the pin · ${label} map`;
  $('#edit-pos-coords').textContent = `(${px.toFixed(2)}%, ${py.toFixed(2)}%)`;
}

function setPinFromPointer(clientX, clientY){
  const stage = $('#edit-stage');
  const img = $('#edit-map-img');
  const iw = +img.dataset.naturalW || img.naturalWidth || 1;
  const ih = +img.dataset.naturalH || img.naturalHeight || 1;
  const rect = stage.getBoundingClientRect();
  const sw = rect.width, sh = rect.height;
  const scale = Math.min(sw / iw, sh / ih);
  const dispW = iw * scale, dispH = ih * scale;
  const offX = (sw - dispW) / 2, offY = (sh - dispH) / 2;
  const x = clientX - rect.left - offX;
  const y = clientY - rect.top - offY;
  // Clamp to image area
  if (x < 0 || y < 0 || x > dispW || y > dispH) return;
  setPin((x / dispW) * 100, (y / dispH) * 100);
  renderEditPin();
}

(function wireEditStage(){
  const stage = document.getElementById('edit-stage');
  if (!stage) return;
  let dragging = false;
  stage.addEventListener('pointerdown', e => {
    setPinFromPointer(e.clientX, e.clientY);
    stage.setPointerCapture(e.pointerId);
    dragging = true;
  });
  stage.addEventListener('pointermove', e => {
    if (!dragging) return;
    setPinFromPointer(e.clientX, e.clientY);
  });
  stage.addEventListener('pointerup', () => { dragging = false; });
  stage.addEventListener('pointercancel', () => { dragging = false; });
  window.addEventListener('resize', renderEditPin);
})();

// Concept switch on edit map header
document.addEventListener('click', e => {
  const btn = e.target.closest?.('#view-edit .concept-btn');
  if (!btn) return;
  editState.concept = btn.dataset.concept;
  $$('#view-edit .concept-btn').forEach(b => b.classList.toggle('on', b === btn));
  loadEditMap();
});

// Level switch on map header
document.addEventListener('click', e => {
  const btn = e.target.closest?.('#view-edit .lvl-btn');
  if (!btn) return;
  editState.level = btn.dataset.lvl;
  $$('#view-edit .lvl-btn').forEach(b => b.classList.toggle('on', b === btn));
  $('#f-level').value = editState.level;
  loadEditMap();
});

// Logo upload + crop
$('#f-logo-btn')?.addEventListener('click', () => $('#f-logo-file').click());
$('#f-logo-clear')?.addEventListener('click', () => {
  editState.logoData = null;
  closeCropper();
  refreshLogoPreview();
});
$('#f-logo-recrop')?.addEventListener('click', () => {
  if (editState.logoData) openCropper(editState.logoData);
});
$('#f-logo-file')?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => openCropper(reader.result);
  reader.readAsDataURL(file);
  // Allow re-selecting the same file later
  e.target.value = '';
});
$('#f-cropper-zoom')?.addEventListener('input', e => {
  cropper.scale = (parseInt(e.target.value, 10) || 100) / 100;
  renderCropper();
});
$('#f-cropper-apply')?.addEventListener('click', () => {
  editState.logoData = cropToDataURL(256);
  closeCropper();
  refreshLogoPreview();
});
$('#f-cropper-cancel')?.addEventListener('click', () => closeCropper());
bindCropperDrag();

// Sync level field changes back to map
$('#f-level')?.addEventListener('change', e => {
  editState.level = e.target.value;
  $$('#view-edit .lvl-btn').forEach(b => b.classList.toggle('on', b.dataset.lvl === editState.level));
  loadEditMap();
});

// Save / Cancel / Delete
$('#save-btn')?.addEventListener('click', onSavePoi);
$('#delete-btn')?.addEventListener('click', onDeletePoi);
$('#back-list-btn')?.addEventListener('click', () => { location.hash = '#list'; });
$('#new-poi-btn')?.addEventListener('click', () => { location.hash = '#new'; });

async function onSavePoi(){
  const name = $('#f-name').value.trim();
  const category_id = $('#f-category').value;
  const level_id = $('#f-level').value;
  if (!name){ toast('Name is required', 'err'); $('#f-name').focus(); return; }
  if (!category_id){ toast('Category is required', 'err'); $('#f-category').focus(); return; }
  if (!level_id){ toast('Level is required', 'err'); return; }
  if (editState.pinX_ill == null && editState.pinX_new == null){
    toast('Tap on the map to place a pin first', 'err'); return;
  }

  const partial = {
    name,
    name_ar: $('#f-name-ar').value.trim() || null,
    category_id,
    level_id,
    pin_x: editState.pinX_ill != null ? round2(editState.pinX_ill) : null,
    pin_y: editState.pinY_ill != null ? round2(editState.pinY_ill) : null,
    pin_x_new: editState.pinX_new != null ? round2(editState.pinX_new) : null,
    pin_y_new: editState.pinY_new != null ? round2(editState.pinY_new) : null,
    phone: $('#f-phone').value.trim() || null,
    whatsapp: $('#f-whatsapp').value.trim() || null,
    instagram: $('#f-instagram').value.trim() || null,
    google_maps_url: $('#f-google-maps').value.trim() || null,
    description: $('#f-description').value.trim() || null,
    description_ar: $('#f-description-ar').value.trim() || null,
    is_active: $('#f-active').checked,
    logo: editState.logoData,
  };

  if (editState.poi){
    persistEdit(editState.poi.id, partial);
    toast(`Saved · ${name}`, 'ok');
  } else {
    const id = 'poi-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    persistAdd({ id, lat: null, lng: null, ...partial });
    toast(`Added · ${name}`, 'ok');
  }
  setTimeout(() => { location.hash = '#list'; }, 600);
}

function onDeletePoi(){
  if (!editState.poi) return;
  if (!confirm(`Delete "${editState.poi.name}"? This can be undone by re-adding it.`)) return;
  persistDelete(editState.poi.id);
  toast('Deleted', 'ok');
  setTimeout(() => { location.hash = '#list'; }, 500);
}

function round2(n){ return Math.round(n * 100) / 100; }

// ---------- 5b. Categories ----------
const PRESET_SWATCHES = [
  '#3AB0C8', '#0E4F58', '#1E40AF', '#7C3AED', '#DC2626', '#EA580C',
  '#92400E', '#8B5E3C', '#059669', '#10B981', '#0891B2', '#C026D3',
  '#F59E0B', '#FBBF24', '#84CC16', '#EF4444', '#EC4899', '#6B7280'
];
const ICON_SVGS = {
  coffee:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>',
  bed:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>',
  'shopping-bag':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  wine:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5V3H7v7a5 5 0 0 0 5 5z"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  landmark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>',
  utensils:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>',
  compass:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  sparkles:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/></svg>',
};

function renderCatList(){
  const wrap = $('#cat-grid');
  if (!wrap) return;
  // POIs grouped by category
  const byCat = {};
  DATA.pois.forEach(p => {
    (byCat[p.category_id] = byCat[p.category_id] || []).push(p);
  });
  $('#cat-count').textContent = `${DATA.categories.length} categories`;
  wrap.innerHTML = DATA.categories.map(c => {
    const places = (byCat[c.id] || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const MAX_CHIPS = 6;
    const sample = places.slice(0, MAX_CHIPS);
    const more = places.length - sample.length;
    const chips = sample.map(p => `<span class="chip">${escHtml(p.name)}</span>`).join('');
    const moreChip = more > 0 ? `<span class="chip more">+ ${more} more</span>` : '';
    const empty = places.length === 0 ? `<span class="chip empty">No places yet</span>` : '';
    return `
      <div class="cat-card" data-id="${escAttr(c.id)}" style="--c:${escAttr(c.color)}">
        <div class="cat-card-head">
          <div class="swatch-lg">
            <div class="swatch-lg-inner">${ICON_SVGS[c.icon] || ICON_SVGS.compass}</div>
          </div>
          <span class="hex-chip">${escHtml(c.color.toUpperCase())}</span>
        </div>
        <div class="cat-titles">
          <h3 class="cat-name">${escHtml(c.name)}</h3>
          ${c.name_ar ? `<p class="cat-name-ar">${escHtml(c.name_ar)}</p>` : ''}
        </div>
        <p class="cat-stats"><strong>${places.length}</strong>place${places.length === 1 ? '' : 's'}</p>
        <div class="cat-mini-grid">
          ${chips}${moreChip}${empty}
        </div>
      </div>
    `;
  }).join('');
  wrap.querySelectorAll('.cat-card').forEach(el => {
    el.addEventListener('click', () => { location.hash = `#cat/${el.dataset.id}`; });
  });
}

let catEditState = { cat: null, color: '#3AB0C8' };

function renderCatEdit(id){
  const cat = id ? DATA.categories.find(c => c.id === id) : null;
  catEditState.cat = cat;
  catEditState.color = cat?.color || '#3AB0C8';

  $('#cat-edit-title').textContent = cat ? `Edit · ${cat.name}` : 'Add a new category';
  $('#cat-delete-btn').hidden = !cat;

  $('#cf-name').value = cat?.name || '';
  $('#cf-name-ar').value = cat?.name_ar || '';
  $('#cf-slug').value = cat?.slug || '';
  $('#cf-color').value = catEditState.color;
  $('#cf-color-hex').value = catEditState.color.toUpperCase();
  $('#cf-icon').value = cat?.icon || 'compass';
  $('#cf-sort').value = cat?.sort_order ?? 0;

  renderSwatches();
  refreshCatPreview();
}

function renderSwatches(){
  const wrap = $('#cf-swatches');
  if (!wrap) return;
  wrap.innerHTML = PRESET_SWATCHES.map(c => `
    <div class="color-swatch ${c.toLowerCase() === catEditState.color.toLowerCase() ? 'on' : ''}" style="--c:${c}" data-color="${c}"></div>
  `).join('');
  wrap.querySelectorAll('.color-swatch').forEach(el => {
    el.addEventListener('click', () => {
      const c = el.dataset.color;
      setCatColor(c);
    });
  });
}

function setCatColor(hex){
  catEditState.color = hex;
  $('#cf-color').value = hex;
  $('#cf-color-hex').value = hex.toUpperCase();
  renderSwatches();
  refreshCatPreview();
}

function refreshCatPreview(){
  const c = catEditState.color;
  document.documentElement.style.setProperty('--c', c);
  const preview = $('#cat-pin-preview');
  if (preview){
    preview.style.setProperty('--c', c);
    preview.innerHTML = `
      <div class="pin-body">
        <div class="pin-inner">${ICON_SVGS[$('#cf-icon').value] || ICON_SVGS.compass}</div>
      </div>
    `;
  }
  const meta = $('#cat-preview-meta');
  if (meta) meta.textContent = ($('#cf-name').value || 'Category name') + ' · ' + c.toUpperCase();
  $('#cf-color-preview').style.setProperty('--c', c);
}

// Wire up category form events
$('#cf-color')?.addEventListener('input', e => setCatColor(e.target.value));
$('#cf-color-hex')?.addEventListener('input', e => {
  let v = e.target.value.trim();
  if (!v.startsWith('#')) v = '#' + v;
  if (/^#[0-9a-fA-F]{6}$/.test(v)) setCatColor(v);
});
$('#cf-name')?.addEventListener('input', refreshCatPreview);
$('#cf-icon')?.addEventListener('change', refreshCatPreview);

$('#cat-save-btn')?.addEventListener('click', () => {
  const name = $('#cf-name').value.trim();
  if (!name){ toast('Category name is required', 'err'); $('#cf-name').focus(); return; }
  const hex = $('#cf-color-hex').value.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(hex)){ toast('Invalid colour hex — use format #RRGGBB', 'err'); return; }
  const partial = {
    name,
    name_ar: $('#cf-name-ar').value.trim() || null,
    slug: $('#cf-slug').value.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    color: hex,
    icon: $('#cf-icon').value,
    sort_order: parseInt($('#cf-sort').value, 10) || 0,
  };
  if (catEditState.cat){
    persistCatEdit(catEditState.cat.id, partial);
    toast(`Saved · ${name}`, 'ok');
  } else {
    const id = 'cat-' + (partial.slug || Date.now().toString(36));
    persistCatAdd({ id, ...partial });
    toast(`Added · ${name}`, 'ok');
  }
  setTimeout(() => { location.hash = '#cats'; }, 500);
});

$('#cat-delete-btn')?.addEventListener('click', () => {
  if (!catEditState.cat) return;
  const inUse = DATA.pois.filter(p => p.category_id === catEditState.cat.id).length;
  if (inUse > 0){
    if (!confirm(`${inUse} places use this category. Delete anyway? Those places will lose their category.`)) return;
  } else {
    if (!confirm(`Delete "${catEditState.cat.name}"?`)) return;
  }
  persistCatDelete(catEditState.cat.id);
  toast('Category deleted', 'ok');
  setTimeout(() => { location.hash = '#cats'; }, 500);
});

$('#back-cats-btn')?.addEventListener('click', () => { location.hash = '#cats'; });
$('#new-cat-btn')?.addEventListener('click', () => { location.hash = '#cat-new'; });

// Section tab clicks — let any new section route work
document.querySelectorAll('.sec-tab').forEach(t => {
  t.addEventListener('click', e => {
    e.preventDefault();
    const sec = t.dataset.section;
    const route = { list: '#list', cats: '#cats', settings: '#settings' }[sec] || '#list';
    location.hash = route;
  });
});

// ---------- 5c. Settings ----------
const SETTINGS_KEY = 'ayla_settings_overrides_v1';
function readSettings(){
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch(_) { return {}; }
}
function writeSettings(o){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(o)); }

function effectiveSettings(){
  // Defaults from settings.json + localStorage overrides
  const base = DATA.settings || {};
  const ov = readSettings();
  return {
    brand_name:    ov.brand_name    ?? base.brand?.name        ?? 'Ayla Marina',
    brand_name_ar: ov.brand_name_ar ?? base.brand?.name_ar     ?? 'أيلا مارينا',
    splash_tag:    ov.splash_tag    ?? base.brand?.splash_tagline ?? 'Shops, dining and experiences by the sea',
    logo_data:     ov.logo_data     ?? null,
    primary:       ov.primary       ?? '#3AB0C8',
    // Custom fonts (data URLs) + names
    font_heading_data: ov.font_heading_data ?? null,
    font_heading_name: ov.font_heading_name ?? 'Playfair Display',
    font_body_data:    ov.font_body_data    ?? null,
    font_body_name:    ov.font_body_name    ?? 'Inter',
    show_illustrated: ov.show_illustrated !== false,
    show_satellite:   ov.show_satellite   !== false,
    show_new:         ov.show_new         !== false,
    default_concept:  ov.default_concept  ?? 'illustrated',
    // 2 concepts × 2 levels (ground/marina) × 2 devices (desktop/phone) = 8
    map_ill_ground_desktop: ov.map_ill_ground_desktop ?? null,
    map_ill_ground_phone:   ov.map_ill_ground_phone   ?? null,
    map_ill_marina_desktop: ov.map_ill_marina_desktop ?? null,
    map_ill_marina_phone:   ov.map_ill_marina_phone   ?? null,
    map_new_ground_desktop: ov.map_new_ground_desktop ?? null,
    map_new_ground_phone:   ov.map_new_ground_phone   ?? null,
    map_new_marina_desktop: ov.map_new_marina_desktop ?? null,
    map_new_marina_phone:   ov.map_new_marina_phone   ?? null,
    password_hash:    ov.password_hash    ?? base.admin?.password_hash ?? '',
  };
}

let _settingsState = {
  logo: null,
  fontHeading: null, fontHeadingName: 'Playfair Display',
  fontBody: null, fontBodyName: 'Inter',
  illGroundDesktop: null, illGroundPhone: null,
  illMarinaDesktop: null, illMarinaPhone: null,
  newGroundDesktop: null, newGroundPhone: null,
  newMarinaDesktop: null, newMarinaPhone: null,
};

function updateAdminBrand(name){
  if (!name) return;
  const el = document.getElementById('admin-brand');
  if (!el) return;
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2){
    const accent = parts.pop();
    el.innerHTML = `${escHtml(parts.join(' '))} <span>${escHtml(accent)}</span>`;
  } else {
    el.innerHTML = `<span>${escHtml(name)}</span>`;
  }
  document.title = name + ' · Admin';
}

function renderSettings(){
  const s = effectiveSettings();
  $('#s-brand-name').value = s.brand_name;
  updateAdminBrand(s.brand_name);
  $('#s-brand-name-ar').value = s.brand_name_ar;
  $('#s-splash-tag').value = s.splash_tag;
  $('#s-color').value = s.primary;
  $('#s-color-hex').value = s.primary.toUpperCase();
  $('#s-color-preview').style.setProperty('--c', s.primary);
  $('#s-show-illustrated').checked = s.show_illustrated;
  $('#s-show-satellite').checked = s.show_satellite;
  $('#s-show-new').checked = s.show_new;
  $('#s-default-concept').value = s.default_concept;
  _settingsState.logo            = s.logo_data;
  _settingsState.fontHeading     = s.font_heading_data;
  _settingsState.fontHeadingName = s.font_heading_name;
  _settingsState.fontBody        = s.font_body_data;
  _settingsState.fontBodyName    = s.font_body_name;
  _settingsState.illGroundDesktop = s.map_ill_ground_desktop;
  _settingsState.illGroundPhone   = s.map_ill_ground_phone;
  _settingsState.illMarinaDesktop = s.map_ill_marina_desktop;
  _settingsState.illMarinaPhone   = s.map_ill_marina_phone;
  _settingsState.newGroundDesktop = s.map_new_ground_desktop;
  _settingsState.newGroundPhone   = s.map_new_ground_phone;
  _settingsState.newMarinaDesktop = s.map_new_marina_desktop;
  _settingsState.newMarinaPhone   = s.map_new_marina_phone;
  refreshSettingsPreviews();
  refreshMapPicker();
}

function refreshSettingsPreviews(){
  const setPrev = (id, data, fallbackBg) => {
    const el = $(id);
    if (!el) return;
    el.innerHTML = data ? `<img src="${data}" alt="" style="width:100%;height:100%;object-fit:cover">` : '';
    el.style.background = data ? '' : (fallbackBg || 'var(--muted)');
  };
  setPrev('#s-logo-preview', _settingsState.logo, '#1F7A8A');
  setPrev('#s-map-ill-ground-desktop-preview', _settingsState.illGroundDesktop);
  setPrev('#s-map-ill-ground-phone-preview',   _settingsState.illGroundPhone);
  setPrev('#s-map-ill-marina-desktop-preview', _settingsState.illMarinaDesktop);
  setPrev('#s-map-ill-marina-phone-preview',   _settingsState.illMarinaPhone);
  setPrev('#s-map-new-ground-desktop-preview', _settingsState.newGroundDesktop);
  setPrev('#s-map-new-ground-phone-preview',   _settingsState.newGroundPhone);
  setPrev('#s-map-new-marina-desktop-preview', _settingsState.newMarinaDesktop);
  setPrev('#s-map-new-marina-phone-preview',   _settingsState.newMarinaPhone);

  // Font previews: apply the uploaded font if present
  if (_settingsState.fontHeading){
    injectFontFace('AylaCustomHeading', _settingsState.fontHeading);
    const p = $('#s-font-heading-preview'); if (p) p.style.fontFamily = "'AylaCustomHeading', " + (_settingsState.fontHeadingName || 'serif');
  }
  if (_settingsState.fontBody){
    injectFontFace('AylaCustomBody', _settingsState.fontBody);
    const p = $('#s-font-body-preview'); if (p) p.style.fontFamily = "'AylaCustomBody', " + (_settingsState.fontBodyName || 'sans-serif');
  }
  $('#s-font-heading-name').textContent = _settingsState.fontHeadingName + (_settingsState.fontHeading ? ' (custom)' : ' (default)');
  $('#s-font-body-name').textContent    = _settingsState.fontBodyName    + (_settingsState.fontBody    ? ' (custom)' : ' (default)');

  // Clear buttons
  $('#s-logo-clear').hidden = !_settingsState.logo;
  $('#s-font-heading-clear').hidden = !_settingsState.fontHeading;
  $('#s-font-body-clear').hidden    = !_settingsState.fontBody;
  document.querySelectorAll('[data-upload-clear]').forEach(b => {
    const key = MAP_STATE_KEY[b.dataset.uploadClear];
    if (key) b.hidden = !_settingsState[key];
  });
}

// Inject (or update) a @font-face rule pointing at a data URL
function injectFontFace(family, dataUrl){
  let style = document.getElementById('font-' + family);
  if (!style){
    style = document.createElement('style');
    style.id = 'font-' + family;
    document.head.appendChild(style);
  }
  style.textContent = `@font-face{font-family:"${family}";src:url(${dataUrl});font-display:swap}`;
}

function bindFileInput(btnId, inputId, stateKey){
  $(btnId)?.addEventListener('click', () => $(inputId).click());
  $(inputId)?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { _settingsState[stateKey] = reader.result; refreshSettingsPreviews(); };
    reader.readAsDataURL(file);
  });
}
bindFileInput('#s-logo-btn', '#s-logo-file', 'logo');

// MAP picker — one upload UI, mirrors to the right state slot via concept+level tabs
const MP = { concept: 'ill', level: 'ground' };
const MP_STATE = {
  'ill-ground-desktop': 'illGroundDesktop', 'ill-ground-phone': 'illGroundPhone',
  'ill-marina-desktop': 'illMarinaDesktop', 'ill-marina-phone': 'illMarinaPhone',
  'new-ground-desktop': 'newGroundDesktop', 'new-ground-phone': 'newGroundPhone',
  'new-marina-desktop': 'newMarinaDesktop', 'new-marina-phone': 'newMarinaPhone',
};
function mpKey(device){ return MP_STATE[`${MP.concept}-${MP.level}-${device}`]; }

// Default bundled maps used by the public site when nothing is uploaded.
// Both Desktop + Phone fall back to the same source image until uploaded.
const DEFAULT_MAPS = {
  'ill-ground': 'images/map-ground.png',
  'ill-marina': 'images/map-marina.png',
  'new-ground': 'images/map-new.jpg',
  'new-marina': 'images/map-new-parchment.jpg',
};
function refreshMapPicker(){
  const setTile = (device) => {
    const data = _settingsState[mpKey(device)];
    const fallback = DEFAULT_MAPS[`${MP.concept}-${MP.level}`];
    const src = data || fallback;
    const isCustom = !!data;
    const prev = $(`#s-mp-${device}-preview`);
    if (!prev) return;
    if (src){
      prev.innerHTML = `
        <img src="${src}" alt="">
        <span class="map-tile-badge ${isCustom ? 'custom' : 'default'}">${isCustom ? 'Custom upload' : 'Default · bundled'}</span>
      `;
    } else {
      prev.innerHTML = '<span>No image yet</span>';
    }
    const clr = document.querySelector(`[data-mp-clear="${device}"]`);
    if (clr) clr.hidden = !data;
  };
  setTile('desktop'); setTile('phone');
}

// Auto-persist on upload so the new map reflects immediately in localStorage
function persistSettingsNow(){
  const current = readSettings();
  writeSettings({
    ...current,
    map_ill_ground_desktop: _settingsState.illGroundDesktop,
    map_ill_ground_phone:   _settingsState.illGroundPhone,
    map_ill_marina_desktop: _settingsState.illMarinaDesktop,
    map_ill_marina_phone:   _settingsState.illMarinaPhone,
    map_new_ground_desktop: _settingsState.newGroundDesktop,
    map_new_ground_phone:   _settingsState.newGroundPhone,
    map_new_marina_desktop: _settingsState.newMarinaDesktop,
    map_new_marina_phone:   _settingsState.newMarinaPhone,
  });
}

// Tab switching
document.addEventListener('click', e => {
  const tab = e.target.closest?.('.mp-tab');
  if (!tab) return;
  const group = tab.parentElement;
  group.querySelectorAll('.mp-tab').forEach(b => b.classList.remove('on'));
  tab.classList.add('on');
  if (tab.dataset.concept) MP.concept = tab.dataset.concept;
  if (tab.dataset.level)   MP.level = tab.dataset.level;
  refreshMapPicker();
});

// Upload + clear inside the active tile
document.addEventListener('click', e => {
  const up = e.target.closest?.('[data-mp-upload]');
  const cl = e.target.closest?.('[data-mp-clear]');
  if (up) $(`#s-mp-${up.dataset.mpUpload}-file`).click();
  else if (cl){
    _settingsState[mpKey(cl.dataset.mpClear)] = null;
    persistSettingsNow();
    refreshMapPicker();
    refreshSettingsPreviews();
    // Refresh the admin edit map if open
    if (typeof loadEditMap === 'function') loadEditMap();
  }
});
['desktop','phone'].forEach(device => {
  document.getElementById(`s-mp-${device}-file`)?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      _settingsState[mpKey(device)] = reader.result;
      persistSettingsNow();
      refreshMapPicker();
      refreshSettingsPreviews();
      if (typeof loadEditMap === 'function') loadEditMap();
      toast(`Uploaded · reflected on the current map`, 'ok');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });
});

// FONT uploads
function setupFontUpload(btnId, inputId, clearId, stateKey, nameKey){
  $(btnId)?.addEventListener('click', () => $(inputId).click());
  $(inputId)?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      _settingsState[stateKey] = reader.result;
      // Strip extension so the font name is presentable
      _settingsState[nameKey] = file.name.replace(/\.[^.]+$/, '');
      refreshSettingsPreviews();
    };
    reader.readAsDataURL(file);
  });
  $(clearId)?.addEventListener('click', () => {
    _settingsState[stateKey] = null;
    _settingsState[nameKey] = nameKey === 'fontHeadingName' ? 'Playfair Display' : 'Inter';
    refreshSettingsPreviews();
  });
}
setupFontUpload('#s-font-heading-btn', '#s-font-heading-file', '#s-font-heading-clear', 'fontHeading', 'fontHeadingName');
setupFontUpload('#s-font-body-btn',    '#s-font-body-file',    '#s-font-body-clear',    'fontBody',    'fontBodyName');

// Logo clear
$('#s-logo-clear')?.addEventListener('click', () => { _settingsState.logo = null; refreshSettingsPreviews(); });

// Colour sync
$('#s-color')?.addEventListener('input', e => {
  const v = e.target.value;
  $('#s-color-hex').value = v.toUpperCase();
  $('#s-color-preview').style.setProperty('--c', v);
});
$('#s-color-hex')?.addEventListener('input', e => {
  let v = e.target.value.trim();
  if (!v.startsWith('#')) v = '#' + v;
  if (/^#[0-9a-fA-F]{6}$/.test(v)){
    $('#s-color').value = v;
    $('#s-color-preview').style.setProperty('--c', v);
  }
});

// Save settings
$('#settings-save-btn')?.addEventListener('click', () => {
  const o = {
    brand_name:       $('#s-brand-name').value.trim() || null,
    brand_name_ar:    $('#s-brand-name-ar').value.trim() || null,
    splash_tag:       $('#s-splash-tag').value.trim() || null,
    logo_data:        _settingsState.logo,
    primary:          $('#s-color-hex').value.trim().toUpperCase(),
    font_heading_data: _settingsState.fontHeading,
    font_heading_name: _settingsState.fontHeadingName,
    font_body_data:    _settingsState.fontBody,
    font_body_name:    _settingsState.fontBodyName,
    show_illustrated: $('#s-show-illustrated').checked,
    show_satellite:   $('#s-show-satellite').checked,
    show_new:         $('#s-show-new').checked,
    default_concept:  $('#s-default-concept').value,
    map_ill_ground_desktop: _settingsState.illGroundDesktop,
    map_ill_ground_phone:   _settingsState.illGroundPhone,
    map_ill_marina_desktop: _settingsState.illMarinaDesktop,
    map_ill_marina_phone:   _settingsState.illMarinaPhone,
    map_new_ground_desktop: _settingsState.newGroundDesktop,
    map_new_ground_phone:   _settingsState.newGroundPhone,
    map_new_marina_desktop: _settingsState.newMarinaDesktop,
    map_new_marina_phone:   _settingsState.newMarinaPhone,
  };
  const current = readSettings();
  writeSettings({ ...current, ...o });
  toast('Saved · reload the public site to see the changes', 'ok');
});

// Password change
$('#s-pw-change-btn')?.addEventListener('click', async () => {
  const cur = $('#s-pw-current').value;
  const nw  = $('#s-pw-new').value;
  const cf  = $('#s-pw-confirm').value;
  if (!cur || !nw || !cf){ toast('Fill all three password fields', 'err'); return; }
  if (nw.length < 6){ toast('New password too short (min 6 chars)', 'err'); return; }
  if (nw !== cf){ toast('Passwords do not match', 'err'); return; }
  const ok = await tryLogin(cur);
  if (!ok){ toast('Current password is wrong', 'err'); return; }
  const newHash = await sha256(nw);
  const o = readSettings();
  o.password_hash = newHash;
  writeSettings(o);
  // Also patch in-memory settings so this session works
  if (DATA.settings){ DATA.settings.admin = DATA.settings.admin || {}; DATA.settings.admin.password_hash = newHash; }
  $('#s-pw-current').value = ''; $('#s-pw-new').value = ''; $('#s-pw-confirm').value = '';
  refreshDemoHint();
  toast('Password changed · export settings.json to persist for other users', 'ok');
});

// ---------- 6. Export JSON ----------
$('#export-btn')?.addEventListener('click', () => {
  const json = JSON.stringify(DATA.pois.map(p => ({
    id: p.id,
    name: p.name,
    name_ar: p.name_ar ?? null,
    level_id: p.level_id,
    category_id: p.category_id,
    pin_x: p.pin_x,
    pin_y: p.pin_y,
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    google_maps_url: p.google_maps_url ?? null,
    logo: p.logo ?? null,
    instagram: p.instagram ?? null,
    phone: p.phone ?? null,
    whatsapp: p.whatsapp ?? null,
    description: p.description ?? null,
    description_ar: p.description_ar ?? null,
    is_active: p.is_active !== false,
  })), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pois.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Downloaded pois.json — commit to the repo and Vercel will redeploy', 'ok');
  // Also offer categories.json if any cat changes exist
  const o = readOverrides();
  if ((o.catUpdates && Object.keys(o.catUpdates).length) || (o.catAdds && o.catAdds.length) || (o.catDeletes && o.catDeletes.length)){
    setTimeout(() => {
      const catJson = JSON.stringify(DATA.categories.map(c => ({
        id: c.id, slug: c.slug, name: c.name, name_ar: c.name_ar ?? null,
        color: c.color, icon: c.icon, sort_order: c.sort_order ?? 0,
      })), null, 2);
      const b = new Blob([catJson], { type: 'application/json' });
      const u = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = u; a.download = 'categories.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(u);
      toast('Also downloaded categories.json', 'ok');
    }, 1200);
  }
});

// ---------- 7. Login form ----------
// Hide the "Demo password: ayla2026" hint once the admin has set a custom password.
function refreshDemoHint(){
  const hint = document.querySelector('.login-hint');
  if (!hint) return;
  if (readSettings()?.password_hash) hint.hidden = true;
}
refreshDemoHint();

$('#login-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  const pw = $('#login-password').value;
  if (!pw) return;
  const ok = await tryLogin(pw);
  if (ok){
    $('#login-error').hidden = true;
    setAuthed();
    showApp();
  } else {
    $('#login-error').hidden = false;
    $('#login-password').select();
  }
});

$('#logout-btn')?.addEventListener('click', () => {
  clearAuthed();
  showLogin();
});

// ---------- 8. Filter / search events ----------
$('#search-input')?.addEventListener('input', refreshTable);
$('#cat-filter')?.addEventListener('change', refreshTable);
$('#lvl-filter')?.addEventListener('change', refreshTable);

// ---------- 9. Toast ----------
function toast(msg, type){
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + (type === 'ok' ? 'ok' : type === 'err' ? 'err' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- 10. Boot ----------
(async function boot(){
  try {
    await loadData();
  } catch(err){
    console.error(err);
    document.body.innerHTML = '<div style="padding:40px;font-family:system-ui">Couldn\'t load data. Check that /data JSON files exist.</div>';
    return;
  }
  if (isAuthed()) showApp();
  else showLogin();
})();
