// خروجی PDF: برگه با وضوح بالا روی Canvas رسم و در PDF با اندازه دقیق A4/A3 قرار می‌گیرد
// (متن فارسی را مرورگر شکل می‌دهد، بنابراین حروف به‌هم‌چسبیده و درست می‌آیند)
import { drawScene } from './draw.js';

export async function makePdfBlob(scene, imgs, paper) {
  const dpi = paper === 'A3' ? 250 : 300;
  const k = dpi / 25.4;
  const c = document.createElement('canvas');
  c.width = Math.round(scene.W * k);
  c.height = Math.round(scene.H * k);
  drawScene(c.getContext('2d'), scene, k, imgs);
  const data = c.toDataURL('image/jpeg', 0.95);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: scene.W >= scene.H ? 'landscape' : 'portrait',
    unit: 'mm',
    format: paper === 'A3' ? 'a3' : 'a4',
    compress: true,
  });
  pdf.addImage(data, 'JPEG', 0, 0, scene.W, scene.H, undefined, 'FAST');
  pdf.setProperties({ title: 'نقشه UTM', creator: 'نقشه‌ساز UTM' });
  return pdf.output('blob');
}
