// قالب‌های نقشه: عنوان و متن شرح نقشه (قابل ویرایش توسط کاربر)
export const TEMPLATES = {
  tafkiki: {
    name: 'نقشه تفکیکی',
    title: 'نقشه تفکیکی',
    statement: 'نقشه تفکیکی ششدانگ یک قطعه زمین به پلاک {plak} که به درخواست متقاضی تهیه و ترسیم گردید.',
  },
  sanad: {
    name: 'نقشه UTM جهت سند',
    title: 'نقشه UTM',
    statement: 'نقشه UTM ششدانگ یک قطعه زمین به پلاک {plak} جهت اخذ سند مالکیت که به درخواست متقاضی تهیه و ترسیم گردید.',
  },
  amade: {
    name: 'نقشه آماده‌سازی',
    title: 'نقشه آماده‌سازی',
    statement: 'نقشه آماده‌سازی ششدانگ یک قطعه زمین به پلاک {plak} که به درخواست متقاضی تهیه و ترسیم گردید.',
  },
  vaz: {
    name: 'نقشه وضع موجود',
    title: 'نقشه وضع موجود',
    statement: 'نقشه وضع موجود ششدانگ یک قطعه زمین به پلاک {plak} که به درخواست متقاضی تهیه و ترسیم گردید.',
  },
};

export function plakString(meta) {
  const a = (meta.plakMain || '').trim();
  const b = (meta.plakSub || '').trim();
  if (a && b) return `${a}/${b}`;
  return a || b || '';
}

export function statementText(meta) {
  const p = plakString(meta) || '..........';
  return (meta.statement || '').replace(/\{plak\}/g, p);
}
