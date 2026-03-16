export function getTodayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysBetween(from, to) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / 86400000);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatPercent(value) {
  return `${Math.round(value)}%`;
}

export function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function sampleBySeed(list, count, seed) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const copied = [...list];
  const out = [];
  let next = seed || 1;
  while (copied.length && out.length < count) {
    next = (next * 9301 + 49297) % 233280;
    const idx = next % copied.length;
    out.push(copied.splice(idx, 1)[0]);
  }
  return out;
}

export function chunk(list, size) {
  const result = [];
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size));
  }
  return result;
}

export function progressTone(percent) {
  if (percent >= 80) return "excellent";
  if (percent >= 60) return "good";
  if (percent >= 40) return "steady";
  return "starting";
}

export function dateLabel(dateKey) {
  const d = parseDateKey(dateKey);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function getCountdown(examDate) {
  const today = new Date();
  const exam = new Date(`${examDate}T00:00:00`);
  const days = daysBetween(today, exam);
  return days;
}
