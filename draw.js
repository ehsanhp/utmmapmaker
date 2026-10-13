// رسم صحنه روی Canvas (پیش‌نمایش و PDF) — شکل‌دهی متن فارسی را مرورگر انجام می‌دهد
import { hasArabic } from './scene.js';

export const FONT = 'Vazirmatn, Tahoma, Arial, sans-serif';

export function drawScene(ctx, scene, k, imgs = {}) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, scene.W * k, scene.H * k);
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  for (const it of scene.items) {
    switch (it.t) {
      case 'line':
        ctx.lineWidth = Math.max(it.lw * k, 1);
        ctx.beginPath();
        ctx.moveTo(it.x1 * k, it.y1 * k);
        ctx.lineTo(it.x2 * k, it.y2 * k);
        ctx.stroke();
        break;
      case 'rect':
        ctx.lineWidth = Math.max(it.lw * k, 1);
        ctx.strokeRect(it.x * k, it.y * k, it.w * k, it.h * k);
        break;
      case 'poly':
        ctx.lineWidth = Math.max(it.lw * k, 1);
        ctx.beginPath();
        it.pts.forEach((p, i) => (i ? ctx.lineTo(p[0] * k, p[1] * k) : ctx.moveTo(p[0] * k, p[1] * k)));
        if (it.closed) ctx.closePath();
        if (it.fill) ctx.fill();
        ctx.stroke();
        break;
      case 'circle':
        ctx.lineWidth = Math.max(it.lw * k, 1);
        ctx.beginPath();
        ctx.arc(it.x * k, it.y * k, it.r * k, 0, Math.PI * 2);
        if (it.fill) ctx.fill();
        ctx.stroke();
        break;
      case 'text':
        ctx.save();
        ctx.translate(it.x * k, it.y * k);
        if (it.rot) ctx.rotate(it.rot);
        ctx.font = `${it.bold ? 'bold ' : ''}${it.size * k}px ${FONT}`;
        ctx.direction = hasArabic(it.s) ? 'rtl' : 'ltr';
        ctx.textAlign = it.align === 'left' ? 'left' : it.align === 'right' ? 'right' : 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(it.s, 0, 0);
        ctx.restore();
        break;
      case 'image': {
        const im = imgs[it.src];
        if (im) {
          const r = Math.min(it.w / im.width, it.h / im.height);
          const w = im.width * r;
          const h = im.height * r;
          ctx.drawImage(im, (it.x + (it.w - w) / 2) * k, (it.y + (it.h - h) / 2) * k, w * k, h * k);
        }
        break;
      }
      default:
    }
  }
  ctx.restore();
}

/** اندازه‌گیری عرض متن برحسب mm */
export function makeMeasure(ctx) {
  return (s, size, bold) => {
    const px = 100; // دقت اندازه‌گیری
    ctx.font = `${bold ? 'bold ' : ''}${px}px ${FONT}`;
    ctx.direction = hasArabic(s) ? 'rtl' : 'ltr';
    return (ctx.measureText(s).width / px) * size;
  };
}
