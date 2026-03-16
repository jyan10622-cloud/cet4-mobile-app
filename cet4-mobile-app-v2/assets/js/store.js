import { taskBlueprints, vocabLibrary, quizBank } from "./data.js";
import { clamp, daysBetween, getTodayKey, parseDateKey } from "./utils.js";

const STORAGE_KEY = "cet4_8020_mobile_v2";

function createDefaultState() {
  return {
    settings: {
      examDate: "2026-06-13",
      dailyMinutes: 90,
      targetScore: 425,
      theme: "system"
    },
    tasksByDate: {},
    vocabStatus: {},
    quizHistory: [],
    wrongQuestionIds: [],
    correctionHistory: {},
    translationHistory: {},
    lessonDoneIds: [],
    dailyNotes: {},
    profile: {
      learnerType: "成人本科 · 上班后重启",
      weakPoints: ["主谓一致", "基础时态", "简单输出"],
      strongPoints: ["基础词汇识别", "简单阅读理解"]
    }
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    const merged = { ...createDefaultState(), ...parsed };
    merged.settings = { ...createDefaultState().settings, ...(parsed.settings || {}) };
    merged.profile = { ...createDefaultState().profile, ...(parsed.profile || {}) };
    merged.tasksByDate = parsed.tasksByDate || {};
    merged.vocabStatus = parsed.vocabStatus || {};
    merged.quizHistory = Array.isArray(parsed.quizHistory) ? parsed.quizHistory : [];
    merged.wrongQuestionIds = Array.isArray(parsed.wrongQuestionIds) ? parsed.wrongQuestionIds : [];
    merged.correctionHistory = parsed.correctionHistory || {};
    merged.translationHistory = parsed.translationHistory || {};
    merged.lessonDoneIds = Array.isArray(parsed.lessonDoneIds) ? parsed.lessonDoneIds : [];
    merged.dailyNotes = parsed.dailyNotes || {};
    return merged;
  } catch (error) {
    console.warn("loadState failed", error);
    return createDefaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  const state = createDefaultState();
  saveState(state);
  return state;
}

function getPhase(examDate) {
  const today = new Date();
  const exam = new Date(`${examDate}T00:00:00`);
  const daysLeft = daysBetween(today, exam);
  if (daysLeft <= 28) return "sprint";
  if (daysLeft <= 63) return "strengthen";
  return "foundation";
}

function findCarryoverTask(state, dateKey) {
  const dates = Object.keys(state.tasksByDate).sort().reverse();
  for (const key of dates) {
    if (key >= dateKey) continue;
    const tasks = state.tasksByDate[key] || [];
    const match = tasks.find((task) => task.status === "deferred" && !task.carryoverUsed);
    if (match) {
      match.carryoverUsed = true;
      return {
        id: `carry-${key}-${match.id}`,
        type: "carryover",
        tag: "补做任务",
        title: `补做：${match.title}`,
        minutes: match.minutes,
        desc: "这是你之前延期的任务，今天补掉最划算。",
        points: ["做完它，避免任务堆积", "延期可以，但别无限延期"],
        status: "pending",
        sourceDate: key
      };
    }
  }
  return null;
}

function pickBlueprints(phase, seed) {
  const blueprints = taskBlueprints[phase] || taskBlueprints.foundation;
  const words = blueprints.words[seed % blueprints.words.length];
  const grammar = blueprints.grammar[seed % blueprints.grammar.length];
  const reading = blueprints.reading[seed % blueprints.reading.length];
  const quiz = blueprints.quiz[seed % blueprints.quiz.length];
  return [words, grammar, reading, quiz];
}

function createTaskFromBlueprint(blueprint, dateKey, index) {
  return {
    ...blueprint,
    id: `${dateKey}-${index}-${blueprint.id}`,
    status: "pending"
  };
}

export function ensureTasksForDate(state, dateKey = getTodayKey()) {
  if (state.tasksByDate[dateKey]) return state.tasksByDate[dateKey];
  const phase = getPhase(state.settings.examDate);
  const seed = parseDateKey(dateKey).getDate() + parseDateKey(dateKey).getMonth() * 31;
  const carryover = findCarryoverTask(state, dateKey);
  const tasks = pickBlueprints(phase, seed).map((item, idx) => createTaskFromBlueprint(item, dateKey, idx));
  if (carryover) tasks.unshift(carryover);
  state.tasksByDate[dateKey] = tasks;
  saveState(state);
  return tasks;
}

export function setTaskStatus(state, dateKey, taskId, status) {
  ensureTasksForDate(state, dateKey);
  const tasks = state.tasksByDate[dateKey];
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return state;
  task.status = status;
  saveState(state);
  return state;
}

export function setVocabStatus(state, vocabId, status) {
  state.vocabStatus[vocabId] = status;
  saveState(state);
  return state;
}

export function recordQuizAnswer(state, questionId, isCorrect) {
  const question = quizBank.find((item) => item.id === questionId);
  if (!question) return state;
  state.quizHistory.push({
    date: getTodayKey(),
    category: question.category,
    questionId,
    correct: Boolean(isCorrect)
  });
  const wrongSet = new Set(state.wrongQuestionIds);
  if (isCorrect) {
    wrongSet.delete(questionId);
  } else {
    wrongSet.add(questionId);
  }
  state.wrongQuestionIds = [...wrongSet];
  saveState(state);
  return state;
}

export function setCorrectionResult(state, drillId, result) {
  state.correctionHistory[drillId] = result;
  saveState(state);
  return state;
}

export function setTranslationResult(state, drillId, result) {
  state.translationHistory[drillId] = result;
  saveState(state);
  return state;
}

export function setLessonDone(state, lessonId) {
  if (!state.lessonDoneIds.includes(lessonId)) {
    state.lessonDoneIds.push(lessonId);
  }
  saveState(state);
  return state;
}

export function setDailyNote(state, dateKey, note) {
  state.dailyNotes[dateKey] = note;
  saveState(state);
  return state;
}

export function updateSettings(state, nextSettings) {
  state.settings = { ...state.settings, ...nextSettings };
  saveState(state);
  return state;
}

export function getTaskSummary(state, days = 7) {
  const today = new Date();
  let completed = 0;
  let total = 0;
  let minutes = 0;
  for (let i = 0; i < days; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = getTodayKey(date);
    const tasks = state.tasksByDate[key] || [];
    total += tasks.length;
    tasks.forEach((task) => {
      if (task.status === "completed") {
        completed += 1;
        minutes += Number(task.minutes || 0);
      }
    });
  }
  return { completed, total, minutes };
}

export function getStreak(state) {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = getTodayKey(date);
    const tasks = state.tasksByDate[key] || [];
    if (!tasks.length) break;
    const done = tasks.filter((task) => task.status === "completed").length;
    if (done >= Math.max(1, Math.ceil(tasks.length * 0.5))) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function getVocabStats(state) {
  const counts = { unknown: 0, familiar: 0, mastered: 0, untouched: 0, total: vocabLibrary.length };
  vocabLibrary.forEach((item) => {
    const status = state.vocabStatus[item.id];
    if (!status) counts.untouched += 1;
    else if (status === "unknown") counts.unknown += 1;
    else if (status === "familiar") counts.familiar += 1;
    else if (status === "mastered") counts.mastered += 1;
  });
  return counts;
}

export function getQuizStats(state) {
  const byCategory = {};
  const allCategories = [...new Set(quizBank.map((item) => item.category))];
  allCategories.forEach((cat) => {
    byCategory[cat] = { total: 0, correct: 0, accuracy: 0 };
  });
  state.quizHistory.forEach((row) => {
    byCategory[row.category] ??= { total: 0, correct: 0, accuracy: 0 };
    byCategory[row.category].total += 1;
    if (row.correct) byCategory[row.category].correct += 1;
  });
  Object.keys(byCategory).forEach((cat) => {
    const item = byCategory[cat];
    item.accuracy = item.total ? Math.round((item.correct / item.total) * 100) : 0;
  });
  const total = state.quizHistory.length;
  const correct = state.quizHistory.filter((row) => row.correct).length;
  return {
    total,
    correct,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    byCategory
  };
}

export function getReadinessScore(state) {
  const task14 = getTaskSummary(state, 14);
  const vocab = getVocabStats(state);
  const quiz = getQuizStats(state);
  const taskPart = task14.total ? (task14.completed / task14.total) * 45 : 0;
  const vocabPart = ((vocab.mastered + vocab.familiar * 0.5) / Math.max(1, vocab.total)) * 25;
  const quizPart = (quiz.accuracy / 100) * 30;
  return Math.round(clamp(taskPart + vocabPart + quizPart, 18, 92));
}

export function getHeatmapData(state, days = 84) {
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = getTodayKey(date);
    const tasks = state.tasksByDate[key] || [];
    const done = tasks.filter((task) => task.status === "completed").length;
    const total = tasks.length;
    const level = total ? Math.ceil((done / total) * 4) : 0;
    out.push({ key, done, total, level });
  }
  return out;
}

export function getWeekGoal(state) {
  const targetMinutes = state.settings.dailyMinutes * 5;
  const summary = getTaskSummary(state, 7);
  return {
    targetMinutes,
    currentMinutes: summary.minutes,
    percent: targetMinutes ? Math.round((summary.minutes / targetMinutes) * 100) : 0
  };
}

export function getMonthlyGoal(state) {
  const vocab = getVocabStats(state);
  const quiz = getQuizStats(state);
  return {
    masteredTarget: 40,
    masteredCurrent: vocab.mastered,
    quizTarget: 25,
    quizCurrent: quiz.total
  };
}

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

export function importState(raw) {
  const parsed = JSON.parse(raw);
  saveState(parsed);
  return loadState();
}
