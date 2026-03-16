import {
  vocabLibrary,
  microLessons,
  correctionDrills,
  translationDrills,
  quizBank,
  weeklyPlan,
  lowReturnTopics
} from "./data.js";
import {
  loadState,
  saveState,
  ensureTasksForDate,
  setTaskStatus,
  setVocabStatus,
  recordQuizAnswer,
  setCorrectionResult,
  setTranslationResult,
  setLessonDone,
  setDailyNote,
  updateSettings,
  getTaskSummary,
  getStreak,
  getVocabStats,
  getQuizStats,
  getReadinessScore,
  getHeatmapData,
  getWeekGoal,
  getMonthlyGoal,
  exportState,
  importState
} from "./store.js";
import {
  clamp,
  formatPercent,
  getTodayKey,
  getCountdown,
  escapeHtml,
  chunk,
  progressTone
} from "./utils.js";

let state = loadState();
let currentView = "home";
let vocabGroup = "all";
let vocabFilter = "all";
let quizFilter = "all";
let currentQuizSession = null;
let deferredInstallPrompt = null;

const views = {
  home: document.getElementById("view-home"),
  daily: document.getElementById("view-daily"),
  vocab: document.getElementById("view-vocab"),
  practice: document.getElementById("view-practice"),
  plan: document.getElementById("view-plan"),
  profile: document.getElementById("view-profile")
};

function applyTheme() {
  const pref = state.settings.theme || "system";
  document.documentElement.dataset.theme = pref;
}

function getPhaseLabel(daysLeft) {
  if (daysLeft <= 28) return "最后 4 周：冲刺稳心态";
  if (daysLeft <= 63) return "中段强化：阅读定位 + 错题回炉";
  return "基础恢复：高频词 + 基础语法";
}

function getEncouragement(score) {
  if (score >= 80) return "你的节奏很稳，继续把错题和输出守住。";
  if (score >= 65) return "通过感在上升，别扩内容，继续盯高回报任务。";
  if (score >= 50) return "基础正在回来，先把每天 4 件小事做扎实。";
  return "别焦虑，先连续做满 7 天，你会明显找回手感。";
}

