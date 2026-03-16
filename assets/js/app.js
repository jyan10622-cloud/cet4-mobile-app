import {
  examStructure,
  vocabLibrary,
  grammarLessons,
  readingStrategies,
  writingTranslationBank,
  weeklyPlan
} from "./data.js";
import {
  loadState,
  saveState,
  ensureDailyTasks,
  setTaskStatus,
  setVocabStatus,
  pickWordDeck,
  getVocabStats,
  updateSettings,
  getDashboard,
  getPlanSummary,
  getProfileStats,
  getListeningList,
  toggleListeningFavorite,
  markListeningPracticed
} from "./store.js";
import { clamp, getTodayKey, getCountdown, escapeHtml } from "./utils.js";

let state = loadState();
let currentView = "home";
let vocabMode = "learn";
let vocabDeck = [];
let vocabIndex = 0;
let listeningType = "全部";
let activeListeningId = null;
let fakePlayerTimer = null;
let fakePlayerSec = 0;

const views = {
  home: document.getElementById("view-home"),
  daily: document.getElementById("view-daily"),
  vocab: document.getElementById("view-vocab"),
  practice: document.getElementById("view-practice"),
  plan: document.getElementById("view-plan"),
  profile: document.getElementById("view-profile")
};

function statusClass(status) {
  return status === "completed" ? "completed" : status === "deferred" ? "deferred" : status === "skipped" ? "skipped" : "pending";
}

function taskStatusText(status) {
  return status === "completed" ? "已完成" : status === "deferred" ? "已延期" : status === "skipped" ? "已跳过" : "待开始";
}

function renderHome() {
  const todayKey = getTodayKey();
  const tasks = ensureDailyTasks(state, todayKey);
  const dashboard = getDashboard(state, todayKey);
  const countdown = getCountdown(state.settings.examDate);
  views.home.innerHTML = `
    <section class="hero card tone-good">
      <p class="eyebrow">2026 上半年 CET4 备考</p>
      <h2>今天学什么，一目了然</h2>
      <p class="muted">考试总时长 ${examStructure.durationMinutes} 分钟，距离考试还有 <strong>${countdown}</strong> 天。</p>
      <div class="bar large"><span style="width:${dashboard.today.progress}%"></span></div>
      <p class="muted">今日完成 ${dashboard.today.completed}/${dashboard.today.total} · 连续打卡 ${dashboard.streak} 天</p>
    </section>

    <section class="grid two">
      <article class="card">
        <div class="section-head"><h3>今日任务清单</h3><span class="pill">可执行</span></div>
        <ul class="check-list">
          ${tasks.map((t) => `<li class="simple-line"><span>${escapeHtml(t.title)}</span><span class="mini-status ${statusClass(t.status)}">${taskStatusText(t.status)}</span></li>`).join("")}
        </ul>
      </article>
      <article class="card">
        <div class="section-head"><h3>真实四级结构</h3><span class="pill">官方权重</span></div>
        <ul class="bullet-list">
          ${examStructure.sections.map((s) => `<li>${s.name} ${s.weight}%${s.parts ? `（${s.parts.join("、")}）` : ""}</li>`).join("")}
        </ul>
      </article>
    </section>
  `;
}

