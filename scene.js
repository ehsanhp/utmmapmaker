// ساخت صحنه نقشه (فهرست اشکال بر حسب میلی‌متر روی برگه، مبدأ بالا-چپ، محور y رو به پایین)
// همین صحنه برای پیش‌نمایش، PDF و DXF استفاده می‌شود.
import { analyze, buildVertices, f2, f4 } from './geometry.js';
import { plakString, statementText } from './templates.js';

export const PAPER = { A4: [297, 210], A3: [420, 297] };
export const SCALES = [50, 100, 200, 250, 300, 400, 500, 1000, 1500, 2000, 2500, 5000, 10000, 25000];
const AR = /[؀-ۿ]/;
export const hasArabic = (s) => AR.test(s);

export function edgeLabel(adj) {
  if (!adj || !adj.text || !adj.text.trim()) return '';
  const t = adj.text.trim();
  return adj.type === 'plak' ? `پلاک ${t}` : t;
}

/**
 * measure(text, sizeMm, bold) → عرض متن بر حسب mm
 */
export function buildScene(model, measure) {
  const st = model.settings;
  const mt = model.meta;
  const [pw, ph] = PAPER[st.paper] || PAPER.A4;
  const land = st.orient !== 'portrait';
  const W = land ? pw : ph;
  const H = land ? ph : pw;
  const f = Math.min(W, H) / 210;
  const items = [];
  const add = (o) => { items.push(o); return o; };
  const line = (x1, y1, x2, y2, lw, layer = 'FRAME') => add({ t: 'line', x1, y1, x2, y2, lw, layer });
  const rect = (x, y, w, h, lw, layer = 'FRAME') => add({ t: 'rect', x, y, w, h, lw, layer });
  const text = (s, x, y, size, o = {}) =>
    add({ t: 'text', s, x, y, size, align: o.align || 'center', rot: o.rot || 0, bold: !!o.bold, layer: o.layer || 'TEXT' });

  const wrap = (s, size, maxW, bold) => {
    const out = [];
    for (const para of String(s).split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      let cur = '';
      for (const w of words) {
        const tryS = cur ? `${cur} ${w}` : w;
        if (cur && measure(tryS, size, bold) > maxW) { out.push(cur); cur = w; } else cur = tryS;
      }
      if (cur) out.push(cur);
    }
    return out;
  };
  const fit = (paras, maxW, maxH, size0, minSize, bold) => {
    let size = size0;
    let lines = [];
    for (; size >= minSize; size -= 0.1) {
      lines = paras.flatMap((p) => wrap(p, size, maxW, bold));
      if (lines.length * size * 1.45 <= maxH) break;
    }
    return { lines, size: Math.max(size, minSize) };
  };

  // ---------- قاب ----------
  const F = { l: 5, t: 5, r: W - 5, b: H - 5 };
  rect(F.l, F.t, F.r - F.l, F.b - F.t, 0.7);
  const Wf = F.r - F.l;

  // ---------- نوار بالا ----------
  const Ht = 24 * f;
  const yTop = F.t + Ht;
  line(F.l, yTop, F.r, yTop, 0.5);
  const hasLogo = !!st.logo;
  const spec = [
    { k: 'title', w: 0.25 },
    { k: 'scale', w: 0.09 },
    { k: 'applicant', w: 0.19 },
    { k: 'surveyor', w: 0.17 },
    { k: 'company', w: 0.16 },
    { k: 'north', w: 0.08 },
  ];
  if (hasLogo) spec.push({ k: 'logo', w: 0.1 });
  const tot = spec.reduce((s, c) => s + c.w, 0);
  const verts = buildVertices(model.rows, { tol: model.tol, reverse: model.reverse });
  const an = analyze(verts);

  // برای مقیاس باید زودتر محاسبه شود
  // ---------- نوار پایین (ابتدا ابعاد) ----------
  const fs = 2.4 * f;
  const lineH = fs * 1.55;
  const coordLines = verts.map((v, i) => `${i + 1}-X=${f4(v.e)}  Y=${f4(v.n)}`);
  let colW = 0;
  for (const s of coordLines) colW = Math.max(colW, measure(s, fs, false));
  colW += 4 * f;
  let rowsPer = 8;
  let cols = Math.max(1, Math.ceil(coordLines.length / rowsPer));
  if (mt.showCoords) {
    while (cols > 1 && cols * colW > 0.58 * Wf) {
      rowsPer += 1;
      cols = Math.ceil(coordLines.length / rowsPer);
    }
  } else { cols = 0; rowsPer = 0; }
  const Wc = mt.showCoords ? Math.max(1, cols) * colW + 4 * f : 0;
  const rowsUsed = mt.showCoords ? Math.min(rowsPer, Math.max(coordLines.length, 1)) : 0;
  const Hb = Math.max(42 * f, mt.showCoords ? 8 * f + rowsUsed * lineH + 2 * f : 0);
  const yb = F.b - Hb;
  line(F.l, yb, F.r, yb, 0.5);

  // ---------- محدودهٔ ترسیم و مقیاس ----------
  const P = { l: F.l + 2, t: yTop + 2, r: F.r - 2, b: yb - 2 };
  P.w = P.r - P.l; P.h = P.b - P.t;
  const M = 13 * f;
  let den = 200;
  let autoDen = 200;
  const plot = { k: 0.005, ox: (P.l + P.r) / 2, oy: (P.t + P.b) / 2, Ec: 0, Nc: 0, den, auto: true };
  if (an.bbox) {
    const bw = Math.max(an.bbox.maxE - an.bbox.minE, 0.01);
    const bh = Math.max(an.bbox.maxN - an.bbox.minN, 0.01);
    const need = Math.max((bw * 1000) / Math.max(P.w - 2 * M, 10), (bh * 1000) / Math.max(P.h - 2 * M, 10));
    autoDen = SCALES.find((s) => s >= need) || SCALES[SCALES.length - 1];
    den = mt.scaleDen && mt.scaleDen > 0 ? mt.scaleDen : autoDen;
    plot.k = 1000 / den;
    plot.Ec = (an.bbox.minE + an.bbox.maxE) / 2;
    plot.Nc = (an.bbox.minN + an.bbox.maxN) / 2;
    plot.den = den;
    plot.auto = !(mt.scaleDen > 0);
  }
  const SX = (e) => plot.ox + (e - plot.Ec) * plot.k;
  const SY = (n) => plot.oy - (n - plot.Nc) * plot.k;

  // ---------- سلول‌های نوار بالا (از راست به چپ) ----------
  let xr = F.r;
  const cellLabel = (x, label) => text(label, x - 2, yTop - Ht + 3.2 * f, 2.2 * f, { align: 'right', layer: 'TABLE' });
  const cellValue = (x0, x1, paras, size0 = 3 * f) => {
    const wMax = x1 - x0 - 4;
    const hMax = Ht - 7 * f;
    const r = fit(paras, wMax, hMax, size0, 1.8 * f, false);
    const total = r.lines.length * r.size * 1.45;
    let y = yTop - Ht + 6 * f + (hMax - total) / 2 + r.size * 0.72;
    for (const ln of r.lines) {
      text(ln, x1 - 2, y, r.size, { align: 'right', layer: 'TEXT' });
      y += r.size * 1.45;
    }
  };
  for (const c of spec) {
    const cw = (c.w / tot) * Wf;
    const x1 = xr;
    const x0 = xr - cw;
    if (c !== spec[spec.length - 1]) line(x0, F.t, x0, yTop, 0.35);
    if (c.k === 'title') {
      cellLabel(x1, 'عنوان نقشه:');
      cellValue(x0, x1, [mt.title || '', mt.date ? `تاریخ نقشه‌برداری: ${mt.date}` : '']);
    } else if (c.k === 'scale') {
      cellLabel(x1, 'مقیاس:');
      text(`1/${den}`, (x0 + x1) / 2, yTop - Ht / 2 + 3 * f, 4 * f, { bold: true, layer: 'TEXT' });
    } else if (c.k === 'applicant') {
      cellLabel(x1, 'متقاضی:');
      cellValue(x0, x1, [mt.applicant || '']);
    } else if (c.k === 'surveyor') {
      cellLabel(x1, 'نقشه‌بردار:');
      cellValue(x0, x1, [st.surveyor || '']);
    } else if (c.k === 'company') {
      cellLabel(x1, 'تهیه و ترسیم:');
      cellValue(x0, x1, [st.company || '']);
    } else if (c.k === 'north') {
      const cx = (x0 + x1) / 2;
      const y0 = F.t + 2 * f;
      const y1 = yTop - 2 * f;
      text('N', cx, y0 + 2 * f, 3.4 * f, { bold: true, layer: 'NORTH' });
      const tipY = y0 + 5.5 * f;
      const hw = 3 * f;
      const headB = tipY + 7 * f;
      add({ t: 'poly', pts: [[cx, tipY], [cx - hw, headB], [cx, headB - 2 * f]], closed: true, fill: true, lw: 0.3, layer: 'NORTH' });
      add({ t: 'poly', pts: [[cx, tipY], [cx + hw, headB], [cx, headB - 2 * f]], closed: true, fill: false, lw: 0.3, layer: 'NORTH' });
      line(cx, headB - 2 * f, cx, y1, 0.4, 'NORTH');
    } else if (c.k === 'logo') {
      add({ t: 'image', src: 'logo', x: x0 + 1.5, y: F.t + 1.5, w: cw - 3, h: Ht - 3, layer: 'LOGO' });
    }
    xr = x0;
  }

  // ---------- نوار پایین ----------
  if (mt.showCoords) {
    const xs = F.l + Wc;
    line(xs, yb, xs, F.b, 0.35);
    text('مختصات UTM', F.l + Wc / 2, yb + 3.6 * f, 2.8 * f, { bold: true, layer: 'TABLE' });
    coordLines.forEach((s, i) => {
      const c = Math.floor(i / rowsPer);
      const r = i % rowsPer;
      text(s, F.l + 2 * f + c * colW, yb + 8 * f + r * lineH + lineH / 2, fs, { align: 'left', layer: 'TABLE' });
    });
  }
  const xR0 = F.l + Wc;
  const Wr = F.r - xR0;
  const Hs = Math.min(15 * f, Hb * 0.4);
  line(xR0, yb + Hs, F.r, yb + Hs, 0.35);
  {
    const r = fit([statementText(mt)], Wr - 6, Hs - 2, 3.1 * f, 1.8 * f, false);
    const total = r.lines.length * r.size * 1.45;
    let y = yb + (Hs - total) / 2 + r.size * 0.72;
    for (const ln of r.lines) {
      text(ln, F.r - 3, y, r.size, { align: 'right', layer: 'TEXT' });
      y += r.size * 1.45;
    }
  }
  {
    const grid = [
      ['شماره پلاک اصلی', mt.plakMain, 'شماره پلاک فرعی', mt.plakSub, 'بخش', mt.bakhsh],
      ['شهرستان', st.county, 'شهر', st.city, 'آدرس', mt.address],
    ];
    const rh = (Hb - Hs) / 2;
    const cw = Wr / 3;
    for (let r = 0; r < 2; r++) {
      const y0 = yb + Hs + r * rh;
      if (r === 1) line(xR0, y0, F.r, y0, 0.25);
      for (let c = 0; c < 3; c++) {
        const x1 = F.r - c * cw;
        const x0 = x1 - cw;
        if (c > 0) line(x1, y0, x1, y0 + rh, 0.25);
        const label = grid[r][c * 2];
        const val = String(grid[r][c * 2 + 1] || '');
        text(label, x1 - 2, y0 + 3 * f, 2.1 * f, { align: 'right', layer: 'TABLE' });
        const fv = fit([val], cw - 4, rh - 6 * f, 3 * f, 1.6 * f, false);
        const total = fv.lines.length * fv.size * 1.45;
        let y = y0 + 5.5 * f + (rh - 6 * f - total) / 2 + fv.size * 0.72;
        for (const ln of fv.lines) {
          text(ln, x1 - 2, y, fv.size, { align: 'right', layer: 'TEXT' });
          y += fv.size * 1.45;
        }
      }
    }
  }

  // ---------- خود نقشه ----------
  const edgesOut = [];
  if (verts.length >= 3) {
    const pts = verts.map((v) => [SX(v.e), SY(v.n)]);
    add({ t: 'poly', pts, closed: true, fill: false, lw: 0.6, layer: 'PARCEL' });
    const cen = { x: SX(an.centroid.e), y: SY(an.centroid.n) };

    an.edges.forEach((ed, i) => {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const nxs = ed.nx;
      const nys = -ed.ny; // تبدیل به دستگاه برگه (y رو به پایین)
      let th = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (th > Math.PI / 2 || th < -Math.PI / 2) th += Math.PI;
      const edgeMm = Math.hypot(b[0] - a[0], b[1] - a[1]);

      if (mt.showLengths && ed.len > 0.004) {
        const s0 = 2.8 * f;
        const lab = f2(ed.len);
        const tw = measure(lab, s0, false);
        const size = tw > edgeMm * 0.92 ? Math.max(1.3, (s0 * edgeMm * 0.92) / tw) : s0;
        const off = size * 0.5 + 0.9;
        text(lab, mx - nxs * off, my - nys * off, size, { rot: th, layer: 'DIM' });
      }
      const al = edgeLabel(model.adj[ed.key]);
      if (al) {
        const s0 = 2.8 * f;
        const tw = measure(al, s0, false);
        const size = tw > edgeMm * 1.1 ? Math.max(1.8, (s0 * edgeMm * 1.1) / tw) : s0;
        const off = size * 0.5 + 1.3;
        text(al, mx + nxs * off, my + nys * off, size, { rot: th, layer: 'ADJ' });
      }
      edgesOut.push(ed);
    });

    pts.forEach((p, i) => {
      add({ t: 'circle', x: p[0], y: p[1], r: 0.6, fill: true, lw: 0.2, layer: 'POINTS' });
      if (mt.showVertexNums) {
        let dx = p[0] - cen.x, dy = p[1] - cen.y;
        const d = Math.hypot(dx, dy) || 1;
        dx /= d; dy /= d;
        text(String(i + 1), p[0] + dx * 2.4 * f, p[1] + dy * 2.4 * f, 2.2 * f, { layer: 'POINTS' });
      }
    });

    // مساحت و محیط
    const plak = plakString(mt);
    const lines = [];
    if (plak) lines.push([`پلاک ${plak}`, 3.4 * f]);
    lines.push([`S=${f2(an.area)}m²`, 3.4 * f]);
    lines.push([`P=${f2(an.perimeter)}m`, 2.8 * f]);
    const th = lines.reduce((s, l) => s + l[1] * 1.55, 0);
    let y = cen.y - th / 2 + lines[0][1] * 0.78;
    for (const [s, size] of lines) {
      text(s, cen.x, y, size, { layer: 'AREA', bold: s.startsWith('S=') });
      y += size * 1.55;
    }
  }

  return {
    W, H, items, plot,
    stats: { n: verts.length, area: an.area, perimeter: an.perimeter, den, autoDen, selfIntersect: !!an.selfIntersect },
    verts, edges: an.edges,
  };
}