function renderHome() {
  const todayKey = getTodayKey();
  const tasks = ensureTasksForDate(state, todayKey);
  const doneToday = tasks.filter((item) => item.status === "completed").length;
  const countdown = getCountdown(state.settings.examDate);
  const readiness = getReadinessScore(state);
  const vocabStats = getVocabStats(state);
  const quizStats = getQuizStats(state);
  const streak = getStreak(state);
  const weekGoal = getWeekGoal(state);
  const todayProgress = tasks.length ? Math.round((doneToday / tasks.length) * 100) : 0;
  const tone = progressTone(todayProgress);
  const topTasks = tasks.slice(0, 3).map((task) => `
    <li class="simple-line">
      <span>${escapeHtml(task.title)}</span>
      <span class="mini-status ${task.status}">${labelStatus(task.status)}</span>
    </li>
  `).join("");

  views.home.innerHTML = `
    <section class="hero card tone-${tone}">
      <div>
        <p class="eyebrow">为你的情况定制：成人本科 · 上班后重启 · 弱输出强输入</p>
        <h2>把最值钱的 20% 做扎实</h2>
        <p class="muted">${countdown >= 0 ? `距离考试还有 <strong>${countdown}</strong> 天` : `考试日期已过 ${Math.abs(countdown)} 天，仍可继续用来积累基础`}，当前阶段：${getPhaseLabel(countdown)}。</p>
      </div>
      <div class="hero-grid">
        <article class="metric card inset">
          <p>今日完成</p>
          <h3>${doneToday}/${tasks.length}</h3>
          <div class="bar"><span style="width:${todayProgress}%"></span></div>
        </article>
        <article class="metric card inset">
          <p>连续打卡</p>
          <h3>${streak} 天</h3>
          <small>完成一半以上任务即计入</small>
        </article>
      </div>
    </section>

    <section class="grid two">
      <article class="card">
        <div class="section-head">
          <h3>预计状态</h3>
          <span class="pill">${readiness} / 100</span>
        </div>
        <div class="ring-wrap">
          <div class="ring" style="--deg:${readiness * 3.6}deg"><span>${readiness}%</span></div>
          <div>
            <p class="strong">${getEncouragement(readiness)}</p>
            <p class="muted">这是根据近 14 天执行率、词汇掌握度和小测正确率给出的鼓励型估算，不是保证分数。</p>
          </div>
        </div>
      </article>

      <article class="card">
        <div class="section-head">
          <h3>本周目标</h3>
          <span class="pill">${formatPercent(clamp(weekGoal.percent, 0, 999))}</span>
        </div>
        <p class="muted">目标学习时长：${weekGoal.targetMinutes} 分钟，本周已完成：${weekGoal.currentMinutes} 分钟。</p>
        <div class="bar large"><span style="width:${clamp(weekGoal.percent, 0, 100)}%"></span></div>
        <ul class="check-list">
          ${topTasks}
        </ul>
      </article>
    </section>

    <section class="grid three">
      <article class="card compact">
        <p class="kicker">词汇</p>
        <h3>${vocabStats.mastered} 已掌握</h3>
        <p class="muted">熟悉 ${vocabStats.familiar} · 不认识 ${vocabStats.unknown} · 未碰 ${vocabStats.untouched}</p>
      </article>
      <article class="card compact">
        <p class="kicker">自测</p>
        <h3>${quizStats.accuracy}% 正确率</h3>
        <p class="muted">累计 ${quizStats.total} 题，错题本 ${state.wrongQuestionIds.length} 题。</p>
      </article>
      <article class="card compact">
        <p class="kicker">今天就做这几件</p>
        <h3>4 小任务</h3>
        <p class="muted">别追求完美，先把能完成的做完。</p>
      </article>
    </section>

    <section class="grid two">
      <article class="card">
        <div class="section-head">
          <h3>你该继续加码的 20%</h3>
          <span class="pill">高回报</span>
        </div>
        <ul class="bullet-list">
          <li>高频词：先看得懂，再追求会默写。</li>
          <li>主谓一致、基础时态、定语从句识别。</li>
          <li>阅读定位：题干关键词 → 原文同义替换。</li>
          <li>听力信号：but / however / actually / should / need to。</li>
          <li>简单输出：每天 1 句中译英 + 1 题改错。</li>
        </ul>
      </article>
      <article class="card">
        <div class="section-head">
          <h3>大多数时候先别学这些</h3>
          <span class="pill muted-pill">低回报</span>
        </div>
        <ul class="bullet-list">
          ${lowReturnTopics.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </article>
    </section>
  `;
}

function labelStatus(status) {
  if (status === "completed") return "已完成";
  if (status === "skipped") return "已跳过";
  if (status === "deferred") return "已延期";
  return "待开始";
}

