import {
  examStructure,
  grammarLessons,
  readingStrategies
} from "./data.js";
import {
  loadState,
  saveState,
  ensureDailyTasks,
  setTaskStatus,
  getVocabDeck,
  rateVocabWord,
  getVocabStats,
  updateSettings,
  getDashboard,
  getPlanSummary,
  getProfileStats,
  getListeningList,
  toggleListeningFavorite,
  markListeningPracticed,
  submitSpelling,
  getMistakeWords
} from "./store.js";
import { clamp, getTodayKey, getCountdown, escapeHtml } from "./utils.js";

let state = loadState();
let currentView = "home";
let vocabMode = "learn";
let vocabDeck = [];
let vocabIndex = 0;
let spellingType = "audio";
let listeningType = "全部";
let activeListeningId = null;
let listeningSpeed = 1.0;
let fakePlayerTimer = null;
let fakePlayerSec = 0;

const synth = window.speechSynthesis;

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

function speakWord(word) {
  if (!synth || !word) return;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = "en-US";
  utter.rate = 0.95;
  synth.speak(utter);
}

function refreshDeck() {
  const size = vocabMode === "spelling" ? 6 : vocabMode === "review" ? 20 : 12;
  vocabDeck = getVocabDeck(state, vocabMode, size);
  vocabIndex = 0;
}

function gotoView(view) {
  currentView = view;
  renderView();
}

function startTask(task) {
  if (!task) return;
  if (task.type === "vocab") gotoView("vocab");
  else if (task.type === "listening") gotoView("practice");
  else if (task.type === "practice") gotoView("practice");
}

function renderHome() {
  const todayKey = getTodayKey();
  const dashboard = getDashboard(state, todayKey);
  const countdown = getCountdown(state.settings.examDate);
  const resume = dashboard.resumeTask;
  const modeHint = dashboard.missedDays > 0 ? `<p class="muted">你中断了 ${dashboard.missedDays} 天：今天先恢复 3 个任务，先找回节奏。</p>` : "";

  views.home.innerHTML = `
    <section class="hero card tone-good">
      <p class="eyebrow">CET4 移动备考</p>
      <h2>今天就学这几件事</h2>
      <div class="hero-kpis">
        <div><p class="kicker">今日任务</p><h3>${dashboard.today.total}</h3></div>
        <div><p class="kicker">已完成</p><h3>${dashboard.today.completed}</h3></div>
        <div><p class="kicker">预计时长</p><h3>${dashboard.today.minutes} 分钟</h3></div>
      </div>
      <div class="bar large"><span style="width:${dashboard.today.progress}%"></span></div>
      <p class="muted">连续打卡 ${dashboard.streak} 天 · 距考试 ${countdown} 天（${escapeHtml(state.settings.examDate)}）</p>
      ${modeHint}
      <button class="primary-btn big-btn" data-action="start-today">开始今天学习</button>
      ${resume ? `<button class="ghost-btn" data-action="resume-task" data-id="${resume.id}">继续未完成：${escapeHtml(resume.title)}</button>` : ""}
    </section>

    <section class="card">
      <div class="section-head"><h3>今日学习链路</h3><span class="pill">打开就能学</span></div>
      <div class="path-row top-gap">
        ${dashboard.chain.map((line) => `<span class="path-chip">${escapeHtml(line)}</span>`).join("")}
      </div>
    </section>

    <section class="card top-gap">
      <div class="section-head"><h3>执行状态</h3><span class="pill">可推进</span></div>
      <p class="muted">剩余约 ${dashboard.today.remainingMinutes} 分钟。建议按顺序完成，减少决策成本。</p>
      <button class="small-btn top-gap" data-action="go-tab" data-view="daily">查看今日清单</button>
    </section>
  `;
}

