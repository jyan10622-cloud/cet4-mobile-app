import { dailyTaskTemplates, vocabLibrary, listeningLibrary, weeklyPlan } from "./data.js";
import { getTodayKey, parseDateKey, daysBetween, clamp } from "./utils.js";

const STORAGE_KEY = "cet4_mobile_product_v3";
const START_DATE = "2026-03-16";

function defaultState() {
  return {
    settings: {
      examDate: "2026-06-13",
      dailyMinutes: 60,
      targetScore: 500,
      reminder: true,
      theme: "system"
    },
    tasksByDate: {},
    vocabProgress: {},
    listeningProgress: {},
    listeningFavorites: [],
    checkins: [],
    stats: { totalTasksCompleted: 0, totalMinutes: 0 },
    startedAt: getTodayKey()
  };
}

export function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const base = defaultState();
    if (!parsed) return base;
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      tasksByDate: parsed.tasksByDate || {},
      vocabProgress: parsed.vocabProgress || {},
      listeningProgress: parsed.listeningProgress || {},
      listeningFavorites: parsed.listeningFavorites || [],
      checkins: parsed.checkins || [],
      stats: { ...base.stats, ...(parsed.stats || {}) }
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function dateSeed(dateKey) {
  const d = parseDateKey(dateKey);
  return d.getDate() + d.getMonth() * 31;
}

export function ensureDailyTasks(state, dateKey = getTodayKey()) {
  if (state.tasksByDate[dateKey]) return state.tasksByDate[dateKey];
  const seed = dateSeed(dateKey);
  const tasks = dailyTaskTemplates.map((tpl, idx) => ({
    id: `${dateKey}-${tpl.key}-${idx}`,
    key: tpl.key,
    title: tpl.title,
    minutes: tpl.minutes,
    type: tpl.type,
    status: "pending"
  }));
  if (seed % 3 === 0) {
    tasks.push({ id: `${dateKey}-translation`, key: "translation", title: "完成 1 组翻译表达", minutes: 12, type: "writing", status: "pending" });
  }
  state.tasksByDate[dateKey] = tasks;
  saveState(state);
  return tasks;
}

export function setTaskStatus(state, dateKey, taskId, status) {
  const tasks = ensureDailyTasks(state, dateKey);
  const task = tasks.find((t) => t.id === taskId);
  if (!task || task.status === status) return;
  const prevCompleted = task.status === "completed";
  task.status = status;
  if (!prevCompleted && status === "completed") {
    state.stats.totalTasksCompleted += 1;
    state.stats.totalMinutes += Number(task.minutes || 0);
    if (!state.checkins.includes(dateKey)) state.checkins.push(dateKey);
  }
  saveState(state);
}

export function setVocabStatus(state, wordId, status) {
  const prev = state.vocabProgress[wordId]?.status;
  state.vocabProgress[wordId] = {
    status,
    updatedAt: Date.now(),
    reviewCount: (state.vocabProgress[wordId]?.reviewCount || 0) + 1
  };
  if (prev !== "已掌握" && status === "已掌握") {
    state.stats.totalMinutes += 1;
  }
  saveState(state);
}

export function pickWordDeck(state, mode = "learn", size = 12) {
  const scored = vocabLibrary.map((w) => {
    const p = state.vocabProgress[w.id];
    const status = p?.status || "未学习";
    const reviewed = p?.reviewCount || 0;
    const scoreMap = {
      "不认识": 100,
      "模糊": 75,
      "认识": 45,
      "已掌握": 10,
      "未学习": 90
    };
    const priority = scoreMap[status] + Math.max(0, 20 - reviewed);
    return { ...w, status, priority };
  });
  const sorted = scored.sort((a, b) => b.priority - a.priority);
  const filtered = mode === "learn"
    ? sorted.filter((w) => w.status === "未学习" || w.status === "不认识" || w.status === "模糊")
    : sorted.filter((w) => w.status !== "未学习");
  return (filtered.length ? filtered : sorted).slice(0, size);
}

