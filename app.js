import { parsePoints, buildVertices, analyze, f2, jalaliToday, hashText } from './geometry.js';
import { TEMPLATES } from './templates.js';
import { buildScene, SCALES } from './scene.js';
import { drawScene, makeMeasure } from './draw.js';
import { sceneToDxf } from './dxf.js';
import { makePdfBlob } from './pdf.js';

const $ = (id) => document.getElementById(id);
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* حافظه پر است */ } },
};

// ---------- وضعیت ----------
const model = {
  rows: [],
  tol: 0.1,
  reverse: false,
  adj: {},
  fileName: '',
  hash: '',
  settings: Object.assign(
    { company: '', surveyor: '', county: '', city: '', logo: '', dxfFont: 'Tahoma', paper: 'A4', orient: 'landscape' },
    LS.get('ums.settings', {}),
  ),
  meta: {
    template: 'tafkiki',
    title: TEMPLATES.tafkiki.title,
    statement: TEMPLATES.tafkiki.statement,
    date: '',
    applicant: '', plakMain: '', plakSub: '', bakhsh: '', address: '',
    scaleDen: 0,
    showLengths: true, showVertexNums: true, showCoords: true,
  },
};
Object.assign(model.meta, LS.get('ums.meta.defaults', {}));
if (!model.meta.date) model.meta.date = jalaliToday();

const imgs = {};
const measure = makeMeasure(document.createElement('canvas').getContext('2d'));
let zoom = 1;
let raf = 0;
let lastScene = null;

// ---------- ذخیره ----------
const saveSettings = () => LS.set('ums.settings', model.settings);
const saveDefaults = () => LS.set('ums.meta.defaults', {
  template: model.meta.template, bakhsh: model.meta.bakhsh, showLengths: model.meta.showLengths,
  showVertexNums: model.meta.showVertexNums, showCoords: model.meta.showCoords,
});
const saveFile = () => {
  if (!model.hash) return;
  LS.set(`ums.file.${model.hash}`, {
    adj: model.adj, off: model.rows.filter((r) => !r.use).map((r) => r.idx),
    tol: model.tol, reverse: model.reverse, meta: model.meta,
  });
};

// ---------- زبانه‌ها ----------
function showTab(name) {
  if (name === 'preview' && window.matchMedia('(min-width: 900px)').matches) name = 'points';
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.panel > section').forEach((s) => { s.hidden = s.dataset.tab !== name; });
  $('canvasWrap').parentElement.hidden = !(name === 'preview') && window.matchMedia('(max-width: 899px)').matches;
  if (name === 'preview' || window.matchMedia('(min-width: 900px)').matches) render();
}
$('tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); });
window.addEventListener('resize', () => showTab(document.querySelector('#tabs button.on').dataset.tab));

// ---------- فایل نقاط ----------
function loadText(text, name) {
  const rows = parsePoints(text);
  model.rows = rows;
  model.fileName = name || '';
  model.hash = rows.length ? hashText(text) : '';
  model.adj = {};
  model.tol = 0.1;
  model.reverse = false;
  const saved = model.hash ? LS.get(`ums.file.${model.hash}`, null) : null;
  if (saved) {
    model.adj = saved.adj || {};
    model.tol = saved.tol ?? 0.1;
    model.reverse = !!saved.reverse;
    (saved.off || []).forEach((i) => { if (rows[i]) rows[i].use = false; });
    if (saved.meta) Object.assign(model.meta, saved.meta);
  } else if (rows.length) {
    Object.assign(model.meta, { applicant: '', plakMain: '', plakSub: '', scaleDen: 0, date: jalaliToday() });
  }
  $('tol').value = model.tol;
  $('reverse').checked = model.reverse;
  $('fileInfo').textContent = rows.length
    ? `${name || 'متن چسبانده‌شده'}: ${rows.length} نقطه خوانده شد.`
    : 'نقطه معتبری در فایل پیدا نشد. قالب مورد انتظار: شناسه، East، North، Height.';
  fillMetaInputs();
  renderPoints();
  structureChanged();
}

$('fileInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  loadText(await f.text(), f.name);
  e.target.value = '';
});
$('btnPaste').addEventListener('click', () => loadText($('pasteBox').value, ''));