function renderDaily() {
  const todayKey = getTodayKey();
  const tasks = ensureDailyTasks(state, todayKey);
  const done = tasks.filter((t) => t.status === "completed").length;
  const pendingTask = tasks.find((t) => t.status !== "completed");

  views.daily.innerHTML = `
    <section class="section-intro"><h2>今日任务</h2><p class="muted">每项 5-10 分钟，完成一项就有推进感。</p></section>
    <section class="card">
      <div class="section-head"><h3>完成进度</h3><span class="pill">${done}/${tasks.length}</span></div>
      <div class="bar"><span style="width:${Math.round((done / Math.max(1, tasks.length)) * 100)}%"></span></div>
      ${pendingTask ? `<button class="ghost-btn top-gap" data-action="start-task" data-id="${pendingTask.id}">继续：${escapeHtml(pendingTask.title)}</button>` : `<p class="feedback success top-gap">今日任务已清空，建议去词汇页做额外复习。</p>`}
    </section>
    <section class="task-stack top-gap">
      ${tasks.map((t) => `
        <article class="card task-card ${t.status === "completed" ? "is-done" : ""}">
          <label class="check-head">
            <input type="checkbox" data-action="quick-check" data-id="${t.id}" ${t.status === "completed" ? "checked" : ""}/>
            <div>
              <h3>${escapeHtml(t.title)}</h3>
              <p class="muted">预计 ${t.minutes} 分钟</p>
            </div>
            <span class="mini-status ${statusClass(t.status)}">${taskStatusText(t.status)}</span>
          </label>
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

function renderSpellingCard(card, idx, total) {
  if (!card) return `<section class="card top-gap"><p>拼写池为空。先在学习/复习中把单词标记为“认识”，再回来挑战。</p></section>`;
  const cloze = card.example_en.replace(new RegExp(card.word, "i"), "____");
  return `
    <section class="card word-card top-gap slide-in">
      <p class="task-tag">拼写挑战 · ${idx + 1}/${total}</p>
      <h3>${spellingType === "audio" ? "听音拼写" : "例句填空"}</h3>
      <p class="muted">${spellingType === "audio" ? "点击发音后输入单词" : escapeHtml(cloze)}</p>
      <div class="action-row top-gap">
        <button class="small-btn" data-action="speak-word" data-word="${escapeHtml(card.word)}">播放发音</button>
        <button class="small-btn ghost" data-action="swap-spell-type">切换题型</button>
      </div>
      <label class="stack top-gap"><span>你的答案</span><input class="spell-input" id="spellingInput" autocomplete="off" placeholder="输入单词"/></label>
      <div class="action-row top-gap">
        <button class="small-btn" data-action="submit-spelling" data-id="${card.id}" data-word="${escapeHtml(card.word)}">提交</button>
        <button class="small-btn ghost" data-action="retry-spelling">再试一次</button>
      </div>
      <p class="muted top-gap">提示：${escapeHtml(card.meaning)} · ${escapeHtml(card.example_zh)}</p>
    </section>
  `;
}

function renderVocab() {
  if (!vocabDeck.length) refreshDeck();
  const current = vocabDeck[vocabIndex];
  const stats = getVocabStats(state);
  const top = `
    <section class="section-intro"><h2>词汇核心学习</h2><p class="muted">看词 → 听音 → 例句 → 标熟悉度 → 复习 → 拼写</p></section>
    <section class="grid three stats-grid">
      <article class="card compact"><p class="kicker">今日新词</p><h3>${stats.today.newWords}</h3></article>
      <article class="card compact"><p class="kicker">今日复习</p><h3>${stats.today.reviewWords}</h3></article>
      <article class="card compact"><p class="kicker">今日拼写</p><h3>${stats.today.spelling}</h3></article>
    </section>
    <section class="card top-gap">
      <div class="chips">
        <button class="chip ${vocabMode === "learn" ? "active" : ""}" data-action="set-vocab-mode" data-mode="learn">学习新词</button>
        <button class="chip ${vocabMode === "review" ? "active" : ""}" data-action="set-vocab-mode" data-mode="review">复习旧词</button>
        <button class="chip ${vocabMode === "spelling" ? "active" : ""}" data-action="set-vocab-mode" data-mode="spelling">拼写挑战</button>
      </div>
      <p class="muted top-gap">拼写池：${stats.spellingEligible} 词可挑战（认识≥2次或完成复习后自动加入）。</p>
    </section>
  `;

  if (vocabMode === "spelling") {
    views.vocab.innerHTML = top + renderSpellingCard(current, vocabIndex, vocabDeck.length);
    return;
  }

  views.vocab.innerHTML = top + (current ? `
    <section class="card word-card top-gap slide-in">
      <p class="task-tag">${escapeHtml(current.group)} · ${vocabIndex + 1}/${vocabDeck.length}</p>
      <h2>${escapeHtml(current.word)}</h2>
      <p class="muted">${escapeHtml(current.ipa)} · ${escapeHtml(current.meaning)}</p>
      <p><strong>英文例句：</strong>${escapeHtml(current.example_en)}</p>
      <p><strong>中文释义：</strong>${escapeHtml(current.example_zh)}</p>
      <div class="action-row top-gap">
        <button class="small-btn" data-action="speak-word" data-word="${escapeHtml(current.word)}">发音</button>
      </div>
      <div class="action-row top-gap">
        <button class="small-btn ghost" data-action="word-rate" data-id="${current.id}" data-rate="不认识">不认识</button>
        <button class="small-btn ghost" data-action="word-rate" data-id="${current.id}" data-rate="模糊">模糊</button>
        <button class="small-btn" data-action="word-rate" data-id="${current.id}" data-rate="认识">认识</button>
      </div>
    </section>
  ` : `<section class="card top-gap"><p>当前模式今日卡片已完成，可切换模式继续。</p></section>`);
}

function renderPractice() {
  const listAll = getListeningList(state);
  const list = listeningType === "全部" ? listAll : listAll.filter((i) => i.type === listeningType);
  const grammar = grammarLessons.slice(0, 4);
  const reading = readingStrategies.slice(0, 3);
  const mistakes = getMistakeWords(state);

  views.practice.innerHTML = `
    <section class="section-intro"><h2>练习</h2><p class="muted">听力训练 / 阅读定位 / 语法基础 / 错题回顾</p></section>
    <section class="grid two">
      <article class="card">
        <div class="section-head"><h3>听力训练</h3><span class="pill">轻听模式</span></div>
        <div class="chips secondary">
          ${["全部", "短篇新闻", "长对话", "听力篇章"].map((t) => `<button class="chip ${listeningType === t ? "active" : ""}" data-action="listening-type" data-type="${t}">${t}</button>`).join("")}
        </div>
        <div class="task-stack top-gap">
          ${list.slice(0, 3).map((item) => `
            <article class="card compact">
              <div class="section-head"><h4>${escapeHtml(item.title)}</h4><span class="mini-status pending">${item.duration}</span></div>
              <p class="muted">${item.type} · 目标：${escapeHtml(item.target)}</p>
              <div class="action-row top-gap">
                <button class="small-btn" data-action="listen-play" data-id="${item.id}">${activeListeningId === item.id ? "暂停" : "播放"}</button>
                <button class="small-btn ghost" data-action="set-speed" data-speed="0.8">0.8x</button>
                <button class="small-btn ghost" data-action="set-speed" data-speed="1.0">1.0x</button>
                <button class="small-btn ghost" data-action="set-speed" data-speed="1.2">1.2x</button>
                <button class="small-btn ghost" data-action="listen-repeat" data-id="${item.id}">重点句重复</button>
                <button class="small-btn ghost" data-action="listen-transcript" data-id="${item.id}">原文</button>
                <button class="small-btn ghost" data-action="listen-favorite" data-id="${item.id}">${item.favorite ? "取消收藏" : "收藏"}</button>
                <button class="small-btn ghost" data-action="listen-done" data-id="${item.id}">标记已练习</button>
              </div>
              <div id="transcript-${item.id}" class="muted top-gap hidden">${escapeHtml(item.transcript)}</div>
            </article>
          `).join("")}
        </div>
        <p class="muted top-gap">播放状态：${activeListeningId ? `${activeListeningId} · ${fakePlayerSec}s · ${listeningSpeed}x` : "未播放"}</p>
      </article>

      <article class="card">
        <div class="section-head"><h3>阅读定位</h3><span class="pill">轻任务</span></div>
        <ul class="bullet-list">
          ${reading.map((r) => `<li><strong>${escapeHtml(r.title)}</strong>：${escapeHtml(r.method)}</li>`).join("")}
        </ul>
        <button class="small-btn top-gap" data-action="quick-complete" data-key="readingGrammar">完成 1 次阅读定位</button>
      </article>

      <article class="card">
        <div class="section-head"><h3>语法基础</h3><span class="pill">12个要点</span></div>
        <ul class="bullet-list">
          ${grammar.map((g) => `<li><strong>${escapeHtml(g.topic)}</strong>：${escapeHtml(g.drill)}</li>`).join("")}
        </ul>
        <button class="small-btn top-gap" data-action="quick-complete" data-key="readingGrammar">完成 1 次语法训练</button>
      </article>

      <article class="card">
        <div class="section-head"><h3>错题回顾</h3><span class="pill">${mistakes.length} 词</span></div>
        <p class="muted">拼写错词会自动进入回顾池，建议今天优先处理。</p>
        <ul class="bullet-list small">
          ${mistakes.slice(0, 6).map((w) => `<li>${escapeHtml(w.word)} · ${escapeHtml(w.meaning)}</li>`).join("") || "<li>暂无错词，继续保持。</li>"}
        </ul>
        <button class="small-btn top-gap" data-action="go-vocab-spelling">去拼写回顾</button>
      </article>
    </section>
  `;
}

function renderPlan() {
  const plan = getPlanSummary(state);
  const week = plan.current;
  views.plan.innerHTML = `
    <section class="section-intro"><h2>计划中枢</h2><p class="muted">看得见阶段、看得见推进、看得见恢复路径。</p></section>
    <section class="card">
      <div class="section-head"><h3>总备考进度</h3><span class="pill">剩余 ${plan.daysLeft} 天</span></div>
      <div class="bar large"><span style="width:${plan.progress}%"></span></div>
      <p class="muted">第 ${plan.currentWeek} 周 · ${escapeHtml(week.stage)} · 完成今日任务可再前进约 ${plan.gainIfDoneToday}% 本周目标。</p>
    </section>

    <section class="card top-gap">
      <h3>本周目标</h3>
      <p class="muted">目标：${escapeHtml(week.goal)}</p>
      <p class="muted">重点：${escapeHtml(week.focus)}</p>
      <div class="bar"><span style="width:${week.doneRatio}%"></span></div>
      <p class="muted">已完成 ${week.doneRatio}% · 剩余 ${Math.max(0, 100 - week.doneRatio)}%</p>
      ${week.doneRatio < 40 ? `<button class="small-btn top-gap" data-action="go-tab" data-view="daily">恢复学习（先做 3 项）</button>` : `<button class="small-btn top-gap" data-action="go-tab" data-view="home">继续推进今日任务</button>`}
    </section>

    <section class="task-stack top-gap">
      ${plan.weekRows.map((w) => `
        <article class="card plan-card ${w.week === plan.currentWeek ? "current" : ""}">
          <div class="section-head"><h3>第 ${w.week} 周 · ${escapeHtml(w.stage)}</h3><span class="pill">${w.doneMinutes}/${w.expectedMinutes} 分钟</span></div>
          <p class="muted">${escapeHtml(w.goal)}</p>
          <div class="bar"><span style="width:${w.doneRatio}%"></span></div>
        </article>
      `).join("")}
    </section>
  `;
}

function renderProfile() {
  const profile = getProfileStats(state);
  views.profile.innerHTML = `
    <section class="section-intro"><h2>我的</h2><p class="muted">仅保留对备考有用的数据与设置。</p></section>
    <section class="grid three">
      <article class="card compact"><p class="kicker">考试日期</p><h3>${escapeHtml(state.settings.examDate)}</h3></article>
      <article class="card compact"><p class="kicker">每日学习时长</p><h3>${state.settings.dailyMinutes} 分钟</h3></article>
      <article class="card compact"><p class="kicker">目标分数</p><h3>${state.settings.targetScore}</h3></article>
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
  showToast.t = setTimeout(() => toast.classList.remove("show"), 1300);
}

function toggleFakePlay(id) {
  if (activeListeningId === id) {
    activeListeningId = null;
    clearInterval(fakePlayerTimer);
    showToast("已暂停");
    return;
  }
  activeListeningId = id;
  clearInterval(fakePlayerTimer);
  fakePlayerSec = 0;
  fakePlayerTimer = setInterval(() => {
    fakePlayerSec += listeningSpeed;
    if (currentView === "practice") renderPractice();
  }, 1000);
  showToast(`播放中 ${listeningSpeed}x`);
}

function advanceVocab() {
  if (vocabIndex < vocabDeck.length - 1) vocabIndex += 1;
  else refreshDeck();
}

function completeTaskByKey(taskKey) {
  const today = getTodayKey();
  const tasks = ensureDailyTasks(state, today);
  const target = tasks.find((t) => t.key === taskKey && t.status !== "completed");
  if (target) {
    setTaskStatus(state, today, target.id, "completed");
  }
}

function handleAction(action, el) {
  const today = getTodayKey();
  if (action === "go-tab") {
    gotoView(el.dataset.view);
    return;
  }
  if (action === "start-today") {
    gotoView("daily");
    return;
  }
  if (action === "resume-task") {
    const task = ensureDailyTasks(state, today).find((t) => t.id === el.dataset.id);
    startTask(task);
    return;
  }
  if (action === "start-task") {
    const task = ensureDailyTasks(state, today).find((t) => t.id === el.dataset.id);
    startTask(task);
    return;
  }
  if (action === "quick-check") {
    setTaskStatus(state, today, el.dataset.id, el.checked ? "completed" : "pending");
    renderHome();
    renderDaily();
    return;
  }
  if (action === "task-status") {
    setTaskStatus(state, today, el.dataset.id, el.dataset.status);
    renderHome();
    renderDaily();
    return;
  }
  if (action === "set-vocab-mode") {
    vocabMode = el.dataset.mode;
    refreshDeck();
    renderVocab();
    return;
  }
  if (action === "speak-word") {
    speakWord(el.dataset.word);
    return;
  }
  if (action === "word-rate") {
    const row = rateVocabWord(state, el.dataset.id, el.dataset.rate);
    if (el.dataset.rate === "不认识") speakWord(vocabDeck[vocabIndex]?.word);
    if (row.spellingEligible) showToast("该词已进入拼写池");
    advanceVocab();
    renderVocab();
    completeTaskByKey(vocabMode === "review" ? "reviewWords" : "newWords");
    return;
  }
  if (action === "swap-spell-type") {
    spellingType = spellingType === "audio" ? "cloze" : "audio";
    renderVocab();
    return;
  }
  if (action === "submit-spelling") {
    const input = document.getElementById("spellingInput")?.value?.trim().toLowerCase() || "";
    const target = (el.dataset.word || "").trim().toLowerCase();
    const ok = input && input === target;
    submitSpelling(state, el.dataset.id, ok);
    if (ok) {
      showToast("拼写正确 ✔");
      completeTaskByKey("spelling");
      advanceVocab();
      renderVocab();
    } else {
      showToast(`拼写错误，正确答案：${target}`);
      renderVocab();
    }
    return;
  }
  if (action === "retry-spelling") {
    const input = document.getElementById("spellingInput");
    if (input) input.value = "";
    input?.focus();
    return;
  }
  if (action === "go-vocab-spelling") {
    vocabMode = "spelling";
    refreshDeck();
    gotoView("vocab");
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
  if (action === "set-speed") {
    listeningSpeed = Number(el.dataset.speed) || 1.0;
    showToast(`倍速 ${listeningSpeed}x`);
    return;
  }
  if (action === "listen-repeat") {
    const row = getListeningList(state).find((i) => i.id === el.dataset.id);
    showToast(row?.keySentence || "重复重点句");
    return;
  }
  if (action === "listen-transcript") {
    document.getElementById(`transcript-${el.dataset.id}`)?.classList.toggle("hidden");
    return;
  }
  if (action === "listen-favorite") {
    toggleListeningFavorite(state, el.dataset.id);
    renderPractice();
    return;
  }
  if (action === "listen-done") {
    markListeningPracticed(state, el.dataset.id);
    completeTaskByKey("listening");
    showToast("已标记听力完成");
    renderPractice();
    return;
  }
  if (action === "quick-complete") {
    completeTaskByKey(el.dataset.key);
    showToast("已记录完成");
    renderPractice();
    return;
  }
  if (action === "save-settings") {
    updateSettings(state, {
      examDate: document.getElementById("examDateInput").value || "2026-06-13",
      dailyMinutes: clamp(Number(document.getElementById("dailyMinutesInput").value || 55), 20, 180),
      targetScore: clamp(Number(document.getElementById("targetScoreInput").value || 500), 425, 710)
    });
    showToast("设置已保存");
    renderProfile();
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
