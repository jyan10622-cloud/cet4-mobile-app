import { dailyTaskTemplates, vocabLibrary, vocabEnhancements, listeningLibrary, weeklyPlan } from "./data.js";
import { getTodayKey, parseDateKey, daysBetween, clamp } from "./utils.js";

const STORAGE_KEY = "cet4_mobile_product_v5";
const START_DATE = "2026-03-16";

function defaultState() {
  return {
    settings: {
      examDate: "2026-06-13",
      dailyMinutes: 55,
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
    studyLog: {},
    mistakes: { spelling: [] },
    lastVocabSession: { mode: "learn", wordId: null, updatedAt: null },
    startedAt: getTodayKey(),
    lastActiveDate: getTodayKey()
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
      studyLog: parsed.studyLog || {},
      mistakes: { ...base.mistakes, ...(parsed.mistakes || {}) },
      stats: { ...base.stats, ...(parsed.stats || {}) },
      lastVocabSession: { ...base.lastVocabSession, ...(parsed.lastVocabSession || {}) },
      lastActiveDate: parsed.lastActiveDate || getTodayKey()
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  state.lastActiveDate = getTodayKey();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getMissedDays(state, dateKey = getTodayKey()) {
  if (!state.lastActiveDate) return 0;
  return Math.max(0, daysBetween(parseDateKey(state.lastActiveDate), parseDateKey(dateKey)) - 1);
}

export function ensureDailyTasks(state, dateKey = getTodayKey()) {
  if (state.tasksByDate[dateKey]) return state.tasksByDate[dateKey];
  const missedDays = getMissedDays(state, dateKey);
  const baseTasks = missedDays > 0
    ? dailyTaskTemplates.filter((t) => ["reviewWords", "audioWords", "spelling"].includes(t.key))
    : dailyTaskTemplates;
  state.tasksByDate[dateKey] = baseTasks.map((tpl, idx) => ({
    id: `${dateKey}-${tpl.key}-${idx}`,
    key: tpl.key,
    title: tpl.title,
    minutes: tpl.minutes,
    type: tpl.type,
    status: "pending"
  }));
  saveState(state);
  return state.tasksByDate[dateKey];
}

export function setTaskStatus(state, dateKey, taskId, status) {
  const tasks = ensureDailyTasks(state, dateKey);
  const task = tasks.find((t) => t.id === taskId);
  if (!task || task.status === status) return;
  const wasDone = task.status === "completed";
  task.status = status;
  if (!wasDone && status === "completed") {
    state.stats.totalTasksCompleted += 1;
    state.stats.totalMinutes += Number(task.minutes || 0);
    if (!state.checkins.includes(dateKey)) state.checkins.push(dateKey);
  }
  saveState(state);
}

function ensureWordProgress(state, wordId) {
  const prev = state.vocabProgress[wordId] || {};
  state.vocabProgress[wordId] = {
    familiarityStatus: prev.familiarityStatus || "未学习",
    reviewCount: prev.reviewCount || 0,
    knownCount: prev.knownCount || 0,
    lastSeenAt: prev.lastSeenAt || null,
    nextReviewAt: prev.nextReviewAt || null,
    spellingEligible: Boolean(prev.spellingEligible),
    wrongSpellingCount: prev.wrongSpellingCount || 0
  };
  return state.vocabProgress[wordId];
}

function addDay(now, days) {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function bumpDailyLog(state, key, count = 1, dateKey = getTodayKey()) {
  state.studyLog[dateKey] = state.studyLog[dateKey] || { newWords: 0, reviewWords: 0, spelling: 0, audioWords: 0 };
  state.studyLog[dateKey][key] = (state.studyLog[dateKey][key] || 0) + count;
}

export function rateVocabWord(state, wordId, rating) {
  const row = ensureWordProgress(state, wordId);
  row.reviewCount += 1;
  row.lastSeenAt = new Date().toISOString();
  if (rating === "不认识") {
    row.familiarityStatus = "不认识";
    row.knownCount = 0;
    row.nextReviewAt = addDay(Date.now(), 1);
    bumpDailyLog(state, "reviewWords");
  } else if (rating === "模糊") {
    row.familiarityStatus = "模糊";
    row.nextReviewAt = addDay(Date.now(), 2);
    bumpDailyLog(state, "reviewWords");
  } else {
    row.familiarityStatus = "认识";
    row.knownCount += 1;
    row.nextReviewAt = addDay(Date.now(), row.knownCount >= 2 ? 5 : 3);
    if (row.knownCount >= 2 || row.reviewCount >= 3) row.spellingEligible = true;
    bumpDailyLog(state, row.reviewCount <= 1 ? "newWords" : "reviewWords");
  }
  saveState(state);
  return row;
}

function enrichWord(baseWord) {
  const detail = vocabEnhancements[baseWord.id] || {};
  const meanings = detail.meanings?.length ? detail.meanings : [{ enLabel: "core", zh: baseWord.meaning }];
  const mainMeaning = detail.coreMeaning || meanings[0]?.zh || baseWord.meaning;
  const exampleEn = detail.example_en || baseWord.example_en;
  const exampleZh = detail.example_zh || baseWord.example_zh;
  return {
    ...baseWord,
    ...detail,
    mainMeaning,
    meanings,
    example_en: exampleEn,
    example_zh: exampleZh,
    roots: detail.roots || [],
    wordFamily: detail.wordFamily || [],
    phrases: detail.phrases || [],
    extraExamples: detail.extraExamples || [],
    audio_us: detail.audio_us || "",
    audio_uk: detail.audio_uk || "",
    example_audio_us: detail.example_audio_us || "",
    example_audio_uk: detail.example_audio_uk || ""
  };
}

export function getVocabDeck(state, mode = "learn", size = 12) {
  const now = Date.now();
  const list = vocabLibrary.map((raw) => {
    const w = enrichWord(raw);
    const p = state.vocabProgress[w.id] || {};
    const familiarityStatus = p.familiarityStatus || "未学习";
    const due = !p.nextReviewAt || new Date(p.nextReviewAt).getTime() <= now;
    const weightMap = { "未学习": 90, "不认识": 100, "模糊": 75, "认识": 45 };
    const weight = weightMap[familiarityStatus] + (due ? 12 : 0) + Math.max(0, 8 - (p.reviewCount || 0));
    return { ...w, familiarityStatus, due, weight, ...p };
  });

  if (mode === "review") {
    return list.filter((w) => w.familiarityStatus !== "未学习" && w.due).sort((a, b) => b.weight - a.weight).slice(0, size);
  }
  if (mode === "spelling") {
    return list.filter((w) => w.spellingEligible).sort((a, b) => b.weight - a.weight).slice(0, size);
  }
  return list.filter((w) => w.familiarityStatus === "未学习" || w.familiarityStatus === "不认识" || w.familiarityStatus === "模糊").sort((a, b) => b.weight - a.weight).slice(0, size);
}

export function submitSpelling(state, wordId, passed) {
  const row = ensureWordProgress(state, wordId);
  row.spellingEligible = true;
  if (!passed) {
    row.wrongSpellingCount += 1;
    row.nextReviewAt = addDay(Date.now(), 1);
    state.mistakes.spelling = Array.from(new Set([wordId, ...(state.mistakes.spelling || [])])).slice(0, 30);
  } else {
    row.nextReviewAt = addDay(Date.now(), 4);
    state.mistakes.spelling = (state.mistakes.spelling || []).filter((id) => id !== wordId);
    bumpDailyLog(state, "spelling");
  }
  saveState(state);
}

export function touchAudioTraining(state) {
  bumpDailyLog(state, "audioWords");
  saveState(state);
}

export function setLastVocabSession(state, payload) {
  state.lastVocabSession = {
    mode: payload?.mode || "learn",
    wordId: payload?.wordId || null,
    updatedAt: new Date().toISOString()
  };
  saveState(state);
}

export function getVocabStats(state, dateKey = getTodayKey()) {
  const stats = { total: vocabLibrary.length, 未学习: 0, 不认识: 0, 模糊: 0, 认识: 0, spellingEligible: 0 };
  vocabLibrary.forEach((w) => {
    const p = state.vocabProgress[w.id];
    const s = p?.familiarityStatus || "未学习";
    stats[s] += 1;
    if (p?.spellingEligible) stats.spellingEligible += 1;
  });
  const today = state.studyLog[dateKey] || { newWords: 0, reviewWords: 0, spelling: 0, audioWords: 0 };
  return { ...stats, today };
}

export function updateSettings(state, next) {
  state.settings = { ...state.settings, ...next };
  saveState(state);
}

function lastNDays(state, n) {
  const rows = [];
  const now = new Date();
  for (let i = 0; i < n; i += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = getTodayKey(d);
    const tasks = state.tasksByDate[key] || [];
    const completed = tasks.filter((t) => t.status === "completed");
    rows.push({ key, completed: completed.length, minutes: completed.reduce((sum, t) => sum + (t.minutes || 0), 0) });
  }
  return rows;
}

export function getDashboard(state, dateKey = getTodayKey()) {
  const tasks = ensureDailyTasks(state, dateKey);
  const completed = tasks.filter((t) => t.status === "completed").length;
  const pending = tasks.find((t) => t.status !== "completed");
  const todayMinutes = tasks.reduce((s, t) => s + (t.minutes || 0), 0);
  const chain = tasks.map((t) => t.title.replace("学习 ", "").replace("完成 ", ""));
  return {
    today: {
      total: tasks.length,
      completed,
      progress: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
      minutes: todayMinutes,
      remainingMinutes: tasks.filter((t) => t.status !== "completed").reduce((s, t) => s + t.minutes, 0)
    },
    resumeTask: pending,
    resumeVocab: state.lastVocabSession,
    streak: getStreak(state),
    chain,
    missedDays: getMissedDays(state, dateKey),
    weekMinutes: lastNDays(state, 7).reduce((s, r) => s + r.minutes, 0)
  };
}

export function getStreak(state) {
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i += 1) {
    const key = getTodayKey(cursor);
    const tasks = state.tasksByDate[key] || [];
    if (!tasks.length) break;
    const done = tasks.filter((t) => t.status === "completed").length;
    if (done >= Math.max(1, Math.floor(tasks.length * 0.6))) streak += 1;
    else break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getPlanSummary(state) {
  const examDate = new Date(`${state.settings.examDate}T00:00:00`);
  const startDate = new Date(`${START_DATE}T00:00:00`);
  const totalDays = Math.max(1, daysBetween(startDate, examDate));
  const passedDays = clamp(daysBetween(startDate, new Date()), 0, totalDays);
  const progress = Math.round((passedDays / totalDays) * 100);
  const currentWeek = clamp(Math.ceil((passedDays + 1) / 7), 1, 12);

  const weekRows = weeklyPlan.map((w) => {
    const daysBackStart = (12 - w.week) * 7;
    const doneMinutes = lastNDays(state, 84).slice(daysBackStart, daysBackStart + 7).reduce((s, r) => s + r.minutes, 0);
    const doneRatio = Math.round((doneMinutes / w.expectedMinutes) * 100);
    return { ...w, doneMinutes, doneRatio: clamp(doneRatio, 0, 100) };
  });

  const current = weekRows.find((w) => w.week === currentWeek) || weekRows[0];
  const today = ensureDailyTasks(state, getTodayKey());
  const pendingTodayMinutes = today.filter((t) => t.status !== "completed").reduce((s, t) => s + t.minutes, 0);

  return {
    totalDays,
    passedDays,
    progress,
    currentWeek,
    daysLeft: Math.max(0, daysBetween(new Date(), examDate)),
    current,
    weekRows,
    gainIfDoneToday: Math.min(100, Math.round((pendingTodayMinutes / Math.max(1, current.expectedMinutes)) * 100))
  };
}

export function getProfileStats(state) {
  const learnedDays = new Set(Object.keys(state.tasksByDate).filter((k) => (state.tasksByDate[k] || []).some((t) => t.status === "completed"))).size;
  const vocab = getVocabStats(state);
  const listeningCount = Object.values(state.listeningProgress).reduce((s, row) => s + (row.times || 0), 0);
  return {
    learnedDays,
    totalTasksCompleted: state.stats.totalTasksCompleted,
    masteredWords: vocab.认识,
    listeningCount,
    streak: getStreak(state)
  };
}

export function getListeningList(state) {
  return listeningLibrary.map((item) => ({
    ...item,
    practicedTimes: state.listeningProgress[item.id]?.times || 0,
    practiced: Boolean(state.listeningProgress[item.id]?.practiced),
    favorite: state.listeningFavorites.includes(item.id)
  }));
}

export function markListeningPracticed(state, id) {
  state.listeningProgress[id] = {
    practiced: true,
    times: (state.listeningProgress[id]?.times || 0) + 1,
    updatedAt: Date.now()
  };
  state.stats.totalMinutes += 8;
  saveState(state);
}

export function toggleListeningFavorite(state, id) {
  const set = new Set(state.listeningFavorites || []);
  if (set.has(id)) set.delete(id); else set.add(id);
  state.listeningFavorites = [...set];
  saveState(state);
}

export function getMistakeWords(state) {
  const ids = state.mistakes.spelling || [];
  return vocabLibrary.filter((w) => ids.includes(w.id));
}
