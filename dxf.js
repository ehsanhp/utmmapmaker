// خروجی DXF (نسخه R2000 / AC1015، ASCII با escape یونیکد \U+XXXX)
// نقشه در مختصات واقعی UTM قرار می‌گیرد؛ قاب و جدول‌ها هم با همان مقیاس اطراف آن چیده می‌شوند.
// برای چاپ: واحد = متر، مقیاس خروجی 1:den (همان که روی برگه نوشته شده است).

const LAYERS = [
  ['FRAME', 7], ['TABLE', 7], ['TEXT', 7], ['PARCEL', 1], ['DIM', 7],
  ['ADJ', 4], ['POINTS', 2], ['AREA', 7], ['NORTH', 7], ['LOGO', 7],
];

function enc(s) {
  let o = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (c > 126 || c < 32) o += `\\U+${c.toString(16).toUpperCase().padStart(4, '0')}`;
    else o += ch;
  }
  return o;
}

export function sceneToDxf(scene, { font = 'Tahoma' } = {}) {
  const { k, ox, oy, Ec, Nc } = scene.plot;
  const X = (x) => Ec + (x - ox) / k;
  const Y = (y) => Nc - (y - oy) / k;
  const L = (l) => l / k;
  const n4 = (v) => (Math.round(v * 1e4) / 1e4).toString();

  let h = 0x40;
  const nh = () => (h++).toString(16).toUpperCase();
  const out = [];
  const g = (code, val) => out.push(String(code), String(val));

  const msRec = nh();
  const psRec = nh();

  // ----- HEADER -----
  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1015');
  g(9, '$HANDSEED'); g(5, 'FFFFFF');
  g(9, '$INSUNITS'); g(70, 6);
  g(9, '$MEASUREMENT'); g(70, 1);
  g(9, '$LTSCALE'); g(40, 1);
  g(0, 'ENDSEC');

  // ----- TABLES -----
  g(0, 'SECTION'); g(2, 'TABLES');

  g(0, 'TABLE'); g(2, 'LTYPE'); g(5, nh()); g(100, 'AcDbSymbolTable'); g(70, 1);
  g(0, 'LTYPE'); g(5, nh()); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbLinetypeTableRecord');
  g(2, 'CONTINUOUS'); g(70, 0); g(3, 'Solid line'); g(72, 65); g(73, 0); g(40, 0);
  g(0, 'ENDTAB');

  g(0, 'TABLE'); g(2, 'LAYER'); g(5, nh()); g(100, 'AcDbSymbolTable'); g(70, LAYERS.length + 1);
  for (const [name, color] of [['0', 7], ...LAYERS]) {
    g(0, 'LAYER'); g(5, nh()); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbLayerTableRecord');
    g(2, name); g(70, 0); g(62, color); g(6, 'CONTINUOUS');
  }
  g(0, 'ENDTAB');

  g(0, 'TABLE'); g(2, 'STYLE'); g(5, nh()); g(100, 'AcDbSymbolTable'); g(70, 1);
  g(0, 'STYLE'); g(5, nh()); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbTextStyleTableRecord');
  g(2, 'STD'); g(70, 0); g(40, 0); g(41, 1); g(50, 0); g(71, 0); g(42, 2.5);
  g(3, `${font.toLowerCase().replace(/\s+/g, '')}.ttf`); g(4, '');
  g(1001, 'ACAD'); g(1000, font); g(1071, 0);
  g(0, 'ENDTAB');

  g(0, 'TABLE'); g(2, 'APPID'); g(5, nh()); g(100, 'AcDbSymbolTable'); g(70, 1);
  g(0, 'APPID'); g(5, nh()); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbRegAppTableRecord');
  g(2, 'ACAD'); g(70, 0);
  g(0, 'ENDTAB');

  g(0, 'TABLE'); g(2, 'BLOCK_RECORD'); g(5, nh()); g(100, 'AcDbSymbolTable'); g(70, 2);
  for (const [hd, nm] of [[msRec, '*Model_Space'], [psRec, '*Paper_Space']]) {
    g(0, 'BLOCK_RECORD'); g(5, hd); g(100, 'AcDbSymbolTableRecord'); g(100, 'AcDbBlockTableRecord'); g(2, nm);
  }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');

  // ----- BLOCKS -----
  g(0, 'SECTION'); g(2, 'BLOCKS');
  for (const [hd, nm, ps] of [[msRec, '*Model_Space', false], [psRec, '*Paper_Space', true]]) {
    g(0, 'BLOCK'); g(5, nh()); g(330, hd); g(100, 'AcDbEntity'); if (ps) g(67, 1); g(8, '0');
    g(100, 'AcDbBlockBegin'); g(2, nm); g(70, 0); g(10, 0); g(20, 0); g(30, 0); g(3, nm); g(1, '');
    g(0, 'ENDBLK'); g(5, nh()); g(330, hd); g(100, 'AcDbEntity'); if (ps) g(67, 1); g(8, '0');
    g(100, 'AcDbBlockEnd');
  }
  g(0, 'ENDSEC');

  // ----- ENTITIES -----
  g(0, 'SECTION'); g(2, 'ENTITIES');
  const head = (type, layer) => { g(0, type); g(5, nh()); g(330, msRec); g(100, 'AcDbEntity'); g(8, layer); };

  const lwpoly = (pts, closed, lw, layer) => {
    head('LWPOLYLINE', layer);
    g(100, 'AcDbPolyline'); g(90, pts.length); g(70, closed ? 1 : 0);
    g(43, n4(L(lw)));
    for (const [x, y] of pts) { g(10, n4(X(x))); g(20, n4(Y(y))); }
  };
  const solid = (pts, layer) => {
    if (pts.length < 3 || pts.length > 4) return;
    const p = pts.length === 3 ? [pts[0], pts[1], pts[2], pts[2]] : [pts[0], pts[1], pts[3], pts[2]];
    head('SOLID', layer);
    g(100, 'AcDbTrace');
    p.forEach(([x, y], i) => { g(10 + i, n4(X(x))); g(20 + i, n4(Y(y))); g(30 + i, 0); });
  };

  for (const it of scene.items) {
    if (it.t === 'line') {
      lwpoly([[it.x1, it.y1], [it.x2, it.y2]], false, it.lw, it.layer);
    } else if (it.t === 'rect') {
      lwpoly([[it.x, it.y], [it.x + it.w, it.y], [it.x + it.w, it.y + it.h], [it.x, it.y + it.h]], true, it.lw, it.layer);
    } else if (it.t === 'poly') {
      lwpoly(it.pts, it.closed, it.lw, it.layer);
      if (it.fill) solid(it.pts, it.layer);
    } else if (it.t === 'circle') {
      head('CIRCLE', it.layer);
      g(100, 'AcDbCircle'); g(10, n4(X(it.x))); g(20, n4(Y(it.y))); g(30, 0); g(40, n4(L(it.r)));
    } else if (it.t === 'text') {
      const x = n4(X(it.x));
      const y = n4(Y(it.y));
      head('TEXT', it.layer);
      g(100, 'AcDbText');
      g(10, x); g(20, y); g(30, 0);
      g(40, n4(L(it.size * 0.72)));
      g(1, enc(it.s));
      if (it.rot) g(50, n4((-it.rot * 180) / Math.PI));
      g(7, 'STD');
      g(72, it.align === 'left' ? 0 : it.align === 'right' ? 2 : 1);
      g(11, x); g(21, y); g(31, 0);
      g(100, 'AcDbText');
      g(73, 2);
    }
    // تصویر (لوگو) در DXF قرار داده نمی‌شود
  }
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return out.join('\r\n') + '\r\n';
}