function renderPoints() {
  const tb = $('ptTable').tBodies[0];
  tb.innerHTML = '';
  for (const r of model.rows) {
    const tr = document.createElement('tr');
    tr.className = r.use ? '' : 'off';
    tr.innerHTML = `<td><input type="checkbox" ${r.use ? 'checked' : ''}></td><td>${r.id}</td><td class="num">${r.e.toFixed(3)}</td><td class="num">${r.n.toFixed(3)}</td>`;
    tr.querySelector('input').addEventListener('change', (ev) => {
      r.use = ev.target.checked;
      tr.className = r.use ? '' : 'off';
      structureChanged();
    });
    tb.appendChild(tr);
  }
}
$('btnAll').addEventListener('click', () => { model.rows.forEach((r) => { r.use = true; }); renderPoints(); structureChanged(); });
$('btnNone').addEventListener('click', () => { model.rows.forEach((r) => { r.use = false; }); renderPoints(); structureChanged(); });
$('tol').addEventListener('input', (e) => { model.tol = Math.max(0, parseFloat(e.target.value) || 0); structureChanged(); });
$('reverse').addEventListener('change', (e) => { model.reverse = e.target.checked; structureChanged(); });

// ---------- جدول برها ----------
function structureChanged() {
  saveFile();
  renderEdges();
  render();
}

