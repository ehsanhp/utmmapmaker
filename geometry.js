// هندسه و پردازش نقاط — بدون وابستگی به مرورگر

/** خواندن فایل txt/csv دستگاه: شناسه، East، North، [Height] */
export function parsePoints(text) {
  const rows = [];
  const lines = text.replace(/\r/g, '').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[,;\t ]+/).filter((s) => s !== '');
    if (parts.length < 3) continue;
    const nums = parts.map(Number);
    const e = nums[1];
    const n = nums[2];
    if (!Number.isFinite(e) || !Number.isFinite(n)) continue; // سطر عنوان یا نامعتبر
    rows.push({
      idx: rows.length,
      id: parts[0],
      e,
      n,
      h: Number.isFinite(nums[3]) ? nums[3] : null,
      use: true,
    });
  }
  return rows;
}

const dist = (a, b) => Math.hypot(a.e - b.e, a.n - b.n);

/**
 * ساخت رأس‌های مرز به ترتیب فایل.
 * نقاط پشت‌سرهم که فاصله‌شان ≤ tol باشد یکی می‌شوند (میانگین).
 */
export function buildVertices(rows, { tol = 0.1, reverse = false } = {}) {
  let pts = rows.filter((r) => r.use);
  if (reverse) pts = pts.slice().reverse();
  const groups = [];
  for (const p of pts) {
    const g = groups[groups.length - 1];
    if (g && tol > 0 && dist({ e: g.se / g.c, n: g.sn / g.c }, p) <= tol) {
      g.se += p.e;
      g.sn += p.n;
      g.c += 1;
      g.ids.push(p.id);
    } else {
      groups.push({ key: p.idx, se: p.e, sn: p.n, c: 1, ids: [p.id] });
    }
  }
  // اگر آخرین گروه با اولین یکی باشد، ادغام شود
  while (groups.length > 1 && tol > 0) {
    const a = groups[0];
    const b = groups[groups.length - 1];
    if (dist({ e: a.se / a.c, n: a.sn / a.c }, { e: b.se / b.c, n: b.sn / b.c }) <= tol) {
      a.se += b.se;
      a.sn += b.sn;
      a.c += b.c;
      a.ids.push(...b.ids);
      groups.pop();
    } else break;
  }
  return groups.map((g) => ({ key: g.key, e: g.se / g.c, n: g.sn / g.c, ids: g.ids }));
}

function segCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b.e - a.e) * (c.n - a.n) - (b.n - a.n) * (c.e - a.e);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** آیا ضلع‌های غیرمجاور همدیگر را قطع می‌کنند؟ */
export function hasSelfIntersection(v) {
  const n = v.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segCross(v[i], v[(i + 1) % n], v[j], v[(j + 1) % n])) return true;
    }
  }
  return false;
}

const DIRS = ['شمال', 'شمال شرقی', 'شرق', 'جنوب شرقی', 'جنوب', 'جنوب غربی', 'غرب', 'شمال غربی'];

/** مساحت، محیط، ضلع‌ها (طول، بردار عمود بیرونی، سمت جغرافیایی) و مرکز سطح */
export function analyze(v) {
  const n = v.length;
  const res = { n, area: 0, perimeter: 0, ccw: true, edges: [], centroid: null, bbox: null };
  if (n === 0) return res;
  let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
  for (const p of v) {
    minE = Math.min(minE, p.e); maxE = Math.max(maxE, p.e);
    minN = Math.min(minN, p.n); maxN = Math.max(maxN, p.n);
  }
  res.bbox = { minE, maxE, minN, maxN };
  if (n < 3) return res;
  const e0 = (minE + maxE) / 2;
  const n0 = (minN + maxN) / 2;
  let a2 = 0, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const p = v[i], q = v[(i + 1) % n];
    const x1 = p.e - e0, y1 = p.n - n0, x2 = q.e - e0, y2 = q.n - n0;
    const cr = x1 * y2 - x2 * y1;
    a2 += cr;
    cx += (x1 + x2) * cr;
    cy += (y1 + y2) * cr;
  }
  res.ccw = a2 >= 0;
  res.area = Math.abs(a2) / 2;
  res.centroid = Math.abs(a2) > 1e-9
    ? { e: e0 + cx / (3 * a2), n: n0 + cy / (3 * a2) }
    : { e: e0, n: n0 };
  // برای چندضلعی‌های خودمتقاطع مرکز سطح ممکن است بیرون محدوده بیفتد؛ آن‌وقت میانگین رأس‌ها
  if (res.centroid.e < minE || res.centroid.e > maxE || res.centroid.n < minN || res.centroid.n > maxN) {
    res.centroid = { e: v.reduce((s, p) => s + p.e, 0) / n, n: v.reduce((s, p) => s + p.n, 0) / n };
  }
  res.selfIntersect = hasSelfIntersection(v);
  for (let i = 0; i < n; i++) {
    const p = v[i], q = v[(i + 1) % n];
    const dx = q.e - p.e, dy = q.n - p.n;
    const len = Math.hypot(dx, dy);
    res.perimeter += len;
    const ux = len ? dx / len : 0, uy = len ? dy / len : 0;
    // عمود بیرونی (در دستگاه East/North)
    const nx = res.ccw ? uy : -uy;
    const ny = res.ccw ? -ux : ux;
    let az = (Math.atan2(nx, ny) * 180) / Math.PI;
    if (az < 0) az += 360;
    res.edges.push({
      i,
      key: `${p.key}>${q.key}`,
      from: i + 1,
      to: ((i + 1) % n) + 1,
      len,
      nx,
      ny,
      side: DIRS[Math.round(az / 45) % 8],
    });
  }
  return res;
}

export const f2 = (x) => x.toFixed(2);
export const f4 = (x) => x.toFixed(4);

/** تاریخ امروز شمسی به صورت YYYY/MM/DD با ارقام لاتین */
export function jalaliToday() {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  return `${g('year')}/${g('month')}/${g('day')}`;
}

export function hashText(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