export function getVocabStats(state) {
  const stats = { "未学习": 0, "不认识": 0, "模糊": 0, "认识": 0, "已掌握": 0 };
  vocabLibrary.forEach((w) => {
    const s = state.vocabProgress[w.id]?.status || "未学习";
    stats[s] += 1;
  });
  return { ...stats, total: vocabLibrary.length };
}

export function toggleListeningFavorite(state, id) {
  const set = new Set(state.listeningFavorites);
  if (set.has(id)) set.delete(id); else set.add(id);
  state.listeningFavorites = [...set];
  saveState(state);
}

export function markListeningPracticed(state, id) {
  state.listeningProgress[id] = { practiced: true, times: (state.listeningProgress[id]?.times || 0) + 1, updatedAt: Date.now() };
  state.stats.totalMinutes += 10;
  saveState(state);
}

export function updateSettings(state, next) {
  state.settings = { ...state.settings, ...next };
  saveState(state);
}

export function getDashboard(state, dateKey = getTodayKey()) {
  const tasks = ensureDailyTasks(state, dateKey);
  const completed = tasks.filter((t) => t.status === "completed").length;
  const weekMinutes = lastNDays(state, 7).reduce((sum, row) => sum + row.minutes, 0);
  const streak = getStreak(state);
  const vocab = getVocabStats(state);
  return {
    today: { completed, total: tasks.length, progress: tasks.length ? Math.round((completed / tasks.length) * 100) : 0 },
    streak,
    weekMinutes,
    masteredWords: vocab["已掌握"]
  };
}

export function getStreak(state) {
  let streak = 0;
  let cursor = new Date();
  for (let i = 0; i < 365; i += 1) {
    const key = getTodayKey(cursor);
    const tasks = state.tasksByDate[key] || [];
    if (!tasks.length) break;
    const done = tasks.filter((t) => t.status === "completed").length;
    if (done >= Math.max(1, Math.floor(tasks.length * 0.6))) streak += 1; else break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function lastNDays(state, n) {
  const rows = [];
  const now = new Date();
  for (let i = 0; i < n; i += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = getTodayKey(d);
    const tasks = state.tasksByDate[key] || [];
    const completedTasks = tasks.filter((t) => t.status === "completed");
    rows.push({ key, completed: completedTasks.length, minutes: completedTasks.reduce((s, t) => s + t.minutes, 0) });
  }
  return rows;
}

export function getPlanSummary(state) {
  const examDate = new Date(`${state.settings.examDate}T00:00:00`);
  const startDate = new Date(`${START_DATE}T00:00:00`);
  const totalDays = Math.max(1, daysBetween(startDate, examDate));
  const passedDays = clamp(daysBetween(startDate, new Date()), 0, totalDays);
  const progress = Math.round((passedDays / totalDays) * 100);
  const currentWeek = clamp(Math.ceil((passedDays + 1) / 7), 1, 12);
  const weekly = weeklyPlan.map((w) => {
    const doneMinutes = lastNDays(state, 84).filter((_, idx) => Math.floor(idx / 7) === 12 - w.week).reduce((s, r) => s + r.minutes, 0);
    return { ...w, progress: Math.round((doneMinutes / w.expectedMinutes) * 100) };
  });
  return { totalDays, passedDays, progress, currentWeek, daysLeft: daysBetween(new Date(), examDate), weekly };
}

export function getProfileStats(state) {
  const learnedDays = new Set(Object.keys(state.tasksByDate).filter((k) => (state.tasksByDate[k] || []).some((t) => t.status === "completed"))).size;
  const vocab = getVocabStats(state);
  const listeningCount = Object.values(state.listeningProgress).reduce((s, row) => s + (row.times || 0), 0);
  return {
    learnedDays,
    totalTasksCompleted: state.stats.totalTasksCompleted,
    masteredWords: vocab["已掌握"],
    listeningCount,
    streak: getStreak(state)
  };
}

export function getListeningList() {
  return listeningLibrary;
}
