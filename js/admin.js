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
  DATA.categories = categories.sort((a, b) => a.sort_order - b.sort_order);
  // Apply any saved overrides on top of the JSON
  const overrides = readOverrides();
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
  return { name: 'list' };
}

function navigate(){
  if (!isAuthed()){ showLogin(); return; }
  const r = currentRoute();
  if (r.name === 'list'){
    $('#view-list').hidden = false;
    $('#view-edit').hidden = true;
    renderList();
  } else if (r.name === 'edit'){
    $('#view-list').hidden = true;
    $('#view-edit').hidden = false;
    renderEdit(r.id);
  }
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
  pinX: null, pinY: null,   // % of image
  logoData: null,
};

function renderEdit(id){
  const poi = id ? DATA.pois.find(p => p.id === id) : null;
  editState.poi = poi;
  editState.level = poi?.level_id || 'lvl-ground';
  editState.pinX = poi?.pin_x ?? null;
  editState.pinY = poi?.pin_y ?? null;
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
  } else {
    wrap.innerHTML = `<span>No logo</span>`;
    $('#f-logo-clear').hidden = true;
  }
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
  img.src = lvl.map_image;
}

function renderEditPin(){
  const pin = $('#edit-pin');
  if (editState.pinX == null || editState.pinY == null){
    pin.hidden = true;
    $('#edit-pos-hint').textContent = 'Tap on the map to place this pin';
    $('#edit-pos-coords').textContent = '';
    return;
  }
  // Translate % → CSS position within the stage's contained image rect
  const stage = $('#edit-stage');
  const img = $('#edit-map-img');
  const iw = +img.dataset.naturalW || img.naturalWidth || 1;
  const ih = +img.dataset.naturalH || img.naturalHeight || 1;
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const scale = Math.min(sw / iw, sh / ih);
  const dispW = iw * scale, dispH = ih * scale;
  const offX = (sw - dispW) / 2, offY = (sh - dispH) / 2;
  pin.style.left = `${offX + (editState.pinX / 100) * dispW}px`;
  pin.style.top  = `${offY + (editState.pinY / 100) * dispH}px`;
  pin.hidden = false;
  $('#edit-pos-hint').textContent = 'Drag the pin to fine-tune';
  $('#edit-pos-coords').textContent = `(${editState.pinX.toFixed(2)}%, ${editState.pinY.toFixed(2)}%)`;
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
  editState.pinX = (x / dispW) * 100;
  editState.pinY = (y / dispH) * 100;
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

// Level switch on map header
document.addEventListener('click', e => {
  const btn = e.target.closest?.('#view-edit .lvl-btn');
  if (!btn) return;
  editState.level = btn.dataset.lvl;
  $$('#view-edit .lvl-btn').forEach(b => b.classList.toggle('on', b === btn));
  $('#f-level').value = editState.level;
  loadEditMap();
});

// Logo upload
$('#f-logo-btn')?.addEventListener('click', () => $('#f-logo-file').click());
$('#f-logo-clear')?.addEventListener('click', () => { editState.logoData = null; refreshLogoPreview(); });
$('#f-logo-file')?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { editState.logoData = reader.result; refreshLogoPreview(); };
  reader.readAsDataURL(file);
});

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
  if (editState.pinX == null){ toast('Tap on the map to place a pin first', 'err'); return; }

  const partial = {
    name,
    name_ar: $('#f-name-ar').value.trim() || null,
    category_id,
    level_id,
    pin_x: round2(editState.pinX),
    pin_y: round2(editState.pinY),
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
});

// ---------- 7. Login form ----------
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