function renderDaily() {
  const todayKey = getTodayKey();
  const tasks = ensureTasksForDate(state, todayKey);
  const lesson = microLessons[(new Date().getDate() - 1) % microLessons.length];
  const note = state.dailyNotes[todayKey] || "";

  views.daily.innerHTML = `
    <section class="section-intro">
      <h2>今日学习</h2>
      <p class="muted">今天只盯 4 件高回报小事。做满 3 件，就已经很不错。</p>
    </section>

    <section class="task-stack">
      ${tasks.map((task) => `
        <article class="card task-card">
          <div class="task-head">
            <div>
              <p class="task-tag">${escapeHtml(task.tag)}</p>
              <h3>${escapeHtml(task.title)}</h3>
            </div>
            <span class="pill">${task.minutes} 分钟</span>
          </div>
          <p class="muted">${escapeHtml(task.desc)}</p>
          <ul class="bullet-list small">
            ${(task.points || []).map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
          </ul>
          <div class="status-row">
            <span class="mini-status ${task.status}">${labelStatus(task.status)}</span>
            <div class="action-row">
              <button class="small-btn" data-action="task-status" data-task="${task.id}" data-status="completed">完成</button>
              <button class="small-btn ghost" data-action="task-status" data-task="${task.id}" data-status="deferred">延期</button>
              <button class="small-btn ghost" data-action="task-status" data-task="${task.id}" data-status="skipped">跳过</button>
            </div>
          </div>
        </article>
      `).join("")}
    </section>

    <section class="grid two">
      <article class="card">
        <div class="section-head">
          <h3>今日微课</h3>
          <span class="pill">${lesson.minutes} 分钟</span>
        </div>
        <p class="kicker">${escapeHtml(lesson.tag)}</p>
        <h4>${escapeHtml(lesson.title)}</h4>
        <p class="muted">${escapeHtml(lesson.summary)}</p>
        <ul class="bullet-list">
          ${lesson.bullets.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
        </ul>
        <div class="compare">
          <div><span>易错</span><strong>${escapeHtml(lesson.exampleWrong)}</strong></div>
          <div><span>更稳</span><strong>${escapeHtml(lesson.exampleRight)}</strong></div>
        </div>
        <p class="tip">提醒：${escapeHtml(lesson.trap)}</p>
        <button class="primary-btn" data-action="lesson-done" data-lesson="${lesson.id}">我看完了</button>
      </article>

      <article class="card">
        <div class="section-head">
          <h3>今日复盘</h3>
          <span class="pill">1 分钟</span>
        </div>
        <label class="stack">
          <span class="muted">写一句：今天完成了什么？明天最关键的一件事是什么？</span>
          <textarea id="dailyNoteInput" rows="6" placeholder="例如：我完成了高频词和改错。明天最关键的是把中译英做掉。">${escapeHtml(note)}</textarea>
        </label>
        <button class="primary-btn" data-action="save-note">保存复盘</button>
      </article>
    </section>
  `;
}

function getFilteredVocab() {
  return vocabLibrary.filter((item) => {
    const status = state.vocabStatus[item.id] || "untouched";
    const groupOk = vocabGroup === "all" || item.group === vocabGroup;
    const filterOk = vocabFilter === "all" || status === vocabFilter;
    return groupOk && filterOk;
  });
}

function statusText(status) {
  if (status === "unknown") return "不认识";
  if (status === "familiar") return "认识";
  if (status === "mastered") return "已掌握";
  return "未标记";
}

function renderVocab() {
  const list = getFilteredVocab();
  const stats = getVocabStats(state);
  const groups = [
    ["all", "全部"],
    ["verbs", "动词"],
    ["adjectives", "形容词"],
    ["phrases", "短语"],
    ["writing", "写作句型"]
  ];
  const filters = [
    ["all", "全部状态"],
    ["untouched", "未标记"],
    ["unknown", "不认识"],
    ["familiar", "认识"],
    ["mastered", "已掌握"]
  ];

  views.vocab.innerHTML = `
    <section class="section-intro">
      <h2>词汇与句型</h2>
      <p class="muted">你的目标不是把所有词背到会拼，而是先把高频词认熟、会用短句表达。</p>
    </section>

    <section class="grid four stats-grid">
      <article class="card compact"><p class="kicker">已掌握</p><h3>${stats.mastered}</h3></article>
      <article class="card compact"><p class="kicker">认识</p><h3>${stats.familiar}</h3></article>
      <article class="card compact"><p class="kicker">不认识</p><h3>${stats.unknown}</h3></article>
      <article class="card compact"><p class="kicker">未标记</p><h3>${stats.untouched}</h3></article>
    </section>

    <section class="card">
      <div class="chips">
        ${groups.map(([key, label]) => `<button class="chip ${vocabGroup === key ? "active" : ""}" data-action="set-vocab-group" data-value="${key}">${label}</button>`).join("")}
      </div>
      <div class="chips secondary">
        ${filters.map(([key, label]) => `<button class="chip ${vocabFilter === key ? "active" : ""}" data-action="set-vocab-filter" data-value="${key}">${label}</button>`).join("")}
      </div>
      <p class="muted top-gap">当前展示 ${list.length} 张卡片。优先刷“不认识”和“未标记”。</p>
    </section>

    <section class="task-stack">
      ${list.slice(0, 18).map((word) => {
        const status = state.vocabStatus[word.id] || "untouched";
        return `
          <article class="card word-card">
            <div class="word-top">
              <div>
                <p class="task-tag">${groupLabel(word.group)}</p>
                <h3>${escapeHtml(word.term)}</h3>
                <p class="muted">${escapeHtml(word.meaning)}</p>
              </div>
              <span class="mini-status ${status === "untouched" ? "pending" : status}">${statusText(status)}</span>
            </div>
            <p class="tip">${escapeHtml(word.tip)}</p>
            <details>
              <summary>查看例句</summary>
              <p>${escapeHtml(word.example)}</p>
            </details>
            <div class="action-row">
              <button class="small-btn ghost" data-action="vocab-status" data-id="${word.id}" data-status="unknown">不认识</button>
              <button class="small-btn ghost" data-action="vocab-status" data-id="${word.id}" data-status="familiar">认识</button>
              <button class="small-btn" data-action="vocab-status" data-id="${word.id}" data-status="mastered">已掌握</button>
            </div>
          </article>
        `;
      }).join("")}
      ${list.length > 18 ? `<p class="muted center">当前先显示前 18 张，做完再切换分组或状态继续刷。</p>` : ""}
    </section>
  `;
}

function groupLabel(group) {
  if (group === "verbs") return "动词";
  if (group === "adjectives") return "形容词";
  if (group === "phrases") return "短语";
  return "写作句型";
}

function getPracticeQuestionPool() {
  if (quizFilter === "all") return quizBank;
  if (quizFilter === "wrong") return quizBank.filter((item) => state.wrongQuestionIds.includes(item.id));
  return quizBank.filter((item) => item.category === quizFilter);
}

function startQuiz(mode = "normal") {
  const pool = getPracticeQuestionPool();
  const source = mode === "wrong" ? pool : shuffle(pool).slice(0, Math.min(5, pool.length || 5));
  currentQuizSession = {
    mode,
    items: source,
    index: 0,
    correct: 0,
    answered: []
  };
  renderPractice();
}

function shuffle(list) {
  const copied = [...list];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function currentCorrection() {
  const index = Object.keys(state.correctionHistory).length % correctionDrills.length;
  return correctionDrills[index];
}

function currentTranslation() {
  const index = Object.keys(state.translationHistory).length % translationDrills.length;
  return translationDrills[index];
}

function renderPractice() {
  const quizStats = getQuizStats(state);
  const categories = ["all", "词汇", "语法", "阅读", "听力策略", "写作模板", "wrong"];
  const correction = currentCorrection();
  const translation = currentTranslation();

  const categoryCards = Object.entries(quizStats.byCategory).map(([category, info]) => `
    <article class="card compact">
      <p class="kicker">${escapeHtml(category)}</p>
      <h3>${info.accuracy}%</h3>
      <p class="muted">${info.correct}/${info.total || 0} 正确</p>
    </article>
  `).join("");

  let quizHtml = `
    <div class="card">
      <div class="section-head">
        <h3>分类小测</h3>
        <span class="pill">${quizStats.accuracy}% 总正确率</span>
      </div>
      <div class="chips">
        ${categories.map((item) => {
          const label = item === "all" ? "全部" : item === "wrong" ? `错题本(${state.wrongQuestionIds.length})` : item;
          return `<button class="chip ${quizFilter === item ? "active" : ""}" data-action="set-quiz-filter" data-value="${item}">${label}</button>`;
        }).join("")}
      </div>
      <p class="muted top-gap">当前题池：${getPracticeQuestionPool().length} 题。先做 5 题就够，关键是看解释。</p>
      <div class="action-row top-gap">
        <button class="primary-btn" data-action="start-quiz">开始 5 题小测</button>
        <button class="ghost-btn" data-action="start-wrong-quiz">只练错题</button>
      </div>
    </div>
  `;

  if (currentQuizSession && currentQuizSession.items.length) {
    const q = currentQuizSession.items[currentQuizSession.index];
    const progress = currentQuizSession.items.length ? Math.round(((currentQuizSession.index) / currentQuizSession.items.length) * 100) : 0;
    const answeredRow = currentQuizSession.answered.find((row) => row.id === q.id);

    quizHtml = `
      <div class="card">
        <div class="section-head">
          <h3>进行中的小测</h3>
          <span class="pill">${currentQuizSession.index + 1} / ${currentQuizSession.items.length}</span>
        </div>
        <div class="bar"><span style="width:${progress}%"></span></div>
        <p class="kicker top-gap">${escapeHtml(q.category)}</p>
        <h4>${escapeHtml(q.question)}</h4>
        <div class="option-list top-gap">
          ${q.choices.map((choice, idx) => `
            <button class="option-btn ${answeredRow ? (idx === q.answer ? "correct" : (answeredRow.selected === idx ? "wrong" : "")) : ""}" data-action="quiz-answer" data-id="${q.id}" data-index="${idx}" ${answeredRow ? "disabled" : ""}>
              ${String.fromCharCode(65 + idx)}. ${escapeHtml(choice)}
            </button>
          `).join("")}
        </div>
        ${answeredRow ? `
          <div class="feedback ${answeredRow.correct ? "success" : "error"}">
            <strong>${answeredRow.correct ? "答对了" : "这题先别急"}</strong>
            <p>${escapeHtml(q.explanation)}</p>
          </div>
          <button class="primary-btn" data-action="quiz-next">${currentQuizSession.index === currentQuizSession.items.length - 1 ? "查看结果" : "下一题"}</button>
        ` : ""}
      </div>
    `;
  }

  if (currentQuizSession && currentQuizSession.items.length && currentQuizSession.index >= currentQuizSession.items.length) {
    // not used, kept for safety
  }

  const summaryBlock = currentQuizSession && currentQuizSession.done ? `
    <article class="card">
      <div class="section-head">
        <h3>本轮结果</h3>
        <span class="pill">${currentQuizSession.correct}/${currentQuizSession.items.length}</span>
      </div>
      <p class="muted">继续做错题本，比分散刷新题更高效。</p>
    </article>
  ` : "";

  views.practice.innerHTML = `
    <section class="section-intro">
      <h2>练习与输出</h2>
      <p class="muted">你现在最需要的是：小测 + 改错 + 中译英。量不必大，但要每天碰一下。</p>
    </section>

    <section class="grid four stats-grid">
      ${categoryCards}
    </section>

    <section class="grid two top-gap">
      <article class="card">
        <div class="section-head">
          <h3>句子改错</h3>
          <span class="pill">${escapeHtml(correction.focus)}</span>
        </div>
        <p class="muted strong">错句：${escapeHtml(correction.wrong)}</p>
        <details>
          <summary>展开答案与解释</summary>
          <p><strong>正确：</strong>${escapeHtml(correction.correct)}</p>
          <p class="muted">${escapeHtml(correction.explanation)}</p>
        </details>
        <div class="action-row top-gap">
          <button class="small-btn ghost" data-action="correction-result" data-id="${correction.id}" data-result="review">还要再看</button>
          <button class="small-btn" data-action="correction-result" data-id="${correction.id}" data-result="mastered">这题会了</button>
        </div>
      </article>

      <article class="card">
        <div class="section-head">
          <h3>中译英</h3>
          <span class="pill">${escapeHtml(translation.focus)}</span>
        </div>
        <p class="muted strong">${escapeHtml(translation.cn)}</p>
        <label class="stack top-gap">
          <span class="muted">先自己写，再展开参考答案。</span>
          <textarea id="translationAttempt" rows="4" placeholder="先自己写一句英文，不求复杂，求写对。"></textarea>
        </label>
        <details>
          <summary>查看参考答案</summary>
          <p><strong>参考：</strong>${escapeHtml(translation.answer)}</p>
          <p class="muted">提示：${escapeHtml(translation.hint)}</p>
        </details>
        <div class="action-row top-gap">
          <button class="small-btn ghost" data-action="translation-result" data-id="${translation.id}" data-result="review">写不出来</button>
          <button class="small-btn" data-action="translation-result" data-id="${translation.id}" data-result="done">写出来了</button>
        </div>
      </article>
    </section>

    <section class="top-gap">
      ${quizHtml}
      ${summaryBlock}
    </section>
  `;
}

function renderPlan() {
  const countdown = getCountdown(state.settings.examDate);
  const currentWeek = clamp(12 - Math.floor(Math.max(countdown, 0) / 7), 1, 12);
  views.plan.innerHTML = `
    <section class="section-intro">
      <h2>12 周冲刺路线</h2>
      <p class="muted">给你的路线只有一个原则：范围小一点，重复多一点。</p>
    </section>

    <section class="grid two">
      <article class="card">
        <div class="section-head">
          <h3>当前建议阶段</h3>
          <span class="pill">第 ${currentWeek} 周附近</span>
        </div>
        <p class="muted">${getPhaseLabel(countdown)}</p>
        <ul class="bullet-list">
          <li>优先把每天 4 个任务做稳。</li>
          <li>输出弱，就每天碰 1 个中译英和 1 个改错。</li>
          <li>错误重复出现，就停止扩张内容，转为复盘。</li>
        </ul>
      </article>
      <article class="card">
        <div class="section-head">
          <h3>本月目标</h3>
          <span class="pill">别贪多</span>
        </div>
        ${renderMonthlyGoalInner()}
      </article>
    </section>

    <section class="task-stack top-gap">
      ${weeklyPlan.map((item) => `
        <article class="card plan-card ${item.week === currentWeek ? "current" : ""}">
          <div class="section-head">
            <div>
              <p class="kicker">${escapeHtml(item.phase)}</p>
              <h3>${escapeHtml(item.title)}</h3>
            </div>
            <span class="pill ${item.week === currentWeek ? "" : "muted-pill"}">${item.week === currentWeek ? "当前重点" : `第 ${item.week} 周`}</span>
          </div>
          <p class="muted">${escapeHtml(item.focus)}</p>
          <ul class="bullet-list small">
            ${item.goals.map((goal) => `<li>${escapeHtml(goal)}</li>`).join("")}
          </ul>
        </article>
      `).join("")}
    </section>
  `;
}

function renderMonthlyGoalInner() {
  const monthly = getMonthlyGoal(state);
  const masteredPercent = Math.round((monthly.masteredCurrent / monthly.masteredTarget) * 100);
  const quizPercent = Math.round((monthly.quizCurrent / monthly.quizTarget) * 100);
  return `
    <div class="goal-row">
      <div>
        <p class="strong">掌握词汇 ${monthly.masteredCurrent}/${monthly.masteredTarget}</p>
        <div class="bar"><span style="width:${clamp(masteredPercent, 0, 100)}%"></span></div>
      </div>
      <div>
        <p class="strong">完成自测 ${monthly.quizCurrent}/${monthly.quizTarget}</p>
        <div class="bar"><span style="width:${clamp(quizPercent, 0, 100)}%"></span></div>
      </div>
    </div>
  `;
}

function renderHeatmapSquares() {
  const data = getHeatmapData(state, 84);
  const columns = chunk(data, 7);
  return `
    <div class="heatmap">
      ${columns.map((col) => `
        <div class="heat-col">
          ${col.map((cell) => `<span class="heat level-${cell.level}" title="${cell.key}：${cell.done}/${cell.total || 0}"></span>`).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

function renderProfile() {
  const summary7 = getTaskSummary(state, 7);
  const summary14 = getTaskSummary(state, 14);
  const streak = getStreak(state);
  const readiness = getReadinessScore(state);

  views.profile.innerHTML = `
    <section class="section-intro">
      <h2>我的进度</h2>
      <p class="muted">看趋势，不内耗。你只和昨天的自己比。</p>
    </section>

    <section class="grid three">
      <article class="card compact">
        <p class="kicker">7 天完成任务</p>
        <h3>${summary7.completed}/${summary7.total || 0}</h3>
        <p class="muted">${summary7.minutes} 分钟</p>
      </article>
      <article class="card compact">
        <p class="kicker">14 天执行率</p>
        <h3>${summary14.total ? Math.round((summary14.completed / summary14.total) * 100) : 0}%</h3>
        <p class="muted">用于估算当前状态</p>
      </article>
      <article class="card compact">
        <p class="kicker">连续打卡</p>
        <h3>${streak} 天</h3>
        <p class="muted">预计状态 ${readiness}/100</p>
      </article>
    </section>

    <section class="card top-gap">
      <div class="section-head">
        <h3>学习热力图</h3>
        <span class="pill">最近 12 周</span>
      </div>
      <p class="muted">颜色越深，说明当天完成度越高。哪怕只做了 1 件事，也比空白强。</p>
      ${renderHeatmapSquares()}
    </section>

    <section class="grid two top-gap">
      <article class="card">
        <div class="section-head">
          <h3>个人设置</h3>
          <span class="pill">本地保存</span>
        </div>
        <label class="stack">
          <span>考试日期</span>
          <input id="examDateInput" type="date" value="${state.settings.examDate}" />
        </label>
        <label class="stack">
          <span>每天计划学习分钟数</span>
          <input id="dailyMinutesInput" type="number" min="20" max="240" step="5" value="${state.settings.dailyMinutes}" />
        </label>
        <label class="stack">
          <span>目标分数</span>
          <input id="targetScoreInput" type="number" min="425" max="710" step="5" value="${state.settings.targetScore}" />
        </label>
        <label class="stack">
          <span>界面主题</span>
          <select id="themeInput">
            <option value="system" ${state.settings.theme === "system" ? "selected" : ""}>跟随系统</option>
            <option value="light" ${state.settings.theme === "light" ? "selected" : ""}>浅色</option>
            <option value="dark" ${state.settings.theme === "dark" ? "selected" : ""}>深色</option>
          </select>
        </label>
        <div class="action-row top-gap">
          <button class="primary-btn" data-action="save-settings">保存设置</button>
          <button class="ghost-btn" data-action="export-data">导出备份</button>
        </div>
        <label class="stack top-gap">
          <span>导入备份 JSON</span>
          <textarea id="importArea" rows="4" placeholder="把导出的 JSON 粘贴到这里，再点导入。"></textarea>
        </label>
        <div class="action-row top-gap">
          <button class="ghost-btn" data-action="import-data">导入数据</button>
        </div>
      </article>

      <article class="card">
        <div class="section-head">
          <h3>你的当前画像</h3>
          <span class="pill">自动定制</span>
        </div>
        <p class="muted"><strong>学习者类型：</strong>${escapeHtml(state.profile.learnerType)}</p>
        <p class="muted"><strong>优势：</strong>${state.profile.strongPoints.map(escapeHtml).join("、")}</p>
        <p class="muted"><strong>重点补：</strong>${state.profile.weakPoints.map(escapeHtml).join("、")}</p>
        <ul class="bullet-list">
          <li>现在最不该做的是：把精力分散到低频内容上。</li>
          <li>现在最该做的是：高频词 + 基础语法 + 阅读定位 + 每天短输出。</li>
          <li>保持 7 天连续学习，比一次学 5 小时更重要。</li>
        </ul>
      </article>
    </section>
  `;
}

function renderView() {
  Object.keys(views).forEach((key) => {
    views[key].classList.toggle("active", key === currentView);
  });
  if (currentView === "home") renderHome();
  if (currentView === "daily") renderDaily();
  if (currentView === "vocab") renderVocab();
  if (currentView === "practice") renderPractice();
  if (currentView === "plan") renderPlan();
  if (currentView === "profile") renderProfile();
  updateTabs();
}

function updateTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === currentView);
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1600);
}

function finalizeQuizSession() {
  if (!currentQuizSession) return;
  currentQuizSession.done = true;
  showToast(`本轮完成：${currentQuizSession.correct}/${currentQuizSession.items.length}`);
  currentQuizSession = null;
  renderPractice();
}

function handleAction(action, button) {
  const todayKey = getTodayKey();
  switch (action) {
    case "task-status":
      setTaskStatus(state, todayKey, button.dataset.task, button.dataset.status);
      renderDaily();
      renderHome();
      return;
    case "lesson-done":
      setLessonDone(state, button.dataset.lesson);
      showToast("微课已记录");
      return;
    case "save-note": {
      const text = document.getElementById("dailyNoteInput")?.value?.trim() || "";
      setDailyNote(state, todayKey, text);
      showToast("已保存复盘");
      return;
    }
    case "set-vocab-group":
      vocabGroup = button.dataset.value;
      renderVocab();
      return;
    case "set-vocab-filter":
      vocabFilter = button.dataset.value;
      renderVocab();
      return;
    case "vocab-status":
      setVocabStatus(state, button.dataset.id, button.dataset.status);
      renderVocab();
      return;
    case "set-quiz-filter":
      quizFilter = button.dataset.value;
      currentQuizSession = null;
      renderPractice();
      return;
    case "start-quiz":
      startQuiz("normal");
      return;
    case "start-wrong-quiz":
      if (state.wrongQuestionIds.length === 0) {
        showToast("你的错题本还是空的，先做一轮小测吧");
        return;
      }
      quizFilter = "wrong";
      startQuiz("wrong");
      return;
    case "quiz-answer": {
      if (!currentQuizSession) return;
      const question = currentQuizSession.items[currentQuizSession.index];
      const selected = Number(button.dataset.index);
      const correct = selected === question.answer;
      currentQuizSession.answered.push({ id: question.id, selected, correct });
      if (correct) currentQuizSession.correct += 1;
      recordQuizAnswer(state, question.id, correct);
      renderPractice();
      return;
    }
    case "quiz-next":
      if (!currentQuizSession) return;
      if (currentQuizSession.index === currentQuizSession.items.length - 1) {
        finalizeQuizSession();
      } else {
        currentQuizSession.index += 1;
        renderPractice();
      }
      return;
    case "correction-result":
      setCorrectionResult(state, button.dataset.id, button.dataset.result);
      showToast(button.dataset.result === "mastered" ? "已记为会了" : "已加入继续复习");
      renderPractice();
      return;
    case "translation-result":
      setTranslationResult(state, button.dataset.id, button.dataset.result);
      showToast(button.dataset.result === "done" ? "很好，继续保持短输出" : "没关系，明天再来");
      renderPractice();
      return;
    case "save-settings": {
      const examDate = document.getElementById("examDateInput")?.value || "2026-06-13";
      const dailyMinutes = clamp(Number(document.getElementById("dailyMinutesInput")?.value || 90), 20, 240);
      const targetScore = clamp(Number(document.getElementById("targetScoreInput")?.value || 425), 425, 710);
      const theme = document.getElementById("themeInput")?.value || "system";
      updateSettings(state, { examDate, dailyMinutes, targetScore, theme });
      applyTheme();
      renderView();
      showToast("设置已保存");
      return;
    }
    case "export-data": {
      const raw = exportState(state);
      navigator.clipboard?.writeText(raw).then(() => {
        showToast("备份 JSON 已复制到剪贴板");
      }).catch(() => {
        const area = document.getElementById("importArea");
        if (area) area.value = raw;
        showToast("已放到下方文本框，可手动复制");
      });
      return;
    }
    case "import-data": {
      const raw = document.getElementById("importArea")?.value?.trim();
      if (!raw) {
        showToast("请先粘贴备份 JSON");
        return;
      }
      try {
        state = importState(raw);
        applyTheme();
        renderView();
        showToast("数据导入成功");
      } catch (error) {
        console.error(error);
        showToast("导入失败，请检查 JSON");
      }
      return;
    }
    case "install-pwa":
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.finally(() => {
          deferredInstallPrompt = null;
          document.getElementById("installBtn")?.classList.add("hidden");
        });
      } else {
        showToast("可用浏览器菜单里的“添加到主屏幕”");
      }
      return;
    default:
      return;
  }
}

function registerEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentView = tab.dataset.view;
      renderView();
    });
  });

  document.body.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    handleAction(target.dataset.action, target);
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    document.getElementById("installBtn")?.classList.remove("hidden");
  });

  document.getElementById("installBtn")?.addEventListener("click", () => {
    handleAction("install-pwa", document.getElementById("installBtn"));
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.warn("serviceWorker failed", error);
      });
    });
  }
}

function boot() {
  applyTheme();
  ensureTasksForDate(state, getTodayKey());
  registerEvents();
  registerServiceWorker();
  renderView();
}

boot();
