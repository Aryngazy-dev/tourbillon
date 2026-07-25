export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : s;
  return d.innerHTML;
}

export function formatDue(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

export function isOverdue(dateStr, done) {
  if (!dateStr || done) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return d < today;
}

export function isDueToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  const d = new Date(dateStr + 'T00:00:00');
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

export function isDueThisWeek(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const d = new Date(dateStr + 'T00:00:00');
  return d >= today && d <= in7;
}

export function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function daysSince(ts) {
  return Math.floor((Date.now() - ts) / 86400000);
}

export function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return pluralize(min, 'минуту', 'минуты', 'минут') + ' назад';
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return pluralize(hrs, 'час', 'часа', 'часов') + ' назад';
  const days = Math.floor(hrs / 24);
  if (days < 30) return pluralize(days, 'день', 'дня', 'дней') + ' назад';
  const months = Math.floor(days / 30);
  return pluralize(months, 'месяц', 'месяца', 'месяцев') + ' назад';
}

function pluralize(n, one, few, many) {
  const mod10 = n % 10, mod100 = n % 100;
  let word;
  if (mod10 === 1 && mod100 !== 11) word = one;
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = few;
  else word = many;
  return `${n} ${word}`;
}

export const LABEL_PALETTE = [
  { id: 'l-red', var: '--label-red' },
  { id: 'l-orange', var: '--label-orange' },
  { id: 'l-yellow', var: '--label-yellow' },
  { id: 'l-green', var: '--label-green' },
  { id: 'l-teal', var: '--label-teal' },
  { id: 'l-blue', var: '--label-blue' },
  { id: 'l-purple', var: '--label-purple' },
  { id: 'l-pink', var: '--label-pink' }
];

export function colorForString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return LABEL_PALETTE[hash % LABEL_PALETTE.length].var;
}

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]).join('').toUpperCase();
}