function renderDaily() {
  const todayKey = getTodayKey();
  const tasks = ensureDailyTasks(state, todayKey);
  const done = tasks.filter((t) => t.status === "completed").length;
  views.daily.innerHTML = `
    <section class="section-intro"><h2>今日</h2><p class="muted">每项任务支持开始/完成/跳过/延期，完成后自动统计。</p></section>
    <section class="card">
      <div class="section-head"><h3>今日完成</h3><span class="pill">${done}/${tasks.length}</span></div>
      <div class="bar"><span style="width:${Math.round(done / Math.max(1, tasks.length) * 100)}%"></span></div>
    </section>
    <section class="task-stack top-gap">
      ${tasks.map((t) => `
        <article class="card task-card ${t.status === "completed" ? "is-done" : ""}">
          <div class="section-head"><h3>${escapeHtml(t.title)}</h3><span class="pill">${t.minutes} 分钟</span></div>
          <div class="action-row top-gap">
            <button class="small-btn ghost" data-action="task-status" data-id="${t.id}" data-status="pending">开始</button>
            <button class="small-btn" data-action="task-status" data-id="${t.id}" data-status="completed">完成</button>
            <button class="small-btn ghost" data-action="task-status" data-id="${t.id}" data-status="skipped">跳过</button>
            <button class="small-btn ghost" data-action="task-status" data-id="${t.id}" data-status="deferred">延期</button>
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function refreshDeck() {
  vocabDeck = pickWordDeck(state, vocabMode, vocabMode === "learn" ? 12 : 20);
  vocabIndex = 0;
}

function renderVocab() {
  if (!vocabDeck.length) refreshDeck();
  const current = vocabDeck[vocabIndex];
  const stats = getVocabStats(state);
  views.vocab.innerHTML = `
    <section class="section-intro"><h2>单词</h2><p class="muted">卡片式学习：新词 + 复习双模式，状态流转驱动复习优先级。</p></section>
    <section class="grid four stats-grid">
      <article class="card compact"><p class="kicker">今日新词</p><h3>${vocabMode === "learn" ? vocabDeck.length : 0}</h3></article>
      <article class="card compact"><p class="kicker">今日复习</p><h3>${vocabMode === "review" ? vocabDeck.length : 0}</h3></article>
      <article class="card compact"><p class="kicker">已掌握</p><h3>${stats["已掌握"]}</h3></article>
      <article class="card compact"><p class="kicker">未学习</p><h3>${stats["未学习"]}</h3></article>
    </section>
    <section class="card top-gap">
      <div class="chips">
        <button class="chip ${vocabMode === "learn" ? "active" : ""}" data-action="set-vocab-mode" data-mode="learn">学习新词</button>
        <button class="chip ${vocabMode === "review" ? "active" : ""}" data-action="set-vocab-mode" data-mode="review">复习旧词</button>
      </div>
    </section>
    ${current ? `
      <section class="card word-card top-gap slide-in">
        <p class="task-tag">${escapeHtml(current.group)} · ${vocabIndex + 1}/${vocabDeck.length}</p>
        <h2>${escapeHtml(current.term)}</h2>
        <p class="muted">${escapeHtml(current.phonetic)} · ${escapeHtml(current.meaning)}</p>
        <p><strong>高频搭配：</strong>${escapeHtml(current.collocation)}</p>
        <p><strong>例句：</strong>${escapeHtml(current.example)}</p>
        <div class="action-row top-gap">
          <button class="small-btn ghost" data-action="word-status" data-id="${current.id}" data-status="不认识">不认识</button>
          <button class="small-btn ghost" data-action="word-status" data-id="${current.id}" data-status="模糊">模糊</button>
          <button class="small-btn ghost" data-action="word-status" data-id="${current.id}" data-status="认识">认识</button>
          <button class="small-btn" data-action="word-status" data-id="${current.id}" data-status="已掌握">已掌握</button>
        </div>
      </section>
    ` : `<section class="card top-gap"><p>今日卡片已完成，切换模式继续。</p></section>`}
  `;
}

function renderPractice() {
  const lessons = grammarLessons.slice(0, 3);
  const readings = readingStrategies;
  const writings = writingTranslationBank.slice(0, 4);
  const listeningAll = getListeningList();
  const list = listeningType === "全部" ? listeningAll : listeningAll.filter((i) => i.type === listeningType);
  views.practice.innerHTML = `
    <section class="section-intro"><h2>练习</h2><p class="muted">真实内容：语法、阅读、写作翻译、听力。</p></section>
    <section class="grid two">
      <article class="card"><h3>语法</h3><ul class="bullet-list">${lessons.map((l) => `<li><strong>${l.topic}</strong>：${l.points[0]}（${l.drill}）</li>`).join("")}</ul></article>
      <article class="card"><h3>阅读方法</h3><ul class="bullet-list">${readings.map((r) => `<li><strong>${r.title}</strong>：${r.method}</li>`).join("")}</ul></article>
    </section>
    <section class="card top-gap"><h3>写作翻译高频表达</h3><ul class="bullet-list">${writings.map((w) => `<li>${w.cn}<br/><span class="muted">${w.en}</span></li>`).join("")}</ul></section>
    <section class="card top-gap">
      <div class="section-head"><h3>听力模块（轻听模式）</h3><span class="pill">可替换音频结构</span></div>
      <div class="chips secondary">
        ${["全部", "短篇新闻", "长对话", "听力篇章"].map((t) => `<button class="chip ${listeningType === t ? "active" : ""}" data-action="listening-type" data-type="${t}">${t}</button>`).join("")}
      </div>
      <div class="task-stack top-gap">
        ${list.map((item) => `
          <article class="card compact">
            <div class="section-head"><h4>${item.title}</h4><span class="mini-status pending">${item.duration}</span></div>
            <p class="muted">${item.type} · 训练目标：${item.target}</p>
            <div class="action-row top-gap">
              <button class="small-btn" data-action="listen-play" data-id="${item.id}">${activeListeningId === item.id ? "暂停" : "播放"}</button>
              <button class="small-btn ghost" data-action="listen-transcript" data-id="${item.id}">显示原文</button>
              <button class="small-btn ghost" data-action="listen-follow">跟读提示</button>
              <button class="small-btn ghost" data-action="listen-favorite" data-id="${item.id}">${state.listeningFavorites.includes(item.id) ? "取消收藏" : "收藏"}</button>
              <button class="small-btn ghost" data-action="listen-done" data-id="${item.id}">已练习</button>
            </div>
            <div id="transcript-${item.id}" class="muted top-gap hidden">${escapeHtml(item.transcript)}</div>
          </article>
        `).join("")}
      </div>
      <p class="muted top-gap">${activeListeningId ? `播放中：${activeListeningId} · ${fakePlayerSec}s` : "当前未播放"}</p>
    </section>
  `;
}

function renderPlan() {
  const plan = getPlanSummary(state);
  views.plan.innerHTML = `
    <section class="section-intro"><h2>12 周计划</h2><p class="muted">依据考试日动态计算阶段和剩余天数。</p></section>
    <section class="card">
      <div class="section-head"><h3>总进度</h3><span class="pill">剩余 ${plan.daysLeft} 天</span></div>
      <div class="bar large"><span style="width:${plan.progress}%"></span></div>
      <p class="muted">当前处于第 ${plan.currentWeek} 周 · 周期推进 ${plan.progress}%</p>
    </section>
    <section class="task-stack top-gap">
      ${weeklyPlan.map((w) => {
        const current = w.week === plan.currentWeek;
        const suggest = w.progress < 60 ? "建议：降低新内容，增加复习占比。" : "建议：维持当前节奏，增加限时训练。";
        return `<article class="card plan-card ${current ? "current" : ""}"><div class="section-head"><h3>第${w.week}周 · ${w.stage}</h3><span class="pill">${w.expectedMinutes} 分钟</span></div><p class="muted">目标：${w.goal}</p><p class="muted">重点：${w.focus}</p><div class="bar"><span style="width:${clamp(w.progress || 0, 0, 100)}%"></span></div><p class="muted">完成进度：${clamp(w.progress || 0, 0, 100)}% · ${suggest}</p></article>`;
      }).join("")}
    </section>
  `;
}

function renderProfile() {
  const profile = getProfileStats(state);
  views.profile.innerHTML = `
    <section class="section-intro"><h2>我的</h2><p class="muted">展示真实学习数据与必要设置。</p></section>
    <section class="grid three">
      <article class="card compact"><p class="kicker">已学习天数</p><h3>${profile.learnedDays}</h3></article>
      <article class="card compact"><p class="kicker">累计完成任务</p><h3>${profile.totalTasksCompleted}</h3></article>
      <article class="card compact"><p class="kicker">已掌握词数</p><h3>${profile.masteredWords}</h3></article>
      <article class="card compact"><p class="kicker">听力练习次数</p><h3>${profile.listeningCount}</h3></article>
      <article class="card compact"><p class="kicker">当前连续打卡</p><h3>${profile.streak} 天</h3></article>
    </section>
    <section class="card top-gap">
      <h3>设置</h3>
      <label class="stack"><span>考试日期</span><input id="examDateInput" type="date" value="${state.settings.examDate}"/></label>
      <label class="stack"><span>每日学习时长（分钟）</span><input id="dailyMinutesInput" type="number" min="20" max="180" value="${state.settings.dailyMinutes}"/></label>
      <label class="stack"><span>目标分数</span><input id="targetScoreInput" type="number" min="425" max="710" value="${state.settings.targetScore}"/></label>
      <label class="stack"><span>提醒</span><select id="reminderInput"><option value="on" ${state.settings.reminder ? "selected" : ""}>开启</option><option value="off" ${!state.settings.reminder ? "selected" : ""}>关闭</option></select></label>
      <button class="primary-btn top-gap" data-action="save-settings">保存设置</button>
    </section>
  `;
}

function renderView() {
  Object.keys(views).forEach((k) => views[k].classList.toggle("active", k === currentView));
  if (currentView === "home") renderHome();
  if (currentView === "daily") renderDaily();
  if (currentView === "vocab") renderVocab();
  if (currentView === "practice") renderPractice();
  if (currentView === "plan") renderPlan();
  if (currentView === "profile") renderProfile();
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === currentView));
}