function renderEdges() {
  const verts = buildVertices(model.rows, { tol: model.tol, reverse: model.reverse });
  const an = analyze(verts);
  const tb = $('edgeTable').tBodies[0];
  tb.innerHTML = '';
  $('edgeEmpty').hidden = verts.length >= 3;
  for (const ed of an.edges) {
    const a = model.adj[ed.key] || { type: 'plak', text: '' };
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="num">${ed.from}←→${ed.to}</td><td class="num">${f2(ed.len)}</td><td>${ed.side}</td>
      <td><select><option value="plak">پلاک</option><option value="gozar">گذر</option><option value="other">سایر</option></select></td>
      <td><input type="text" placeholder="مثلاً 735/2 یا بلوار امام"></td>`;
    const sel = tr.querySelector('select');
    const inp = tr.querySelector('input');
    sel.value = a.type;
    inp.value = a.text;
    const upd = () => {
      model.adj[ed.key] = { type: sel.value, text: inp.value };
      saveFile();
      render();
    };
    sel.addEventListener('change', upd);
    inp.addEventListener('input', upd);
    tb.appendChild(tr);
  }
}

// ---------- مشخصات ----------
const META_TEXT = ['title', 'date', 'applicant', 'plakMain', 'plakSub', 'bakhsh', 'address', 'statement'];
const META_CHECK = ['showLengths', 'showVertexNums', 'showCoords'];

$('template').innerHTML = Object.entries(TEMPLATES).map(([k, t]) => `<option value="${k}">${t.name}</option>`).join('');
$('scale').innerHTML = `<option value="0">خودکار</option>${SCALES.map((s) => `<option value="${s}">1/${s}</option>`).join('')}`;

function fillMetaInputs() {
  $('template').value = model.meta.template;
  META_TEXT.forEach((k) => { $(k).value = model.meta[k] || ''; });
  META_CHECK.forEach((k) => { $(k).checked = !!model.meta[k]; });
  $('scale').value = String(model.meta.scaleDen || 0);
  $('paper').value = model.settings.paper;
  $('orient').value = model.settings.orient;
  ['company', 'surveyor', 'county', 'city', 'dxfFont'].forEach((k) => { $(k).value = model.settings[k] || ''; });
  syncLogoUi();
}
META_TEXT.forEach((k) => $(k).addEventListener('input', (e) => { model.meta[k] = e.target.value; saveFile(); saveDefaults(); render(); }));
META_CHECK.forEach((k) => $(k).addEventListener('change', (e) => { model.meta[k] = e.target.checked; saveFile(); saveDefaults(); render(); }));
$('template').addEventListener('change', (e) => {
  const t = TEMPLATES[e.target.value];
  model.meta.template = e.target.value;
  model.meta.title = t.title;
  model.meta.statement = t.statement;
  $('title').value = t.title;
  $('statement').value = t.statement;
  saveFile(); saveDefaults(); render();
});
$('scale').addEventListener('change', (e) => { model.meta.scaleDen = parseInt(e.target.value, 10) || 0; saveFile(); render(); });
$('btnToday').addEventListener('click', () => { model.meta.date = jalaliToday(); $('date').value = model.meta.date; saveFile(); render(); });

// ---------- تنظیمات ----------
['company', 'surveyor', 'county', 'city', 'dxfFont'].forEach((k) =>
  $(k).addEventListener('input', (e) => { model.settings[k] = e.target.value; saveSettings(); render(); }));
$('paper').addEventListener('change', (e) => { model.settings.paper = e.target.value; saveSettings(); render(); });
$('orient').addEventListener('change', (e) => { model.settings.orient = e.target.value; saveSettings(); render(); });

function syncLogoUi() {
  const has = !!model.settings.logo;
  $('logoPrev').hidden = !has;
  $('btnLogoDel').hidden = !has;
  if (has) {
    $('logoPrev').src = model.settings.logo;
    if (!imgs.logo || imgs.logo.src !== model.settings.logo) {
      const im = new Image();
      im.onload = () => { imgs.logo = im; render(); };
      im.src = model.settings.logo;
    }
  } else delete imgs.logo;
}
$('logoFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  const im = new Image();
  im.onload = () => {
    const r = Math.min(1, 500 / Math.max(im.width, im.height));
    const c = document.createElement('canvas');
    c.width = Math.round(im.width * r);
    c.height = Math.round(im.height * r);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    model.settings.logo = c.toDataURL('image/png');
    saveSettings();
    URL.revokeObjectURL(url);
    syncLogoUi();
    render();
  };
  im.src = url;
  e.target.value = '';
});
$('btnLogoDel').addEventListener('click', () => { model.settings.logo = ''; saveSettings(); syncLogoUi(); render(); });

// ---------- پیش‌نمایش ----------
function render() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(doRender);
}
function doRender() {
  const cv = $('cv');
  const wrap = $('canvasWrap');
  const scene = buildScene(model, measure);
  lastScene = scene;
  updateStats(scene);
  const avail = wrap.clientWidth - 2;
  if (avail <= 0) return;
  const css = (avail / scene.W) * zoom;
  const dpr = window.devicePixelRatio || 1;
  const ppm = Math.min(css * dpr, 4200 / Math.max(scene.W, scene.H));
  cv.width = Math.round(scene.W * ppm);
  cv.height = Math.round(scene.H * ppm);
  cv.style.width = `${scene.W * css}px`;
  cv.style.height = `${scene.H * css}px`;
  drawScene(cv.getContext('2d'), scene, ppm, imgs);
  $('zoomInfo').textContent = `${Math.round(zoom * 100)}٪`;
}
function updateStats(scene) {
  const s = scene.stats;
  const autoOpt = $('scale').options[0];
  autoOpt.textContent = s.n >= 3 ? `خودکار (1/${s.autoDen})` : 'خودکار';
  $('stats').innerHTML = s.n >= 3
    ? `<div>تعداد رأس: <b>${s.n}</b></div><div>مساحت: <b>${f2(s.area)}</b> m²</div><div>محیط: <b>${f2(s.perimeter)}</b> m</div><div>مقیاس: <b>1/${s.den}</b></div>${s.selfIntersect ? '<div class="warn">⚠ ضلع‌ها همدیگر را قطع می‌کنند؛ ترتیب یا انتخاب نقاط را بررسی کن (نقاط غیرمرزی را بی‌تیک کن).</div>' : ''}`
    : '<div>برای ساخت نقشه حداقل ۳ نقطه لازم است.</div>';
}
$('zoomIn').addEventListener('click', () => { zoom = Math.min(zoom * 1.25, 6); render(); });
$('zoomOut').addEventListener('click', () => { zoom = Math.max(zoom / 1.25, 0.4); render(); });
$('zoomFit').addEventListener('click', () => { zoom = 1; render(); });

// ---------- خروجی ----------
function baseName() {
  const b = (model.fileName || 'map').replace(/\.[^.]+$/, '').replace(/[^\w؀-ۿ\- ]+/g, '_').trim();
  return b || 'map';
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
const say = (t) => { $('msg').textContent = t; };
const ready = () => {
  const s = buildScene(model, measure).stats;
  if (s.n < 3) { say('ابتدا فایل نقاط را وارد کن (حداقل ۳ نقطه).'); return false; }
  return true;
};

$('btnPdf').addEventListener('click', async () => {
  if (!ready()) return;
  say('در حال ساخت PDF…');
  try {
    await new Promise((r) => setTimeout(r, 30));
    const scene = buildScene(model, measure);
    const blob = await makePdfBlob(scene, imgs, model.settings.paper);
    download(blob, `${baseName()}.pdf`);
    say('PDF ساخته شد.');
  } catch (err) {
    console.error(err);
    say(`ساخت PDF ناموفق بود: ${err.message}`);
  }
});
$('btnDxf').addEventListener('click', () => {
  if (!ready()) return;
  const dxf = sceneToDxf(buildScene(model, measure), { font: (model.settings.dxfFont || 'Tahoma').trim() || 'Tahoma' });
  download(new Blob([dxf], { type: 'application/dxf' }), `${baseName()}.dxf`);
  say('DXF ساخته شد.');
});

// ---------- نصب PWA ----------
let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; $('btnInstall').hidden = false; });
$('btnInstall').addEventListener('click', async () => {
  if (!deferred) return;
  deferred.prompt();
  deferred = null;
  $('btnInstall').hidden = true;
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ---------- شروع ----------
(async () => {
  try {
    await Promise.all([
      document.fonts.load('16px Vazirmatn'),
      document.fonts.load('bold 16px Vazirmatn'),
    ]);
  } catch { /* ادامه با فونت جایگزین */ }
  fillMetaInputs();
  renderPoints();
  renderEdges();
  showTab('points');
  window.__app = { model, loadText, buildScene: () => buildScene(model, measure), measure };
})();