function showToast(text) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove("show"), 1400);
}

function toggleFakePlay(id) {
  if (activeListeningId === id) {
    activeListeningId = null;
    clearInterval(fakePlayerTimer);
    showToast("已暂停");
  } else {
    activeListeningId = id;
    clearInterval(fakePlayerTimer);
    fakePlayerSec = 0;
    fakePlayerTimer = setInterval(() => {
      fakePlayerSec += 1;
      if (currentView === "practice") renderPractice();
    }, 1000);
    showToast("开始播放（占位播放器）");
  }
}

function handleAction(action, el) {
  const today = getTodayKey();
  if (action === "task-status") {
    setTaskStatus(state, today, el.dataset.id, el.dataset.status);
    renderDaily();
    renderHome();
    return;
  }
  if (action === "set-vocab-mode") {
    vocabMode = el.dataset.mode;
    refreshDeck();
    renderVocab();
    return;
  }
  if (action === "word-status") {
    setVocabStatus(state, el.dataset.id, el.dataset.status);
    vocabIndex = Math.min(vocabIndex + 1, Math.max(0, vocabDeck.length - 1));
    refreshDeck();
    renderVocab();
    return;
  }
  if (action === "listening-type") {
    listeningType = el.dataset.type;
    renderPractice();
    return;
  }
  if (action === "listen-play") {
    toggleFakePlay(el.dataset.id);
    renderPractice();
    return;
  }
  if (action === "listen-transcript") {
    document.getElementById(`transcript-${el.dataset.id}`)?.classList.toggle("hidden");
    return;
  }
  if (action === "listen-follow") {
    showToast("跟读提示：先听一句，停顿3秒复述关键词");
    return;
  }
  if (action === "listen-favorite") {
    toggleListeningFavorite(state, el.dataset.id);
    renderPractice();
    return;
  }
  if (action === "listen-done") {
    markListeningPracticed(state, el.dataset.id);
    showToast("已标记为已练习");
    renderPractice();
    return;
  }
  if (action === "save-settings") {
    updateSettings(state, {
      examDate: document.getElementById("examDateInput").value || "2026-06-13",
      dailyMinutes: clamp(Number(document.getElementById("dailyMinutesInput").value || 60), 20, 180),
      targetScore: clamp(Number(document.getElementById("targetScoreInput").value || 500), 425, 710),
      reminder: document.getElementById("reminderInput").value === "on"
    });
    showToast("设置已保存");
    renderProfile();
    return;
  }
}

function registerEvents() {
  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
    currentView = tab.dataset.view;
    renderView();
  }));
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    handleAction(btn.dataset.action, btn);
  });
}

function boot() {
  ensureDailyTasks(state);
  refreshDeck();
  registerEvents();
  renderView();
  saveState(state);
}

boot();
